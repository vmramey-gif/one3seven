// Pure selection of which data source feeds the firm review screen (timeline + documents).
// Extracted from IntakeReviewScreen so the live-vs-empty decision is unit-tested and can NEVER
// silently regress to showing stale/placeholder rows on the attorney-facing Claim Lens screen.
//
// The rule, in one place:
//   - Connected (the real firm review path): only ever show LIVE data. While loading → empty.
//     If there is no live data → empty. It must NOT fall back to legacy workspace/mock rows.
//   - Non-connected (dev gallery / preview only): prefer live; otherwise the workspace rows.

export interface ReviewBaseInput<T> {
  /** preferConnectedLiveIntake — true on the real firm review path. */
  connected: boolean;
  /** The firm live view is still loading. */
  loading: boolean;
  /** A live view exists for this intake. */
  livePresent: boolean;
  /** Live-derived rows (may be empty). */
  live: T[];
  /** Legacy workspace-derived rows (reachable only in the non-connected dev/preview path). */
  ws: T[];
}

export function pickReviewBase<T>(o: ReviewBaseInput<T>): T[] {
  if (o.connected) {
    if (o.loading) return [];
    return o.livePresent ? o.live : [];
  }
  if (o.livePresent) return o.live;
  return o.ws;
}
