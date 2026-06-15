/** Firm intake review presentation (layout/copy helpers only — no workflow logic). */
export const FIRM_INTAKE_ACTIONS = {
  showMore: 'Show more',
  showLess: 'Show less',
  showFullAnalysis: 'View full narrative',
} as const;

export const FIRM_REVIEW_SECTION = {
  intakeOverview: 'Intake Overview',
  workerStory: 'Worker Context',
  timelineHighlights: 'Chronology',
  recordsAvailable: 'Supporting Records',
  topicsInRecords: 'Topics Reflected in the Records',
  additionalContext: 'Additional Context That May Help',
  fullRecordSummary: 'Intake summary',
  timelineReview: 'Chronology summary',
  supportingMaterials: 'Supporting records',
  firmActivity: 'Firm activity and routing',
} as const;
