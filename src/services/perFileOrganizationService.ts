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
  const likelyDate =
    likelyAnchor && likelyAnchor !== DATE_UNCLEAR_LABEL ? likelyAnchor : fileDates[0] ?? null;

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

  const people = collectPeopleFromFacts(payFacts, commFacts);
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

  return {
    source_file_id: resolveSourceFileId(meta),
    file_name: meta.fileName,
    document_type: documentType,
    legacy_upload_category: legacyCategory,
    likely_date: likelyDate,
    people_or_entities: people,
    employment_topics: employmentTopics,
    possible_timeline_event: buildPossibleTimelineEvent({
      documentType,
      dates: fileDates,
      fileName: meta.fileName,
      hasText: minedText.length > 0,
    }),
    supporting_record_strength: supportingStrength,
    missing_or_unclear_information: [...new Set(missing)].slice(0, 6),
    confidence,
    extraction_quality: extractionQuality,
  };
}

export function buildPeopleIndexFromFileRecords(
  records: IntakeFileOrganizationRecord[]
): string[] {
  const seen = new Set<string>();
  const rawPeople: string[] = [];
  for (const r of records) {
    for (const person of r.people_or_entities) {
      const key = person.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        rawPeople.push(person);
      }
    }
  }

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
  completedExtractions: DocumentGroundedFileInput[] = []
): { fileRecords: IntakeFileOrganizationRecord[]; peopleIndex: string[] } {
  const fileRecords = filesMeta.map((meta) =>
    buildSingleFileRecord(meta, matchExtraction(meta, completedExtractions))
  );
  return {
    fileRecords,
    peopleIndex: buildPeopleIndexFromFileRecords(fileRecords),
  };
}
