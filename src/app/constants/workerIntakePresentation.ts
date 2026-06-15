/**
 * Person-facing language system — calm record organization, not legal analysis.
 */

import { ONE3SEVEN_UNIVERSAL_DISCLAIMER } from './one3sevenProduct';

export const WORKER_DISCLAIMER_SHORT = ONE3SEVEN_UNIVERSAL_DISCLAIMER;

export const WORKER_INTAKE_SECTIONS = {
  recordStory: 'What your records show so far',
  currentUnderstanding: 'Intake Overview',
  organizationProgress: 'Organization Progress',
  fullRecordSummary: 'Records Reviewed So Far',
  yourWords: 'In your own words',
  timeline: 'Timeline',
  reviewItems: 'Possible Missing Records',
  documentTypes: 'Records Included',
  uploadedFiles: 'Uploaded records',
  printablePacket: 'Review packet preview',
  firmActivity: 'Firm connection',
  workflowSteps: 'Next step',
  howItWorks: 'How this is organized',
} as const;

export const WORKER_INTAKE_ACTIONS = {
  openSummary: 'View timeline',
  editIntake: 'Add records',
  fullReview: 'Full review',
  exitFullReview: 'Back to overview',
  downloadPacket: 'Download review packet',
  showMore: 'Show more',
  showLess: 'Show less',
  viewSupportingRecords: 'View supporting records',
} as const;

export const WORKER_HUB_COPY = {
  hubHeadline: 'Your timeline is taking shape.',
  hubSubline: (recordCount: number, eventCount: number) =>
    recordCount > 0 || eventCount > 0
      ? `${recordCount} record${recordCount === 1 ? '' : 's'} connected across ${eventCount} key event${eventCount === 1 ? '' : 's'}.`
      : 'Connect records to build a clear chronology for review.',
  hubInlineStatus: (recordCount: number, eventCount: number, gapCount: number) => {
    const gaps =
      gapCount > 0
        ? `${gapCount} Gap${gapCount === 1 ? '' : 's'} To Review`
        : 'No Gaps Noted';
    return `${recordCount} Records Connected • ${eventCount} Key Events • ${gaps}`;
  },
  hubGreeting: (name: string) => `Good morning, ${name}`,
  activeLabel: 'Active intake',
  intakesLabel: 'Records available',
  summaryReady: 'Summary ready',
  nextStepLabel: 'Next step',
} as const;

export const WORKER_DOC_REQUEST_DASHBOARD_COPY = {
  headline: 'A law firm needs more records from you',
  subline: (firmName: string) => `${firmName} is waiting on documents to continue review.`,
  firmLabel: 'Firm name',
  requestedRecordsLabel: 'Requested records',
  firmMessageLabel: 'Firm message',
  uploadCta: 'Upload requested records',
  viewTimeline: 'View timeline',
} as const;

export const WORKER_DOC_REQUEST_ALERT_COPY = {
  title: 'Additional records requested',
  bodyWithFirm: (firmName: string) => `${firmName} asked for more records to continue review.`,
  bodyGeneric: 'Your firm asked for more records to continue review.',
  primaryCta: 'Review request & upload records',
  confirmCta: 'Open summary to confirm response',
} as const;

export const WORKER_UPLOAD_COPY = {
  storyProvided: 'Story provided',
  viewStory: 'View story',
  hideStory: 'Hide story',
} as const;

export const WORKER_DOC_REQUEST_PANEL_COPY = {
  sectionTitle: 'Additional records requested',
  categoriesLabel: 'Requested records',
  firmMessageLabel: 'Firm message',
  notePrefix: (firmName: string) => `${firmName} wrote:`,
  detailsLoading: 'Request details are still loading. Refresh or return from your dashboard if this stays empty.',
  uploadSectionTitle: 'Upload requested records',
  uploadSectionHint: 'Add the files your firm asked for, then organize them so your summary stays up to date.',
  summaryCollapsedTitle: 'Existing intake summary',
  summaryCollapsedHint:
    'Your organized summary is saved below. Upload new records first — you can confirm what you sent from your summary after organizing.',
} as const;

export const WORKER_DOC_REQUEST_STATUS_COPY = {
  uploadedTitle: 'Requested records uploaded',
  uploadedBody: 'Organize your new uploads, then confirm your response on your intake summary.',
  submittedTitle: 'Records sent back to firm',
  submittedBody: 'Your firm can review your response when they open this intake on their dashboard.',
} as const;

export const WORKER_DOC_REQUEST_BELL_COPY = {
  actionLabel: 'Review request & upload records',
} as const;

/** Approved neutral phrasing for flags and gaps (never legal conclusions). */
/** How firmly a timeline row is tied to uploaded files (from generation metadata). */
export const WORKER_SOURCE_STRENGTH_LABELS: Record<string, string> = {
  strong: 'Directly supported by uploaded text',
  partial: 'Partially supported by uploaded text',
  inferred: 'Grouped from file type and filename',
  needs_review: 'Needs review against source files',
};

export const WORKER_REVIEW_PHRASES = {
  flagged: 'Flagged for professional review',
  inconsistency: 'Potential inconsistency identified',
  timelineGap: 'Timeline gap detected between uploaded records',
  compensationVariation: 'Compensation structure variation noted',
  additionalReview: 'Additional review may be recommended',
  needsReview: 'Needs review against source records',
} as const;
