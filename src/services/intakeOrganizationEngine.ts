/**
 * Assembles Phase 2 evidence timeline + Phase 3 sections after per-file records exist.
 */

import {
  buildEvidenceMappedTimelineEvents,
  evidenceTimelineToOrganizationEvents,
  TAX_FORM_FACTS_RE,
  TAX_FORM_FILENAME_RE,
} from './evidenceMappedTimelineService';
import {
  extractCommunicationFacts,
  extractPayRecordFacts,
} from './documentFactExtractionService';
import {
  buildIntakeOrganizationSections,
  buildTimelineSummaryFromSections,
} from './intakeOrganizationSectionsService';
import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import type {
  DocumentGroundedFileInput,
  EvidenceMappedTimelineEvent,
  IntakeFileOrganizationRecord,
  IntakeOrganizationSections,
  OrganizationTimelineEvent,
  ReviewCheckItem,
} from './intakeOrganizationTypes';

export type ApplyEvidenceOrganizationOpts = {
  fileRecords: IntakeFileOrganizationRecord[];
  peopleIndex: string[];
  completedExtractions?: DocumentGroundedFileInput[];
  executiveLead: string;
  missingDocumentSuggestions: string[];
  readinessIndicators: string[];
  reviewItems: ReviewCheckItem[];
  docTotal: number;
  employmentMatterTags?: EmploymentMatterTagId[];
};

export type EvidenceOrganizationResult = {
  evidenceTimeline: EvidenceMappedTimelineEvent[];
  timelineEvents: OrganizationTimelineEvent[];
  sections: IntakeOrganizationSections;
  timelineSummary: string;
};

export function applyEvidenceMappedOrganization(
  opts: ApplyEvidenceOrganizationOpts
): EvidenceOrganizationResult {
  const extractions = opts.completedExtractions ?? [];
  const payFacts = extractions
    .map((row) =>
      extractPayRecordFacts({
        uploaded_file_id: row.uploadedFileId,
        file_name: row.fileName,
        category: row.category,
        extracted_text: row.extractedText,
      })
    )
    .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));
  const commFacts = extractions
    .map((row) =>
      extractCommunicationFacts({
        uploaded_file_id: row.uploadedFileId,
        file_name: row.fileName,
        category: row.category,
        extracted_text: row.extractedText,
      })
    )
    .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));

  // uploadedFileId → document_facts.document_date. The extraction's stored date is
  // authoritative for a file's event date; the timeline service validates each value
  // and falls back to its text-mined candidate when unusable.
  const documentDates: Record<string, string> = {};
  for (const row of extractions) {
    const facts = row.documentFacts;
    const docDate =
      facts && typeof facts === 'object'
        ? (facts as { document_date?: unknown }).document_date
        : null;
    if (typeof docDate === 'string' && docDate.trim()) {
      documentDates[row.uploadedFileId] = docDate;
    }
  }

  // Tax forms (W-2/1099) are tax-year payroll context, never timeline events. Detected by
  // filename (row + facts-stored file_name) or explicit form phrasing in the extraction's
  // document type / key quote, so a renamed scan of a W2 is still recognized.
  const taxFormFileIds = new Set<string>();
  for (const row of extractions) {
    const facts = (row.documentFacts ?? null) as {
      document_type?: unknown;
      key_quote?: unknown;
      file_name?: unknown;
    } | null;
    const factsFileName = typeof facts?.file_name === 'string' ? facts.file_name : '';
    const factsTypeSignal = [facts?.document_type, facts?.key_quote]
      .filter((v): v is string => typeof v === 'string')
      .join(' ');
    if (
      TAX_FORM_FILENAME_RE.test(row.fileName) ||
      (factsFileName && TAX_FORM_FILENAME_RE.test(factsFileName)) ||
      (factsTypeSignal && TAX_FORM_FACTS_RE.test(factsTypeSignal))
    ) {
      taxFormFileIds.add(row.uploadedFileId);
    }
  }

  const evidenceTimeline = buildEvidenceMappedTimelineEvents({
    fileRecords: opts.fileRecords,
    payFacts,
    commFacts,
    documentDates,
    taxFormFileIds,
  });
  const timelineEvents = evidenceTimelineToOrganizationEvents(evidenceTimeline);
  const sections = buildIntakeOrganizationSections({
    fileRecords: opts.fileRecords,
    peopleIndex: opts.peopleIndex,
    evidenceTimeline,
    executiveLead: opts.executiveLead,
    missingDocumentSuggestions: opts.missingDocumentSuggestions,
    readinessIndicators: opts.readinessIndicators,
    reviewItems: opts.reviewItems,
    docTotal: opts.docTotal,
    employmentMatterTags: opts.employmentMatterTags,
  });
  const timelineSummary = buildTimelineSummaryFromSections(sections);

  return { evidenceTimeline, timelineEvents, sections, timelineSummary };
}
