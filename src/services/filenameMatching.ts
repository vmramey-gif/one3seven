/**
 * Shared filename normalization for document-type matching.
 *
 * THE BUG THIS KILLS: classifiers all over the app match a document TYPE off the
 * uploaded filename with regex/keyword patterns written in one separator style —
 * usually spaces or underscores ("written warning", "offer_letter", "final pay").
 * Real filenames are inconsistent: they arrive CamelCase with NO separator
 * ("Rosa_WrittenWarning_2026-03-13.pdf" → the token "writtenwarning"), or with
 * hyphens/dots. When a pattern expects a separator the filename does not have, the
 * match SILENTLY FAILS and the document is mislabeled or miscounted (this has caused
 * real production bugs: a written warning titled "Schedule change", broken gap
 * detection, and wrong record-coverage counts).
 *
 * THE FIX: before matching, split CamelCase into words and collapse every separator
 * run (space, underscore, hyphen, dot) to a single space, then lowercase. This yields
 * a canonical SPACE-delimited string so patterns written with spaces, word
 * boundaries (\b), or `\s`-based separators all match regardless of how the original
 * filename was separated.
 *
 *   "Rosa_WrittenWarning_2026-03-13.pdf" -> "rosa written warning 2026 03 13.pdf"
 *   "OfferLetter2022.pdf"                -> "offer letter2022.pdf"
 *   "PayStubFeb.pdf"                     -> "pay stub feb.pdf"
 *   "complaint_to_hr.pdf"                -> "complaint to hr.pdf"
 *
 * Note: the CamelCase split fires on a lower/digit -> upper boundary, so an
 * all-caps run ("HRComplaint") stays joined ("hrcomplaint") — patterns for those
 * should already be separator-optional. The goal here is to stop the common
 * CamelCase-with-separators real-world filenames from missing.
 */
export function normalizeFilenameForMatching(name: string | null | undefined): string {
  return (name ?? '')
    // Insert a break at camelCase / digit->letter boundaries: "WrittenWarning" -> "Written Warning".
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    // Collapse every separator run to a single space so " ", "_", "-", "." all read alike.
    .replace(/[\s._-]+/g, ' ')
    .trim();
}
