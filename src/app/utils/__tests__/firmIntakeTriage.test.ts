import { describe, it, expect } from 'vitest';
import {
  sortIntakesForTriage,
  recordCompletenessScore,
  type TriageSortable,
} from '../firmIntakeTriage';

const mk = (id: string, uploadDate: string | null, documentCount: number, timelineComplete: boolean) =>
  ({ id, uploadDate, documentCount, timelineComplete } as TriageSortable & { id: string });

describe('sortIntakesForTriage', () => {
  const a = mk('a', '2026-04-08', 6, true);
  const b = mk('b', '2026-02-01', 2, false);
  const c = mk('c', '2026-03-15', 9, false);

  it('recent: newest activity first', () => {
    const out = sortIntakesForTriage([b, a, c], 'recent').map((i: any) => i.id);
    expect(out).toEqual(['a', 'c', 'b']);
  });

  it('oldest: longest-waiting first', () => {
    const out = sortIntakesForTriage([a, c, b], 'oldest').map((i: any) => i.id);
    expect(out).toEqual(['b', 'c', 'a']);
  });

  it('complete: fullest record first (timeline complete outranks raw count)', () => {
    // a has a complete timeline (+1000) even with fewer docs than c (9 docs, no timeline).
    const out = sortIntakesForTriage([b, c, a], 'complete').map((i: any) => i.id);
    expect(out).toEqual(['a', 'c', 'b']);
  });

  it('does not mutate the input array', () => {
    const input = [b, a, c];
    const snapshot = input.map((i: any) => i.id);
    sortIntakesForTriage(input, 'recent');
    expect(input.map((i: any) => i.id)).toEqual(snapshot);
  });

  it('undated items sink to the bottom in both date sorts', () => {
    const undated = mk('u', null, 4, false);
    const last = (ids: string[]) => ids[ids.length - 1];
    expect(last(sortIntakesForTriage([undated, a, b], 'recent').map((i: any) => i.id))).toBe('u');
    expect(last(sortIntakesForTriage([undated, a, b], 'oldest').map((i: any) => i.id))).toBe('u');
  });

  it('is stable for ties (preserves incoming order)', () => {
    const x = mk('x', '2026-01-01', 3, false);
    const y = mk('y', '2026-01-01', 3, false);
    expect(sortIntakesForTriage([x, y], 'recent').map((i: any) => i.id)).toEqual(['x', 'y']);
    expect(sortIntakesForTriage([y, x], 'recent').map((i: any) => i.id)).toEqual(['y', 'x']);
  });

  it('recordCompletenessScore is a pure factual count, never negative', () => {
    expect(recordCompletenessScore({ documentCount: 5, timelineComplete: true })).toBe(1005);
    expect(recordCompletenessScore({ documentCount: null, timelineComplete: false })).toBe(0);
    expect(recordCompletenessScore({ documentCount: -3, timelineComplete: false })).toBe(0);
  });
});
