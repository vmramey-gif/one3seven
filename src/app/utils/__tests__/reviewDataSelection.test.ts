import { describe, it, expect } from 'vitest';
import { pickReviewBase } from '../reviewDataSelection';

// Guards the firm review (Claim Lens) screen's data source. The critical invariant:
// on the REAL firm review path (connected), the screen shows LIVE data or nothing —
// it must never fall back to legacy workspace/mock rows and show an attorney fabricated facts.
const LIVE = ['live-row'];
const WS = ['workspace-row'];

describe('pickReviewBase — firm review data source selection', () => {
  it('connected + loading → empty (no rows while the live view loads)', () => {
    expect(pickReviewBase({ connected: true, loading: true, livePresent: true, live: LIVE, ws: WS })).toEqual([]);
  });

  it('connected + live present → the live rows', () => {
    expect(pickReviewBase({ connected: true, loading: false, livePresent: true, live: LIVE, ws: WS })).toEqual(LIVE);
  });

  it('connected + NO live → empty — THE GUARD: never falls back to workspace/mock', () => {
    expect(pickReviewBase({ connected: true, loading: false, livePresent: false, live: [], ws: WS })).toEqual([]);
  });

  it('non-connected + live present → the live rows', () => {
    expect(pickReviewBase({ connected: false, loading: false, livePresent: true, live: LIVE, ws: WS })).toEqual(LIVE);
  });

  it('non-connected + no live → workspace fallback (dev/preview path only)', () => {
    expect(pickReviewBase({ connected: false, loading: false, livePresent: false, live: [], ws: WS })).toEqual(WS);
  });

  it('non-connected + nothing → empty', () => {
    expect(pickReviewBase({ connected: false, loading: false, livePresent: false, live: [], ws: [] })).toEqual([]);
  });
});
