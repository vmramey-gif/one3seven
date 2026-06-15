/**
 * Assembles Phase 2 evidence timeline + Phase 3 sections after per-file records exist.
 */

import {
  buildEvidenceMappedTimelineEvents,
  evidenceTimelineToOrganizationEvents,
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

  const evidenceTimeline = buildEvidenceMappedTimelineEvents({
    fileRecords: opts.fileRecords,
    payFacts,
    commFacts,
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
