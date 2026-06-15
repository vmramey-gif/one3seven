/**
 * Neutral-language validation for deterministic organization output.
 */

import type { PlaceholderOrganizationResult } from './intakeOrganizationTypes';
import { ORGANIZATION_BANNED_OUTPUT_PATTERN } from './intakeGenerationVoice';

/** Flatten all user-visible strings produced by an organization run. */
export function collectOrganizationOutputText(org: PlaceholderOrganizationResult): string {
  const fileRecordText = org.fileRecords.flatMap((r) => [
    r.file_name,
    r.document_type,
    r.legacy_upload_category ?? '',
    r.likely_date ?? '',
    ...r.people_or_entities,
    ...r.employment_topics,
    r.possible_timeline_event?.title ?? '',
    r.possible_timeline_event?.date ?? '',
    r.possible_timeline_event?.neutral_summary ?? '',
    ...r.missing_or_unclear_information,
  ]);

  const evidenceText = org.evidenceTimeline.flatMap((e) => [
    e.title,
    e.neutral_summary,
    ...e.people_involved,
    ...e.related_topics,
    ...e.gaps_or_uncertainties,
  ]);
  const sectionText = org.sections
    ? [
        org.sections.executive_summary,
        ...org.sections.chronology,
        ...org.sections.people_and_entities,
        ...org.sections.supporting_records.map((r) => `${r.file_name} ${r.note}`),
        ...org.sections.potential_gaps,
        ...org.sections.clarification_items,
        ...org.sections.review_notes,
        org.sections.disclaimer,
      ]
    : [];

  return [
    org.recordStory,
    org.firmReviewSummary,
    org.overview,
    org.timelineSummary,
    ...org.timelineEvents.map((e) => `${e.title} ${e.aiSummary} ${e.category}`),
    ...org.readinessIndicators,
    ...org.missingDocumentSuggestions,
    ...org.reviewItems.map((r) => `${r.title} ${r.whyNeedsReview} ${r.clarifyingRecord ?? ''}`),
    ...fileRecordText,
    ...evidenceText,
    ...sectionText,
    ...org.peopleIndex,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Throws when organization output contains banned legal-conclusion phrasing. */
export function assertNeutralOrganizationOutput(org: PlaceholderOrganizationResult): void {
  const blob = collectOrganizationOutputText(org);
  ORGANIZATION_BANNED_OUTPUT_PATTERN.lastIndex = 0;
  const match = ORGANIZATION_BANNED_OUTPUT_PATTERN.exec(blob);
  if (match) {
    throw new Error(`Banned phrase in organization output: "${match[0]}"`);
  }
}
