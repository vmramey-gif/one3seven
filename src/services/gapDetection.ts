/**
 * Gap Detection — Layer 1 (structural pay-period coverage).
 *
 * DOCTRINE: "Describe the record, not the case." This computes how much of the expected
 * PAY-PERIOD RECORD is present, from the employment dates and a pay frequency. It measures
 * the completeness of the FILE — never the strength, value, or merit of the matter.
 *
 * HARD RULE: every number this produces is ESTIMATED and must be labeled so in the UI. Real
 * employment distorts the arithmetic (unpaid leave, pay-frequency changes, partial first/final
 * periods, seasonal work, multiple payroll entities, off-cycle/amended statements), so the
 * worker always gets a correction control. A confident-but-wrong "59 missing" to someone who
 * knows she took months of unpaid leave destroys trust instantly.
 *
 * V1 is intentionally arithmetic-only. Narrative (story cross-reference) and referential
 * (documents citing documents) layers are separate, later work.
 */

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  semimonthly: 'Twice a month',
  monthly: 'Monthly',
};

/** Most common private-sector schedule in the US — the sensible default when none is stated. */
export const DEFAULT_PAY_FREQUENCY: PayFrequency = 'biweekly';

export type GapDetectionInput = {
  employmentStart: Date | null;
  employmentEnd: Date | null;
  payFrequency: PayFrequency;
  /** Dates of uploaded payroll/wage records (one per statement). Undated records are ignored here. */
  payrollRecordDates: Date[];
};

export type CoveragePeriod = {
  index: number;
  start: Date;
  end: Date;
  covered: boolean;
};

/** A contiguous run of periods, for the coverage rail + human labels ("Aug–Dec 2024"). */
export type CoverageSegment = {
  covered: boolean;
  start: Date;
  end: Date;
  periodCount: number;
  label: string;
};

export type GapDetectionResult = {
  computable: boolean;
  /** Why it couldn't compute (missing dates) — for an honest empty state, never a fake number. */
  reason?: 'missing-start' | 'missing-end' | 'missing-both' | 'invalid-range';
  estimatedPeriods: number;
  documentedPeriods: number;
  undocumentedPeriods: number;
  payFrequency: PayFrequency;
  periods: CoveragePeriod[];
  segments: CoverageSegment[];
  /** The undocumented segments only, ready to describe/request. */
  gapSegments: CoverageSegment[];
};

const MS_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Step a period start to the next period start for the frequency. Pure calendar math. */
function nextPeriodStart(start: Date, freq: PayFrequency): Date {
  const d = new Date(start);
  switch (freq) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      return d;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      return d;
    case 'semimonthly':
      // 1st→16th→1st-of-next-month. Approximate to the two conventional splits.
      if (d.getDate() < 16) return new Date(d.getFullYear(), d.getMonth(), 16);
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    case 'monthly':
      return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
}

/** Format a covered/gap run as workers read dates: "Sep 2024", "Aug–Dec 2024", "Nov 2024 – Feb 2025". */
export function formatCoverageRange(start: Date, end: Date): string {
  const mo = (d: Date) => d.toLocaleString('en-US', { month: 'short' });
  const yr = (d: Date) => d.getFullYear();
  if (yr(start) === yr(end)) {
    if (start.getMonth() === end.getMonth()) return `${mo(start)} ${yr(start)}`;
    return `${mo(start)}–${mo(end)} ${yr(start)}`;
  }
  return `${mo(start)} ${yr(start)} – ${mo(end)} ${yr(end)}`;
}

/**
 * Build the ordered list of pay periods across the employment span, mark which are covered by
 * an uploaded payroll record, and group contiguous runs into rail segments.
 */
export function detectPayPeriodGaps(input: GapDetectionInput): GapDetectionResult {
  const empty = (reason: GapDetectionResult['reason']): GapDetectionResult => ({
    computable: false,
    reason,
    estimatedPeriods: 0,
    documentedPeriods: 0,
    undocumentedPeriods: 0,
    payFrequency: input.payFrequency,
    periods: [],
    segments: [],
    gapSegments: [],
  });

  const { employmentStart, employmentEnd, payFrequency } = input;
  if (!employmentStart && !employmentEnd) return empty('missing-both');
  if (!employmentStart) return empty('missing-start');
  if (!employmentEnd) return empty('missing-end');

  const start = startOfDay(employmentStart);
  const end = startOfDay(employmentEnd);
  if (end.getTime() <= start.getTime()) return empty('invalid-range');

  // Build periods by stepping period starts until we pass the employment end.
  const periods: CoveragePeriod[] = [];
  let cursor = new Date(start);
  let guard = 0;
  while (cursor.getTime() < end.getTime() && guard < 2000) {
    const next = nextPeriodStart(cursor, payFrequency);
    const periodEnd = new Date(Math.min(next.getTime() - MS_DAY, end.getTime()));
    periods.push({ index: periods.length, start: new Date(cursor), end: periodEnd, covered: false });
    cursor = next;
    guard += 1;
  }
  if (periods.length === 0) return empty('invalid-range');

  // Mark covered: a payroll record dated within a period (inclusive) covers it.
  for (const raw of input.payrollRecordDates) {
    if (!(raw instanceof Date) || Number.isNaN(raw.getTime())) continue;
    const t = startOfDay(raw).getTime();
    const hit = periods.find((p) => t >= p.start.getTime() && t <= p.end.getTime());
    if (hit) hit.covered = true;
  }

  // Group contiguous covered/gap runs.
  const segments: CoverageSegment[] = [];
  for (const p of periods) {
    const last = segments[segments.length - 1];
    if (last && last.covered === p.covered) {
      last.end = p.end;
      last.periodCount += 1;
      last.label = formatCoverageRange(last.start, last.end);
    } else {
      segments.push({
        covered: p.covered,
        start: p.start,
        end: p.end,
        periodCount: 1,
        label: formatCoverageRange(p.start, p.end),
      });
    }
  }

  const documentedPeriods = periods.filter((p) => p.covered).length;
  return {
    computable: true,
    estimatedPeriods: periods.length,
    documentedPeriods,
    undocumentedPeriods: periods.length - documentedPeriods,
    payFrequency,
    periods,
    segments,
    gapSegments: segments.filter((s) => !s.covered),
  };
}

/**
 * Parse the free-text employmentDates field ("March 2022 – January 2026", "3/2022 to 1/2026",
 * "2022 - 2026") into a start/end. Returns nulls it can't resolve — never guesses a date.
 */
export function parseEmploymentDateRange(raw: string | null | undefined): {
  start: Date | null;
  end: Date | null;
} {
  if (!raw || !raw.trim()) return { start: null, end: null };
  // Split on common range separators (en/em dash, hyphen with spaces, "to", "through", "until").
  const parts = raw
    .split(/\s*(?:–|—|\bto\b|\bthrough\b|\buntil\b|(?<=\d)\s*-\s*(?=[A-Za-z\d]))\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const startStr = parts[0] ?? '';
  const endStr = parts.length > 1 ? parts[parts.length - 1] : '';
  return { start: parseOneDate(startStr, false), end: parseOneDate(endStr, true) };
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/** Parse one endpoint. isEnd=true resolves a bare year/month to the END of that unit. */
function parseOneDate(s: string, isEnd: boolean): Date | null {
  if (!s) return null;
  const t = s.trim().toLowerCase().replace(/,/g, '');

  // "March 2022" | "Mar 2022"
  let m = t.match(/^([a-z]+)\s+(\d{4})$/);
  if (m && MONTHS[m[1]] !== undefined) {
    const mo = MONTHS[m[1]];
    const yr = Number(m[2]);
    return isEnd ? new Date(yr, mo + 1, 0) : new Date(yr, mo, 1);
  }
  // "03/2022" | "3/2022"
  m = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mo = Number(m[1]) - 1;
    const yr = Number(m[2]);
    if (mo >= 0 && mo <= 11) return isEnd ? new Date(yr, mo + 1, 0) : new Date(yr, mo, 1);
  }
  // "03/15/2022" | "3/15/22"
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const mo = Number(m[1]) - 1;
    const day = Number(m[2]);
    let yr = Number(m[3]);
    if (yr < 100) yr += 2000;
    if (mo >= 0 && mo <= 11 && day >= 1 && day <= 31) return new Date(yr, mo, day);
  }
  // "2022-03" | "2022/03"
  m = t.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) {
    const yr = Number(m[1]);
    const mo = Number(m[2]) - 1;
    if (mo >= 0 && mo <= 11) return isEnd ? new Date(yr, mo + 1, 0) : new Date(yr, mo, 1);
  }
  // bare "2022"
  m = t.match(/^(\d{4})$/);
  if (m) {
    const yr = Number(m[1]);
    return isEnd ? new Date(yr, 11, 31) : new Date(yr, 0, 1);
  }
  return null;
}
