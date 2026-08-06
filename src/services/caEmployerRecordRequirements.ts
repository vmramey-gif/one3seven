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
    key: 'expense_reimbursement',
    label: 'Business-expense reimbursement records',
    citation: 'Labor Code § 2802',
    scope: 'all',
    // Single-token stems so CamelCase filenames (ExpenseReport.pdf, Reimbursement.pdf) still match —
    // this engine collapses separators but does not split CamelCase.
    match: [/reimburs|expense|\b2802\b|home ?office|stipend/i],
    workerObtainable: true,
    describeMissing:
      'California requires employers to reimburse necessary business expenses — including a reasonable share of home internet and personal cell phone used for work (Labor Code § 2802). No expense-reimbursement records are in your file yet.',
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
 * Optional per-file content for coverage assessment. `documentFacts` is the structured facts the
 * extraction stored (file_text_extractions.document_facts); `textSnippet` is the first ~2,000
 * characters of extracted text. Both are optional — filename/category matching still works alone.
 */
export type CoverageFileInput = {
  fileName?: string;
  category?: string;
  documentFacts?: Record<string, unknown> | null;
  textSnippet?: string;
};

/** Cap content signals to the head of the document (title/header wording, not deep boilerplate). */
const COVERAGE_SNIPPET_LIMIT = 2000;

function coverageSnippet(f: CoverageFileInput): string {
  return (f.textSnippet ?? '').slice(0, COVERAGE_SNIPPET_LIMIT);
}

function factString(facts: Record<string, unknown> | null | undefined, key: string): string {
  if (!facts || typeof facts !== 'object') return '';
  const v = (facts as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.trim() : '';
}

function factStringArray(facts: Record<string, unknown> | null | undefined, key: string): string[] {
  if (!facts || typeof facts !== 'object') return [];
  const v = (facts as Record<string, unknown>)[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Loose date parse for extraction-stored labels ("March 6, 2025", "03/14/2025", "1/31/25"). */
function parseCoverageDate(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const mdy = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (mdy) {
    let year = parseInt(mdy[3], 10);
    if (mdy[3].length === 2) year += 2000;
    const month = parseInt(mdy[1], 10);
    const day = parseInt(mdy[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day).getTime();
    }
    return null;
  }
  const parsed = Date.parse(t);
  return Number.isNaN(parsed) ? null : parsed;
}

const SEPARATION_DOC_RE = /separation|terminat|severance/i;

function isSeparationDoc(f: CoverageFileInput): boolean {
  return (
    SEPARATION_DOC_RE.test(f.category ?? '') ||
    SEPARATION_DOC_RE.test(factString(f.documentFacts, 'category')) ||
    SEPARATION_DOC_RE.test(f.fileName ?? '')
  );
}

/** Latest separation date carried by a separation-categorized document's stored facts. */
function latestSeparationDate(files: CoverageFileInput[]): number | null {
  let latest: number | null = null;
  for (const f of files) {
    if (!isSeparationDoc(f)) continue;
    const t =
      parseCoverageDate(factString(f.documentFacts, 'effective_date')) ??
      parseCoverageDate(factString(f.documentFacts, 'document_date'));
    if (t != null && (latest == null || t > latest)) latest = t;
  }
  return latest;
}

const PAY_RECORD_CONTENT_RE = /earnings statement|pay ?stub|paystub|wage statement|itemized/i;

function isPayRecordFile(f: CoverageFileInput): boolean {
  const nameAndCategory = `${f.fileName ?? ''} ${f.category ?? ''}`
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ');
  const wageReq = CA_EMPLOYER_RECORD_REQUIREMENTS.find((r) => r.key === 'wage_statements');
  if (wageReq?.match.some((re) => re.test(nameAndCategory))) return true;
  if (PAY_RECORD_CONTENT_RE.test(coverageSnippet(f))) return true;
  return Boolean(
    factString(f.documentFacts, 'gross_pay') || factString(f.documentFacts, 'net_pay')
  );
}

const FINAL_PAY_WORDING_RE =
  /\bfinal\s+(?:pay(?:check)?|wages|pay\s?stub|payout)\b|\blast\s+paycheck\b/i;
const MANUAL_CHECK_WORDING_RE = /\bmanual\s+check\b/i;

/**
 * Final paycheck present: a PAY RECORD whose text says final-pay wording, whose text says
 * "manual check" while a separation document exists in the record set, or whose own pay date
 * (facts document_date / pay_period_end) falls on or after a separation date the record set
 * itself establishes. Conservative: a signal must be specific wording or a dated comparison —
 * a false "present" here suppresses a records-request line, which is worse than a false gap.
 */
function finalPaycheckContentSignal(files: CoverageFileInput[]): boolean {
  const separationDate = latestSeparationDate(files);
  const hasSeparationDoc = files.some(isSeparationDoc);
  return files.some((f) => {
    if (!isPayRecordFile(f)) return false;
    const snippet = coverageSnippet(f);
    if (FINAL_PAY_WORDING_RE.test(snippet)) return true;
    if (hasSeparationDoc && MANUAL_CHECK_WORDING_RE.test(snippet)) return true;
    if (separationDate == null) return false;
    const payDate =
      parseCoverageDate(factString(f.documentFacts, 'document_date')) ??
      parseCoverageDate(factString(f.documentFacts, 'pay_period_end'));
    return payDate != null && payDate >= separationDate;
  });
}

/** Body wording of an actual offer/agreement — never a mere mention of one in another document. */
const OFFER_BODY_WORDING_RE =
  /pleased\s+to\s+offer\s+you|offer\s+of\s+employment|this\s+(?:employment\s+)?(?:agreement|contract)\s+is\s+(?:made|entered)|your\s+employment\s+(?:with\s+\S+\s+)?(?:will\s+)?(?:begin|commence)s?\b/i;

/**
 * Offer letter / employment agreement present: agreement body wording in the file's own text,
 * a document executed between parties whose stated roles are exactly Employee and Employer,
 * or stored facts carrying the full offer-terms triple (position title + start date + pay rate).
 */
function offerOrAgreementContentSignal(files: CoverageFileInput[]): boolean {
  return files.some((f) => {
    if (OFFER_BODY_WORDING_RE.test(coverageSnippet(f))) return true;
    const facts = f.documentFacts;
    if (!facts || typeof facts !== 'object') return false;
    const parties = (facts as { communication_parties?: unknown }).communication_parties;
    if (Array.isArray(parties)) {
      const roles = parties.map((p) =>
        p && typeof p === 'object' ? String((p as { role?: unknown }).role ?? '').trim().toLowerCase() : ''
      );
      if (roles.includes('employee') && roles.includes('employer')) return true;
    }
    return Boolean(
      factString(facts, 'position_title') &&
        factString(facts, 'start_date') &&
        factString(facts, 'pay_rate')
    );
  });
}

const PERSONNEL_WORDING_RE = /personnel\s+file|personnel\s+record/i;

/** Distinct employment-file document markers; ≥3 in ONE file = a multi-document employment-file production. */
const EMPLOYMENT_FILE_MARKERS: RegExp[] = [
  /\bW-?4\b/i,
  /\bI-?9\b/i,
  /handbook\s+acknowledg/i,
  /background\s+check/i,
  /benefit(?:s)?\s+(?:election|enrollment)|enrollment\s*&\s*waiver/i,
  /non-?disclosure|\bNDA\b/,
  /payroll\s+form/i,
  /offer\s+letter/i,
  /new\s+hire|onboarding/i,
  /tax\s+form/i,
];

/**
 * Personnel file present: explicit "personnel file/record" wording, or a single upload whose
 * text/facts show at least three distinct employment-file document types combined (W-4, I-9,
 * handbook acknowledgment, background check, …) — the shape of a personnel-file production.
 */
function personnelFileContentSignal(files: CoverageFileInput[]): boolean {
  return files.some((f) => {
    const hay = [
      coverageSnippet(f),
      ...factStringArray(f.documentFacts, 'flags'),
      ...factStringArray(f.documentFacts, 'referenced_documents'),
    ].join('\n');
    if (!hay.trim()) return false;
    if (PERSONNEL_WORDING_RE.test(hay)) return true;
    const markerCount = EMPLOYMENT_FILE_MARKERS.filter((re) => re.test(hay)).length;
    return markerCount >= 3;
  });
}

/** Conservative content-based presence signals, keyed by requirement. Absence of a signal never flips a match off. */
const CONTENT_SIGNALS: Record<string, (files: CoverageFileInput[]) => boolean> = {
  final_pay: finalPaycheckContentSignal,
  offer_or_agreement: offerOrAgreementContentSignal,
  personnel_file: personnelFileContentSignal,
};

// ── Time / meal-rest presence gates ────────────────────────────────────────────
// Filename/category wording alone marked hours records present when the only "time"
// document was an employer POLICY page ("Attendance Policy - Team Handbook p14.pdf"
// classifies as category "Time Records"). A false "present" suppresses the
// records-request line — the worst failure this rail has (see finalPaycheckContentSignal).
// Presence for these keys therefore requires actual time-data signals in the file's
// text/facts; category matching alone remains sufficient ONLY when the stored category
// is an explicit timekeeping category AND the filename is not policy/handbook-flavored.
// When in doubt: not_in_record.

/** Policy/handbook-flavored filenames — policy wording about time is not a time record. */
const POLICY_FLAVORED_FILENAME_RE = /polic(?:y|ies)|handbook|manual|guidelines?|acknowledg/i;

/** A stored/inferred category that explicitly names timekeeping records. */
const EXPLICIT_TIMEKEEPING_CATEGORY_RE =
  /\btime\s*(?:records?|sheets?|cards?|keeping)\b|\btimekeeping\b|\btime\s*(?:&|and)\s*attendance\b|\bpunch\b/i;

/**
 * Actual time-data wording: punch/clock exports, hours columns/totals, shift start–end
 * pairs, and Spanish "Reporte de Horas"-style hours-report wording. Deliberately does NOT
 * match policy prose ("clocks in more than five minutes late is recorded as tardy").
 */
const TIME_DATA_SNIPPET_RES: RegExp[] = [
  /\btime\s*punch(?:es)?\b|\bpunch\s+(?:export|report|detail|records?)\b|\btime\s+detail\s+report\b/i,
  // Punch column headers / in–out pairs on one line ("Clock In   Clock Out").
  /\bclock[\s-]?in\b[^\n]{0,48}\bclock[\s-]?out\b/i,
  // Spanish hours-report wording.
  /\breporte\s+de\s+horas\b|\btotal\s+de\s+horas\b/i,
  /\b(?:total|scheduled)\s+hours\b/i,
  // Shift start–end pair: two clock times with meridiems separated by a short non-digit run.
  /\d{1,2}:\d{2}\s*[ap]\.?m\.?[^\d\n]{1,8}\d{1,2}:\d{2}\s*[ap]\.?m\.?/i,
];

function timeRecordsPresenceSignal(files: CoverageFileInput[]): boolean {
  return files.some((f) => {
    const snippet = coverageSnippet(f);
    if (TIME_DATA_SNIPPET_RES.some((re) => re.test(snippet))) return true;
    return (
      EXPLICIT_TIMEKEEPING_CATEGORY_RE.test(f.category ?? '') &&
      !POLICY_FLAVORED_FILENAME_RE.test(f.fileName ?? '')
    );
  });
}

/**
 * Punch-level meal data only: meal punch rows, "no meal period recorded" report lines,
 * meal premium stub lines, missed-break facts (incl. Spanish "periodo de comida").
 * A handbook meal-break policy page, or any generic time record, never counts.
 */
const MEAL_DATA_WORDING_RE =
  /\bmeal\s+punch(?:es)?\b|\bno\s+meal\s+period\b|\bmeal\s+period\s+(?:recorded|punch)\b|\bmeal\s+premium\b|\bmissed\s+(?:meal|rest)\s+break|\bperiodo\s+de\s+comida\b/i;

/**
 * A missed_breaks facts value counts only when it is punch-level (punch/premium/shift
 * counts) — an absence note on a schedule ("no meal period rows shown on schedule") is
 * not a meal record. Keep in sync with PUNCH_LEVEL_MISSED_BREAKS_RE in
 * perFileOrganizationService (the packet-surfacing filter).
 */
const PUNCH_LEVEL_MISSED_BREAKS_RE = /\bpunch(?:es)?\b|\bpremiums?\b|\bshifts?\b/i;

function mealRestPresenceSignal(files: CoverageFileInput[]): boolean {
  return files.some((f) => {
    const missedBreaks = factString(f.documentFacts, 'missed_breaks');
    if (missedBreaks && PUNCH_LEVEL_MISSED_BREAKS_RE.test(missedBreaks)) return true;
    // Extraction flags count under the same punch-level bar ("no meal punch recorded on
    // 9 of 11 shifts…" yes; "no meal period rows shown on schedule" no).
    const punchLevelFlag = factStringArray(f.documentFacts, 'flags').some(
      (flag) => MEAL_DATA_WORDING_RE.test(flag) && PUNCH_LEVEL_MISSED_BREAKS_RE.test(flag)
    );
    if (punchLevelFlag) return true;
    return MEAL_DATA_WORDING_RE.test(coverageSnippet(f));
  });
}

/**
 * Keys whose presence is FULLY determined by their conservative gate — the generic
 * filename/category regex match is NOT sufficient on its own for these.
 */
const PRESENCE_GATES: Record<string, (files: CoverageFileInput[]) => boolean> = {
  time_records: timeRecordsPresenceSignal,
  meal_rest: mealRestPresenceSignal,
};

/**
 * Assess a worker's file against the CA requirement list. Pure + factual: present / worker-stated
 * missing / not in record. `stillEmployed` drops separation-only items (a final paycheck isn't
 * "missing" for someone still on the job). `workerStatedMissingKeys` = requirement keys the worker
 * has told us they never received. Rows may optionally carry `documentFacts` + `textSnippet` for
 * conservative content signals (final paycheck, offer/agreement, personnel file). Time and
 * meal/rest records are presence-GATED: filename/category wording alone never marks them present
 * (see PRESENCE_GATES). When in doubt a requirement stays `not_in_record` — this rail feeds a
 * records-request letter.
 */
export function assessEmployerRecordCoverage(
  fileInventory: CoverageFileInput[],
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
      const gate = PRESENCE_GATES[r.key];
      const present = gate
        ? gate(fileInventory)
        : haystacks.some((h) => r.match.some((re) => re.test(h))) ||
          Boolean(CONTENT_SIGNALS[r.key]?.(fileInventory));
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
