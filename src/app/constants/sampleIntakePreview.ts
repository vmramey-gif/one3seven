/** Single labeled demo row for empty dashboards   gated by `SHOW_SAMPLE_INTAKE` in flags.ts (from App). */
export const SAMPLE_INTAKE_NUMBER = '137-DEMO';

export const SAMPLE_WORKER_INTAKE_CARD = {
  intake_number: SAMPLE_INTAKE_NUMBER,
  workflow_status: 'Intake Summary Generated',
  updated_at: new Date().toISOString(),
  has_summary: true,
  label: 'Demo preview',
  categoriesLine: 'Payroll � Scheduling � HR Communication',
  timelineSummary:
    'Records span multiple pay periods with scheduling communications and HR policy references. Language is factual and organizational only.',
  missingLine: 'Additional schedule records may help complete the timeline.',
  workerLabel: 'Sample initials: V.R.',
} as const;

export const SAMPLE_FIRM_INTAKE_ROW = {
  id: 'sample-firm-intake',
  routeId: 'sample-route',
  routeStatus: 'preview_sent',
  intakeNumber: SAMPLE_INTAKE_NUMBER,
  readiness: 'ready' as const,
  categories: ['Payroll', 'Scheduling', 'HR Communication'],
  documentCount: 4,
  uploadDate: '2026-05-01',
  workerLocation: ' ',
  employerState: ' ',
  timelineComplete: true,
  hasAlerts: false,
  lastActivity: 'Demo preview',
  reviewStatus: 'new' as const,
  summary:
    'Sample intake summary: payroll and scheduling materials are grouped with HR communications. Neutral factual organization only.',
  submissionType: 'Participating Firm Review' as const,
  timelineSummary:
    'Payroll periods align with posted schedules; HR communications reference policy acknowledgments.',
  readinessHints: ['Records grouped for review preparation'],
  missingHints: ['Additional schedule records may help complete the timeline.'],
  workflowStatusLabel: 'Intake Summary Generated',
  workerLabel: 'Sample record owner',
  label: 'Demo preview',
};
