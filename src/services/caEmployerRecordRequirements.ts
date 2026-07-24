/**
 * CA employer-record requirements — the attorney's intake worksheet, pre-answered with facts.
 *
 * DOCTRINE ("describe the record, not the case"): this measures which records California law
 * requires an employer to keep/provide are PRESENT in the worker's file, WORKER-STATED as never
 * received, or NOT IN THE RECORD. It NEVER concludes the employer broke the law, that the worker
 * was wronged, or that a claim exists. It states what the record contains and — the useful half —
 * turns each gap into the specific record an attorney would request next.
 *
 * ⚠ COUNSEL-GATED: the requirement list + citations below are a LEGAL ARTIFACT. Every item,
 * citation, and "applies to" scope must be reviewed by California employment counsel before this
 * is surfaced on any worker or firm screen. The tool's BEHAVIOR is not legal advice; the LIST is.
 * Ship the engine; gate the surface. (See project_readiness_counsel_gate, project_describe_record_not_case.)
 */

export type RecordState = 'on_file' | 'worker_stated_missing' | 'not_in_record';

export type RequirementScope = 'all' | 'nonexempt' | 'on_separation';

export type EmployerRecordRequirement = {
  key: string;
  /** Worker-facing plain name. */
  label: string;
  /** Statute — VERIFY WITH COUNSEL before surfacing. */
  citation: string;
  scope: RequirementScope;
  /** Category/filename patterns that indicate this record is present in the file. */
  match: RegExp[];
  /** Can the worker themselves request this (feeds the records-request tool)? */
  workerObtainable: boolean;
  /** Safe, record-describing copy for the "not in record" state. Never accuses. */
  describeMissing: string;
};

// VERIFY WITH COUNSEL. Well-established CA requirements; scopes simplified for a factual coverage read.
export const CA_EMPLOYER_RECORD_REQUIREMENTS: EmployerRecordRequirement[] = [
  {
    key: 'wage_statements',
    label: 'Itemized wage statements',
    citation: 'Labor Code § 226',
    scope: 'all',
    match: [/wage statement|itemized|pay ?stub|paystub|earnings statement|wage record|payroll/i],
    workerObtainable: true,
    describeMissing:
      'California requires itemized wage statements each pay period (Labor Code § 226). None are in your file yet.',
  },
  {
    key: 'wtpa_notice',
    label: 'Wage notice given at hire (Notice to Employee)',
    citation: 'Labor Code § 2810.5',
    scope: 'nonexempt',
    match: [/wage theft|2810\.?5|notice to employee|wage notice|pay rate notice/i],
    workerObtainable: true,
    describeMissing:
      'California requires a written wage notice at hire for most non-exempt employees (Labor Code § 2810.5). It is not in your file yet.',
  },
  {
    key: 'personnel_file',
    label: 'Personnel file',
    citation: 'Labor Code § 1198.5',
    scope: 'all',
    match: [/personnel file|personnel record/i],
    workerObtainable: true,
    describeMissing:
      'You have the right to inspect and copy your personnel file (Labor Code § 1198.5). It is not in your file yet.',
  },
  {
    key: 'time_records',
    label: 'Time and hours records',
    citation: 'Labor Code § 1174 / Wage Order',
    scope: 'nonexempt',
    match: [/time ?record|timesheet|timecard|time card|hours worked|schedule|punch/i],
    workerObtainable: true,
    describeMissing:
      'Employers must keep accurate time records of hours worked (Labor Code § 1174). None are in your file yet.',
  },
  {
    key: 'meal_rest',
    label: 'Meal and rest break records',
    citation: 'Labor Code §§ 226.7, 512',
    scope: 'nonexempt',
    match: [/meal ?break|rest ?break|break record|meal period|rest period/i],
    workerObtainable: true,
    describeMissing:
      'Records of meal and rest breaks (or premium pay for missed ones) relate to Labor Code §§ 226.7 and 512. None are in your file yet.',
  },
  {
    key: 'final_pay',
    label: 'Final paycheck',
    citation: 'Labor Code §§ 201–203',
    scope: 'on_separation',
    match: [/final pay|final paycheck|last paycheck|final wages|separation pay/i],
    workerObtainable: true,
    describeMissing:
      'Final wages are due on a specific timeline after employment ends (Labor Code §§ 201–203). A final paycheck record is not in your file yet.',
  },
  {
    key: 'harassment_policy',
    label: 'Anti-harassment policy acknowledgment',
    citation: 'Gov. Code § 12950 / SB 1343',
    scope: 'all',
    match: [/harassment policy|anti-?harassment|policy acknowledg|handbook acknowledg|sexual harassment training/i],
    workerObtainable: true,
    describeMissing:
      'California requires employers to provide a written harassment policy (Gov. Code § 12950). An acknowledgment is not in your file yet.',
  },
  {
    key: 'offer_or_agreement',
    label: 'Offer letter or employment agreement',
    citation: 'Records you signed — Labor Code § 432',
    scope: 'all',
    match: [/offer letter|employment agreement|employment contract|signed agreement/i],
    workerObtainable: true,
    describeMissing:
      'You are entitled to copies of documents you signed to obtain or hold your job (Labor Code § 432). An offer letter or agreement is not in your file yet.',
  },
];

export type AssessedRequirement = EmployerRecordRequirement & { state: RecordState };

export type EmployerRecordCoverage = {
  items: AssessedRequirement[];
  onFileCount: number;
  notInRecordCount: number;
  /** The flip side of the gaps: what an attorney would request next (worker-obtainable + absent). */
  toObtain: AssessedRequirement[];
};

/**
 * Assess a worker's file against the CA requirement list. Pure + factual: present / worker-stated
 * missing / not in record. `stillEmployed` drops separation-only items (a final paycheck isn't
 * "missing" for someone still on the job). `workerStatedMissingKeys` = requirement keys the worker
 * has told us they never received.
 */
export function assessEmployerRecordCoverage(
  fileInventory: Array<{ fileName?: string; category?: string }>,
  opts: { stillEmployed?: boolean; workerStatedMissingKeys?: string[] } = {}
): EmployerRecordCoverage {
  const stated = new Set(opts.workerStatedMissingKeys ?? []);
  // Normalize separators so "Final_Paycheck.pdf" / "offer-letter" match space-delimited patterns
  // (real filenames use _ . - freely).
  const haystacks = fileInventory.map((f) =>
    `${f.fileName ?? ''} ${f.category ?? ''}`
      .toLowerCase()
      .replace(/[_\-.]+/g, ' ')
      .replace(/\s+/g, ' ')
  );

  const items: AssessedRequirement[] = CA_EMPLOYER_RECORD_REQUIREMENTS
    .filter((r) => !(opts.stillEmployed && r.scope === 'on_separation'))
    .map((r) => {
      const present = haystacks.some((h) => r.match.some((re) => re.test(h)));
      const state: RecordState = present
        ? 'on_file'
        : stated.has(r.key)
          ? 'worker_stated_missing'
          : 'not_in_record';
      return { ...r, state };
    });

  return {
    items,
    onFileCount: items.filter((i) => i.state === 'on_file').length,
    notInRecordCount: items.filter((i) => i.state !== 'on_file').length,
    toObtain: items.filter((i) => i.state !== 'on_file' && i.workerObtainable),
  };
}
