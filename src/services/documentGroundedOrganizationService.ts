/**
 * Deterministic, document-grounded intake organization (no LLM).
 * Uses extracted plain text + file metadata; worker narrative stays attributed separately.
 */

import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import { safeTrim } from './summarySaveDiagnostics';
import type {
  DocumentGroundedFileInput,
  IntakeFileOrganizationRecord,
  PlaceholderOrganizationResult,
  ReviewCheckItem,
} from './intakeOrganizationTypes';
import {
  bestBucketFromScores,
  legacyCategoryToScanBucket,
  REVIEW_TOPIC_DEFINITIONS,
  SCAN_DOCUMENT_BUCKETS,
  scoreTextAgainstBuckets,
  type ScanDocumentBucket,
} from './documentScanClassification';
import {
  buildMissingRecordSuggestion,
  buildReviewItemFromTopic,
  documentsDoNotYetShowPhrase,
  reviewingMayConfirmPhrase,
  sanitizeGenerationPhrase,
  timelineGapPhrase,
  usefulForReviewPhrase,
} from './intakeGenerationVoice';
import {
  uniqueSortedEmploymentChronologyDates,
} from './contextualDateClassification';
import {
  buildNarrativeHierarchy,
  buildRecordSetProfile,
  filterTextForOrganizerMining,
  type OrganizerFileInput,
} from './intakeOrganizerReasoning';
import { buildPerFileOrganizationRecords } from './perFileOrganizationService';
import { applyEvidenceMappedOrganization } from './intakeOrganizationEngine';
import { intakeSatisfiesHelpfulRecordType, resolveHelpfulRecordSuggestionLabels } from './organizationOutputQuality';

export type { DocumentGroundedFileInput } from './intakeOrganizationTypes';
export {
  SCAN_DOCUMENT_BUCKETS,
  type ScanDocumentBucket,
  legacyCategoryToScanBucket,
  scoreTextAgainstBuckets,
  bestBucketFromScores,
  employmentTopicLabelsForText,
} from './documentScanClassification';

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December';

const EMPLOYER_HINTS =
  /\b(HR|human resources|payroll|employer|employment|W-2|1099|EIN|benefits|FMLA|ADA|FLSA|overtime|timesheet|paystub|pay stub)\b/i;

function clipAtWordBoundary(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return sp > max * 0.45 ? cut.slice(0, sp).trim() : cut.trim();
}

function linesWithEmployerHints(extractedCorpus: string, max: number): string[] {
  const out: string[] = [];
  for (const line of extractedCorpus.split(/\n+/)) {
    const t = line.trim();
    if (t.length < 8) continue;
    if (EMPLOYER_HINTS.test(t)) {
      out.push(clipAtWordBoundary(t, 220));
      if (out.length >= max) break;
    }
  }
  return out;
}

function reviewItemsFromCorpus(
  corpus: string,
  supportingFileNames: string[],
  max: number
): ReviewCheckItem[] {
  const lower = corpus.toLowerCase();
  const out: ReviewCheckItem[] = [];
  for (const def of REVIEW_TOPIC_DEFINITIONS) {
    const hits = def.terms.filter((term) => lower.includes(term));
    if (hits.length >= 2) {
      out.push(
        buildReviewItemFromTopic({
          title: def.label,
          termsFound: hits,
          reviewGuidance: def.review,
          supportingFileNames,
        })
      );
      if (out.length >= max) break;
    }
  }
  return out;
}

/** Issue-signal labels that apply to a single document cluster (same rules as issueSignalLines, smaller cap). */
function digestReviewHeadingFromDefLabel(defLabel: string): string | null {
  const l = defLabel.toLowerCase();
  if (/wage|payroll/.test(l)) return 'Wage / Hour / Payroll Review';
  if (/contract|classification|promised-pay/.test(l)) return 'Classification / Pay Structure Review';
  if (/termination|separation/.test(l)) return 'Separation / Final Pay Review';
  if (/hr|complaint|workplace communication/.test(l)) return 'HR / Workplace Communications Review';
  if (/disability|accommodation|pregnancy|medical-leave/.test(l)) return 'HR / Workplace Communications Review';
  if (/scheduling|attendance|meal|rest|leave/.test(l)) return 'Meal / Rest Break Records Review';
  return null;
}

function reviewAreaLabelsForLocalText(lower: string, max: number): string[] {
  const labels: string[] = [];
  for (const def of REVIEW_TOPIC_DEFINITIONS) {
    const hits = def.terms.filter((term) => lower.includes(term));
    if (hits.length >= 2) {
      const h = digestReviewHeadingFromDefLabel(def.label);
      if (h && !labels.includes(h)) labels.push(h);
    }
    if (labels.length >= max) break;
  }
  return labels;
}

function buildExtractedCorpus(rows: DocumentGroundedFileInput[]): string {
  const parts: string[] = [];
  for (const r of rows) {
    const cat = (r.category ?? 'Uncategorized').trim();
    parts.push(`### ${r.fileName} (${cat})\n${r.extractedText.trim()}`);
  }
  return parts.join('\n\n');
}

function qualityFlagSummary(flags: Record<string, unknown> | null | undefined): string | null {
  if (!flags || typeof flags !== 'object') return null;
  const parts: string[] = [];
  if (flags.truncated === true) parts.push('truncated extraction length');
  if (flags.empty_text_layer === true) parts.push('empty PDF text layer (not OCR)');
  if (flags.skipped_reason) parts.push(`skipped: ${String(flags.skipped_reason)}`);
  if (flags.download === false) parts.push('storage download issue');
  if (flags.exception === true) parts.push('extraction exception');
  return parts.length ? parts.join('; ') : null;
}

const MONTH_NAME =
  'January|February|March|April|May|June|July|August|September|October|November|December';

function extractEntityMentions(corpus: string, max: number): string[] {
  const counts = new Map<string, number>();
  const re = new RegExp(`\\b((?:${MONTH_NAME})\\s+\\d{1,2},?\\s+\\d{4}|[A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,2})\\b`, 'g');
  for (const m of corpus.matchAll(re)) {
    const t = m[1].trim();
    if (t.length < 3) continue;
    if (/^(The|This|That|These|Those|Attorney|Review|Worker|Upload|File|Files)$/i.test(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([name]) => name);
}

function deriveInformationSufficiency(opts: {
  docTotal: number;
  extractedN: number;
  workerContextLen: number;
  dateCount: number;
  hasPayroll: boolean;
  hasTime: boolean;
}): string {
  if (opts.dateCount === 0 && opts.extractedN >= 1) {
    return 'Timeline needs clarification';
  }
  if (opts.docTotal >= 4 && opts.extractedN >= 2 && opts.workerContextLen >= 80 && opts.dateCount >= 2) {
    return 'Enough to begin organizing';
  }
  if (opts.docTotal <= 1 || opts.extractedN === 0) {
    return 'Key records appear missing';
  }
  return 'More context would improve review';
}

function buildHelpfulRecordSuggestions(
  bucketLabels: string[],
  filesMeta: Array<{ fileName: string; category: string | null }>,
  workerContext: string,
  satisfaction: {
    corpusLower: string;
    fileRecords: IntakeFileOrganizationRecord[];
  }
): string[] {
  return resolveHelpfulRecordSuggestionLabels({
    bucketLabels,
    filesMeta,
    workerContext,
    corpusLower: satisfaction.corpusLower,
    fileRecords: satisfaction.fileRecords,
  });
}

function reviewTopicPhraseFromCorpus(lower: string): string | null {
  const hits: string[] = [];
  const add = (label: string, re: RegExp) => {
    if (re.test(lower) && !hits.includes(label)) hits.push(label);
  };
  add('wage or payroll topics', /payroll|pay stub|paystub|wages|hourly|gross pay|net pay|pay period|overtime/);
  add('separation or final-pay topics', /termination|terminated|separation|resignation|final pay|final paycheck|severance|laid off|layoff/);
  add('HR or workplace communication topics', /\bhr\b|human resources|complaint|supervisor|manager|investigation|write-up|warning/);
  add('pay-structure or classification topics', /exempt|non-exempt|1099|salary|commission|independent contractor|offer letter|classification/);
  if (!hits.length) return null;
  return hits.join(', ');
}

/**
 * Returns null when there is no completed extracted text to ground on (caller should use placeholder).
 */
export function buildDocumentGroundedOrganization(
  filesMeta: Array<{ fileName: string; category: string | null; uploadedFileId?: string }>,
  completedExtractions: DocumentGroundedFileInput[],
  workerProvidedContextForMining: string | null | undefined,
  orgContext?: { employmentMatterTags?: EmploymentMatterTagId[] }
): PlaceholderOrganizationResult | null {
  const withText = completedExtractions.filter(
    (r) => safeTrim(r.extractedText, 'documentGroundedOrganization.extractedText').length > 0
  );
  if (withText.length === 0) return null;

  const extractedCorpus = buildExtractedCorpus(withText);
  const workerMining = (workerProvidedContextForMining ?? '').trim();
  const miningCorpus = filterTextForOrganizerMining(`${extractedCorpus}\n${workerMining}`);

  const dates = uniqueSortedEmploymentChronologyDates(miningCorpus);
  const employerLines = linesWithEmployerHints(filterTextForOrganizerMining(extractedCorpus), 5);
  const allFileNames = filesMeta.map((f) => f.fileName);
  const reviewItems = reviewItemsFromCorpus(filterTextForOrganizerMining(extractedCorpus), allFileNames, 6);
  const anyTruncated = withText.some((r) => Boolean(r.qualityFlags && (r.qualityFlags as { truncated?: boolean }).truncated));

  const docTotal = filesMeta.length;
  const extractedN = withText.length;
  const bucketOrder = new Map<ScanDocumentBucket, number>();
  for (const f of filesMeta) {
    const b = legacyCategoryToScanBucket(f.category);
    bucketOrder.set(b, (bucketOrder.get(b) ?? 0) + 1);
  }
  const bucketLabels = [...bucketOrder.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([b]) => b.charAt(0).toLowerCase() + b.slice(1));

  const corpusLower = filterTextForOrganizerMining(extractedCorpus).toLowerCase();
  const topicPhrase = reviewTopicPhraseFromCorpus(corpusLower);
  const hasPayroll = bucketLabels.some((b) => /pay|payroll|compensation/i.test(b));
  const hasTime = bucketLabels.some((b) => /schedul|time|attendance|leave/i.test(b));

  const sufficiencyStatus = deriveInformationSufficiency({
    docTotal,
    extractedN,
    workerContextLen: workerMining.length,
    dateCount: dates.length,
    hasPayroll,
    hasTime,
  });

  const { fileRecords, peopleIndex } = buildPerFileOrganizationRecords(
    filesMeta,
    completedExtractions
  );

  const helpfulRecords = buildHelpfulRecordSuggestions(
    bucketLabels,
    filesMeta,
    workerMining,
    { corpusLower, fileRecords }
  ).map((h, index) => buildMissingRecordSuggestion(safeTrim(h, `helpfulRecords[${index}]`).replace(/^•\s*/, '')));

  const completedIds = new Set(withText.map((w) => w.uploadedFileId));
  const withoutExtraction = filesMeta.filter((f) => {
    if (f.uploadedFileId) return !completedIds.has(f.uploadedFileId);
    return !withText.some((w) => w.fileName === f.fileName);
  });

  const organizerFiles: OrganizerFileInput[] = withText.map((r) => ({
    uploadedFileId: r.uploadedFileId,
    fileName: r.fileName,
    category: r.category,
    extractedText: filterTextForOrganizerMining(r.extractedText),
    scanBucket: bestBucketFromScores(scoreTextAgainstBuckets(r.extractedText.toLowerCase())).bucket,
    qualityFlags: r.qualityFlags,
  }));

  const recordSetProfile = buildRecordSetProfile({
    docTotal,
    extractedN,
    withoutExtractionCount: withoutExtraction.length,
    files: organizerFiles,
    bucketLabels,
    dates,
    topicPhrase,
    corpusLower,
  });

  const narrative = buildNarrativeHierarchy(recordSetProfile, {
    corpusLower,
    workerMining,
    anyTruncated,
    withoutExtractionCount: withoutExtraction.length,
  });

  const recordStory = narrative.recordStory;
  const firmReviewSummary = narrative.firmReviewLead;
  const overview = narrative.narrativeOverview;

  const readinessIndicators: string[] = [];
  for (const theme of narrative.themes.slice(0, 4)) {
    readinessIndicators.push(usefulForReviewPhrase(theme.observation));
  }
  for (const item of reviewItems.slice(0, 4)) {
    const why = safeTrim(item.whyNeedsReview, 'reviewItems.whyNeedsReview').replace(
      /^This item may need human review because\s+/i,
      ''
    );
    readinessIndicators.push(usefulForReviewPhrase(`${item.title}: ${why}`));
  }
  if (sufficiencyStatus === 'Timeline needs clarification') {
    readinessIndicators.push(
      sanitizeGenerationPhrase('Some portions of the timeline remain incomplete.')
    );
  }
  for (const line of narrative.uncertaintyLines) {
    if (!readinessIndicators.includes(line)) readinessIndicators.push(line);
  }

  const missingDocumentSuggestions: string[] = [...helpfulRecords];
  if (withoutExtraction.length) {
    missingDocumentSuggestions.push(
      sanitizeGenerationPhrase(
        'Some uploads may still need clearer copies or manual review before they can be read alongside the rest of the set.'
      )
    );
  }
  if (sufficiencyStatus === 'Timeline needs clarification' && dates.length >= 2) {
    missingDocumentSuggestions.push(
      timelineGapPhrase(`${dates[0]} and ${dates[dates.length - 1]}`)
    );
  } else if (sufficiencyStatus === 'Timeline needs clarification') {
    const satisfactionOpts = {
      corpusLower,
      fileNameCorpus: filesMeta.map((f) => f.fileName.toLowerCase()).join(' '),
      categoryCorpus: filesMeta.map((f) => (f.category ?? '').toLowerCase()).join(' '),
      fileRecords,
    };
    const needsDatedRecords =
      !intakeSatisfiesHelpfulRecordType('pay', satisfactionOpts) &&
      !intakeSatisfiesHelpfulRecordType('time', satisfactionOpts) &&
      !intakeSatisfiesHelpfulRecordType('termination', satisfactionOpts);
    if (needsDatedRecords) {
      const datedSuggestion = buildMissingRecordSuggestion(
        'dated pay periods, schedules, or separation paperwork'
      );
      if (!missingDocumentSuggestions.includes(datedSuggestion)) {
        missingDocumentSuggestions.push(datedSuggestion);
      }
    }
  }

  const catCounts = new Map<string, number>();
  for (const f of filesMeta) {
    const c = (f.category ?? 'Uncategorized').trim() || 'Uncategorized';
    catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  }
  const documentCategories = [...catCounts.entries()].map(([name, count]) => ({ name, count }));

  const evidenceOrg = applyEvidenceMappedOrganization({
    fileRecords,
    peopleIndex,
    completedExtractions,
    executiveLead: firmReviewSummary,
    missingDocumentSuggestions,
    readinessIndicators,
    reviewItems,
    docTotal: docTotal,
    employmentMatterTags: orgContext?.employmentMatterTags,
  });

  return {
    recordStory,
    firmReviewSummary,
    overview,
    timelineSummary: evidenceOrg.timelineSummary,
    timelineEvents: evidenceOrg.timelineEvents,
    documentCategories,
    readinessIndicators,
    missingDocumentSuggestions,
    reviewItems,
    fileRecords,
    peopleIndex,
    evidenceTimeline: evidenceOrg.evidenceTimeline,
    sections: evidenceOrg.sections,
  };
}
