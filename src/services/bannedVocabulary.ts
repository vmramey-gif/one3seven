/**
 * Banned-vocabulary scanner — the enforcement half of "organizes, never concludes."
 * Run any generated text (AI output, packet copy, marketing) through this to catch
 * legal-conclusion / outcome-promise language before it reaches a worker, firm, or rep.
 *
 * Pure + deterministic so it can gate output in tests and at runtime. The caller decides
 * where to apply it; this module only detects.
 */

// The canonical banned list (matches the product's stated standard). Single words are matched
// on word boundaries (so "reliable" does NOT trip "liable"); phrases are matched as phrases.
export const BANNED_TERMS: readonly string[] = [
  'violation', 'violations',
  'owes', 'owed',
  'entitled', 'entitlement',
  'liable', 'liability',
  'strong case', 'weak case',
  'valid claim', 'invalid claim',
  'you have a case', 'you have a claim',
  'guarantee', 'guaranteed',
  'damages', // as a conclusion/label in customer-facing output
];

function termRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

/** Returns the distinct banned terms found in the text (empty array = clean). */
export function scanBannedVocabulary(text: string | null | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const term of BANNED_TERMS) {
    if (termRegex(term).test(text)) found.push(term);
  }
  return found;
}

/** True if the text contains any banned term. */
export function containsBannedVocabulary(text: string | null | undefined): boolean {
  return scanBannedVocabulary(text).length > 0;
}
