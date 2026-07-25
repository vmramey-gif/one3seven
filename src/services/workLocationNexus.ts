/**
 * Work-location nexus — records two FACTS side by side: the state where the worker physically
 * performed the work, and the state the employer is based in. When they differ, it surfaces that
 * difference as a recorded fact.
 *
 * DOCTRINE ("describe the record, not the case"): California employment law follows where work is
 * physically performed, not where the employer is headquartered — but that is a LEGAL conclusion for
 * counsel to draw. This engine never draws it. It states the two locations and notes only that they
 * differ. It never says "California law applies," "you're covered," or names any statute. The
 * work-location is something the worker states about themselves; the legal consequence is not ours.
 * (See project_ca_remote_worker_nexus, project_describe_record_not_case.)
 */

/** Two-letter code or full name; we normalize loosely. Null/blank = not stated. */
export type WorkLocationNexusInput = {
  /** Where the worker physically performed the work. */
  workState?: string | null;
  /** Where the employer is based / headquartered. */
  employerState?: string | null;
};

export type WorkLocationNexusResult = {
  workState: string | null;
  employerState: string | null;
  /** Both states are known AND they differ. */
  crossState: boolean;
  /** Describe-the-record line when cross-state; null otherwise. Never concludes. */
  note: string | null;
};

const STATE_ABBR: Record<string, string> = {
  california: 'CA', texas: 'TX', florida: 'FL', 'new york': 'NY', washington: 'WA',
  oregon: 'OR', colorado: 'CO', arizona: 'AZ', nevada: 'NV', illinois: 'IL',
  georgia: 'GA', 'north carolina': 'NC', virginia: 'VA', massachusetts: 'MA',
};

/** Normalize to an uppercase 2-letter code where we recognize it; else a trimmed Title-ish string. */
function normState(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const key = s.toLowerCase().replace(/\s+/g, ' ');
  if (STATE_ABBR[key]) return STATE_ABBR[key];
  return s;
}

export function assessWorkLocationNexus(input: WorkLocationNexusInput): WorkLocationNexusResult {
  const workState = normState(input.workState);
  const employerState = normState(input.employerState);
  const crossState = Boolean(workState && employerState && workState !== employerState);

  return {
    workState,
    employerState,
    crossState,
    note: crossState
      ? `Work was performed in ${workState}; the employer is based in ${employerState}.`
      : null,
  };
}
