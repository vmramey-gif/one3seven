/** Placeholder organization — filename/type and upload inventory; no document body parsing. */

import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import type { UploadedFileMeta } from './employmentTimelineOrganization';
import type { PlaceholderOrganizationResult } from './intakeOrganizationTypes';
import {
  buildMissingRecordSuggestion,
  clipSentences,
  sanitizeGenerationPhrase,
  takenTogetherPhrase,
} from './intakeGenerationVoice';
import { applyEvidenceMappedOrganization } from './intakeOrganizationEngine';
import { buildPerFileOrganizationRecords } from './perFileOrganizationService';

export type { PlaceholderOrganizationResult, OrganizationTimelineEvent } from './intakeOrganizationTypes';
export type { UploadedFileMeta };

function isPayrollCategoryLabel(cat: string) {
  return cat === 'Pay Records / Payroll' || cat === 'Pay Records';
}

function aggregateCategories(files: UploadedFileMeta[]) {
  const map = new Map<string, number>();
  for (const f of files) {
    const c = f.category || 'Uncategorized';
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

export function buildPlaceholderOrganization(
  files: UploadedFileMeta[],
  orgContext?: { employmentMatterTags?: EmploymentMatterTagId[] }
): PlaceholderOrganizationResult {
  const n = files.length;
  const cats = aggregateCategories(files);
  const hasPayroll = files.some((f) => isPayrollCategoryLabel(f.category));

  const { fileRecords, peopleIndex } = buildPerFileOrganizationRecords(
    files.map((f) => ({
      uploadedFileId: f.uploadedFileId,
      fileName: f.fileName,
      category: f.category,
    }))
  );

  const recordStory =
    n === 0
      ? 'No records are uploaded yet. When files are added, a short chronology summary will appear here.'
      : clipSentences(
          takenTogetherPhrase(
            'uploaded employment-related materials are grouped to support chronology review once readable text is available.'
          ),
          3,
          420
        );

  const overview =
    n === 0
      ? 'No files were uploaded. Add employment-related records to continue.'
      : [
          takenTogetherPhrase(
            'uploads are organized for human review — not legal advice or outcome prediction.'
          ),
          sanitizeGenerationPhrase(
            'File names and categories are indexed until readable text is available; chronology will sharpen after processing.'
          ),
        ].join('\n\n');

  const readinessIndicators: string[] = [];
  if (n > 0) {
    readinessIndicators.push(
      sanitizeGenerationPhrase('Materials are grouped for review; originals should be checked when details matter.')
    );
    if (hasPayroll) {
      readinessIndicators.push(
        sanitizeGenerationPhrase(
          'Payroll-related files are present — pay periods may need confirmation alongside time records if both exist.'
        )
      );
    }
  }

  const missingDocumentSuggestions: string[] = [];
  if (!hasPayroll && n > 0) {
    missingDocumentSuggestions.push(buildMissingRecordSuggestion('payroll or wage records for relevant periods'));
  }

  const firmReviewSummary = clipSentences(
    `${overview.split('\n\n')[0] ?? ''} Timeline entries and notes below flag items that may need human review.`,
    3,
    420
  );

  const evidenceOrg = applyEvidenceMappedOrganization({
    fileRecords,
    peopleIndex,
    executiveLead: firmReviewSummary,
    missingDocumentSuggestions,
    readinessIndicators,
    reviewItems: [],
    docTotal: n,
    employmentMatterTags: orgContext?.employmentMatterTags,
  });

  return {
    recordStory,
    firmReviewSummary,
    overview,
    timelineSummary: evidenceOrg.timelineSummary,
    timelineEvents: evidenceOrg.timelineEvents,
    documentCategories: cats,
    readinessIndicators,
    missingDocumentSuggestions,
    reviewItems: [],
    fileRecords,
    peopleIndex,
    evidenceTimeline: evidenceOrg.evidenceTimeline,
    sections: evidenceOrg.sections,
  };
}
