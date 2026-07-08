/**
 * Public demo experience — no auth required.
 * Accessible via /?demo or /demo in the URL.
 *
 * Shows the firm-side intake review with a fully populated sample intake
 * (Marcus Rivera) so anyone can see the product without signing in.
 */

import { IntakeReviewScreen } from './IntakeReviewScreen';
import { IntakeReviewErrorBoundary } from '../components/IntakeReviewErrorBoundary';
import type { FirmLiveIntakeView } from '../../services/intakeDataService';

const DEMO_FIRM_LIVE_VIEW: FirmLiveIntakeView = {
  previewOnly: false,
  routeId: 'demo-route-137',
  routeStatus: 'full_access',
  intakeNumber: '137-DEMO',
  isFirmCodeIntake: false,
  submissionChannel: 'participating',
  intakeWorkflowStatus: 'Under Firm Review',
  overview:
    'According to the worker\'s account and supporting records, Marcus Rivera was employed as a warehouse associate at a regional distribution center from March 2022 through January 2026. Worker reports pay and timekeeping concerns — including unpaid overtime and missed meal-break compensation — across 31 documented pay periods. Records currently reflect a formal HR complaint filed November 2025, a written warning issued 11 days later, and separation documentation dated January 2026 citing "performance deficiency," not corroborated by prior performance reviews on file. These patterns are organized for attorney review.',
  timelineSummary:
    'Timeline spans March 2022 – January 2026. Key inflection points: wage and pay concerns begin Q4 2022, pattern continues Q2 2023, formal HR complaint November 2025, written warning following the HR complaint December 2025 (11-day gap), termination January 2026 (34-day gap from complaint).',
  workerProvidedContext:
    `Marcus says he raised the overtime issue informally with his shift supervisor in early 2023 and was told "that's just how scheduling works here." He kept personal copies of his schedule on his phone after noticing discrepancies. His HR complaint in November 2025 was the first formal escalation. He was called into HR the following week and told his "attitude had become a concern."`,
  workerFollowUp: {
    employer: 'Pacific Ridge Distribution LLC',
    employmentDates: 'March 2022 – January 2026 (3 years, 10 months)',
    keyPeople: 'Shift supervisor Derek Howell; HR Manager Sandra Fitch; Regional Director (unnamed in docs)',
    employmentStatus: 'employment_ended',
    reimbursed: null,
    workedRemotely: 'no',
  },
  employmentMatterTags: ['wage_hour', 'wrongful_termination', 'retaliation'],
  events: [
    {
      id: 'demo-ev-1',
      event_date: 'Q4 2022 – Q1 2023',
      title: 'Overtime hours recorded without matching pay rate',
      category: 'Payroll Records',
      ai_summary:
        'Pay stubs from October 2022 through March 2023 reflect consistent undercount of overtime hours worked. Time records show 48–54 hour weeks while pay stubs reflect 40-hour straight-time calculations. Supported by Rivera_PayStub_Oct2022.pdf, Rivera_PayStub_Dec2022.pdf, Rivera_PayStub_Feb2023.pdf.',
      worker_context: 'I kept working extra because my supervisor said the hours would "balance out." They never did.',
    },
    {
      id: 'demo-ev-2',
      event_date: 'March – July 2023',
      title: 'Missed meal-break log entries across 14 documented shifts',
      category: 'Time Records',
      ai_summary:
        'Time records provided show 14 shifts across the March–July 2023 window where meal breaks are either missing entirely or logged as under 20 minutes despite a stated 30-minute minimum. Supported by Rivera_TimeRecords_Spring2023.pdf.',
      worker_context: 'We were told breaks were optional during peak season. I never signed anything saying I waived them.',
    },
    {
      id: 'demo-ev-3',
      event_date: 'November 26, 2025',
      title: 'Formal HR complaint filed — wage irregularities and timekeeping',
      category: 'HR Communications',
      ai_summary:
        'Worker submitted a written HR complaint dated November 26, 2025 referencing unpaid overtime and missed break compensation. Complaint names supervisor Derek Howell and requests payroll audit. HR acknowledged receipt the same day. Supported by Rivera_HR_Complaint_Nov2025.pdf.',
      worker_context: 'I filed the complaint after I found out a coworker had the same issue and they quietly settled with him.',
    },
    {
      id: 'demo-ev-4',
      event_date: 'December 7, 2025',
      title: 'Written warning issued — "attitude and conduct"',
      category: 'HR Communications',
      ai_summary:
        'Written warning issued to Marcus Rivera on December 7, 2025 — 11 days after formal HR complaint. Warning cites "attitude and conduct concerns" and "failure to follow supervisor direction." No prior disciplinary record appears in documents provided. Supported by Rivera_WrittenWarning_Dec2025.pdf.',
      worker_context: 'I had never received any warning in over three years. This came out of nowhere right after my complaint.',
    },
    {
      id: 'demo-ev-5',
      event_date: 'January 10, 2026',
      title: 'Employment terminated — stated reason: performance deficiency',
      category: 'Termination Records',
      ai_summary:
        'Termination letter dated January 10, 2026 cites "ongoing performance deficiency." No performance improvement plan on file. Termination follows 34 days after formal HR complaint. No prior performance reviews in the record set reflect deficiency. Supported by Rivera_TerminationLetter_Jan2026.pdf.',
      worker_context: 'My last two annual reviews were "meets expectations" or above. There was no PIP, no second warning, nothing.',
    },
    {
      id: 'demo-ev-6',
      event_date: 'January 2026',
      title: 'Final pay period — discrepancy documented',
      category: 'Payroll Records',
      ai_summary:
        'Final pay stub reflects 3.5 days of accrued PTO not paid out, contrary to stated company policy in the employee handbook excerpt provided. Supported by Rivera_FinalPayStub_Jan2026.pdf, Rivera_EmployeeHandbook_PTO_excerpt.pdf.',
      worker_context: 'They said I forfeited the PTO because I was terminated for cause. The handbook says otherwise.',
    },
  ],
  files: [
    { file_name: 'Rivera_PayStub_Oct2022.pdf', category: 'Payroll Records' },
    { file_name: 'Rivera_PayStub_Dec2022.pdf', category: 'Payroll Records' },
    { file_name: 'Rivera_PayStub_Feb2023.pdf', category: 'Payroll Records' },
    { file_name: 'Rivera_FinalPayStub_Jan2026.pdf', category: 'Payroll Records' },
    { file_name: 'Rivera_TimeRecords_Spring2023.pdf', category: 'Time Records' },
    { file_name: 'Rivera_TimeRecords_Q3_2023.pdf', category: 'Time Records' },
    { file_name: 'Rivera_HR_Complaint_Nov2025.pdf', category: 'HR Communications' },
    { file_name: 'Rivera_WrittenWarning_Dec2025.pdf', category: 'HR Communications' },
    { file_name: 'Rivera_TerminationLetter_Jan2026.pdf', category: 'Termination Records' },
    { file_name: 'Rivera_EmployeeHandbook_PTO_excerpt.pdf', category: 'HR Communications' },
    { file_name: 'Rivera_PersonalScheduleNotes_2023.pdf', category: 'Time Records' },
  ],
  readiness: [
    'Payroll discrepancy documented across 12+ pay periods',
    'HR complaint on file with acknowledged receipt',
    'Written warning issued 11 days post-complaint — timing noted',
    'Termination letter on file — 34-day gap from complaint',
    'No prior disciplinary record in documents provided',
    'Final pay discrepancy documented against handbook policy',
  ],
  missing: [
    'Prior performance reviews pre-complaint (2022–2024) not in current record set — may be relevant to attorney evaluation',
    'Coworker statements or corroboration not yet included',
  ],
  documentRequest: null,
  documentResponse: null,
  intelligence: {
    confirmedEmployer: 'Pacific Ridge Distribution LLC',
    confirmedComplaintTopic: 'Unpaid overtime and missed meal-break compensation',
    confirmedComplaintDate: 'November 26, 2025',
    confirmedHrResponseSummary: 'HR acknowledged receipt same day; written warning issued 11 days later',
    confirmedWarningReason: '"Attitude and conduct concerns; failure to follow supervisor direction"',
    confirmedWarningDate: 'December 7, 2025',
    confirmedTerminationReason: '"Ongoing performance deficiency" — not corroborated by prior reviews',
    confirmedTerminationDate: 'January 10, 2026',
    confirmedStartDate: 'March 2022',
    overtimeIssueDetected: true,
    finalPayPresent: true,
    coworkerCorroboration: [],
    timingIntervals: [
      {
        label: 'HR response',
        days: 11,
        description: 'Written warning issued 11 days after complaint',
      },
      {
        label: 'Termination',
        days: 34,
        description: 'Employment ended 34 days after complaint',
      },
    ],
    keyQuotes: [
      {
        file_name: 'Rivera_WrittenWarning_Dec2025.pdf',
        category: 'HR Communications',
        quote:
          'Employee has demonstrated a pattern of attitude and conduct concerns inconsistent with company expectations.',
        confidence: 'high',
      },
      {
        file_name: 'Rivera_TerminationLetter_Jan2026.pdf',
        category: 'Termination Records',
        quote:
          'After careful consideration, the Company has determined that your continued employment is no longer consistent with our performance standards.',
        confidence: 'high',
      },
      {
        file_name: 'Rivera_HR_Complaint_Nov2025.pdf',
        category: 'HR Communications',
        quote:
          'I am formally requesting a payroll audit covering the period October 2022 to present, specifically regarding overtime calculation and meal-break compensation.',
        confidence: 'high',
      },
    ],
    confirmationNeeded: [
      'Prior annual performance reviews (2022–2024) not in current record set — may be relevant to attorney evaluation',
      'Coworker corroboration not yet documented',
    ],
    clarificationQuestions: [
      'Pay records show overtime hours without a matching overtime rate. Do you have additional paystubs or wage statements for those periods?',
      'No coworker statement is in the records. Is there anyone who saw what happened who could share what they observed?',
    ],
    // Not surfaced in the demo review UI; empty keeps the sample honest (no
    // fabricated raw flag tokens or wage-exposure figures).
    allFlags: [],
    wageFacts: [],
  },
};

export function DemoApp() {
  const handleBackToDashboard = () => {
    // In demo mode "back" just reloads to the demo — no real dashboard exists
  };

  const handleSignUp = () => {
    // Remove ?demo from URL and go to the main app (sign-up flow)
    window.location.href = window.location.pathname;
  };

  return (
    <div className="relative">
      {/* Slim fixed banner — brand + CTA only, stays out of the way */}
      <div className="fixed bottom-0 left-0 right-0 z-[999] bg-[#14112E]/95 backdrop-blur text-white px-4 py-2.5 flex items-center justify-between gap-3 border-t border-white/10">
        <p className="text-xs text-white/50 truncate">
          one3seven · Sample intake preview
        </p>
        <button
          onClick={handleSignUp}
          className="shrink-0 rounded-full bg-[#5B21B6] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#4C1D96] transition-colors"
        >
          Get your firm intake link →
        </button>
      </div>

      {/* Offset content so it's not hidden behind the bottom banner */}
      <div className="pb-12">
        <IntakeReviewErrorBoundary onBackToDashboard={handleBackToDashboard}>
          <IntakeReviewScreen
            onNavigate={() => {}}
            intakeId="sample-137-demo"
            onUpdateWorkspace={() => {}}
            firmLiveView={DEMO_FIRM_LIVE_VIEW}
            firmLiveViewLoading={false}
            firmDisplayName="Demo Law Firm"
            firmBellNotifications={[]}
            demoMode
            onRequestFullAccess={undefined}
            onAcceptIntake={undefined}
            onDeclineIntake={undefined}
            onRequestAdditionalDocuments={undefined}
            onReloadFirmLiveView={undefined}
          />
        </IntakeReviewErrorBoundary>
      </div>
    </div>
  );
}
