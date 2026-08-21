import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression coverage for the "silent fabrication on real backend failure" fix:
 *
 *   - `fetchIntakeSummaryBundle` must distinguish a genuinely-empty `intake_summaries` row
 *     (legitimate: a new intake with files but no organized summary yet, where the beta
 *     placeholder synthesis is a real convenience) from a query that actually FAILED (RLS
 *     denial, network error, etc.) — in the latter case, the placeholder must NOT fire, because
 *     a synthesized-from-filenames summary is indistinguishable from a genuine one to an
 *     attorney reviewing it.
 *   - `loadFirmLiveIntakeView` must return null (matching its declared type) when the bundle
 *     reports a real fetch error, instead of silently assembling and returning a full view.
 *
 * Supabase is mocked at the client-singleton level so these are pure unit tests of the gating
 * logic — no real network/DB calls.
 */

type MockResult = { data: unknown; error: { message: string; code?: string } | null };

const tableResults = new Map<string, MockResult>();

function setTableResult(table: string, result: MockResult) {
  tableResults.set(table, result);
}

function makeQueryBuilder(table: string) {
  const resolve = () => tableResults.get(table) ?? { data: null, error: null };
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(resolve()),
    then: (onFulfilled: any, onRejected: any) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
  };
  return builder;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeQueryBuilder(table),
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
  isSupabaseConfigured: () => true,
}));

import { fetchIntakeSummaryBundle, loadFirmLiveIntakeView } from '../firmRoutingService';

const INTAKE_ID = 'intake-123';

const SAMPLE_FILES = [
  { id: 'f1', file_name: 'paystub-march.pdf', category: 'Pay Records' },
];

beforeEach(() => {
  tableResults.clear();
  setTableResult('intakes', { data: { id: INTAKE_ID, workflow_status: 'Submitted' }, error: null });
  setTableResult('uploaded_files', { data: SAMPLE_FILES, error: null });
  setTableResult('timeline_events', { data: [], error: null });
  setTableResult('intake_summaries', { data: [], error: null });
  setTableResult('firm_intake_routes', {
    data: { route_status: 'full_access', firm_id: 'firm-1' },
    error: null,
  });
  setTableResult('firm_profiles', { data: { plan_id: 'starter' }, error: null });
});

describe('fetchIntakeSummaryBundle — genuine emptiness vs. real fetch error (regression + fix)', () => {
  it('REGRESSION GUARD: genuinely empty summary + timeline (no error) still synthesizes the beta placeholder', async () => {
    // intake_summaries and timeline_events both legitimately return zero rows, no error.
    const bundle = await fetchIntakeSummaryBundle(INTAKE_ID);
    expect(bundle.fetchErrors).toEqual([]);
    expect(bundle.summary).not.toBeNull();
    expect((bundle.summary as { overview?: string })?.overview).toBeTruthy();
    expect(bundle.events.length).toBeGreaterThan(0);
  });

  it('a real intake_summaries query error does NOT produce a fabricated placeholder summary', async () => {
    setTableResult('intake_summaries', {
      data: null,
      error: { message: 'permission denied for table intake_summaries', code: '42501' },
    });
    const bundle = await fetchIntakeSummaryBundle(INTAKE_ID);
    expect(bundle.fetchErrors.length).toBeGreaterThan(0);
    expect(bundle.fetchErrors.some((e) => e.includes('intake_summaries'))).toBe(true);
    // The critical assertion: no beta-placeholder fabrication on a real error.
    expect(bundle.summary).toBeNull();
  });

  it('a real timeline_events query error is recorded and does not synthesize placeholder events', async () => {
    setTableResult('timeline_events', {
      data: null,
      error: { message: 'connection timeout', code: '57014' },
    });
    const bundle = await fetchIntakeSummaryBundle(INTAKE_ID);
    expect(bundle.fetchErrors.some((e) => e.includes('timeline_events'))).toBe(true);
    expect(bundle.events).toEqual([]);
  });

  it('a schema-not-deployed error (beta schema gap) is still treated as legitimate emptiness, not a fetch error', async () => {
    setTableResult('intake_summaries', {
      data: null,
      error: { message: 'Could not find the table \'public.intake_summaries\' in the schema cache', code: 'PGRST205' },
    });
    const bundle = await fetchIntakeSummaryBundle(INTAKE_ID);
    expect(bundle.fetchErrors).toEqual([]);
    // Still eligible for the beta placeholder since this isn't a genuine fetch failure.
    expect(bundle.summary).not.toBeNull();
  });
});

describe('loadFirmLiveIntakeView — refuses to fabricate a view on real backend failure', () => {
  it('REGRESSION GUARD: a genuinely empty-but-successful bundle still produces a non-null view', async () => {
    const view = await loadFirmLiveIntakeView(INTAKE_ID, 'route-1', 'full_access', 'INT-001');
    expect(view).not.toBeNull();
  });

  it('a simulated intake_summaries fetch error produces a null view, not a fabricated one', async () => {
    setTableResult('intake_summaries', {
      data: null,
      error: { message: 'permission denied for table intake_summaries', code: '42501' },
    });
    const view = await loadFirmLiveIntakeView(INTAKE_ID, 'route-1', 'full_access', 'INT-001');
    expect(view).toBeNull();
  });

  it('a simulated uploaded_files fetch error also produces a null view', async () => {
    setTableResult('uploaded_files', {
      data: null,
      error: { message: 'permission denied for table uploaded_files', code: '42501' },
    });
    const view = await loadFirmLiveIntakeView(INTAKE_ID, 'route-1', 'full_access', 'INT-001');
    expect(view).toBeNull();
  });
});
