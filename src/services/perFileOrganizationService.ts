/**
 * Per-file structured intake organization records (Phase 1).
 * Deterministic metadata from uploads + extracted text — no legal conclusions.
 */

import {
  DATE_UNCLEAR_LABEL,
  bestEmploymentChronologyAnchor,
  uniqueSortedEmploymentChronologyDates,
} from './contextualDateClassification';
import {
  extractCommunicationFacts,
  extractPayRecordFacts,
} from './documentFactExtractionService';
import { usableDocumentDateLabel } from './evidenceMappedTimelineService';
import { deriveNamedPeopleForIntake, type DocumentFacts, type FileWithFacts } from './documentFactsService';
import type { DocumentGroundedFileInput } from './intakeOrganizationTypes';
import {
  bestBucketFromScores,
  employmentTopicLabelsForText,
  legacyCategoryToScanBucket,
  scoreTextAgainstBuckets,
} from './documentScanClassification';
import {
  materialsMayReflectPhrase,
  sanitizeGenerationPhrase,
} from './intakeGenerationVoice';
import type {
  ExtractionQuality,
  IntakeFileOrganizationRecord,
  SourceStrength,
} from './intakeOrganizationTypes';
import { chronologyPhaseTitle, filterTextForOrganizerMining } from './intakeOrganizerReasoning';
import { formatPersonWithRole, inferRolesForPeople, type InferredPersonRole } from './peopleRoleInference';

export type PerFileOrganizationMeta = {
  uploadedFileId?: string;
  fileName: string;
  category: string | null;
};

function resolveSourceFileId(meta: PerFileOrganizationMeta): string {
  const id = (meta.uploadedFileId ?? '').trim();
  if (id) return id;
  return `name:${meta.fileName.trim()}`;
}

function matchExtraction(
  meta: PerFileOrganizationMeta,
  extractions: DocumentGroundedFileInput[]
): DocumentGroundedFileInput | null {
  if (meta.uploadedFileId) {
    const byId = extractions.find((e) => e.uploadedFileId === meta.uploadedFileId);
    if (byId) return byId;
  }
  return extractions.find((e) => e.fileName === meta.fileName) ?? null;
}

function qualityFlagIssues(flags: Record<string, unknown> | null | undefined): string[] {
  if (!flags || typeof flags !== 'object') return [];
  const out: string[] = [];
  if (flags.truncated === true) out.push('Extracted text may be truncated.');
  if (flags.empty_text_layer === true) out.push('PDF text layer was empty; readable text may be limited.');
  if (flags.skipped_reason) out.push(`Extraction skipped: ${String(flags.skipped_reason)}.`);
  if (flags.download === false) out.push('File could not be downloaded for text extraction.');
  if (flags.exception === true) out.push('Text extraction encountered an error.');
  return out.map((line) => sanitizeGenerationPhrase(line));
}

function deriveExtractionQuality(
  text: string,
  flags: Record<string, unknown> | null | undefined,
  hasExtractionRow: boolean
): ExtractionQuality {
  const issues = qualityFlagIssues(flags);
  const trimmed = text.trim();
  if (!hasExtractionRow || issues.some((i) => /skipped|error|empty|download/i.test(i))) {
    return 'unreadable';
  }
  if (!trimmed.length) return 'unreadable';
  if (trimmed.length < 40 || flags?.truncated === true) return 'low';
  if (trimmed.length < 120) return 'medium';
  return 'high';
}

function deriveConfidence(
  quality: ExtractionQuality,
  hasDate: boolean,
  topicCount: number
): 'high' | 'medium' | 'low' {
  if (quality === 'unreadable') return 'low';
  if (quality === 'high' && (hasDate || topicCount > 0)) return 'high';
  if (quality === 'medium') return 'medium';
  return 'low';
}

function deriveSupportingStrength(
  quality: ExtractionQuality,
  text: string,
  dateCount: number
): SourceStrength {
  if (quality === 'unreadable') return 'inferred';
  if (quality === 'high' && dateCount > 0 && text.length > 80) return 'strong';
  if (text.trim().length > 0) return 'partial';
  return 'needs_review';
}

function collectPeopleFromFacts(
  payFacts: ReturnType<typeof extractPayRecordFacts>,
  commFacts: ReturnType<typeof extractCommunicationFacts>
): string[] {
  const people = new Set<string>();
  const add = (name: string | null | undefined) => {
    const t = (name ?? '').replace(/\s+/g, ' ').trim();
    if (t.length >= 2 && t.length <= 64) people.add(t);
  };
  if (payFacts) {
    add(payFacts.employeeName);
    add(payFacts.employerName);
  }
  if (commFacts) {
    add(commFacts.sender);
    add(commFacts.recipient);
    add(commFacts.employerOrCompany);
    for (const p of commFacts.peopleMentioned) add(p);
  }
  return [...people].slice(0, 8);
}

/** Generic role-parties: allowed only when a file names no real individual or entity. */
const GENERIC_PARTY_RE =
  /^(human resources|hr|hr department|payroll|management|manager|supervisor|legal|benefits|employer|employee|company|worker|staff|n\/?a|unknown|not specified|none)$/i;

/**
 * Names from the Claude extraction's stored facts (`document_facts.people_mentioned` +
 * `document_facts.communication_parties`) — the authoritative people source for a file.
 * Entries may be plain strings or `{ name, role }` objects; email addresses and URLs are
 * contact data, not names, and are dropped.
 */
export function collectPeopleFromDocumentFacts(
  facts: Record<string, unknown> | null | undefined
): string[] {
  if (!facts || typeof facts !== 'object') return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    const raw =
      typeof value === 'string'
        ? value
        : value && typeof value === 'object'
          ? String((value as { name?: unknown }).name ?? '')
          : '';
    const t = raw.replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 64) return;
    if (t.includes('@') || /^https?:|^www\./i.test(t)) return;
    const clean = sanitizeGenerationPhrase(t);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };
  const mentioned = (facts as { people_mentioned?: unknown }).people_mentioned;
  if (Array.isArray(mentioned)) mentioned.forEach(push);
  const parties = (facts as { communication_parties?: unknown }).communication_parties;
  if (Array.isArray(parties)) parties.forEach(push);
  return out;
}

/**
 * Merge extraction-fact names (preferred) with text-mined names; dedupe case-insensitively.
 * Generic role-parties ("Human Resources") survive only when no named individual exists.
 */
function mergePeopleForFile(factPeople: string[], minedPeople: string[]): string[] {
  const ordered = [...factPeople, ...minedPeople];
  const hasRealName = ordered.some((p) => !GENERIC_PARTY_RE.test(p));
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const person of ordered) {
    if (hasRealName && GENERIC_PARTY_RE.test(person)) continue;
    const key = person.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(person);
  }
  return merged.slice(0, 12);
}

/** Conclusion vocabulary that must never ride along on a surfaced record fact. */
const RECORD_FACT_CONCLUSION_RE =
  /\bviolat|\bpenalt|\bowed\b|\bentitle|\bunlawful|\bwrongful|\billegal|\bretaliat|\bliab|226\.7/i;

/** Files whose facts may carry punch-level meal data worth describing: time/pay records. */
const TIME_OR_PAY_RECORD_RE = /time|schedul|punch|hour|\bpay\b|paystub|pay stub|wage|payroll/i;

/**
 * Only punch-level missed-breaks facts (punch/premium/shift counts) are surfaced — an
 * absence note on a schedule ("no meal period rows shown on schedule") is not what the
 * time records SHOW. Keep in sync with the coverage rail's filter of the same name
 * (caEmployerRecordRequirements).
 */
const PUNCH_LEVEL_MISSED_BREAKS_RE = /\bpunch(?:es)?\b|\bpremiums?\b|\bshifts?\b/i;

/**
 * Presence-describing meal-period line from extraction-stored facts
 * (document_facts.missed_breaks) — e.g. "Time records show no meal period punch on 9 of 11
 * shifts over 6.0 hours." DESCRIPTION of what the record shows, never a violation/penalty/
 * entitlement claim: a facts value carrying conclusion vocabulary is dropped entirely.
 * (Previously these facts reached only the damages path and never the packet.)
 */
export function mealPeriodRecordLineFromFacts(
  facts: Record<string, unknown> | null | undefined
): string | null {
  if (!facts || typeof facts !== 'object') return null;
  const raw = (facts as { missed_breaks?: unknown }).missed_breaks;
  if (typeof raw !== 'string') return null;
  const detail = raw.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (detail.length < 8 || detail.length > 220) return null;
  if (!PUNCH_LEVEL_MISSED_BREAKS_RE.test(detail)) return null;
  if (RECORD_FACT_CONCLUSION_RE.test(detail)) return null;
  return sanitizeGenerationPhrase(`Time records show ${detail}.`);
}

/**
 * Makes a pay/time record's PERIOD legible instead of silently collapsing it into a single
 * anchor date (2026-08-18, document-range vs. employment-period vs. event-chronology conceptual
 * split). A paystub covering "March 1 - March 15, 2024" is a two-week RANGE, not a point-in-time
 * occurrence -- but the record's likely_date/event date fields are a single string (needed for
 * sorting), so whichever boundary date wins reads as if something happened on exactly that one
 * day. document_facts.pay_period_start/pay_period_end are already correctly extracted as a range
 * (see PayRecordFacts) but were never consumed downstream -- same "real data, nothing reads it"
 * pattern found repeatedly tonight. Rather than change what the sortable date field stores (real
 * risk to every date-comparison/export consumer), this surfaces the actual covered range in the
 * summary text, where a reader can see it's a period.
 */
export function payPeriodRangeNoteFromFacts(
  facts: Record<string, unknown> | null | undefined
): string | null {
  if (!facts || typeof facts !== 'object') return null;
  const start = (facts as { pay_period_start?: unknown }).pay_period_start;
  const end = (facts as { pay_period_end?: unknown }).pay_period_end;
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const startTrim = start.trim();
  const endTrim = end.trim();
  if (!startTrim || !endTrim || startTrim === endTrim) return null;
  // Sanity check (2026-08-19 rough-edge cleanup): a malformed/reversed extraction (end before
  // start) previously produced a garbled-but-confident sentence ("...pay period 2026-08-15 to
  // 2026-08-01"). Only suppress when BOTH sides parse as real dates and are confirmed reversed --
  // if either is unparseable, stay silent on ordering rather than guess (under-match is the safe
  // failure mode here, consistent with the rest of this pipeline).
  const startMs = Date.parse(startTrim);
  const endMs = Date.parse(endTrim);
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs < startMs) return null;
  return sanitizeGenerationPhrase(`This record covers the pay period ${startTrim} to ${endTrim}.`);
}

/**
 * Computes which named people across the WHOLE intake are confirmed Human Resources contacts
 * (peopleRoleInference.ts, via deriveNamedPeopleForIntake -- already built/tested, previously only
 * used for the worker-facing "named individuals" count). Cross-document: a communication's OWN
 * document_facts often can't tell you the recipient's role (e.g. an outgoing complaint just says
 * "recipient", not "HR") but a REPLY from the same person elsewhere in the file set often does
 * (relationship_to_worker: "HR Manager"). Aggregating across all files lets a specific event title
 * for file A use a role fact that was only ever stated explicitly in file B.
 */
function toFactsFiles(completedExtractions: DocumentGroundedFileInput[]): FileWithFacts[] {
  return completedExtractions
    .filter((e) => e.documentFacts)
    .map((e) => ({
      uploaded_file_id: e.uploadedFileId,
      file_name: e.fileName,
      category: e.category,
      extraction_status: 'completed',
      fact_extraction_status: 'completed',
      document_facts: e.documentFacts as DocumentFacts,
    }));
}

function buildHrContactNameSet(completedExtractions: DocumentGroundedFileInput[]): Set<string> {
  const asFactsFiles = toFactsFiles(completedExtractions);
  if (!asFactsFiles.length) return new Set();
  const roles = deriveNamedPeopleForIntake(asFactsFiles);
  return new Set(
    roles.filter((r) => r.role === 'Human Resources Representative').map((r) => r.name.toLowerCase())
  );
}

const COMMUNICATION_TITLE_MAX_TOPIC_CHARS = 60;

function clipTopicAtWordBoundary(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).trim();
}

/**
 * Concrete, factual title for a workplace communication, built from the Claude-extracted
 * document_facts (complaint_topic / resolution_summary / relationship_to_worker) instead of the
 * generic bucket label ("Workplace communications") that used to fall through to a wrong-category
 * default (Marcus Delgado regression, 2026-08-18: an overtime-complaint email and HR's reply both
 * ended up titled "Employment activity documented through payroll records" -- their content was
 * ABOUT pay, but neither document IS a pay record). Reuses the exact title strings the rest of the
 * organize pipeline already recognizes ("Complaint submitted to Human Resources" / "HR response
 * received") so downstream category/role-name mapping tables still apply; the topic suffix makes it
 * specific without inventing new vocabulary.
 */
function communicationTitleFromFacts(
  documentFacts: Record<string, unknown> | null | undefined,
  documentType: string,
  hrNames: Set<string>
): { title: string; extraSummary: string } | null {
  if (!documentFacts || typeof documentFacts !== 'object') return null;
  const df = documentFacts as Partial<DocumentFacts>;

  // Was gated on the deterministic bucket-scorer's documentType === 'Workplace Communications' --
  // the exact same fragility behind the underlying bug: an HR reply that mostly discusses payroll
  // scored into a payroll-leaning bucket by content alone, so the gate silently skipped the very
  // documents it was meant to fix. complaint_topic/resolution_summary are only ever populated by
  // the extraction prompt for communication-shaped documents in the first place -- their presence
  // is itself the reliable signal, independent of which bucket the deterministic scorer guessed.
  void documentType;

  const topicRaw = (df.complaint_topic ?? '').toString().trim();
  const resolutionRaw = (df.resolution_summary ?? '').toString().trim();
  if (!topicRaw && !resolutionRaw) return null;

  const parties = (df.communication_parties ?? []).filter(
    (p): p is { name: string; role: string } => Boolean(p?.name)
  );
  const relationshipToWorker = (df.relationship_to_worker ?? '').toString().toLowerCase();
  const involvesHr =
    /human resources|\bhr\b|\bhr manager\b/.test(relationshipToWorker) ||
    parties.some((p) => hrNames.has(p.name.trim().toLowerCase()));
  if (!involvesHr) return null;

  const topic = clipTopicAtWordBoundary(topicRaw, COMMUNICATION_TITLE_MAX_TOPIC_CHARS);

  if (resolutionRaw) {
    const title = topic
      ? `HR response received regarding ${topic}`
      : 'HR response received';
    return {
      title: sanitizeGenerationPhrase(title),
      extraSummary: sanitizeGenerationPhrase(
        `Response indicates: ${clipTopicAtWordBoundary(resolutionRaw, 220)}`
      ),
    };
  }
  const title = topic
    ? `Complaint submitted to Human Resources regarding ${topic}`
    : 'Complaint submitted to Human Resources';
  return { title: sanitizeGenerationPhrase(title), extraSummary: '' };
}

function buildPossibleTimelineEvent(opts: {
  documentType: string;
  dates: string[];
  fileName: string;
  hasText: boolean;
  documentFacts?: Record<string, unknown> | null;
  hrNames?: Set<string>;
}): IntakeFileOrganizationRecord['possible_timeline_event'] {
  const anchor = opts.dates.length
    ? bestEmploymentChronologyAnchor(opts.dates.join('\n'))
    : bestEmploymentChronologyAnchor(opts.fileName);
  const date =
    anchor && anchor !== DATE_UNCLEAR_LABEL ? anchor : opts.dates[0] ?? null;

  const factsTitle = communicationTitleFromFacts(
    opts.documentFacts,
    opts.documentType,
    opts.hrNames ?? new Set()
  );
  if (factsTitle) {
    const base = opts.hasText
      ? materialsMayReflectPhrase(`${factsTitle.title.toLowerCase()} in uploaded materials from this file.`)
      : materialsMayReflectPhrase(
          `${factsTitle.title.toLowerCase()} grouped from file name and category until readable text is available.`
        );
    return {
      title: factsTitle.title,
      date,
      neutral_summary: factsTitle.extraSummary ? `${base} ${factsTitle.extraSummary}` : base,
    };
  }

  const title = chronologyPhaseTitle(opts.documentType, date ? [date] : opts.dates.slice(0, 2));
  const summary = opts.hasText
    ? materialsMayReflectPhrase(`${title.toLowerCase()} in uploaded materials from this file.`)
    : materialsMayReflectPhrase(
        `${title.toLowerCase()} grouped from file name and category until readable text is available.`
      );
  return {
    title: sanitizeGenerationPhrase(title),
    date,
    neutral_summary: summary,
  };
}

function buildSingleFileRecord(
  meta: PerFileOrganizationMeta,
  extraction: DocumentGroundedFileInput | null,
  hrNames: Set<string> = new Set()
): IntakeFileOrganizationRecord {
  const legacyCategory = (meta.category ?? '').trim() || 'Uncategorized';
  const rawText = extraction?.extractedText?.trim() ?? '';
  const minedText = rawText ? filterTextForOrganizerMining(rawText) : '';
  const lower = minedText.toLowerCase();
  const qualityFlags = extraction?.qualityFlags ?? null;
  const hasExtractionRow = Boolean(extraction);
  const extractionQuality = deriveExtractionQuality(rawText, qualityFlags, hasExtractionRow);

  const textBucket =
    minedText.length > 0
      ? bestBucketFromScores(scoreTextAgainstBuckets(lower)).bucket
      : legacyCategoryToScanBucket(legacyCategory);
  const documentType = textBucket;

  const fileDates =
    minedText.length > 0
      ? uniqueSortedEmploymentChronologyDates(minedText)
      : uniqueSortedEmploymentChronologyDates(meta.fileName);
  const likelyAnchor = fileDates.length
    ? bestEmploymentChronologyAnchor(minedText || meta.fileName)
    : bestEmploymentChronologyAnchor(meta.fileName);
  // The extraction-stored document date is authoritative for likely_date when usable
  // (same validation the timeline builder applies); text mining is the fallback. A
  // template-footer date in the text must not beat the extraction's real document date.
  const rawFactsDate = extraction?.documentFacts
    ? (extraction.documentFacts as { document_date?: unknown }).document_date
    : null;
  const factsDate = usableDocumentDateLabel(
    typeof rawFactsDate === 'string' ? rawFactsDate : null
  );
  const likelyDate =
    factsDate ??
    (likelyAnchor && likelyAnchor !== DATE_UNCLEAR_LABEL ? likelyAnchor : fileDates[0] ?? null);

  const payFacts =
    extraction && rawText
      ? extractPayRecordFacts({
          uploaded_file_id: extraction.uploadedFileId,
          file_name: extraction.fileName,
          category: extraction.category,
          extracted_text: rawText,
        })
      : null;
  const commFacts =
    extraction && rawText
      ? extractCommunicationFacts({
          uploaded_file_id: extraction.uploadedFileId,
          file_name: extraction.fileName,
          category: extraction.category,
          extracted_text: rawText,
        })
      : null;

  const people = mergePeopleForFile(
    collectPeopleFromDocumentFacts(extraction?.documentFacts),
    collectPeopleFromFacts(payFacts, commFacts)
  );
  const employmentTopics =
    minedText.length > 0
      ? employmentTopicLabelsForText(lower, 1, 4)
      : employmentTopicLabelsForText(legacyCategory.toLowerCase(), 1, 2);

  const missing: string[] = [...qualityFlagIssues(qualityFlags)];
  if (extractionQuality === 'unreadable') {
    missing.push(
      sanitizeGenerationPhrase('Readable text was not available from this upload.')
    );
  }
  if (!likelyDate) {
    missing.push(sanitizeGenerationPhrase('Date may need confirmation in the source file.'));
  }
  if (!people.length && extractionQuality !== 'unreadable') {
    missing.push(
      sanitizeGenerationPhrase('Named people or entities were not clearly indexed in this file.')
    );
  }

  const confidence = deriveConfidence(extractionQuality, Boolean(likelyDate), employmentTopics.length);
  const supportingStrength = deriveSupportingStrength(extractionQuality, minedText, fileDates.length);

  const possibleTimelineEvent = buildPossibleTimelineEvent({
    documentType,
    dates: fileDates,
    fileName: meta.fileName,
    hasText: minedText.length > 0,
    documentFacts: extraction?.documentFacts,
    hrNames,
  });
  // Surface extraction-stored meal-period facts in this time/pay record's summary
  // (presence description only — see mealPeriodRecordLineFromFacts).
  const mealLine = TIME_OR_PAY_RECORD_RE.test(`${legacyCategory} ${meta.fileName}`.toLowerCase())
    ? mealPeriodRecordLineFromFacts(extraction?.documentFacts)
    : null;
  if (mealLine) {
    possibleTimelineEvent.neutral_summary =
      `${possibleTimelineEvent.neutral_summary} ${mealLine}`.trim();
  }
  // Surface the actual covered pay period so the single anchor date doesn't read as a point-in-
  // time occurrence when the record is really a range (see payPeriodRangeNoteFromFacts).
  const payPeriodNote = TIME_OR_PAY_RECORD_RE.test(`${legacyCategory} ${meta.fileName}`.toLowerCase())
    ? payPeriodRangeNoteFromFacts(extraction?.documentFacts)
    : null;
  if (payPeriodNote) {
    possibleTimelineEvent.neutral_summary =
      `${possibleTimelineEvent.neutral_summary} ${payPeriodNote}`.trim();
  }

  const rawComplaintTopic = extraction?.documentFacts
    ? (extraction.documentFacts as { complaint_topic?: unknown }).complaint_topic
    : null;
  const complaintTopic =
    typeof rawComplaintTopic === 'string' && rawComplaintTopic.trim() ? rawComplaintTopic.trim() : null;

  return {
    source_file_id: resolveSourceFileId(meta),
    file_name: meta.fileName,
    document_type: documentType,
    legacy_upload_category: legacyCategory,
    likely_date: likelyDate,
    people_or_entities: people,
    employment_topics: employmentTopics,
    possible_timeline_event: possibleTimelineEvent,
    supporting_record_strength: supportingStrength,
    missing_or_unclear_information: [...new Set(missing)].slice(0, 6),
    confidence,
    extraction_quality: extractionQuality,
    complaint_topic: complaintTopic,
  };
}

/**
 * Corporate markers that make an entry an ORGANIZATION, not a named individual. Live Francis
 * bug: "Huseby and Esquire Deposition Solutions" was listed among named people as a Human
 * Resources Representative. Organization strings stay out of the people index entirely
 * (file records and the employer metadata path are unaffected).
 */
const ORGANIZATION_NAME_MARKER_RE =
  /\b(?:llc|inc|incorporated|corp|corporation|company|companies|ltd|llp|lp|plc|pllc|solutions|services|holdings|enterprises|industries|associates|partners|partnership|agency|staffing|consulting|depositions?|reporting|global)\b|\bl\.l\.c\b|\binc\.|\bcorp\.|\bco\./i;

/** True when a people-index candidate reads as an organization rather than an individual. */
export function isLikelyOrganizationName(entry: string): boolean {
  return ORGANIZATION_NAME_MARKER_RE.test(entry);
}

/** Lowercased, accent-stripped word tokens of a display name (parentheticals dropped). */
function personNameTokens(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * True when a people-index candidate is the worker's OWN name in any order or variant:
 * "FRANCIS, ALEXIA" == "ALEXIA FRANCIS" == "Alexia S. Francis" for worker "Alexia Francis",
 * and partial-token variants ("Daniela Reyes" for "Daniela Reyes-Okafor"). The worker is the
 * subject of the record set, not a person named IN it — live Francis bug listed her twice,
 * in two name orders, as a "Coworker".
 */
export function isWorkerOwnNameEntry(
  entry: string,
  workerDisplayName: string | null | undefined
): boolean {
  const workerTokens = personNameTokens(workerDisplayName ?? '');
  if (workerTokens.length < 2) return false;
  const entryTokens = personNameTokens(entry);
  if (entryTokens.length < 2) return false;
  const entrySet = new Set(entryTokens);
  const first = workerTokens[0];
  const last = workerTokens[workerTokens.length - 1];
  if (entrySet.has(first) && entrySet.has(last)) return true;
  const workerSet = new Set(workerTokens);
  return entryTokens.every((t) => workerSet.has(t));
}

/** Order-insensitive dedupe key: "Rojas, Maryandreina" and "Maryandreina Rojas" collide. */
function nameOrderDedupKey(entry: string): string {
  const key = personNameTokens(entry).sort().join(' ');
  return key || entry.trim().toLowerCase();
}

export function buildPeopleIndexFromFileRecords(
  records: IntakeFileOrganizationRecord[],
  workerDisplayName?: string | null,
  completedExtractions?: DocumentGroundedFileInput[]
): string[] {
  // Hygiene happens on the RAW names (before role suffixes are appended): the worker's own
  // name is excluded in any order, organization strings are dropped, and name-order variants
  // ("Last, First" vs "First Last") collapse to one entry — preferring the "First Last" form.
  const byKey = new Map<string, string>();
  const keyOrder: string[] = [];
  for (const r of records) {
    for (const person of r.people_or_entities) {
      if (isWorkerOwnNameEntry(person, workerDisplayName)) continue;
      if (isLikelyOrganizationName(person)) continue;
      const key = nameOrderDedupKey(person);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, person);
        keyOrder.push(key);
        continue;
      }
      if (existing.includes(',') && !person.includes(',')) byKey.set(key, person);
    }
  }
  const rawPeople = keyOrder.map((k) => byKey.get(k) as string);

  const contexts = records.map((r) =>
    [
      r.file_name,
      r.document_type,
      r.legacy_upload_category ?? '',
      r.employment_topics.join(' '),
      r.possible_timeline_event?.title ?? '',
      r.possible_timeline_event?.neutral_summary ?? '',
      // '\n', not ' ' -- see the matching fix + comment in evidenceMappedTimelineService.ts's
      // roleContextsForEvent (2026-08-18): joining different people's names onto one shared line
      // lets a role phrase meant for one bleed onto another (e.g. a worker whose complaint email
      // lists ["Worker Name", "Human Resources"] as mentioned people getting misclassified as HR).
      r.people_or_entities.join('\n'),
    ].join('\n')
  );
  const rolesByName = new Map(
    inferRolesForPeople({ names: records.flatMap((r) => r.people_or_entities), contexts }).map((role) => [
      role.name.toLowerCase(),
      role,
    ])
  );

  // document_facts-derived roles (deriveNamedPeopleForIntake) are a STRONGER signal than the
  // per-file-record string context above: they read document_facts.relationship_to_worker /
  // issued_by directly (e.g. "Renee Ashford — HR Manager", stated explicitly by the extraction),
  // cross-document, rather than inferring from whatever happens to appear in a file's own name/
  // category/topics/title strings. A confirmed real case: the reply's own possible_timeline_event
  // title only carries a bare "HR" (medium confidence under the 'high' bar below), while
  // document_facts.relationship_to_worker on that exact file explicitly says "HR Manager" (high).
  // Preferred over rolesByName whenever both exist for the same person.
  const docFactsRolesByName = completedExtractions
    ? new Map(deriveNamedPeopleForIntake(toFactsFiles(completedExtractions)).map((role) => [role.name.toLowerCase(), role]))
    : new Map<string, InferredPersonRole>();

  // 'high' confidence only (was 'medium'): this people index feeds a visible, structured
  // "People Named in Records" roster (2026-08-18) -- higher presentation weight than the single
  // capped prose sentence it fed before. Two real role-misattribution bugs were found and fixed
  // THIS SAME NIGHT (issued_by/relationship_to_worker line-merge; sender+recipient line-bleed),
  // both driven by 'medium'-confidence bare-keyword matches (e.g. a lone "hr"). Under-labeling (a
  // bare name with no role) is the safe failure mode for a standalone roster; a wrong role label
  // sitting next to someone's name in a structured list is not.
  return rawPeople
    .map((person) => {
      const key = person.toLowerCase();
      const role = docFactsRolesByName.get(key) ?? rolesByName.get(key);
      return formatPersonWithRole(person, role, 'high');
    })
    .slice(0, 24);
}

/**
 * Build structured organization metadata for every uploaded file.
 * Grounded path uses extractions; placeholder path still emits valid low-confidence records.
 */
export function buildPerFileOrganizationRecords(
  filesMeta: PerFileOrganizationMeta[],
  completedExtractions: DocumentGroundedFileInput[] = [],
  opts?: { workerDisplayName?: string | null }
): { fileRecords: IntakeFileOrganizationRecord[]; peopleIndex: string[] } {
  const hrNames = buildHrContactNameSet(completedExtractions);
  const fileRecords = filesMeta.map((meta) =>
    buildSingleFileRecord(meta, matchExtraction(meta, completedExtractions), hrNames)
  );
  return {
    fileRecords,
    peopleIndex: buildPeopleIndexFromFileRecords(fileRecords, opts?.workerDisplayName, completedExtractions),
  };
}
