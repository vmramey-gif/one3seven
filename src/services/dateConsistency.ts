/**
 * Date-consistency check — flags when a worker's FORM-entered employment dates conflict with the
 * dates the engine EXTRACTED from their documents. Catches the trust-killer where the intake shows
 * "employment ended January 2025" while a termination letter (and other records) are dated April 2026.
 *
 * DOCTRINE ("describe the record, not the case"): states the two dates and asks the worker to
 * confirm. It never concludes which is right, never edits the record silently, never draws any legal
 * inference. It surfaces a factual discrepancy for confirmation — nothing more.
 */

export type DateConsistencyIssue = {
  kind: 'end-before-records' | 'start-after-records';
  statedDate: Date;
  documentedDate: Date;
  /** Describe-the-record message ending in a confirm ask. */
  message: string;
};

export type DateConsistencyResult = {
  issues: DateConsistencyIssue[];
  hasConflict: boolean;
};

// Ignore differences under this many days — dates are often parsed at month granularity, so a
// few days of slack avoids false positives (e.g. a stub dated the 20th vs an end date on the 1st).
const GRACE_DAYS = 31;
const MS_DAY = 86_400_000;

function monthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * @param statedStart / statedEnd  the worker's form-entered employment range (parsed; null if absent).
 * @param documentDates            any dates the engine extracted from the uploaded documents/events.
 */
export function checkDateConsistency(input: {
  statedStart: Date | null;
  statedEnd: Date | null;
  documentDates: Array<Date | null | undefined>;
}): DateConsistencyResult {
  const docs = input.documentDates
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const issues: DateConsistencyIssue[] = [];

  if (docs.length > 0) {
    const earliest = docs[0];
    const latest = docs[docs.length - 1];

    // Records extend AFTER the stated end date → the end date is likely wrong (the Rosa case).
    if (input.statedEnd && latest.getTime() - input.statedEnd.getTime() > GRACE_DAYS * MS_DAY) {
      issues.push({
        kind: 'end-before-records',
        statedDate: input.statedEnd,
        documentedDate: latest,
        message: `You entered employment ending ${monthYear(input.statedEnd)}, but records are dated through ${monthYear(latest)}. Please confirm the end date.`,
      });
    }

    // Records begin BEFORE the stated start date → the start date is likely wrong.
    if (input.statedStart && input.statedStart.getTime() - earliest.getTime() > GRACE_DAYS * MS_DAY) {
      issues.push({
        kind: 'start-after-records',
        statedDate: input.statedStart,
        documentedDate: earliest,
        message: `You entered employment starting ${monthYear(input.statedStart)}, but records are dated as early as ${monthYear(earliest)}. Please confirm the start date.`,
      });
    }
  }

  return { issues, hasConflict: issues.length > 0 };
}
