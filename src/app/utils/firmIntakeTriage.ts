/**
 * Firm queue triage sort — orders a firm's OWN intake list by factual signals so the most
 * actionable files surface first. This is pipeline organization, not case evaluation.
 *
 * DOCTRINE ("describe the record, not the case"): every sort key here is a FACT about the file or
 * the clock — when it last moved, how many records are on file, whether the timeline is continuous.
 * None of them rank merit, strength, or likelihood of winning. Sorting a firm's own queue by
 * recency and completeness is ordinary pipeline hygiene an office manager could do by hand, so it
 * needs no counsel sign-off. (See project_describe_record_not_case, project_readiness_counsel_gate.)
 */

export type TriageSort = 'recent' | 'oldest' | 'complete';

/** Minimal structural shape — anything with these factual fields can be triaged. */
export type TriageSortable = {
  uploadDate?: string | null;
  documentCount?: number | null;
  timelineComplete?: boolean | null;
};

/** Parse a date to epoch ms; unparseable/missing falls back so undated items sink, not float. */
function timeOf(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? fallback : t;
}

/** Factual completeness: a continuous timeline plus more records on file = a fuller record. */
export function recordCompletenessScore(i: TriageSortable): number {
  return (i.timelineComplete ? 1000 : 0) + Math.max(0, i.documentCount ?? 0);
}

/**
 * Return a new array sorted for triage. Pure; input is not mutated. Array.sort is stable, so ties
 * keep their incoming order (which is already the caller's filtered order).
 */
export function sortIntakesForTriage<T extends TriageSortable>(intakes: T[], mode: TriageSort): T[] {
  const copy = [...intakes];
  switch (mode) {
    case 'recent':
      // Newest activity first; undated sink to the bottom (fallback 0).
      return copy.sort((a, b) => timeOf(b.uploadDate, 0) - timeOf(a.uploadDate, 0));
    case 'oldest':
      // Longest-waiting first; undated sink to the bottom (fallback +Infinity).
      return copy.sort((a, b) => timeOf(a.uploadDate, Infinity) - timeOf(b.uploadDate, Infinity));
    case 'complete':
      return copy.sort((a, b) => recordCompletenessScore(b) - recordCompletenessScore(a));
    default:
      return copy;
  }
}

export const TRIAGE_SORT_OPTIONS: Array<{ id: TriageSort; label: string; hint: string }> = [
  { id: 'recent', label: 'Most recent', hint: 'Newest activity first' },
  { id: 'oldest', label: 'Longest waiting', hint: 'Oldest first — nothing sits' },
  { id: 'complete', label: 'Most complete', hint: 'Fullest records first' },
];
