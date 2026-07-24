import { CaseFactsAssembledPanel } from '../components/CaseFactsAssembledPanel';
import { detectCaseTimelinePatterns } from '../../services/caseTimelinePatterns';
import { assessEmployerRecordCoverage } from '../../services/caEmployerRecordRequirements';
import { detectPayPeriodGaps, parseEmploymentDateRange, inferPayFrequency } from '../../services/gapDetection';
import { calculateDamages } from '../../services/damagesCalculator';
import { WordMark } from '../components/WordMark';

/**
 * /?case-demo — the firm-facing sales canvas. Runs Marcus Rivera's illustrative data through ALL
 * FOUR factual engines (proximity · record coverage · pay gaps · wage exposure) into the assembled
 * attorney worksheet. This is the "we did your intake" moment the sales team points at.
 */

const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

// Illustrative sample (Marcus Rivera) — same worker used across the demos.
const EMPLOYMENT_DATES = 'March 2022 – January 2026';
const PAYROLL_DATES = [new Date(2025, 9, 3), new Date(2025, 9, 17), new Date(2025, 10, 14), new Date(2025, 11, 12)];

const TIMELINE = [
  { date: 'March 2022', title: 'Employment begins' },
  { date: 'Nov 14, 2025', title: 'Formal HR complaint filed' },
  { date: 'Nov 25, 2025', title: 'Written warning issued' },
  { date: 'Dec 19, 2025', title: 'Employment terminated' },
];

const FILE_INVENTORY = [
  { fileName: 'PayStub_Oct2025.pdf', category: 'Wage Records' },
  { fileName: 'PayStub_Nov2025.pdf', category: 'Wage Records' },
  { fileName: 'Final_Paycheck.pdf', category: 'Wage Records' },
  { fileName: 'HR_Complaint_Nov14.pdf', category: 'HR Communications' },
  { fileName: 'Written_Warning.pdf', category: 'Employer Documents' },
  { fileName: 'Termination_Letter.pdf', category: 'Employer Documents' },
  { fileName: 'Offer_Letter_2022.pdf', category: 'Employment Records' },
];

export function CaseFactsDemoPage() {
  const proximity = detectCaseTimelinePatterns(TIMELINE);
  const coverage = assessEmployerRecordCoverage(FILE_INVENTORY, { stillEmployed: false });
  const { start, end } = parseEmploymentDateRange(EMPLOYMENT_DATES);
  const gaps = detectPayPeriodGaps({
    employmentStart: start,
    employmentEnd: end,
    payFrequency: inferPayFrequency(PAYROLL_DATES) ?? 'biweekly',
    payrollRecordDates: PAYROLL_DATES,
  });
  const damages = calculateDamages({
    regularHourlyRate: { value: 22, citation: null },
    overtimeRateApplied: { value: null, citation: null }, // records show no OT premium applied
    overtimeHoursWorked: { value: 48, citation: null },
    mealBreaksMissed: { value: 14, citation: null },
    payPeriodsPresent: gaps.documentedPeriods,
    expectedPayPeriods: gaps.estimatedPeriods,
  });

  return (
    <div style={BODY} className="min-h-screen bg-[#F1F3EF] text-[#17181C]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[19px] font-semibold">
          <WordMark />
        </span>
        <span className="text-[12px] font-medium text-[#6a6d66]">For California employment firms</span>
      </nav>

      <div className="mx-auto max-w-6xl px-6 pb-6">
        <div style={{ fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' }} className="text-[11px] uppercase tracking-[0.16em] text-[#42574E]">
          What lands on your desk
        </div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mt-2 max-w-[24ch] text-[clamp(26px,4vw,40px)] font-semibold leading-[1.05] tracking-[-0.01em]">
          The worker uploads a shoebox. You open a review-ready file.
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-[#40433f]">
          Every fact below was organized from the worker's own records — the sequence, the record coverage, the
          gaps to request in discovery, and the wage-exposure arithmetic. one3seven organizes and reflects; it
          never concludes. Your team evaluates.
        </p>
      </div>

      <div className="px-4 pb-16 sm:px-6">
        <CaseFactsAssembledPanel
          workerName="Marcus Rivera"
          employer="Pacific Ridge Distribution LLC"
          employmentDates={EMPLOYMENT_DATES}
          proximity={proximity}
          coverage={coverage}
          gaps={gaps}
          damages={damages}
          documents={FILE_INVENTORY}
          illustrative
        />
      </div>
    </div>
  );
}
