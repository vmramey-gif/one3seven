import { describe, it, expect } from 'vitest';
import { checkDateConsistency } from '../dateConsistency';

describe('checkDateConsistency', () => {
  it('flags the real Rosa case: form ended Jan 2025 but records run to April 2026', () => {
    const r = checkDateConsistency({
      statedStart: new Date(2022, 2, 1), // March 2022 (form)
      statedEnd: new Date(2025, 0, 31), // January 2025 (form)
      documentDates: [
        new Date(2026, 1, 20), // Feb 2026 paystub
        new Date(2026, 2, 4), // Mar 2026 complaint
        new Date(2026, 2, 13), // Mar 2026 warning
        new Date(2026, 3, 8), // Apr 2026 termination
      ],
    });
    expect(r.hasConflict).toBe(true);
    const end = r.issues.find((i) => i.kind === 'end-before-records');
    expect(end).toBeDefined();
    expect(end!.message).toContain('January 2025');
    expect(end!.message).toContain('April 2026');
    expect(end!.message).toMatch(/confirm/i);
    // stated start (2022) is before the records (2026) → no start conflict
    expect(r.issues.find((i) => i.kind === 'start-after-records')).toBeUndefined();
  });

  it('flags a start date that comes after the earliest record', () => {
    const r = checkDateConsistency({
      statedStart: new Date(2024, 0, 1), // Jan 2024 (form)
      statedEnd: new Date(2025, 0, 1),
      documentDates: [new Date(2023, 5, 1), new Date(2024, 6, 1)], // a record from June 2023
    });
    expect(r.issues.some((i) => i.kind === 'start-after-records')).toBe(true);
  });

  it('no conflict when records fall within the stated range', () => {
    const r = checkDateConsistency({
      statedStart: new Date(2022, 0, 1),
      statedEnd: new Date(2026, 5, 1),
      documentDates: [new Date(2025, 0, 1), new Date(2025, 6, 1)],
    });
    expect(r.hasConflict).toBe(false);
  });

  it('respects the grace window (a few days over is not a conflict)', () => {
    const r = checkDateConsistency({
      statedStart: null,
      statedEnd: new Date(2026, 0, 1),
      documentDates: [new Date(2026, 0, 20)], // 19 days later — within grace
    });
    expect(r.hasConflict).toBe(false);
  });

  it('does nothing when there are no documents or no stated dates', () => {
    expect(checkDateConsistency({ statedStart: null, statedEnd: null, documentDates: [] }).hasConflict).toBe(false);
    expect(
      checkDateConsistency({ statedStart: new Date(2022, 0, 1), statedEnd: new Date(2025, 0, 1), documentDates: [] })
        .hasConflict
    ).toBe(false);
  });

  it('ignores invalid dates among the documents without crashing', () => {
    const r = checkDateConsistency({
      statedStart: null,
      statedEnd: new Date(2025, 0, 1),
      documentDates: [new Date('nonsense'), null, undefined, new Date(2026, 3, 1)],
    });
    expect(r.hasConflict).toBe(true);
  });
});
