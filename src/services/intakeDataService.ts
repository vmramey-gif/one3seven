import type { User } from '@supabase/supabase-js';
import pRetry from 'p-retry';
import { supabase } from '../lib/supabaseClient';
import { buildPlaceholderOrganization } from './aiOrganizationService';
import { buildDocumentGroundedOrganization } from './documentGroundedOrganizationService';
import {
  encodeTimelineWorkerContext,
  mergeFirmReviewSummaryIntoOverview,
  mergeRecordStoryIntoOverview,
} from './timelineSourceTraceCodec';
import { extractOrgEngineFromOverview, mergeOrgEngineIntoOverview, stripOrgEngineBlock } from './intakeOrgEngineCodec';
import { polishFirmFacingProse, stripFirmFacingArtifacts } from './firmIntakeDisplay';
import {
  extractStoryFollowUpFromOverview,
  formatStoryFollowUpForDisplay,
  mergeStoryFollowUpIntoWorkerNotesBody,
} from './storyFollowUpPersistence';
import { hasStoryFollowUpContent } from '../app/constants/workerStoryIntake';
import { extractWorkerContactFromOverview } from './workerContactPersistence';
import {
  buildCommunicationFactDigest,
  buildPayRecordFactDigest,
  extractCommunicationFacts,
  extractPayRecordFacts,
  type PayRecordExtractionInput,
} from './documentFactExtractionService';
import * as notifications from './notificationService';
import {
  normalizePersistedSubmissionChannel,
  resolveFirmSubmissionTypeDisplay,
  resolveIsFirmCodeRoutedIntake,
  type FirmSubmissionTypeDisplay,
} from '../app/constants/one3sevenProduct';
import { inferInventoryCategory } from './packetChronologyIntelligence';
import { normalizeFilenameForMatching } from './filenameMatching';
import { attorneyCategoryLabel } from './packetStoryPresentation';
import type { IntakeOrganizationSections, PlaceholderOrganizationResult } from './intakeOrganizationTypes';
import { refreshSectionsReviewNotes } from './intakeOrganizationSectionsService';
import { extractEmploymentMatterTagsFromOverview } from '../app/utils/employmentMatterPersistence';
import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import { logSummarySave, logSummarySaveError, logGeneratedSummaryPreview, logSupabaseWriteResult, measurePayload, safeTrim, trimAssemblyValue } from './summarySaveDiagnostics';
import { logOrgAudit, logOrgAuditBoundary, logOrgAuditError } from './organizationAudit';
import {
  buildCoreSummaryPayload,
  buildFallbackSummaryPayload,
  payloadsEquivalent,
  sanitizeStringArray,
  type SummaryRowPayload,
} from './organizationCoreSave';
import { parseWorkerIntakeMetadata } from './workerIntakeMetadata';
import { waitForWorkerSummaryRow, fetchIntakeSummaryBundle, updateIntakeWorkflowStatus, isMissingRpcError } from './firmRoutingService';
import { listUploadedFiles, listUploadedFilesResult, listCompletedExtractionsForIntake, type CompletedFileExtractionRow } from './fileUploadService';

export const INTAKE_FILES_BUCKET = 'intake-files';

/** PostgREST / Postgres when optional tables are not deployed (public beta schema). */
export function isSchemaRelationUnavailable(
  err: { message?: string; code?: string } | null | undefined
): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  const code = String(err.code ?? '');
  if (code === 'PGRST205' || code === '42P01') return true;
  if (msg.includes('schema cache') || msg.includes('could not find the table')) return true;
  if (msg.includes('does not exist') && (msg.includes('relation') || msg.includes('table'))) return true;
  return false;
}

export function betaPlaceholderBundleFromFiles(
  intakeId: string,
  files: Array<{ file_name: string; category: string | null; id?: string }>
) {
  const org = buildPlaceholderOrganization(
    files.map((f) => ({
      fileName: f.file_name,
      category: f.category ?? inferCategoryFromFileName(f.file_name),
      uploadedFileId: f.id ? String(f.id) : undefined,
    }))
  );
  const created_at = new Date().toISOString();
  let overview = mergeRecordStoryIntoOverview(
    mergeFirmReviewSummaryIntoOverview(org.overview, org.firmReviewSummary),
    org.recordStory
  );
  overview = mergeOrgEngineIntoOverview(overview, {
    version: 1,
    file_records: org.fileRecords,
    people_index: org.peopleIndex,
    generated_at: created_at,
    timeline_events: org.evidenceTimeline,
    sections: org.sections,
  });
  return {
    summary: {
      overview,
      timeline_summary: org.timelineSummary,
      readiness_indicators: org.readinessIndicators,
      missing_document_alerts: org.missingDocumentSuggestions,
    },
    events: org.timelineEvents.map((e, i) => ({
      id: `beta-${intakeId}-${i}`,
      event_date: e.eventDate,
      title: e.title,
      category: e.category,
      ai_summary: e.aiSummary,
      worker_context: encodeTimelineWorkerContext('', e.source),
      created_at,
    })),
  };
}


export type UploadedFilePersistMetaRow = {
  uploadedFileId: string;
  filePath: string;
  category?: string | null;
};

/** Worker UI: prefer stored upload category; infer from filename only when not persisted yet. */
export function resolveUploadedFileDisplayCategory(
  file: File,
  opts?: { persistedCategory?: string | null }
): string {
  const stored = (opts?.persistedCategory ?? '').trim();
  if (stored) return stored;
  return inferCategoryFromFileName(file.name);
}

/** Attorney-facing category label for worker dashboard file lists (presentation only). */
export function resolveAttorneyFacingUploadCategory(
  fileName: string,
  persistedCategory?: string | null
): string {
  const stored = (persistedCategory ?? '').trim();
  const internal = stored || inferCategoryFromFileName(fileName);
  const inferred = inferInventoryCategory(fileName, internal);
  return attorneyCategoryLabel(inferred, fileName);
}

export function inferCategoryFromFileName(fileName: string): string {
  const rawLower = fileName.toLowerCase();
  // Normalize CamelCase + separators to a SPACE-delimited canonical form so tokens like
  // "final_pay" / "written_warning" also match "FinalPay.pdf" / "WrittenWarning.pdf"
  // (which previously fell through to a weaker/wrong category). Keep a raw lowercase copy
  // for the W-2 checks, whose patterns depend on the literal hyphen.
  const name = normalizeFilenameForMatching(fileName);
  const w2ish =
    /\bw[-\s]?2\b/i.test(fileName) ||
    /(^|[^a-z0-9])w2([^a-z0-9]|$)/i.test(rawLower) ||
    rawLower.includes('w-2') ||
    name.includes('w 2');

  // Separation / termination ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â check before pay to avoid "final pay" grabbing termination letters
  if (
    name.includes('termination') ||
    name.includes('separation') ||
    name.includes('final paystub') ||
    name.includes('final pay') ||
    name.includes('last day') ||
    name.includes('letter of separation') ||
    name.includes('end of employment')
  ) {
    return 'Separation Records';
  }

  // Discipline / warnings
  if (
    name.includes('warning') ||
    name.includes('written warning') ||
    name.includes('write up') ||
    name.includes('writeup') ||
    name.includes('corrective') ||
    name.includes('disciplin') ||
    name.includes('pip') ||
    name.includes('performance improvement')
  ) {
    return 'Performance / discipline records';
  }

  // Witness / coworker statements. Guard against financial "statements" (wage/earnings/pay/bank/
  // income statements) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â those are pay records, not witness statements, and the bare "statement"
  // check used to swallow "EarningsStatement.pdf" before the pay branch below could catch it.
  const financialStatement = /\b(wage|earnings|pay|bank|income|financial|account)\b/.test(name);
  if (
    (name.includes('statement') && !financialStatement) ||
    name.includes('witness') ||
    name.includes('declaration') ||
    name.includes('affidavit') ||
    name.includes('coworker') ||
    name.includes('co worker') ||
    name.includes('colleague')
  ) {
    return 'Witness Statement';
  }

  // Meal & rest period records
  if (
    name.includes('meal') ||
    name.includes('break log') ||
    name.includes('rest period') ||
    name.includes('lunch')
  ) {
    return 'Meal & Rest Period Records';
  }

  // Schedule / shift changes
  if (
    name.includes('schedule') ||
    name.includes('shift') ||
    name.includes('roster') ||
    name.includes('assignment')
  ) {
    return 'Schedules';
  }

  // HR complaints / grievances
  if (
    name.includes('complaint') ||
    name.includes('grievance') ||
    name.includes('report to hr') ||
    name.includes('hr complaint') ||
    name.includes('text message')
  ) {
    return 'Workplace Communications';
  }

  // Pay records
  if (
    w2ish ||
    name.includes('wage') ||
    name.includes('payroll') ||
    name.includes('paystub') ||
    name.includes('pay stub') ||
    name.includes('earnings') ||
    /\btax\b/.test(name) ||
    name.includes('pay') ||
    name.includes('stub') ||
    name.includes('salary')
  ) {
    return 'Pay Records / Payroll';
  }

  if (name.includes('time') || name.includes('timecard') || name.includes('hours')) return 'Time Records';
  if (name.includes('email') || name.includes('slack') || name.includes('message')) return 'Workplace Communications';
  if (name.includes('offer')) return 'Offer Letters';
  if (name.includes('pto') || name.includes('vacation')) return 'PTO Records';
  if (name.includes('policy') || name.includes('handbook') || name.includes('hr')) return 'HR Documents';
  if (name.includes('expense') || name.includes('reimburse')) return 'Reimbursement Records';
  if (name.includes('review') || name.includes('performance')) return 'Performance Reviews';
  return 'Uncategorized';
}

/** Strong title cues ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â used only when deciding whether a rename may change stored category. */
function fileNameHasStrongCategorySignal(fileName: string, category: string): boolean {
  // Space-normalized (CamelCase split, separators collapsed) so the \s-based patterns below
  // match "OfferLetter.pdf" / "PerformanceReview.pdf" as well as "offer_letter" / "offer letter".
  const n = normalizeFilenameForMatching(fileName);
  switch (category) {
    case 'Pay Records / Payroll':
      return /\b(pay\s*stub|paystub|payroll|paycheck|pay\s*record|final\s*pay|w[-\s]?2|wage\s+statement)\b/i.test(
        n
      );
    case 'Time Records':
      return /\b(timecard|time\s*card|timesheet|time\s*sheet)\b/i.test(n);
    case 'Workplace Communications':
      return /\b(hr\s+email|workplace\s+email|email|slack|message)\b/i.test(n);
    case 'Offer Letters':
      return /\b(offer\s+letter|offer\s+of\s+employment)\b/i.test(n);
    case 'PTO Records':
      return /\b(pto|paid\s+time\s+off|vacation\s+request)\b/i.test(n);
    case 'HR Documents':
      return /\b(handbook|hr\s+document|policy|human\s+resources)\b/i.test(n);
    case 'Reimbursement Records':
      return /\b(reimbursement|expense\s+report)\b/i.test(n);
    case 'Performance Reviews':
      return /\b(performance\s+review|discipline|write[\s-]?up)\b/i.test(n);
    default:
      return false;
  }
}

/**
 * Keep stored category stable on custom renames; allow upgrades from Uncategorized
 * and explicit attorney-friendly title patterns (e.g. accepted suggestions).
 */
export function resolveCategoryAfterFileRename(
  previousCategory: string | null | undefined,
  nextFileName: string
): string {
  const prior = (previousCategory ?? '').trim() || 'Uncategorized';
  const inferred = inferCategoryFromFileName(nextFileName);
  if (prior === 'Uncategorized') return inferred;
  if (inferred === 'Uncategorized') return prior;
  if (inferred === prior) return prior;
  if (fileNameHasStrongCategorySignal(nextFileName, inferred)) return inferred;
  return prior;
}

export function generateIntakeNumber(): string {
  return `O3S-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function generateFirmCode(seed?: string | null): string {
  const prefixSource = (seed ?? '')
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
  const prefix = (prefixSource || 'O3S').padEnd(3, 'X').slice(0, 3);
  const number = 10100 + Math.floor(Math.random() * 89900);
  return `${prefix}${number}`;
}


/**
 * Embedded worker intake notes inside `intake_summaries.overview` (no new rows).
 * Newline-tolerant on both edges (`\n?`) â€” the stored overview is trimmed by safeTrim on
 * save, so a strict leading/trailing `\n` requirement made the block unreadable after a
 * rebuild and the notes were silently dropped on the next one.
 */
export const WORKER_INTAKE_NOTES_PATTERN =
  /\n?---\s*O3S_WORKER_INTAKE_NOTES\s*---\n([\s\S]*?)\n---\s*O3S_WORKER_INTAKE_NOTES_END\s*---\n?/;

export const GUIDED_INTAKE_BLOCK_PATTERN =
  /--- O3S_GUIDED_INTAKE ---\n([\s\S]*?)\n--- O3S_GUIDED_INTAKE_END ---/;

export const WORKER_STORY_BLOCK_PATTERN =
  /--- O3S_WORKER_STORY ---\n([\s\S]*?)\n--- O3S_WORKER_STORY_END ---/;

export const STORY_FOLLOWUP_BLOCK_PATTERN =
  /--- O3S_STORY_FOLLOWUP ---\n([\s\S]*?)\n--- O3S_STORY_FOLLOWUP_END ---/;

export const CATEGORY_SCAFFOLD_BLOCK_PATTERN =
  /--- O3S_CATEGORY_SCAFFOLD ---\n([\s\S]*?)\n--- O3S_CATEGORY_SCAFFOLD_END ---/;

export const FIRM_INTERNAL_MARKERS_PATTERN =
  /---\s*O3S_WORKER_INTAKE_NOTES\s*---[\s\S]*?---\s*O3S_WORKER_INTAKE_NOTES_END\s*---/gi;

export const FIRM_DOCUMENT_REQUEST_PATTERN =
  /\n--- O3S_FIRM_DOCUMENT_REQUEST ---\n([\s\S]*?)\n--- O3S_FIRM_DOCUMENT_REQUEST_END ---\n/;

export const WORKER_DOCUMENT_RESPONSE_PATTERN =
  /\n--- O3S_WORKER_DOCUMENT_RESPONSE ---\n([\s\S]*?)\n--- O3S_WORKER_DOCUMENT_RESPONSE_END ---\n/;

/**
 * Worker contact (name/phone) copied into the firm-readable summary at share time.
 * Surfaced to the firm via the extracted `workerContact`, never as raw prose â€” so it
 * is stripped from all firm- and worker-facing display text by sanitizeFirmFacingText.
 */
export const WORKER_CONTACT_PATTERN =
  /\n?---\s*O3S_WORKER_CONTACT\s*---[\s\S]*?---\s*O3S_WORKER_CONTACT_END\s*---\n?/gi;

/** MVP firm â†’ worker document request categories (checkbox labels). */
export const FIRM_ADDITIONAL_DOCUMENT_CATEGORIES = [
  'Pay records / paystubs',
  'Time records / timecards',
  'Schedules',
  'Offer letter / contract',
  'Handbook / policies',
  'HR or workplace messages',
  'Termination / final pay records',
  'Reimbursement records',
  'Performance / discipline records',
  'Other',
] as const;

export type FirmDocumentRequestPayload = {
  categories: string[];
  note: string;
};

export type WorkerDocumentResponsePayload = {
  fulfilled: string[];
  note: string;
};

export function extractFirmDocumentRequestFromOverview(
  overview: string | null | undefined
): FirmDocumentRequestPayload | null {
  const m = (overview ?? '').match(FIRM_DOCUMENT_REQUEST_PATTERN);
  if (!m?.[1]) return null;
  const body = m[1];
  const catLine = body.match(/^categories:(.*)$/m)?.[1]?.trim() ?? '';
  const note = body.match(/^note:(.*)$/m)?.[1]?.trim() ?? '';
  const categories = catLine
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (!categories.length && !note) return null;
  return { categories, note };
}

export function stripFirmDocumentRequestBlock(overview: string): string {
  return overview.replace(FIRM_DOCUMENT_REQUEST_PATTERN, '');
}

export function stripWorkerDocumentResponseBlock(overview: string): string {
  return overview.replace(WORKER_DOCUMENT_RESPONSE_PATTERN, '');
}

export function extractWorkerDocumentResponseFromOverview(
  overview: string | null | undefined
): WorkerDocumentResponsePayload | null {
  const m = (overview ?? '').match(WORKER_DOCUMENT_RESPONSE_PATTERN);
  if (!m?.[1]) return null;
  const body = m[1];
  const fulfilledLine = body.match(/^fulfilled:(.*)$/m)?.[1]?.trim() ?? '';
  const note = body.match(/^note:(.*)$/m)?.[1]?.trim() ?? '';
  const fulfilled = fulfilledLine
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (!fulfilled.length && !note) return null;
  return { fulfilled, note };
}

export function resolveWorkerDocumentResponse(
  overview: string | undefined,
  missing: string[] | undefined
): WorkerDocumentResponsePayload | null {
  const fromOverview = extractWorkerDocumentResponseFromOverview(overview);
  if (fromOverview && (fromOverview.fulfilled.length > 0 || fromOverview.note)) {
    return fromOverview;
  }

  const fulfilled: string[] = [];
  let note = '';
  for (const line of missing ?? []) {
    const t = line.trim();
    if (t.startsWith('Worker fulfilled:')) {
      fulfilled.push(t.slice('Worker fulfilled:'.length).trim());
    } else if (t.startsWith('Worker note to firm:')) {
      note = t.slice('Worker note to firm:'.length).trim();
    }
  }
  if (fulfilled.length > 0 || note) {
    return { fulfilled, note };
  }
  return null;
}

function buildWorkerDocumentResponseBlock(fulfilled: string[], note: string): string {
  const cats = fulfilled.map((c) => c.trim()).filter(Boolean);
  if (!cats.length && !note.trim()) return '';
  const noteLine = note.trim().replace(/\n/g, ' ');
  return (
    `\n--- O3S_WORKER_DOCUMENT_RESPONSE ---\n` +
    `fulfilled:${cats.join('|')}\n` +
    `note:${noteLine}\n` +
    `--- O3S_WORKER_DOCUMENT_RESPONSE_END ---\n`
  );
}

/** Remove internal worker-note markers and stray O3S blocks from attorney-facing copy. */
export function sanitizeFirmFacingText(text: string | null | undefined): string {
  return polishFirmFacingProse(
    stripOrgEngineBlock(
      stripFirmFacingArtifacts(
        (text ?? '')
          .replace(FIRM_INTERNAL_MARKERS_PATTERN, '')
          .replace(FIRM_DOCUMENT_REQUEST_PATTERN, '')
          .replace(WORKER_DOCUMENT_RESPONSE_PATTERN, '')
          .replace(WORKER_CONTACT_PATTERN, '')
      )
    )
  );
}

export function stripWorkerIntakeNotesBlock(overview: string): string {
  return sanitizeFirmFacingText(
    stripWorkerDocumentResponseBlock(stripFirmDocumentRequestBlock(overview.replace(WORKER_INTAKE_NOTES_PATTERN, '')))
  );
}

/**
 * Storage-path strip: removes ONLY the worker-notes block. Never use the sanitizing
 * `stripWorkerIntakeNotesBlock` on text that is written back to `intake_summaries.overview` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â
 * sanitizeFirmFacingText is a display polish that deletes every embedded O3S_ sidecar block
 * (worker contact, org engine, mitigation log, ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦) from whatever it touches.
 */
export function stripWorkerIntakeNotesBlockForStorage(overview: string): string {
  return overview.replace(WORKER_INTAKE_NOTES_PATTERN, '\n');
}

export function extractWorkerIntakeNotesFromOverview(overview: string | null | undefined): string {
  const m = (overview ?? '').match(WORKER_INTAKE_NOTES_PATTERN);
  return m?.[1]?.trim() ?? '';
}

export type ParsedWorkerIntakeNotes = {
  guidedSummary: string | null;
  workerStory: string | null;
  additionalNotes: string | null;
  /** Raw body of the O3S_STORY_FOLLOWUP block, carried through rebuilds so notes edits never drop it. */
  storyFollowUp?: string | null;
  /** Raw body of the O3S_CATEGORY_SCAFFOLD block, carried through rebuilds. */
  categoryScaffold?: string | null;
};

function stripEmbeddedWorkerNoteBlocks(notesBody: string): string {
  return notesBody
    .replace(GUIDED_INTAKE_BLOCK_PATTERN, '')
    .replace(WORKER_STORY_BLOCK_PATTERN, '')
    .replace(STORY_FOLLOWUP_BLOCK_PATTERN, '')
    .replace(CATEGORY_SCAFFOLD_BLOCK_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse worker notes embedded in overview (guided metadata, story, free-form notes). */
export function parseWorkerIntakeNotesContent(notesBody: string | null | undefined): ParsedWorkerIntakeNotes {
  const raw = (notesBody ?? '').trim();
  if (!raw) {
    return {
      guidedSummary: null,
      workerStory: null,
      additionalNotes: null,
      storyFollowUp: null,
      categoryScaffold: null,
    };
  }

  const guidedMatch = raw.match(GUIDED_INTAKE_BLOCK_PATTERN);
  const guidedSummary = guidedMatch?.[1]?.trim() || null;

  const storyFollowUp = raw.match(STORY_FOLLOWUP_BLOCK_PATTERN)?.[1]?.trim() || null;
  const categoryScaffold = raw.match(CATEGORY_SCAFFOLD_BLOCK_PATTERN)?.[1]?.trim() || null;

  const storyMatch = raw.match(WORKER_STORY_BLOCK_PATTERN);
  let workerStory = storyMatch?.[1]?.trim() || null;

  if (!workerStory && guidedMatch) {
    const afterGuided = raw.slice(guidedMatch.index! + guidedMatch[0].length).trim();
    const legacyStory = afterGuided.replace(WORKER_STORY_BLOCK_PATTERN, '').trim();
    if (legacyStory && !legacyStory.startsWith('--- O3S_')) {
      workerStory = legacyStory;
    }
  }

  let additionalNotes = stripEmbeddedWorkerNoteBlocks(raw);
  if (workerStory && additionalNotes === workerStory) {
    additionalNotes = '';
  }
  if (guidedSummary && additionalNotes.includes(guidedSummary)) {
    additionalNotes = additionalNotes.replace(guidedSummary, '').trim();
  }

  return {
    guidedSummary,
    workerStory,
    additionalNotes: additionalNotes || null,
    storyFollowUp,
    categoryScaffold,
  };
}

export function parseWorkerIntakeNotesFromOverview(
  overview: string | null | undefined
): ParsedWorkerIntakeNotes {
  return parseWorkerIntakeNotesContent(extractWorkerIntakeNotesFromOverview(overview));
}

export function extractWorkerStoryFromOverview(overview: string | null | undefined): string | null {
  return parseWorkerIntakeNotesFromOverview(overview).workerStory;
}

export function extractWorkerAdditionalNotesFromOverview(
  overview: string | null | undefined
): string | null {
  return parseWorkerIntakeNotesFromOverview(overview).additionalNotes;
}

/** Rebuild embedded worker-notes body while preserving guided + story + follow-up + scaffold blocks. */
export function rebuildWorkerIntakeNotesBody(parsed: ParsedWorkerIntakeNotes): string {
  const parts: string[] = [];
  if (parsed.guidedSummary) {
    parts.push('--- O3S_GUIDED_INTAKE ---', parsed.guidedSummary, '--- O3S_GUIDED_INTAKE_END ---');
  }
  if (parsed.workerStory) {
    parts.push('--- O3S_WORKER_STORY ---', parsed.workerStory, '--- O3S_WORKER_STORY_END ---');
  }
  if (parsed.categoryScaffold?.trim()) {
    parts.push(
      `--- O3S_CATEGORY_SCAFFOLD ---\n${parsed.categoryScaffold.trim()}\n--- O3S_CATEGORY_SCAFFOLD_END ---`
    );
  }
  if (parsed.additionalNotes?.trim()) {
    parts.push(parsed.additionalNotes.trim());
  }
  if (parsed.storyFollowUp?.trim()) {
    parts.push(
      `--- O3S_STORY_FOLLOWUP ---\n${parsed.storyFollowUp.trim()}\n--- O3S_STORY_FOLLOWUP_END ---`
    );
  }
  return parts.join('\n\n');
}

function formatWorkerProvidedContextForFirmView(parsed: ParsedWorkerIntakeNotes): string | undefined {
  const parts: string[] = [];
  if (parsed.workerStory) parts.push(parsed.workerStory);
  if (parsed.additionalNotes) parts.push(parsed.additionalNotes);
  if (parsed.guidedSummary) parts.push(parsed.guidedSummary);
  const combined = parts.join('\n\n').trim();
  return combined || undefined;
}

/** Worker free-form notes + optional per-timeline context for firm review (not legal analysis). */
export function resolveWorkerProvidedContextForFirmView(
  overviewRaw: string | null | undefined,
  timelineWorkerContexts: string[],
  options?: { includeTimelineContext?: boolean; previewOnly?: boolean }
): string | undefined {
  // PRIVACY GATE (worker dashboard promise, one3sevenProduct.ts: "Firms do not see yet: your full
  // file contents, personal narrative, or private notesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âunless you approve expanded review
  // access"): a preview-only (pre-approval) firm receives NO worker-provided narrative at all ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â
  // no story, no additional notes, no guided summary, no follow-up narrative, no timeline
  // context. Gated here, at the source, so every consumer of the firm view model is protected.
  if (options?.previewOnly) return undefined;
  const parsed = parseWorkerIntakeNotesFromOverview(overviewRaw);
  const structured = formatWorkerProvidedContextForFirmView(parsed);
  const followUp = extractStoryFollowUpFromOverview(overviewRaw);
  const followUpText = followUp ? formatStoryFollowUpForDisplay(followUp) : '';
  const includeTimeline = options?.includeTimelineContext !== false;
  const timeline = includeTimeline
    ? timelineWorkerContexts
        .map((c) => c.trim())
        .filter(Boolean)
        .join('\n\n')
    : '';
  const parts = [structured, followUpText, timeline].filter(Boolean);
  if (!parts.length) return undefined;
  const combined = parts.join('\n\n');
  return polishFirmFacingProse(combined) || undefined;
}

/**
 * Preview-only strip for the structured worker follow-up: the free-text NARRATIVE answers
 * (what happened when they complained, what changed afterward, remote-expense description,
 * prior-filing details, and any named individuals ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â a treating physician, a manager, anyone the
 * worker named) are part of the worker's personal narrative and are withheld until the worker
 * approves expanded access. The identity/scheduling facts the preview surface already shows
 * (employment name, employer, dates, status, arbitration/agency flags, work state) are kept so
 * the preview card and preview PDF cover keep working.
 */
export function stripWorkerFollowUpNarrativeForPreview(
  followUp: import('../app/constants/workerStoryIntake').StoryFollowUpAnswers | null
): import('../app/constants/workerStoryIntake').StoryFollowUpAnswers | null {
  if (!followUp) return followUp;
  return {
    ...followUp,
    complainedOrReported: '',
    changedAfterward: '',
    remoteExpenses: '',
    priorAgencyFilingDetails: '',
    keyPeople: '',
  };
}

export function mergeWorkerIntakeNotesIntoOverview(
  overview: string | null | undefined,
  notes: string
): string {
  const base = stripWorkerIntakeNotesBlockForStorage(overview ?? '').replace(/\s+$/u, '');
  const t = safeTrim(notes, 'mergeWorkerIntakeNotesIntoOverview.notes');
  if (!t) return base;
  return `${base}\n--- O3S_WORKER_INTAKE_NOTES ---\n${t}\n--- O3S_WORKER_INTAKE_NOTES_END ---\n`;
}

/**
 * Sidecar O3S blocks stored in `intake_summaries.overview` but owned by other feature
 * codecs (contact share, category, employment matter, mitigation log, reminders, records
 * requests). A rebuild regenerates the narrative from scratch, so any sidecar block the
 * rebuilt overview lost is copied forward verbatim from the previous stored overview.
 */
const OVERVIEW_SIDECAR_BLOCK_NAMES = [
  'O3S_WORKER_CONTACT',
  'O3S_CASE_CATEGORY',
  'O3S_EMPLOYMENT_MATTER',
  'O3S_MITIGATION_LOG',
  'O3S_WORKER_REMINDERS',
  'O3S_RECORDS_REQUEST_LOG',
] as const;

function overviewSidecarBlockPattern(name: string): RegExp {
  return new RegExp(`\\n?---\\s*${name}\\s*---\\n[\\s\\S]*?\\n---\\s*${name}_END\\s*---\\n?`);
}

export function preserveOverviewSidecarBlocks(
  previousOverview: string | null | undefined,
  nextOverview: string
): string {
  const previous = previousOverview ?? '';
  if (!previous) return nextOverview;
  let out = nextOverview;
  for (const name of OVERVIEW_SIDECAR_BLOCK_NAMES) {
    const pattern = overviewSidecarBlockPattern(name);
    if (pattern.test(out)) continue;
    const match = previous.match(pattern);
    if (!match) continue;
    const block = match[0].replace(/^\n+/u, '').replace(/\n+$/u, '');
    out = `${out.replace(/\s+$/u, '')}\n${block}\n`;
  }
  return out;
}

function extractFirmDocumentRequestBlockFromOverview(overview: string | null | undefined): string {
  const m = (overview ?? '').match(FIRM_DOCUMENT_REQUEST_PATTERN);
  return m?.[0] ?? '';
}

function extractFirmDocumentRequestAlertLines(alerts: string[] | null | undefined): string[] {
  return (alerts ?? []).filter((line, index) => {
    const t = safeTrim(line, `extractFirmDocumentRequestAlertLines[${index}]`);
    return t.startsWith('Firm requested:') || t.startsWith('Firm note:');
  });
}

function extractWorkerDocumentResponseBlockFromOverview(overview: string | null | undefined): string {
  const m = (overview ?? '').match(WORKER_DOCUMENT_RESPONSE_PATTERN);
  return m?.[0] ?? '';
}

function extractWorkerDocumentResponseAlertLines(alerts: string[] | null | undefined): string[] {
  return (alerts ?? []).filter((line, index) => {
    const t = safeTrim(line, `extractWorkerDocumentResponseAlertLines[${index}]`);
    return t.startsWith('Worker fulfilled:') || t.startsWith('Worker note to firm:');
  });
}

function mergeFirmDocumentRequestBlockIntoOverview(overview: string, block: string): string {
  if (
    !trimAssemblyValue(block, {
      file: 'intakeDataService.ts',
      line: 1485,
      variable: 'mergeFirmDocumentRequestBlockIntoOverview.block',
    })
  ) {
    return overview;
  }
  const base = overview.replace(FIRM_DOCUMENT_REQUEST_PATTERN, '').replace(/\s+$/u, '');
  return `${base}${block}`;
}

function mergeMissingDocumentAlertsPreservingRequestContext(
  rebuilt: string[],
  firmLines: string[],
  workerResponseLines: string[]
): string[] {
  const rebuiltFiltered = rebuilt.filter((line, index) => {
    const t = safeTrim(line, `missingDocumentAlerts.rebuilt[${index}]`);
    return (
      !t.startsWith('Firm requested:') &&
      !t.startsWith('Firm note:') &&
      !t.startsWith('Worker fulfilled:') &&
      !t.startsWith('Worker note to firm:')
    );
  });
  const seen = new Set<string>();
  const out: string[] = [];
  const merged = [...firmLines, ...workerResponseLines, ...rebuiltFiltered];
  for (let index = 0; index < merged.length; index += 1) {
    const line = merged[index];
    const key = safeTrim(line, `missingDocumentAlerts.merged[${index}]`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(typeof line === 'string' ? line : key);
  }
  return out;
}

function resolveWorkflowStatusAfterReorganization(
  priorWorkflow: string | null | undefined,
  hasFirmDocRequest: boolean
): string {
  const prior = trimAssemblyValue(priorWorkflow, {
    file: 'intakeDataService.ts',
    line: 1529,
    variable: 'resolveWorkflowStatusAfterReorganization.priorWorkflow',
  });
  if (prior === 'Additional Documents Requested') return 'Additional Documents Requested';
  if (
    prior === 'Worker Uploaded Additional Documents' ||
    prior === 'Worker Uploaded Requested Documents'
  ) {
    return prior;
  }
  if (hasFirmDocRequest && prior) return prior;
  return 'Intake Summary Generated';
}

/** Read persisted worker document-request response + workflow (no local/optimistic state). */
export async function getPersistedWorkerDocumentRequestState(intakeId: string): Promise<{
  workflowStatus: string;
  response: WorkerDocumentResponsePayload | null;
}> {
  const bundle = await fetchIntakeSummaryBundle(intakeId);
  const workflowStatus =
    ((bundle.intake as { workflow_status?: string } | null)?.workflow_status ?? '').trim();
  const summary = bundle.summary as {
    overview?: string;
    missing_document_alerts?: string[];
  } | null;
  const response = resolveWorkerDocumentResponse(
    summary?.overview,
    summary?.missing_document_alerts ?? []
  );
  return { workflowStatus, response };
}

export function isWorkerDocumentRequestResponseComplete(
  workflowStatus: string,
  response: WorkerDocumentResponsePayload | null
): boolean {
  const status = workflowStatus.trim();
  const uploadedAdditional =
    status === 'Worker Uploaded Additional Documents' ||
    status === 'Worker Uploaded Requested Documents';
  return uploadedAdditional && Boolean(response && response.fulfilled.length > 0);
}

async function notifyFirmWorkerDocumentsSubmitted(
  intakeId: string,
  routeId?: string | null
): Promise<{ notified: boolean; warning?: string }> {
  const { data, error } = await supabase.rpc('worker_notify_firm_documents_submitted', {
    p_intake_id: intakeId,
    p_route_id: routeId ?? null,
  });
  if (error) {
    if (isMissingRpcError(error)) {
      return {
        notified: false,
        warning:
          'Firm notification RPC is not deployed yet (worker_notify_firm_documents_submitted migration).',
      };
    }
    return { notified: false, warning: error.message };
  }
  const notified = data === true;
  return {
    notified,
    warning: notified ? undefined : 'No firm route or firm user found for this intake.',
  };
}

/** Worker confirms which requested categories new uploads satisfy; advances workflow for firm review. */
export async function confirmWorkerDocumentRequestResponse(
  intakeId: string,
  payload: { fulfilledCategories: string[]; noteToFirm: string }
): Promise<{ error?: string }> {
  const fulfilled = payload.fulfilledCategories.map((c) => c.trim()).filter(Boolean);
  if (!fulfilled.length) {
    return { error: 'Select at least one category you are sending back to the firm.' };
  }

  const { data: row, error } = await supabase
    .from('intake_summaries')
    .select('id, overview, missing_document_alerts')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: 'No intake summary exists yet for this intake.' };

  const overview = (row.overview as string | null) ?? '';
  const alerts = (row.missing_document_alerts as string[] | null) ?? [];
  const originalOverview = overview;
  const originalAlerts = [...alerts];
  const firmBlock = extractFirmDocumentRequestBlockFromOverview(overview);
  const firmAlerts = extractFirmDocumentRequestAlertLines(alerts);
  const otherAlerts = alerts.filter((line) => {
    const t = line.trim();
    return (
      !t.startsWith('Firm requested:') &&
      !t.startsWith('Firm note:') &&
      !t.startsWith('Worker fulfilled:') &&
      !t.startsWith('Worker note to firm:')
    );
  });

  const workerBlock = buildWorkerDocumentResponseBlock(fulfilled, payload.noteToFirm);
  const baseOverview = stripWorkerDocumentResponseBlock(stripFirmDocumentRequestBlock(overview)).replace(/\s+$/u, '');
  let nextOverview = baseOverview;
  if (firmBlock) nextOverview = mergeFirmDocumentRequestBlockIntoOverview(nextOverview, firmBlock);
  if (workerBlock) nextOverview = `${nextOverview.replace(/\s+$/u, '')}${workerBlock}`;

  const workerAlerts: string[] = fulfilled.map((c) => `Worker fulfilled: ${c}`);
  const noteTrimmed = payload.noteToFirm.trim();
  if (noteTrimmed) workerAlerts.push(`Worker note to firm: ${noteTrimmed}`);

  const nextAlerts = [...firmAlerts, ...workerAlerts, ...otherAlerts];

  const rollbackSummary = async () => {
    await supabase
      .from('intake_summaries')
      .update({
        overview: originalOverview,
        missing_document_alerts: originalAlerts,
      })
      .eq('id', row.id as string);
  };

  const { error: se } = await supabase
    .from('intake_summaries')
    .update({
      overview: nextOverview,
      missing_document_alerts: nextAlerts,
    })
    .eq('id', row.id as string);
  if (se) return { error: se.message };

  const wf = await updateIntakeWorkflowStatus(intakeId, 'Worker Uploaded Requested Documents');
  if (wf.error) {
    await rollbackSummary();
    return { error: wf.error };
  }

  const persisted = await getPersistedWorkerDocumentRequestState(intakeId);
  if (!isWorkerDocumentRequestResponseComplete(persisted.workflowStatus, persisted.response)) {
    await updateIntakeWorkflowStatus(intakeId, 'Additional Documents Requested');
    await rollbackSummary();
    return {
      error:
        'Your response did not save completely. Check your connection and confirm again.',
    };
  }

  const notifyResult = await notifyFirmWorkerDocumentsSubmitted(intakeId);
  if (!notifyResult.notified) {
    console.warn('[o3s-notifications] firm not notified after worker document response', {
      intakeId,
      warning: notifyResult.warning,
    });
  }

  return {};
}

/** Replace worker intake notes on the latest summary row for this intake (updates same row only). */
export async function setWorkerIntakeNotesInLatestIntakeSummary(
  intakeId: string,
  notes: string
): Promise<{ error?: string }> {
  const { data: row, error } = await supabase
    .from('intake_summaries')
    .select('id, overview')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: 'No intake summary exists yet for this intake.' };
  const overview = (row.overview as string | null) ?? '';
  const parsed = parseWorkerIntakeNotesFromOverview(overview);
  const body = rebuildWorkerIntakeNotesBody({
    ...parsed,
    additionalNotes: notes.trim() || null,
  });
  const next = mergeWorkerIntakeNotesIntoOverview(stripWorkerIntakeNotesBlockForStorage(overview), body);
  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}

/**
 * Merges upload-step free-form context into the latest summary's worker-notes block
 * (same markers as intake notes), prepending so upload context stays ahead of existing notes.
 */
export async function mergeUploadContextIntoLatestIntakeSummary(
  intakeId: string,
  uploadContext: string
): Promise<{ error?: string }> {
  const trimmed = uploadContext.trim();
  if (!trimmed) return {};

  const { data: row, error } = await supabase
    .from('intake_summaries')
    .select('id, overview')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: 'No intake summary exists yet for this intake.' };

  const overview = (row.overview as string | null) ?? '';
  const parsed = parseWorkerIntakeNotesFromOverview(overview);
  const priorAdditional = parsed.additionalNotes?.trim() ?? '';
  const combinedAdditional = priorAdditional ? `${trimmed}\n\n${priorAdditional}` : trimmed;
  const base = stripWorkerIntakeNotesBlockForStorage(overview).replace(/\s+$/u, '');
  const body = rebuildWorkerIntakeNotesBody({ ...parsed, additionalNotes: combinedAdditional });
  const next = mergeWorkerIntakeNotesIntoOverview(base, body);

  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}

type IntakeSummaryRowPayload = SummaryRowPayload;

/**
 * Save intake summary without deleting existing rows first.
 * Schema has no unique on intake_id, so this uses update-latest-or-insert (upsert-equivalent).
 */
async function upsertIntakeSummaryRow(
  intakeId: string,
  payload: IntakeSummaryRowPayload
): Promise<{ error?: string; stage?: string; summaryId?: string | null; operation?: 'insert' | 'update' }> {
  const { data: existingRow, error: existingErr } = await supabase
    .from('intake_summaries')
    .select('id')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingErr && !isSchemaRelationUnavailable(existingErr)) {
    logSummarySaveError('intake_summaries preload for save', existingErr, {
      intakeId,
      code: existingErr.code,
      message: existingErr.message,
      details: existingErr.details,
      hint: existingErr.hint,
    });
    return { error: existingErr.message, stage: 'intake_summaries_preload_for_save' };
  }

  if (isSchemaRelationUnavailable(existingErr)) {
    return { error: 'intake_summaries table unavailable', stage: 'intake_summaries_schema_unavailable' };
  }

  if (existingRow?.id) {
    const summaryId = String(existingRow.id);
    const { data: updated, error: updateErr } = await supabase
      .from('intake_summaries')
      .update(payload)
      .eq('id', summaryId)
      .select('id')
      .single();

    logSupabaseWriteResult('intake_summaries', 'update', {
      intakeId,
      summaryId: updated?.id ?? summaryId,
      operation: 'update',
      error: updateErr
        ? {
            message: updateErr.message,
            code: updateErr.code,
            details: updateErr.details,
            hint: updateErr.hint,
          }
        : null,
      ...measurePayload('overview', payload.overview),
      readinessIndicatorCount: payload.readiness_indicators.length,
      missingAlertCount: payload.missing_document_alerts.length,
    });

    if (updateErr && !isSchemaRelationUnavailable(updateErr)) {
      logSummarySaveError('intake_summaries save', updateErr, {
        intakeId,
        operation: 'update',
        summaryId,
        code: updateErr.code,
        message: updateErr.message,
        details: updateErr.details,
        hint: updateErr.hint,
        ...measurePayload('overview', payload.overview),
      });
      return { error: updateErr.message, stage: 'intake_summaries_update' };
    }

    return { summaryId: String(updated?.id ?? summaryId), operation: 'update' };
  }

  const insertPayload = { intake_id: intakeId, ...payload };
  const { data: inserted, error: insertErr } = await supabase
    .from('intake_summaries')
    .insert(insertPayload)
    .select('id')
    .single();

  logSupabaseWriteResult('intake_summaries', 'insert', {
    intakeId,
    summaryId: inserted?.id ?? null,
    operation: 'insert',
    error: insertErr
      ? {
          message: insertErr.message,
          code: insertErr.code,
          details: insertErr.details,
          hint: insertErr.hint,
        }
      : null,
    ...measurePayload('overview', payload.overview),
    readinessIndicatorCount: payload.readiness_indicators.length,
    missingAlertCount: payload.missing_document_alerts.length,
  });

  if (insertErr && !isSchemaRelationUnavailable(insertErr)) {
    logSummarySaveError('intake_summaries save', insertErr, {
      intakeId,
      operation: 'insert',
      code: insertErr.code,
      message: insertErr.message,
      details: insertErr.details,
      hint: insertErr.hint,
      ...measurePayload('overview', payload.overview),
    });
    return { error: insertErr.message, stage: 'intake_summaries_insert' };
  }

  return { summaryId: inserted?.id ? String(inserted.id) : null, operation: 'insert' };
}

function completedExtractionRowToFactInput(row: CompletedFileExtractionRow): PayRecordExtractionInput {
  return {
    uploaded_file_id: row.uploaded_file_id,
    file_name: row.uploaded_files?.file_name ?? 'Uploaded file',
    category: row.uploaded_files?.category ?? null,
    extracted_text: row.extracted_text,
  };
}

function runAssemblyStep<T>(step: string, intakeId: string, fn: () => T): T {
  logSummarySave(`assembly step: ${step} start`, { intakeId });
  logOrgAudit(`assembly step start: ${step}`, { intakeId, activeStep: step });
  try {
    const result = fn();
    logSummarySave(`assembly step: ${step} done`, { intakeId });
    logOrgAuditBoundary(intakeId, { step: `assembly:${step}`, success: true });
    return result;
  } catch (error) {
    logSummarySaveError(`assembly step: ${step}`, error, { intakeId });
    logOrgAuditError(`assembly step failed: ${step}`, error, { intakeId, activeStep: step });
    throw error;
  }
}

type EnrichedAssemblyResult = {
  payload: SummaryRowPayload;
  workflowStatus: string;
};

function assembleEnrichedSummaryPayload(input: {
  intakeId: string;
  org: PlaceholderOrganizationResult;
  extractionRows: CompletedFileExtractionRow[];
  previousOverview: string;
  preservedWorkerNotes: string;
  preservedFirmRequestBlock: string;
  preservedFirmRequestAlerts: string[];
  preservedWorkerResponseBlock: string;
  preservedWorkerResponseAlerts: string[];
  priorWorkflow: string | null | undefined;
  hasFirmDocRequest: boolean;
}): EnrichedAssemblyResult {
  const {
    intakeId,
    org,
    extractionRows,
    previousOverview,
    preservedWorkerNotes,
    preservedFirmRequestBlock,
    preservedFirmRequestAlerts,
    preservedWorkerResponseBlock,
    preservedWorkerResponseAlerts,
    priorWorkflow,
    hasFirmDocRequest,
  } = input;

  const payFacts = runAssemblyStep('extract pay/comm facts', intakeId, () =>
    extractionRows
      .map((row) => extractPayRecordFacts(completedExtractionRowToFactInput(row)))
      .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact))
  );
  const commFacts = runAssemblyStep('extract communication facts', intakeId, () =>
    extractionRows
      .map((row) => extractCommunicationFacts(completedExtractionRowToFactInput(row)))
      .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact))
  );

  const payDigest = runAssemblyStep('buildPayRecordFactDigest', intakeId, () =>
    buildPayRecordFactDigest(payFacts)
  );
  const commDigest = runAssemblyStep('buildCommunicationFactDigest', intakeId, () =>
    buildCommunicationFactDigest(commFacts)
  );

  const readinessIndicators = runAssemblyStep('readinessIndicators merge', intakeId, () =>
    Array.from(
      new Set(
        [
          ...payDigest,
          ...commDigest,
          ...sanitizeStringArray(org.readinessIndicators, 'org.readinessIndicators'),
        ].filter((line, index) => safeTrim(line, `readinessIndicators[${index}]`).length > 0)
      )
    )
  );

  const sectionsToStore = runAssemblyStep('refreshSectionsReviewNotes', intakeId, () =>
    refreshSectionsReviewNotes(org.sections, readinessIndicators, org.reviewItems)
  );

  let overviewToStore = runAssemblyStep('record/firm review merge', intakeId, () =>
    mergeRecordStoryIntoOverview(
      mergeFirmReviewSummaryIntoOverview(org.overview, org.firmReviewSummary),
      org.recordStory
    )
  );

  overviewToStore = runAssemblyStep('org engine merge', intakeId, () =>
    mergeOrgEngineIntoOverview(overviewToStore, {
      version: 1,
      file_records: org.fileRecords,
      people_index: org.peopleIndex,
      generated_at: new Date().toISOString(),
      timeline_events: org.evidenceTimeline,
      sections: sectionsToStore,
    })
  );

  if (preservedWorkerNotes) {
    overviewToStore = runAssemblyStep('worker notes merge', intakeId, () =>
      mergeWorkerIntakeNotesIntoOverview(
        overviewToStore,
        safeTrim(preservedWorkerNotes, 'preservedWorkerNotes')
      )
    );
  }

  if (preservedFirmRequestBlock) {
    overviewToStore = runAssemblyStep('firm request block merge', intakeId, () =>
      mergeFirmDocumentRequestBlockIntoOverview(overviewToStore, preservedFirmRequestBlock)
    );
  }

  if (preservedWorkerResponseBlock) {
    overviewToStore = runAssemblyStep('worker response block merge', intakeId, () =>
      `${overviewToStore.replace(/\s+$/u, '')}${preservedWorkerResponseBlock}`
    );
  }

  overviewToStore = runAssemblyStep('sidecar block preservation', intakeId, () =>
    preserveOverviewSidecarBlocks(previousOverview, overviewToStore)
  );

  const missingAlertsToStore = runAssemblyStep('missing alerts merge', intakeId, () =>
    mergeMissingDocumentAlertsPreservingRequestContext(
      sanitizeStringArray(org.missingDocumentSuggestions, 'org.missingDocumentSuggestions'),
      preservedFirmRequestAlerts,
      preservedWorkerResponseAlerts
    )
  );

  const workflowStatusToStore = runAssemblyStep('workflow status resolve', intakeId, () =>
    resolveWorkflowStatusAfterReorganization(priorWorkflow, hasFirmDocRequest)
  );

  return {
    payload: {
      overview: safeTrim(overviewToStore, 'enriched.overview') || buildCoreSummaryPayload(org).overview,
      timeline_summary:
        safeTrim(org.timelineSummary, 'enriched.timelineSummary') ||
        buildCoreSummaryPayload(org).timeline_summary,
      readiness_indicators: readinessIndicators,
      missing_document_alerts: missingAlertsToStore,
    },
    workflowStatus: workflowStatusToStore,
  };
}

async function saveTimelineEventsForIntake(
  intakeId: string,
  timelineEvents: PlaceholderOrganizationResult['timelineEvents']
): Promise<{ error?: string; stage?: string }> {
  const delTe = await supabase.from('timeline_events').delete().eq('intake_id', intakeId);
  logSupabaseWriteResult('timeline_events', 'delete', {
    intakeId,
    error: delTe.error ? { message: delTe.error.message, code: delTe.error.code } : null,
    schemaUnavailable: isSchemaRelationUnavailable(delTe.error),
  });
  if (isSchemaRelationUnavailable(delTe.error)) {
    return { stage: 'timeline_events_schema_unavailable' };
  }
  if (delTe.error) {
    logSummarySaveError('timeline_events delete', delTe.error, { intakeId, code: delTe.error.code });
    return { error: delTe.error.message, stage: 'timeline_events_delete' };
  }

  if (!timelineEvents.length) {
    return {};
  }

  const { error: te } = await supabase.from('timeline_events').insert(
    timelineEvents.map((e) => ({
      intake_id: intakeId,
      event_date: safeTrim(e.eventDate, 'timeline.eventDate') || null,
      title: safeTrim(e.title, 'timeline.title') || 'Timeline event',
      category: safeTrim(e.category, 'timeline.category') || 'Uncategorized',
      ai_summary: safeTrim(e.aiSummary, 'timeline.aiSummary') || '',
      worker_context: encodeTimelineWorkerContext('', e.source ?? {
        sourceFileIds: [],
        sourceFileNames: [],
        sourceDocumentTypes: [],
        sourceDates: [],
        sourceStrength: 'needs_review',
      }),
    }))
  );
  logSupabaseWriteResult('timeline_events', 'insert', {
    intakeId,
    rowCount: timelineEvents.length,
    error: te ? { message: te.message, code: te.code, details: te.details, hint: te.hint } : null,
  });
  if (te && !isSchemaRelationUnavailable(te)) {
    logSummarySaveError('timeline_events insert', te, {
      intakeId,
      code: te.code,
      rowCount: timelineEvents.length,
    });
    return { error: te.message, stage: 'timeline_events_insert' };
  }
  return {};
}

function appendUniqueWorkerContextChunk(chunks: string[], next: string): void {
  const text = next.trim();
  if (!text) return;
  const hay = chunks.join('\n\n').toLowerCase();
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const novelLines = lines.filter((line) => !hay.includes(line.toLowerCase()));
  if (!novelLines.length) return;
  if (novelLines.length === lines.length) {
    chunks.push(text);
    return;
  }
  chunks.push(novelLines.join('\n'));
}

/** Worker narrative + Story Details for document-grounded mining (never throws). */
export function buildWorkerContextForMining(
  preservedWorkerNotes: string | null | undefined,
  workerMetadataRaw: unknown
): string {
  try {
    const chunks: string[] = [];
    const notes = (preservedWorkerNotes ?? '').trim();
    if (notes) chunks.push(notes);

    const metadata = parseWorkerIntakeMetadata(workerMetadataRaw);
    appendUniqueWorkerContextChunk(chunks, metadata.workerStory?.trim() ?? '');

    if (metadata.storyFollowUp) {
      try {
        appendUniqueWorkerContextChunk(
          chunks,
          formatStoryFollowUpForDisplay(metadata.storyFollowUp)
        );
      } catch {
        /* non-fatal: continue without formatted Story Details */
      }
    }

    return chunks.join('\n\n').trim();
  } catch {
    return (preservedWorkerNotes ?? '').trim();
  }
}

export async function persistPlaceholderOrganizationForIntake(
  intakeId: string,
  opts?: { employmentMatterTags?: EmploymentMatterTagId[] }
): Promise<{ error?: string; stage?: string }> {
  const startedAt = Date.now();
  logSummarySave('organization persist start', { intakeId });

  // listUploadedFiles collapses a real read error to [] -- this function goes on to rebuild and
  // PERSIST an organization/summary from `files`, so trusting a wrongly-empty result here doesn't
  // just flicker the UI, it writes a wiped-out organization to the database (H2, worker audit
  // 2026-08, more severe instance than the original UI-only finding). Use the error-preserving
  // variant and fail the whole persist rather than silently proceeding on a transient failure.
  const filesResult = await listUploadedFilesResult(intakeId);
  if (filesResult.error) {
    logSummarySaveError('uploaded_files list', filesResult.error, { intakeId });
    return { error: 'Could not load uploaded files for this intake.', stage: 'uploaded_files_list' };
  }
  const files = filesResult.rows;
  logSummarySave('uploaded_files loaded', { intakeId, fileCount: files.length });

  logOrgAudit('persist start', {
    intakeId,
    activeStep: 'persist_start',
    uploadedFileCount: files.length,
  });

  const safeMeta = files.map((f) => ({
    uploadedFileId: String(f.id),
    fileName: String(f.file_name ?? 'Uploaded file'),
    category: f.category ?? 'Uncategorized',
  }));

  const [{ data: previousSummary, error: previousSummaryError }, { data: priorIntake, error: priorIntakeError }] =
    await Promise.all([
      supabase
        .from('intake_summaries')
        .select('overview, missing_document_alerts')
        .eq('intake_id', intakeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('intakes').select('workflow_status, worker_metadata').eq('id', intakeId).maybeSingle(),
    ]);

  if (previousSummaryError && !isSchemaRelationUnavailable(previousSummaryError)) {
    logSummarySaveError('intake_summaries preload', previousSummaryError, { intakeId, code: previousSummaryError.code });
    return { error: previousSummaryError.message, stage: 'intake_summaries_preload' };
  }
  if (priorIntakeError) {
    logSummarySaveError('intakes preload', priorIntakeError, { intakeId, code: priorIntakeError.code });
    if (priorIntakeError.message.includes('worker_metadata')) {
      logSummarySave('worker_metadata column unavailable (non-fatal)', { intakeId });
    } else {
      return { error: priorIntakeError.message, stage: 'intakes_preload' };
    }
  } else {
    logSummarySave('intakes preload ok', {
      intakeId,
      workflowStatus: priorIntake?.workflow_status ?? null,
      hasWorkerMetadata: priorIntake?.worker_metadata != null,
    });
  }

  const previousOverview = (previousSummary?.overview as string | null) ?? '';
  const previousAlerts = (previousSummary?.missing_document_alerts as string[] | null) ?? [];
  let preservedWorkerNotes = extractWorkerIntakeNotesFromOverview(previousOverview);
  // Recovery: earlier rebuilds could drop the story / follow-up blocks from the stored
  // overview. `intakes.worker_metadata` keeps the worker-owned originals ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â reconstruct.
  try {
    const recoveryMetadata = parseWorkerIntakeMetadata(priorIntake?.worker_metadata);
    const recoverStory =
      !WORKER_STORY_BLOCK_PATTERN.test(preservedWorkerNotes) &&
      Boolean(recoveryMetadata.workerStory?.trim());
    const recoverFollowUp =
      !STORY_FOLLOWUP_BLOCK_PATTERN.test(preservedWorkerNotes) &&
      hasStoryFollowUpContent(recoveryMetadata.storyFollowUp);
    if (recoverStory || recoverFollowUp) {
      const parsedNotes = parseWorkerIntakeNotesContent(preservedWorkerNotes);
      let recoveredNotes = rebuildWorkerIntakeNotesBody({
        ...parsedNotes,
        workerStory: recoverStory ? recoveryMetadata.workerStory ?? null : parsedNotes.workerStory,
      });
      if (recoverFollowUp && recoveryMetadata.storyFollowUp) {
        recoveredNotes = mergeStoryFollowUpIntoWorkerNotesBody(
          recoveredNotes,
          recoveryMetadata.storyFollowUp
        );
      }
      if (recoveredNotes.trim()) {
        preservedWorkerNotes = recoveredNotes;
        logOrgAudit('worker notes recovered from worker_metadata', {
          intakeId,
          activeStep: 'worker_notes_recovery',
          recoveredStory: recoverStory,
          recoveredFollowUp: recoverFollowUp,
        });
      }
    }
  } catch (recoveryError) {
    logOrgAuditError('worker notes recovery failed (non-fatal)', recoveryError, {
      intakeId,
      activeStep: 'worker_notes_recovery',
    });
  }
  const workerContextForMining = buildWorkerContextForMining(
    preservedWorkerNotes,
    priorIntake?.worker_metadata
  );
  const preservedFirmRequestBlock = extractFirmDocumentRequestBlockFromOverview(previousOverview);
  const preservedFirmRequestAlerts = extractFirmDocumentRequestAlertLines(previousAlerts);
  const preservedWorkerResponseBlock = extractWorkerDocumentResponseBlockFromOverview(previousOverview);
  const preservedWorkerResponseAlerts = extractWorkerDocumentResponseAlertLines(previousAlerts);
  const hasFirmDocRequest =
    preservedFirmRequestBlock.length > 0 || preservedFirmRequestAlerts.length > 0;

  const employmentMatterTags =
    opts?.employmentMatterTags?.length
      ? opts.employmentMatterTags
      : extractEmploymentMatterTagsFromOverview(previousOverview);

  const extractionRes = await listCompletedExtractionsForIntake(intakeId);
  if (extractionRes.error) {
    logSummarySaveError('file_text_extractions list', extractionRes.error, { intakeId });
  }
  logSummarySave('extractions loaded', {
    intakeId,
    completedExtractionCount: extractionRes.rows.length,
    extractionError: extractionRes.error ?? null,
  });

  logOrgAudit('extractions loaded', {
    intakeId,
    activeStep: 'extractions_loaded',
    uploadedFileCount: files.length,
    extractionCount: extractionRes.rows.length,
    extractionError: extractionRes.error ?? null,
  });

  const completedExtractions = extractionRes.rows.map((row) => ({
    uploadedFileId: row.uploaded_file_id,
    fileName: row.uploaded_files?.file_name ?? 'Uploaded file',
    category: row.uploaded_files?.category ?? null,
    extractedText: String(row.extracted_text ?? ''),
    qualityFlags: row.quality_flags,
    documentFacts: row.document_facts ?? null,
  }));

  let org: PlaceholderOrganizationResult;
  let generationUsedFallback = false;
  const generationStartedAt = Date.now();
  logOrgAudit('summary generation start', {
    intakeId,
    activeStep: 'summary_generation',
    uploadedFileCount: files.length,
    extractionCount: completedExtractions.length,
  });
  try {
    org =
      buildDocumentGroundedOrganization(safeMeta, completedExtractions, workerContextForMining, {
        employmentMatterTags,
      }) ??
      buildPlaceholderOrganization(safeMeta, { employmentMatterTags });
  } catch (generationError) {
    generationUsedFallback = true;
    logOrgAuditError('summary generation failed ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â placeholder fallback', generationError, {
      intakeId,
      activeStep: 'summary_generation',
      uploadedFileCount: files.length,
      extractionCount: completedExtractions.length,
    });
    try {
      org = buildPlaceholderOrganization(safeMeta, { employmentMatterTags });
    } catch (placeholderError) {
      logOrgAuditError('summary generation placeholder failed ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â minimal fallback', placeholderError, {
        intakeId,
        activeStep: 'summary_generation',
      });
      org = {
        recordStory: buildFallbackSummaryPayload(files.length).overview,
        firmReviewSummary: '',
        timelineSummary: buildFallbackSummaryPayload(files.length).timeline_summary,
        timelineEvents: [],
        documentCategories: [],
        readinessIndicators: [],
        missingDocumentSuggestions: [],
        overview: buildFallbackSummaryPayload(files.length).overview,
        reviewItems: [],
        fileRecords: [],
        peopleIndex: [],
        evidenceTimeline: [],
        sections: {
          executive_summary: buildFallbackSummaryPayload(files.length).overview,
          chronology: [],
          people_and_entities: [],
          supporting_records: [],
          potential_gaps: [],
          clarification_items: [],
          review_notes: [],
          disclaimer: '',
        },
      };
    }
  }
  logOrgAuditBoundary(intakeId, {
    step: 'summary_generation',
    success: true,
    fallbackUsed: generationUsedFallback,
  });
  logSummarySave('summary generation complete', {
    intakeId,
    ms: Date.now() - generationStartedAt,
    timelineEventCount: org.timelineEvents.length,
    evidenceTimelineCount: org.evidenceTimeline.length,
    fileRecordCount: org.fileRecords.length,
    // org.sections is a fixed-shape object (IntakeOrganizationSections), not an array ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â this
    // used to call .length on it, which is always undefined. Count populated sections instead.
    sectionCount: Object.values(org.sections).filter((v) =>
      Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : Boolean(v)
    ).length,
    readinessIndicatorCount: org.readinessIndicators.length,
    generationUsedFallback,
  });
  logGeneratedSummaryPreview(intakeId, {
    overview: org.overview,
    timelineSummary: org.timelineSummary,
    readinessCount: org.readinessIndicators.length,
    missingCount: org.missingDocumentSuggestions.length,
    timelineEventCount: org.timelineEvents.length,
  });

  const corePayload = buildCoreSummaryPayload(org, { fileCount: files.length });
  logOrgAudit('core save start', {
    intakeId,
    activeStep: 'core_summary_save',
    uploadedFileCount: files.length,
    extractionCount: extractionRes.rows.length,
    summaryAssemblyStatus: 'core_pending',
  });
  logSummarySave('intake_summaries core save start', { intakeId });
  const coreSaveResult = await upsertIntakeSummaryRow(intakeId, corePayload);
  if (coreSaveResult.error) {
    logOrgAudit('core save failed', {
      intakeId,
      activeStep: 'core_summary_save',
      summarySaveStatus: 'failed',
      errorMessage: coreSaveResult.error,
      stage: coreSaveResult.stage ?? null,
    });
    return coreSaveResult;
  }
  logOrgAudit('core summary saved', {
    intakeId,
    activeStep: 'core_summary_save',
    summarySaveStatus: 'core_saved',
    summaryId: coreSaveResult.summaryId ?? null,
    operation: coreSaveResult.operation ?? null,
  });
  logSummarySave('intake_summaries core save complete', {
    intakeId,
    summaryId: coreSaveResult.summaryId ?? null,
    operation: coreSaveResult.operation,
  });

  let finalPayload = corePayload;
  let workflowStatusToStore = resolveWorkflowStatusAfterReorganization(
    priorIntake?.workflow_status as string | null | undefined,
    hasFirmDocRequest
  );
  let enrichmentUsedFallback = false;

  logOrgAudit('summary assembly start', {
    intakeId,
    activeStep: 'summary_assembly',
    summaryAssemblyStatus: 'in_progress',
  });
  try {
    const enriched = assembleEnrichedSummaryPayload({
      intakeId,
      org,
      extractionRows: extractionRes.rows,
      previousOverview,
      preservedWorkerNotes,
      preservedFirmRequestBlock,
      preservedFirmRequestAlerts,
      preservedWorkerResponseBlock,
      preservedWorkerResponseAlerts,
      priorWorkflow: priorIntake?.workflow_status as string | null | undefined,
      hasFirmDocRequest,
    });
    finalPayload = enriched.payload;
    workflowStatusToStore = enriched.workflowStatus;
    logOrgAuditBoundary(intakeId, { step: 'summary_assembly', success: true });
    logSummarySave('summary payload prepared', {
      intakeId,
      ...measurePayload('overview', finalPayload.overview),
      ...measurePayload('timelineSummary', finalPayload.timeline_summary),
      ...measurePayload('readinessIndicators', finalPayload.readiness_indicators),
      ...measurePayload('missingDocumentAlerts', finalPayload.missing_document_alerts),
      timelineDbRowCount: org.timelineEvents.length,
      workflowStatusToStore,
    });

    if (!payloadsEquivalent(corePayload, finalPayload)) {
      logOrgAudit('enriched save start', {
        intakeId,
        activeStep: 'enriched_summary_save',
        summaryAssemblyStatus: 'complete',
      });
      const enrichedSaveResult = await upsertIntakeSummaryRow(intakeId, finalPayload);
      if (enrichedSaveResult.error) {
        enrichmentUsedFallback = true;
        logOrgAuditBoundary(intakeId, {
          step: 'enriched_summary_save',
          success: false,
          fallbackUsed: true,
          errorMessage: enrichedSaveResult.error,
        });
        logSummarySaveError('intake_summaries enriched save', enrichedSaveResult.error, {
          intakeId,
          stage: enrichedSaveResult.stage,
        });
      } else {
        logOrgAudit('enriched summary saved', {
          intakeId,
          activeStep: 'enriched_summary_save',
          summarySaveStatus: 'enriched_saved',
          summaryId: enrichedSaveResult.summaryId ?? null,
        });
      }
    }
  } catch (assemblyError) {
    enrichmentUsedFallback = true;
    const message = assemblyError instanceof Error ? assemblyError.message : String(assemblyError);
    logOrgAuditBoundary(intakeId, {
      step: 'summary_assembly',
      success: false,
      fallbackUsed: true,
      errorMessage: message,
    });
    logSummarySaveError('summary assembly ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â core preserved', assemblyError, { intakeId });
  }

  logOrgAudit('timeline save start', {
    intakeId,
    activeStep: 'timeline_events_save',
    timelineEventCount: org.timelineEvents.length,
  });
  const timelineResult = await saveTimelineEventsForIntake(intakeId, org.timelineEvents);
  if (timelineResult.error) {
    logOrgAuditBoundary(intakeId, {
      step: 'timeline_events_save',
      success: false,
      fallbackUsed: true,
      errorMessage: timelineResult.error,
    });
  } else {
    logOrgAuditBoundary(intakeId, { step: 'timeline_events_save', success: true });
  }

  logSummarySave('intakes update start', { intakeId, workflowStatusToStore });
  logOrgAudit('intakes update start', { intakeId, activeStep: 'intakes_update', workflowStatusToStore });
  const { error: up } = await supabase
    .from('intakes')
    .update({ workflow_status: workflowStatusToStore, status: 'draft' })
    .eq('id', intakeId);
  logSupabaseWriteResult('intakes', 'update', {
    intakeId,
    workflowStatusToStore,
    error: up ? { message: up.message, code: up.code } : null,
  });
  if (up) {
    logOrgAuditError('intakes update failed ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â core summary preserved', up, {
      intakeId,
      activeStep: 'intakes_update',
    });
    logSummarySaveError('intakes update', up, { intakeId, code: up.code, workflowStatusToStore });
    // Non-blocking: core summary already saved.
  } else {
    logOrgAuditBoundary(intakeId, { step: 'intakes_update', success: true });
  }

  const verified = await waitForWorkerSummaryRow(intakeId, { attempts: 5, delayMs: 350 });
  logOrgAudit(verified ? 'post-save verification passed' : 'post-save verification failed', {
    intakeId,
    activeStep: 'post_save_verification',
    rowVerificationStatus: verified ? 'passed' : 'failed',
    enrichmentUsedFallback,
    timelineSaveStatus: timelineResult.error ? 'failed' : 'success',
    ms: Date.now() - startedAt,
  });
  if (!verified) {
    return { error: 'Summary row not found immediately after save.', stage: 'post_save_verification' };
  }

  logSummarySave('organization persist complete', {
    intakeId,
    ms: Date.now() - startedAt,
    enrichmentUsedFallback,
    coreSummarySaved: true,
  });
  return {};
}

