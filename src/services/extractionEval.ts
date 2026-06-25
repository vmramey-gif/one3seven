/**
 * Extraction-accuracy scorer for the eval harness. Pure: compares a model's extracted facts
 * against a hand-labeled expectation and returns a per-field + overall score. Use it to grade
 * extraction quality from a fixture set (run the live function, then score the output here).
 *
 * Strings compare case-insensitively after trim; arrays compare as sets; null === null.
 */

export type ExtractionValue = string | string[] | null | undefined;
export type ExtractionRecord = Record<string, ExtractionValue>;

export interface FieldResult {
  field: string;
  expected: ExtractionValue;
  actual: ExtractionValue;
  match: boolean;
}

export interface ExtractionScore {
  score: number; // fields matched
  total: number; // fields evaluated
  accuracy: number; // score / total, 0..1 (0 when total = 0)
  fields: FieldResult[];
}

const norm = (v: ExtractionValue): string | null => {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((s) => s.trim().toLowerCase()).filter(Boolean).sort().join('|');
  return v.trim().toLowerCase() || null;
};

/** Score `actual` against `expected`. Only the keys present in `expected` are evaluated. */
export function scoreExtraction(expected: ExtractionRecord, actual: ExtractionRecord): ExtractionScore {
  const fields: FieldResult[] = Object.keys(expected).map((field) => {
    const e = expected[field];
    const a = actual[field];
    return { field, expected: e, actual: a, match: norm(e) === norm(a) };
  });
  const total = fields.length;
  const score = fields.filter((f) => f.match).length;
  return { score, total, accuracy: total === 0 ? 0 : score / total, fields };
}
