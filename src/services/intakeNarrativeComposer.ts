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
