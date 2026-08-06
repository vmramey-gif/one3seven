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
import { formatPersonWithRole, inferRolesForPeople } from './peopleRoleInference';

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

function buildPossibleTimelineEvent(opts: {
  documentType: string;
  dates: string[];
  fileName: string;
  hasText: boolean;
}): IntakeFileOrganizationRecord['possible_timeline_event'] {
  const anchor = opts.dates.length
    ? bestEmploymentChronologyAnchor(opts.dates.join('\n'))
    : bestEmploymentChronologyAnchor(opts.fileName);
  const date =
    anchor && anchor !== DATE_UNCLEAR_LABEL ? anchor : opts.dates[0] ?? null;
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
  extraction: DocumentGroundedFileInput | null
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
  workerDisplayName?: string | null
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
      r.people_or_entities.join(' '),
    ].join('\n')
  );
  const rolesByName = new Map(
    inferRolesForPeople({ names: records.flatMap((r) => r.people_or_entities), contexts }).map((role) => [
      role.name.toLowerCase(),
      role,
    ])
  );

  return rawPeople
    .map((person) => formatPersonWithRole(person, rolesByName.get(person.toLowerCase()), 'medium'))
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
  const fileRecords = filesMeta.map((meta) =>
    buildSingleFileRecord(meta, matchExtraction(meta, completedExtractions))
  );
  return {
    fileRecords,
    peopleIndex: buildPeopleIndexFromFileRecords(fileRecords, opts?.workerDisplayName),
  };
}
