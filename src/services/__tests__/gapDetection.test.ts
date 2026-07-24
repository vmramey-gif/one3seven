import { describe, it, expect } from 'vitest';
import {
  detectPayPeriodGaps,
  parseEmploymentDateRange,
  formatCoverageRange,
} from '../gapDetection';

describe('parseEmploymentDateRange', () => {
  it('parses "Month YYYY – Month YYYY"', () => {
    const { start, end } = parseEmploymentDateRange('March 2022 – January 2026');
    expect(start?.getFullYear()).toBe(2022);
    expect(start?.getMonth()).toBe(2); // March
    expect(end?.getFullYear()).toBe(2026);
    expect(end?.getMonth()).toBe(0); // January
  });

  it('parses "M/YYYY to M/YYYY"', () => {
    const { start, end } = parseEmploymentDateRange('3/2022 to 1/2026');
    expect(start?.getMonth()).toBe(2);
    expect(end?.getMonth()).toBe(0);
  });

  it('resolves a bare year end to Dec 31', () => {
    const { start, end } = parseEmploymentDateRange('2022 - 2024');
    expect(start?.getMonth()).toBe(0);
    expect(end?.getMonth()).toBe(11);
    expect(end?.getDate()).toBe(31);
  });

  it('returns nulls for unparseable text rather than guessing', () => {
    const { start, end } = parseEmploymentDateRange('a couple years ago');
    expect(start).toBeNull();
    expect(end).toBeNull();
  });

  it('returns nulls for empty', () => {
    expect(parseEmploymentDateRange('').start).toBeNull();
    expect(parseEmploymentDateRange(null).end).toBeNull();
  });
});

describe('detectPayPeriodGaps', () => {
  it('estimates biweekly periods across a year (~26)', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2024, 0, 1),
      employmentEnd: new Date(2024, 11, 31),
      payFrequency: 'biweekly',
      payrollRecordDates: [],
    });
    expect(r.computable).toBe(true);
    expect(r.estimatedPeriods).toBeGreaterThanOrEqual(26);
    expect(r.estimatedPeriods).toBeLessThanOrEqual(27);
    expect(r.documentedPeriods).toBe(0);
    expect(r.undocumentedPeriods).toBe(r.estimatedPeriods);
  });

  it('counts a record as covering exactly the period it falls in', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2024, 0, 1),
      employmentEnd: new Date(2024, 2, 31), // ~6-7 biweekly periods
      payFrequency: 'biweekly',
      payrollRecordDates: [new Date(2024, 0, 10), new Date(2024, 0, 24)],
    });
    expect(r.documentedPeriods).toBe(2);
    expect(r.undocumentedPeriods).toBe(r.estimatedPeriods - 2);
  });

  it('groups contiguous gaps into a labeled segment', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2024, 0, 1),
      employmentEnd: new Date(2024, 5, 30),
      payFrequency: 'monthly',
      payrollRecordDates: [new Date(2024, 0, 15)], // only Jan covered
    });
    const gaps = r.gapSegments;
    expect(gaps.length).toBeGreaterThan(0);
    // The big gap runs from Feb through Jun.
    const big = gaps.reduce((a, b) => (b.periodCount > a.periodCount ? b : a));
    expect(big.periodCount).toBeGreaterThanOrEqual(4);
    expect(big.label).toMatch(/Feb|Jun|2024/);
  });

  it('is not computable without both dates — never fabricates a number', () => {
    const r = detectPayPeriodGaps({
      employmentStart: null,
      employmentEnd: new Date(2024, 11, 31),
      payFrequency: 'biweekly',
      payrollRecordDates: [],
    });
    expect(r.computable).toBe(false);
    expect(r.reason).toBe('missing-start');
    expect(r.estimatedPeriods).toBe(0);
  });

  it('rejects an inverted range', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2026, 0, 1),
      employmentEnd: new Date(2022, 0, 1),
      payFrequency: 'biweekly',
      payrollRecordDates: [],
    });
    expect(r.computable).toBe(false);
    expect(r.reason).toBe('invalid-range');
  });
});

describe('formatCoverageRange', () => {
  it('single month', () => {
    expect(formatCoverageRange(new Date(2024, 8, 1), new Date(2024, 8, 30))).toBe('Sep 2024');
  });
  it('within a year', () => {
    expect(formatCoverageRange(new Date(2024, 7, 1), new Date(2024, 11, 15))).toBe('Aug–Dec 2024');
  });
  it('across years', () => {
    expect(formatCoverageRange(new Date(2024, 10, 1), new Date(2025, 1, 15))).toBe('Nov 2024 – Feb 2025');
  });
});
