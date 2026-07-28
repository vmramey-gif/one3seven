/**
 * Single, tested utility for scrubbing raw filename references out of WORKER-facing prose.
 *
 * Doctrine: the worker surface presents an organized narrative, never raw upload filenames
 * ("References: Rosa_Statement.pdf"). Firm-facing renderers intentionally SHOW filenames
 * (source-linked), so they must NOT use this. Previously this logic was a private function in
 * workerTimelineNarrative.ts with a leak: the labeled-phrase patterns stop at the first ".",
 * so a filename like "Rosa_Statement.pdf" left an orphaned ".pdf" (or "pdf,") behind. This
 * exported version keeps the original phrase removals and adds a belt-and-suspenders pass that
 * strips any remaining bare filename token and orphaned extension.
 */

const FILE_EXT = 'pdf|png|jpe?g|docx?|xlsx?|txt|eml|heic|webp|csv|rtf';

export function stripFilenameReferences(text: string): string {
  return (
    text
      // 1) Strip filename tokens and orphaned extensions FIRST. Doing this before the phrase
      //    patterns is what fixes the original leak: a filename's own "." no longer terminates
      //    the phrase match and orphans an extension ("... pdf").
      .replace(new RegExp(`\\b[\\w()\\-]+\\.(?:${FILE_EXT})\\b`, 'gi'), '')
      .replace(new RegExp(`\\s*\\.(?:${FILE_EXT})\\b`, 'gi'), '')
      // 2) Remove the labeling phrases that introduced those filenames (now emptied of names).
      .replace(/Available records show supporting uploads include[^.!?]*[.!?]?/gi, '')
      .replace(/supporting uploads include[^.!?]*[.!?]?/gi, '')
      .replace(/Uploaded records show[^.!?]*[.!?]?/gi, '')
      .replace(/References?:\s*[^.!?]*[.!?]?/gi, '')
      .replace(/\b\d+\s+file\(s\):\s*[^.!?]*[.!?]?/gi, '')
      .replace(/From uploaded records:\s*[^.!?]*[.!?]?/gi, '')
      .replace(/Indexed excerpt[^.!?]*[.!?]?/gi, '')
      // 3) Tidy the punctuation/whitespace the removals leave behind.
      .replace(/\s+([.,;:])/g, '$1')
      .replace(/([(,;:])\s*([.,;:])/g, '$2')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}
