import { describe, it, expect } from 'vitest';
import {
  detectPayPeriodGaps,
  parseEmploymentDateRange,
  parseLooseDate,
  inferPayFrequency,
  type PayFrequency,
} from '../gapDetection';

/**
 * Adversarial stress tests — the messy inputs a real worker actually types/uploads.
 * These assert DESIRED behavior; a failure here is a bug to fix, not the test to change.
 */

describe('parseEmploymentDateRange — messy separators & words', () => {
  const cases: Array<[string, boolean, boolean]> = [
    // input, expectStart, expectEnd
    ['March 2022 – January 2026', true, true],
    ['March 2022 to January 2026', true, true],
    ['March 2022 through Jan 2026', true, true],
    ['3/2022 - 1/2026', true, true],
    ['03/15/2022 – 01/10/2026', true, true],
    ['2022 to 2024', true, true],
    ['Mar 2022 until Jan 2026', true, true],
    ['March 2022 - present', true, true], // "present" should resolve to a real end
    ['March 2022 to current', true, true],
    ['since March 2022', true, false], // only a start is recoverable
    ['2022-03 to 2026-01', true, true],
  ];
  it.each(cases)('parses %s', (input, expectStart, expectEnd) => {
    const { start, end } = parseEmploymentDateRange(input);
    expect(Boolean(start), `start for "${input}"`).toBe(expectStart);
    expect(Boolean(end), `end for "${input}"`).toBe(expectEnd);
  });

  it('never throws on garbage', () => {
    for (const g of ['', '   ', 'a while ago', '???', 'last year-ish', '—', 'to to to']) {
      expect(() => parseEmploymentDateRange(g)).not.toThrow();
    }
  });
});

describe('parseLooseDate — timeline/source date formats', () => {
  const good: Array<[string, number, number]> = [
    ['October 2025', 2025, 9],
    ['Oct 2025', 2025, 9],
    ['October 15, 2025', 2025, 9],
    ['Oct 15 2025', 2025, 9],
    ['2025-10-15', 2025, 9],
    ['10/15/2025', 2025, 9],
    ['10/2025', 2025, 9],
    ['2025', 2025, 0],
  ];
  it.each(good)('parses %s', (input, yr, mo) => {
    const d = parseLooseDate(input);
    expect(d, input).not.toBeNull();
    expect(d!.getFullYear()).toBe(yr);
    expect(d!.getMonth()).toBe(mo);
  });
  it('returns null on junk, never throws', () => {
    for (const g of ['', 'sometime', 'n/a', '??', 'recently']) {
      expect(parseLooseDate(g)).toBeNull();
    }
  });
});

describe('detectPayPeriodGaps — adversarial coverage', () => {
  it('empty folder: zero stubs → everything undocumented (the document-poor worker)', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2022, 2, 1),
      employmentEnd: new Date(2024, 2, 1),
      payFrequency: 'biweekly',
      payrollRecordDates: [],
    });
    expect(r.computable).toBe(true);
    expect(r.documentedPeriods).toBe(0);
    expect(r.undocumentedPeriods).toBe(r.estimatedPeriods);
    expect(r.undocumentedMonths).toBeGreaterThan(20);
    expect(r.gapSegments.length).toBe(1); // one big gap
  });

  it('stubs OUTSIDE the employment range are ignored, not crashy', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2024, 0, 1),
      employmentEnd: new Date(2024, 2, 31),
      payFrequency: 'biweekly',
      payrollRecordDates: [
        new Date(2020, 0, 1), // way before
        new Date(2030, 0, 1), // way after
        new Date(2024, 0, 15), // valid → covers one period
      ],
    });
    expect(r.computable).toBe(true);
    expect(r.documentedPeriods).toBe(1);
  });

  it('duplicate + same-period stubs count once', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2024, 0, 1),
      employmentEnd: new Date(2024, 1, 15),
      payFrequency: 'biweekly',
      payrollRecordDates: [new Date(2024, 0, 3), new Date(2024, 0, 3), new Date(2024, 0, 4)],
    });
    expect(r.documentedPeriods).toBe(1);
  });

  it('decade-long employment does not hang and stays bounded', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2010, 0, 1),
      employmentEnd: new Date(2025, 0, 1),
      payFrequency: 'weekly',
      payrollRecordDates: [],
    });
    expect(r.computable).toBe(true);
    expect(r.estimatedPeriods).toBeGreaterThan(700);
    expect(r.estimatedPeriods).toBeLessThan(2000); // guard cap holds
  });

  it('monthly starting on the 31st does not crash on short months', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2024, 0, 31),
      employmentEnd: new Date(2024, 6, 31),
      payFrequency: 'monthly',
      payrollRecordDates: [],
    });
    expect(r.computable).toBe(true);
    expect(r.estimatedPeriods).toBeGreaterThanOrEqual(5);
  });

  it('one-day / same start-end is not computable rather than absurd', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2024, 0, 1),
      employmentEnd: new Date(2024, 0, 1),
      payFrequency: 'biweekly',
      payrollRecordDates: [],
    });
    expect(r.computable).toBe(false);
  });

  it('invalid Date objects among stubs are skipped', () => {
    const r = detectPayPeriodGaps({
      employmentStart: new Date(2024, 0, 1),
      employmentEnd: new Date(2024, 2, 1),
      payFrequency: 'biweekly',
      payrollRecordDates: [new Date('nonsense'), new Date(2024, 0, 10)],
    });
    expect(r.computable).toBe(true);
    expect(r.documentedPeriods).toBe(1);
  });

  it('all frequencies terminate and produce sane period counts for a year', () => {
    const freqs: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];
    const expected: Record<PayFrequency, [number, number]> = {
      weekly: [51, 53],
      biweekly: [25, 27],
      semimonthly: [23, 25],
      monthly: [11, 13],
    };
    for (const f of freqs) {
      const r = detectPayPeriodGaps({
        employmentStart: new Date(2024, 0, 1),
        employmentEnd: new Date(2024, 11, 31),
        payFrequency: f,
        payrollRecordDates: [],
      });
      expect(r.estimatedPeriods, f).toBeGreaterThanOrEqual(expected[f][0]);
      expect(r.estimatedPeriods, f).toBeLessThanOrEqual(expected[f][1]);
    }
  });
});

describe('inferPayFrequency — irregular real spacing', () => {
  it('handles jitter around biweekly (13/15/14)', () => {
    const d = [
      new Date(2024, 0, 5),
      new Date(2024, 0, 18), // 13
      new Date(2024, 1, 2), // 15
      new Date(2024, 1, 16), // 14
    ];
    expect(inferPayFrequency(d)).toBe('biweekly');
  });
  it('missing middle stubs (gaps of 28) do not fool it toward monthly when most are 14', () => {
    const d = [
      new Date(2024, 0, 5),
      new Date(2024, 0, 19), // 14
      new Date(2024, 1, 2), // 14
      new Date(2024, 2, 1), // 28 (a skipped stub)
      new Date(2024, 2, 15), // 14
    ];
    expect(inferPayFrequency(d)).toBe('biweekly'); // median of {14,14,28,14} = 14
  });
});

describe('end-to-end: parse strings → detect (the real live path)', () => {
  it('worker-typed dates + timeline-string stubs produce a coverage result', () => {
    const { start, end } = parseEmploymentDateRange('March 2022 – January 2026');
    const stubs = ['October 2025', 'Nov 2025', '2025-12-15']
      .map(parseLooseDate)
      .filter((d): d is Date => d !== null);
    const r = detectPayPeriodGaps({
      employmentStart: start,
      employmentEnd: end,
      payFrequency: 'biweekly',
      payrollRecordDates: stubs,
    });
    expect(r.computable).toBe(true);
    expect(r.undocumentedMonths).toBeGreaterThan(30);
    expect(r.documentedPeriods).toBeGreaterThanOrEqual(1);
  });
});
