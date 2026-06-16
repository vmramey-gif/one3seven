/**
 * Phase 2b — referenced-but-not-present documents.
 * Validates and normalizes the `referenced_documents` array produced by the
 * extraction layer: documents a file explicitly *mentions* (e.g. "see attached
 * PIP", "per offer letter dated March 2021").
 *
 * Pure and deterministic. Each entry is a document the text literally refers to —
 * never an inferred "you need X." Entries run through the shared banned-vocabulary
 * scrubber so no reference can carry a legal conclusion. This organizes references;
 * it never interprets them.
 */

import { sanitizeGenerationPhrase } from './intakeGenerationVoice';

/** Max references surfaced per document — guards against runaway extraction output. */
export const MAX_REFERENCED_DOCUMENTS = 12;

/** Upper bound on a single reference label before it is dropped as noise. */
const MAX_REFERENCE_LENGTH = 200;

export function normalizeReferencedDocuments(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || trimmed.length > MAX_REFERENCE_LENGTH) continue;

    const cleaned = sanitizeGenerationPhrase(trimmed);
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(cleaned);
    if (out.length >= MAX_REFERENCED_DOCUMENTS) break;
  }

  return out;
}
