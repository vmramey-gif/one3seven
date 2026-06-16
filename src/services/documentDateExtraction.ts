/**
 * Phase 2b — multi-date capture.
 * Validates and normalizes the `document_dates` array produced by the extraction
 * layer (every explicitly-stated date in a document, with a short context label).
 *
 * Pure and deterministic. The free-text `context` label is run through the shared
 * banned-vocabulary scrubber so no extracted date label can carry a legal
 * conclusion — this layer organizes dates, it never interprets them.
 */

import { sanitizeGenerationPhrase } from './intakeGenerationVoice';

export type DocumentDate = { date: string; context: string };

/** Max dates surfaced per document — guards against runaway extraction output. */
export const MAX_DOCUMENT_DATES = 12;

export function normalizeDocumentDates(raw: unknown): DocumentDate[] {
  if (!Array.isArray(raw)) return [];

  const out: DocumentDate[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const rawDate = (entry as { date?: unknown }).date;
    const date = typeof rawDate === 'string' ? rawDate.trim() : '';
    if (!date) continue; // an entry without an explicit date is not a fact

    const rawContext = (entry as { context?: unknown }).context;
    const trimmedContext = typeof rawContext === 'string' ? rawContext.trim() : '';
    // Scrub the label; a conclusory context becomes neutral while the date (a
    // plain fact) is retained.
    const context = trimmedContext ? sanitizeGenerationPhrase(trimmedContext) : '';

    const key = `${date.toLowerCase()}::${context.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ date, context });
    if (out.length >= MAX_DOCUMENT_DATES) break;
  }

  return out;
}
