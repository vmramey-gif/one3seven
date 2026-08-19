import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression coverage for the p-retry migration (2026-08-19 hard-challenge finding): the original
 * `waitForWorkerSummaryRow` was a hand-rolled fixed-interval loop with no test coverage at all.
 * Supabase is mocked at the client-singleton level (same pattern as
 * fetchIntakeSummaryBundleFailures.test.ts) so these are pure unit tests of the retry logic, with
 * a call counter simulating post-write read lag across sequential queries to the same table.
 */

let callCount = 0;
let foundOnAttempt: number | null = null; // 1-indexed; null = never found

function makeQueryBuilder() {
  const resolve = () => {
    callCount += 1;
    const found = foundOnAttempt !== null && callCount >= foundOnAttempt;
    return { data: found ? { id: 'summary-1' } : null, error: null };
  };
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(resolve()),
  };
  return builder;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: () => makeQueryBuilder() },
  isSupabaseConfigured: () => true,
}));

import { waitForWorkerSummaryRow } from '../intakeDataService';

beforeEach(() => {
  callCount = 0;
  foundOnAttempt = null;
});

describe('waitForWorkerSummaryRow (p-retry migration)', () => {
  it('resolves true immediately when the row already exists on the first check', async () => {
    foundOnAttempt = 1;
    const result = await waitForWorkerSummaryRow('intake-1', { attempts: 5, delayMs: 1 });
    expect(result).toBe(true);
    expect(callCount).toBe(1);
  });

  it('retries through simulated post-write read lag and eventually succeeds', async () => {
    foundOnAttempt = 3; // not found on attempts 1-2, found on attempt 3
    const result = await waitForWorkerSummaryRow('intake-1', { attempts: 5, delayMs: 1 });
    expect(result).toBe(true);
    expect(callCount).toBe(3);
  });

  it('gives up and returns false after exhausting all attempts', async () => {
    foundOnAttempt = null; // never found
    const result = await waitForWorkerSummaryRow('intake-1', { attempts: 3, delayMs: 1 });
    expect(result).toBe(false);
    expect(callCount).toBe(3);
  });

  it('respects a custom attempts count smaller than the default', async () => {
    foundOnAttempt = 2;
    const result = await waitForWorkerSummaryRow('intake-1', { attempts: 1, delayMs: 1 });
    // Only 1 attempt allowed, row isn't found until attempt 2 -- must fail, not succeed.
    expect(result).toBe(false);
    expect(callCount).toBe(1);
  });
});
