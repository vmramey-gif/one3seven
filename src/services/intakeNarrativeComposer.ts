/**
 * Shared intake narrative for worker summary excerpts and export digests.
 * Story-first presentation — avoids document-centric AI narration.
 */

import type { IntakeSummaryDownloadPayload } from './intakeSummaryDownload';
import {
  buildExecutiveSummary,
  buildMissingRecordBullets,
  buildReviewTopicBullets,
} from './packetStoryPresentation';

export type ComposedIntakeNarrative = {
  /** Short executive summary paragraphs (joined with blank lines for display). */
  intakeAtAGlance: string;
  chronologyOverview: string;
  reviewFocusAreas: string[];
  recordCompleteness: string[];
};

/**
 * Build shared narrative sections from persisted intake summary fields.
 */
export function composeIntakeNarrativeForDisplay(
  payload: IntakeSummaryDownloadPayload
): ComposedIntakeNarrative {
  return {
    intakeAtAGlance: buildExecutiveSummary(payload),
    chronologyOverview: '',
    reviewFocusAreas: buildReviewTopicBullets(payload),
    recordCompleteness: buildMissingRecordBullets(payload),
  };
}

/** Alias for call sites that pass the standard download payload. */
export function composeIntakeNarrativeFromPayload(
  payload: IntakeSummaryDownloadPayload
): ComposedIntakeNarrative {
  return composeIntakeNarrativeForDisplay(payload);
}

/**
 * Legacy digest helper — returns executive summary only (Records Reviewed So Far removed).
 */
export function formatDocumentGroundedOverviewDigest(narrative: ComposedIntakeNarrative): string {
  return narrative.intakeAtAGlance.trim();
}
