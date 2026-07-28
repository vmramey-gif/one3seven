/**
 * Claim Lens — the Element Coverage Map engine (firm-side).
 *
 * The attorney SELECTS a lens (a claim). The intake's real facts re-sort around that claim's
 * statutory elements. For each element we show every matching item with its source state, plus a
 * LOUD absence card when nothing in the record touches it.
 *
 * DOCTRINE (hard): this organizes; it never concludes. No ranking, no weighting, no omission —
 * every fact that touches an element is shown, whichever way it points. Absence is a FACT, not a
 * verdict. The element sets below are a starting rubric; production intent is firm-configurable.
 *
 * v1 mapping is keyword-driven over facts we already extract (events, key quotes, timing intervals,
 * worker verbatim, file inventory). It is intentionally over-inclusive: showing a marginally-related
 * item is safe (the attorney reads it); silently omitting one is not. Accuracy is a review question,
 * which is why this is firm-access-gated and counsel-gated before any real firm sees it.
 */

export type LensSourceState = 'linked' | 'named' | 'worker' | 'counted';

export type ClaimLensInput = {
  events: Array<{ title: string; date?: string | null; category?: string | null; sourceFile?: string | null }>;
  quotes: Array<{ quote: string; fileName?: string | null; category?: string | null }>;
  intervals: Array<{ label: string; days: number; description: string }>;
  /** Structured facts extracted from documents (label + value), e.g. "HR complaint topic". High signal. */
  confirmed?: Array<{ label: string; value: string }>;
  workerContext: string;
  files: Array<{ fileName: string; category?: string | null }>;
};

export type LensItem = { state: LensSourceState; text: string; meta: string };
export type LensElementView = { name: string; note?: string; items: LensItem[]; empty?: string };
export type ClaimLensView = {
  title: string;
  tally: { total: number; linked: number; named: number; worker: number; counted: number; gaps: number };
  // Coverage Rate: the share of this claim's elements that have ANY material on file.
  // A structural fact about the RECORD (presence/absence), NOT a judgment of the case's merit.
  // withMaterial = elements with at least one item; total = element count; pct = rounded %.
  coverage: { withMaterial: number; total: number; pct: number };
  elements: LensElementView[];
};

export type ExistenceCheck = { label: string; value: string; present: boolean; note: string };

type ElementDef = { name: string; note?: string; patterns: RegExp[]; absence: string };
type LensDef = { id: string; tab: string; title: string; elements: ElementDef[] };

const p = (...s: string[]): RegExp[] => s.map((x) => new RegExp(x, 'i'));

/**
 * Default Library (Tier-1 subset). Every element label LOCATES material — it never CHARACTERIZES it
 * (verb test: no "protected activity"/"adverse action"/"comparators"/"pretext"/"severity"/"strong
 * facts"). Absence is a fact, rendered loudly. The retaliation statutes are kept SEPARATE on purpose
 * (different reports, recipients, and windows). Element sets are data; firm-level editing + a
 * DB-backed store are a later slice. Staged next: PAGA + CalWARN (aggregate coverage), the wage
 * cluster split (§226 / §226.7 / §510 / §512 / §201–203), and Tier 2.
 */
export const CLAIM_LENSES: LensDef[] = [
  {
    id: 'retaliation_1102_5',
    tab: '§1102.5 Retaliation',
    title: 'Labor Code §1102.5 — Retaliation',
    elements: [
      { name: 'Reports and complaints made, and in what words',
        // The worker DOING something — not merely an HR document existing (bare "hr" over-matched handbooks).
        patterns: p('complain', 'grievance', 'reported\\b', 'reporting', 'rais(e|ed|ing)\\b', 'disclos', 'whistle', 'objected', 'protested', 'refus', 'notified', 'wrote to', 'told (hr|my (manager|supervisor|boss))', 'unpaid (wage|overtime)', 'wage theft', 'unsafe', 'hazard', 'safety concern'),
        absence: 'Nothing in the record identifies a report, complaint, or disclosure by the worker.' },
      { name: 'Recipient of the report',
        patterns: p('to (hr|human resources|the manager|my (manager|supervisor|boss)|the owner)', 'human resources', 'reported to', 'complained to', 'raised (it|this) with', 'government (agency|body)', '\\bdlse\\b', 'labor board'),
        absence: 'Nothing in the record identifies who received the report.' },
      { name: 'Employer awareness material',
        patterns: p('acknowledg', 'replied', 'responded', 'forwarded', 'looking into', 'received your', 'confirmed receipt', 'meeting (notes|with)', 'follow up'),
        absence: 'Nothing in the record shows the employer received or acknowledged the report.' },
      { name: 'Employment actions after the report, with dates',
        patterns: p('terminat', 'fired', 'discharg', 'laid off', 'layoff', 'written warning', 'write[- ]?up', 'written up', 'disciplin', 'demot', 'suspend', 'hours (cut|reduced)', 'pay cut', 'transfer', 'schedule change', 'separation'),
        absence: 'No employment action after the report is documented.' },
      { name: 'Sequence and interval',
        note: 'Includes material pointing in both directions. one3seven does not omit items that cut against a theory.',
        patterns: p('day(s)? (after|before|between)', 'week(s)? (after|later|before)', 'month(s)? (after|later|before)', 'shortly (after|before)', 'interval', 'terminat.*complain', 'complain.*terminat', 'warning.*complain'),
        absence: 'No material in the record speaks to the timing between the report and the action.' },
      { name: 'Employer’s stated reason, and any changes to it over time',
        patterns: p('reason (given|stated|cited)', 'stated reason', 'cited', 'for (performance|attitude|conduct|cash|productivity)', 'no longer consistent', 'due to', 'reduction in force', 'restructur'),
        absence: 'No stated reason for the action appears in the record.' },
      { name: 'Treatment of others who reported',
        patterns: p('other (employee|worker)s?', 'coworker', 'colleague', 'others who', 'same (issue|thing|complaint)', 'similarly'),
        absence: 'No material addresses other employees who raised similar issues.' },
    ],
  },
  {
    id: 'feha_retaliation',
    tab: 'FEHA Retaliation §12940(h)',
    title: 'FEHA Retaliation — §12940(h)',
    elements: [
      { name: 'Complaint subject matter as described by the worker',
        patterns: p('harass', 'discriminat', 'accommodat', '\\brace\\b', '\\bsex\\b', 'gender', '\\bage\\b', 'disab', 'religio', 'national origin', 'hostile'),
        absence: 'Nothing describes a complaint about harassment, discrimination, or accommodation.' },
      { name: 'Reports and complaints made, and in what words',
        patterns: p('complain', 'reported\\b', 'grievance', 'rais(e|ed|ing)\\b', 'objected', 'told (hr|human resources)', 'wrote to'),
        absence: 'Nothing in the record identifies a complaint by the worker.' },
      { name: 'Internal HR / EEO channel used',
        patterns: p('hr complaint', 'human resources', '\\beeo\\b', 'ethics (line|hotline)', 'reported to', 'filed (a|an) (complaint|grievance)'),
        absence: 'Nothing identifies the internal channel the worker used.' },
      { name: 'Witnesses to the complaint',
        patterns: p('witness', 'coworker (saw|heard|present)', 'in front of', 'others (present|saw|heard)'),
        absence: 'No witnesses to the complaint are identified.' },
      { name: 'Employment actions after the complaint, with dates',
        patterns: p('terminat', 'fired', 'written warning', 'disciplin', 'demot', 'suspend', 'hours (cut|reduced)', 'transfer', 'separation'),
        absence: 'No employment action after the complaint is documented.' },
      { name: 'Sequence and interval',
        patterns: p('day(s)? (after|before)', 'week(s)? (after|later)', 'month(s)? (after|later)', 'shortly (after|before)'),
        absence: 'No material speaks to the timing between the complaint and the action.' },
    ],
  },
  {
    id: 'lc_98_6',
    tab: '§98.6 Wage/Hour Retaliation',
    title: 'Labor Code §98.6 — Retaliation (wage/hour)',
    elements: [
      { name: 'Reports about pay, hours, or a wage claim',
        patterns: p('unpaid (wage|overtime)', '\\bwage', 'overtime', 'off the clock', 'minimum wage', 'wage theft', 'complain.*pay', 'pay.*complain'),
        absence: 'Nothing identifies a complaint about pay, hours, or a wage claim.' },
      { name: 'Recipient of the report',
        patterns: p('to (hr|human resources|my (manager|supervisor|boss))', 'reported to', 'complained to', '\\bdlse\\b', 'labor (board|commissioner)'),
        absence: 'Nothing identifies who received the wage/hour complaint.' },
      { name: 'DLSE / Labor Commissioner filings',
        patterns: p('\\bdlse\\b', 'labor commissioner', 'wage claim', 'berman hearing'),
        absence: 'No DLSE or Labor Commissioner filing appears in the record.' },
      { name: 'Employment actions after the report, with dates',
        patterns: p('terminat', 'fired', 'written warning', 'disciplin', 'hours (cut|reduced)', 'demot', 'suspend', 'separation'),
        absence: 'No employment action after the report is documented.' },
      { name: 'Sequence and interval',
        patterns: p('day(s)? (after|before)', 'week(s)? (after|later)', 'shortly (after|before)'),
        absence: 'No material speaks to the timing between the report and the action.' },
    ],
  },
  {
    id: 'lc_6310',
    tab: '§6310 Safety Retaliation',
    title: 'Labor Code §6310 — Retaliation (health & safety)',
    elements: [
      { name: 'Safety reports made, and to whom',
        patterns: p('unsafe', 'safety (concern|report|complaint)', 'hazard', 'injur', 'osha', '\\bguard\\b', '\\bppe\\b', 'accident', 'dangerous'),
        absence: 'Nothing identifies a health or safety report by the worker.' },
      { name: 'Cal/OSHA material',
        patterns: p('cal[/ ]?osha', 'osha (complaint|report|filing)', 'inspection', 'citation'),
        absence: 'No Cal/OSHA material appears in the record.' },
      { name: 'Injury or hazard reports',
        patterns: p('injur', 'hazard', 'accident', 'incident report', 'near miss', 'unsafe condition'),
        absence: 'No injury or hazard report appears in the record.' },
      { name: 'Refusal-to-work material',
        patterns: p('refus', 'declined to', 'would not (work|operate)', 'walked off'),
        absence: 'No refusal-to-work material appears in the record.' },
      { name: 'Employment actions after the report, with dates',
        patterns: p('terminat', 'fired', 'written warning', 'disciplin', 'demot', 'suspend', 'separation', 'reduction in force'),
        absence: 'No employment action after the report is documented.' },
      { name: 'Sequence and interval',
        patterns: p('day(s)? (after|before)', 'week(s)? (after|later)', 'shortly (after|before)'),
        absence: 'No material speaks to the timing between the report and the action.' },
    ],
  },
  {
    id: 'feha_discrimination',
    tab: 'FEHA Discrimination §12940(a)',
    title: 'FEHA Discrimination — §12940(a)',
    elements: [
      { name: 'Documents or statements referencing a protected characteristic',
        patterns: p('\\bage\\b', 'older', '\\brace\\b', '\\bsex\\b', 'gender', 'pregnan', 'disab', 'national origin', 'religio', 'accent', 'ethnic', 'sexual orientation'),
        absence: 'No material references a protected characteristic.' },
      { name: 'When and how the employer came to have this information',
        patterns: p('disclosed', 'told (them|hr|my)', 'they knew', 'aware', 'informed', 'on my (application|resume)'),
        absence: 'Nothing addresses how the employer came to have this information.' },
      { name: 'Employment actions taken, with dates',
        patterns: p('hir(e|ing)', 'disciplin', 'assign', 'promot', 'pass(ed)? over', 'terminat', 'fired', 'demot', 'separation', 'written warning'),
        absence: 'No employment action is documented.' },
      { name: 'Treatment of other employees in the same role',
        patterns: p('other (employee|worker)s?', 'coworker', 'younger', 'replaced (by|with)', 'same (role|position|job)', 'others (were|got)'),
        absence: 'No material addresses how others in the same role were treated.' },
      { name: 'Statements attributed to decision-makers',
        patterns: p('told me', '\\bsaid\\b', 'comment', 'remark'),
        absence: 'No statements attributed to a decision-maker appear in the record.' },
      { name: 'Employer’s stated reason, and any later variations',
        patterns: p('reason (given|stated)', 'for (performance|attitude|conduct)', 'no longer consistent', 'restructur', 'reduction in force', 'due to'),
        absence: 'No stated reason for the action appears in the record.' },
    ],
  },
  {
    id: 'feha_harassment',
    tab: 'FEHA Harassment §12940(j)',
    title: 'FEHA Harassment — §12940(j)',
    elements: [
      { name: 'Conduct described, dated',
        patterns: p('harass', 'comment', 'remark', 'touch', 'slur', '\\bjoke', 'hostile', 'yelled'),
        absence: 'No conduct is described in the record.' },
      { name: 'Frequency and duration',
        patterns: p('every (day|week|shift)', 'repeated', 'constant', 'ongoing', 'for (weeks|months)', 'multiple times', 'daily', '\\bagain\\b'),
        absence: 'Nothing addresses how often or how long the conduct occurred.' },
      { name: 'Participants and witnesses',
        patterns: p('coworker', 'supervisor', 'manager', 'witness', 'in front of', 'others (saw|heard|present)'),
        absence: 'No participants or witnesses are identified.' },
      { name: 'Reports made, and to whom',
        patterns: p('complain', 'reported\\b', 'told (hr|human resources|my (manager|supervisor))', 'grievance'),
        absence: 'No report of the conduct appears in the record.' },
      { name: 'Employer’s response after each report',
        patterns: p('responded', 'investigat', 'did nothing', 'no (action|response)', 'ignored', 'looking into'),
        absence: 'Nothing addresses the employer’s response.' },
      { name: 'Changes to work conditions afterward',
        patterns: p('after (i|the) (complain|report)', 'hours (cut|reduced)', 'schedule change', 'transfer', 'written warning', 'terminat'),
        absence: 'Nothing addresses changes to work conditions after the report.' },
    ],
  },
  {
    id: 'feha_disability',
    tab: 'Disability Accommodation §12940(m)',
    title: 'Disability Accommodation — §12940(m)',
    elements: [
      { name: 'Medical condition material',
        patterns: p('disab', 'medical', 'injur', 'condition', 'doctor', 'diagnos', 'health', 'surgery', 'therapy', 'back strain'),
        absence: 'No medical condition material appears in the record.' },
      { name: 'Work restrictions documented',
        patterns: p('restriction', 'no lifting', 'light duty', 'limit', 'note from', 'work status', 'cannot (lift|stand|sit)'),
        absence: 'No documented work restrictions appear in the record.' },
      { name: 'Accommodation requested — words, date, recipient',
        patterns: p('accommodat', 'lighter (duty|work)', 'reassign', 'modified (duty|schedule)', 'asked for', 'requested.*(help|assign|leave)', 'ergonomic'),
        absence: 'Nothing describes an accommodation the worker requested.' },
      { name: 'Employer response',
        patterns: p('responded', 'met with', 'offered', 'denied', 'granted', 'hr.*(respon|met)', 'interactive process'),
        absence: 'Nothing addresses whether the employer responded.' },
      { name: 'Accommodations provided, and duration',
        patterns: p('provided', 'granted', 'allowed', 'gave me', 'for (weeks|months)', 'temporar'),
        absence: 'No material describes accommodations provided.' },
      { name: 'Leave used as accommodation',
        patterns: p('\\bleave\\b', 'time off', '\\bfmla\\b', '\\bcfra\\b', 'medical leave', 'out (for|on)'),
        absence: 'No material describes leave used as an accommodation.' },
      { name: 'Separation material',
        patterns: p('terminat', 'fired', 'let go', 'separation', 'could not return', 'resign'),
        absence: 'No separation material appears in the record.' },
    ],
  },
  {
    id: 'interactive_process',
    tab: 'Interactive Process §12940(n)',
    title: 'Interactive Process — §12940(n)',
    elements: [
      { name: 'Communications in the accommodation exchange, chronologically',
        patterns: p('\\bemail', 'letter', 'message', '\\bcall', '\\bmet\\b', 'meeting', 'discussed', 'requested', 'responded'),
        absence: 'No communications in the accommodation exchange appear in the record.' },
      { name: 'Who initiated each communication',
        patterns: p('i (asked|requested|emailed|wrote|called)', 'hr (asked|requested|emailed)', 'they (asked|requested)', 'initiated'),
        absence: 'Nothing identifies who initiated each communication.' },
      { name: 'Gaps between messages',
        patterns: p('day(s)? (later|between)', 'week(s)? (later|passed)', 'no (response|reply)', 'never (heard|responded)', 'waited'),
        absence: 'Nothing addresses gaps between messages.' },
      { name: 'Documents requested by employer, and provided',
        patterns: p('doctor(\'s)? note', 'medical (documentation|certification)', 'requested.*(note|documentation)', 'provided.*(note|documentation)', '\\bform\\b'),
        absence: 'No document requests or productions appear in the record.' },
      { name: 'Date the exchange stopped, and who stopped responding',
        patterns: p('stopped (responding|replying)', 'never (heard back|responded)', 'no (further|more) (response|contact)', 'ghosted', 'last (email|message|contact)'),
        absence: 'Nothing addresses when the exchange stopped.' },
    ],
  },
  {
    id: 'wage',
    tab: 'Wage & Final Pay',
    title: 'Wage statements & final pay',
    elements: [
      { name: 'Employment relationship and dates on file',
        patterns: p('offer letter', 'employment agreement', 'hire', 'start date', 'employment (began|begins|start)', 'terminat', 'separation', 'employment dates'),
        absence: 'No document establishes the employment relationship or its dates.' },
      { name: 'Wage statements in the record',
        patterns: p('pay ?stub', 'paycheck', 'wage statement', 'earnings statement', 'payroll', 'pay period', 'wage record'),
        absence: 'No wage statements are in the record.' },
      { name: 'Hours recorded, and overtime paid',
        patterns: p('overtime', 'hours worked', 'time ?record', 'timesheet', 'timecard', 'off the clock', 'straight[- ]?time'),
        absence: 'No hours or overtime records appear in the record.' },
      { name: 'Final payment date and amount',
        patterns: p('final pay', 'final paycheck', 'last paycheck', 'final wage', 'separation.*pay', 'waiting time'),
        absence: 'No material addresses the timing or amount of the final payment.' },
      { name: 'Meal and rest period records',
        patterns: p('\\bmeal', 'rest (period|break)', '\\bbreak\\b', 'premium (pay|hour)', 'waiver'),
        absence: 'No meal/rest records or premium-pay material appear in the record.' },
    ],
  },
  {
    id: 'separation_public_policy',
    tab: 'Separation — Public Policy',
    title: 'Separation — Public Policy (Tameny)',
    elements: [
      { name: 'Separation event and date',
        patterns: p('terminat', 'fired', 'discharg', 'let go', 'laid off', 'separation', 'last day'),
        absence: 'No separation event is documented.' },
      { name: 'Reason given, in writing',
        patterns: p('termination letter', 'reason (given|stated)', 'no longer consistent', 'for (performance|attitude|conduct)', 'in writing', 'letter states'),
        absence: 'No written reason for the separation appears in the record.' },
      { name: 'Reasons given at other times',
        patterns: p('told me', 'said (it was|because)', 'later (said|claimed)', 'verbally', 'in the meeting'),
        absence: 'No other stated reasons appear in the record.' },
      { name: 'Events in the preceding period',
        patterns: p('before (i was|the) (terminat|fired)', 'shortly before', 'week(s)? before', 'month(s)? before', 'after (i) (complain|report)'),
        absence: 'No material addresses events in the period before the separation.' },
      { name: 'Policy or statute the worker points to',
        patterns: p('complain', 'reported\\b', 'unsafe', '\\bwage', 'overtime', 'discriminat', 'refus', 'illegal', 'against the law', 'public policy'),
        absence: 'Nothing identifies a policy or statute the worker points to.' },
      { name: 'Witnesses',
        patterns: p('witness', 'coworker (saw|heard)', 'others (present|saw|heard)'),
        absence: 'No witnesses are identified.' },
    ],
  },
  {
    id: 'constructive_discharge',
    tab: 'Constructive Discharge',
    title: 'Constructive Discharge',
    elements: [
      { name: 'Conditions described, dated',
        patterns: p('intolerable', 'hostile', 'harass', 'demot', 'hours (cut|reduced)', 'pay cut', 'humiliat', 'unsafe', 'threat'),
        absence: 'No working conditions are described in the record.' },
      { name: 'Reports made about those conditions',
        patterns: p('complain', 'reported\\b', 'told (hr|my (manager|supervisor))', 'raised (it|this)'),
        absence: 'No reports about the conditions appear in the record.' },
      { name: 'Employer response',
        patterns: p('responded', 'did nothing', 'no (action|response)', 'ignored', 'got worse', 'nothing changed'),
        absence: 'Nothing addresses the employer’s response.' },
      { name: 'Resignation communication',
        patterns: p('resign', '\\bquit\\b', 'gave notice', 'had to (leave|quit)', 'could not (stay|continue)', 'last day'),
        absence: 'No resignation communication appears in the record.' },
      { name: 'Timing between conditions and resignation',
        patterns: p('shortly (after|before)', 'day(s)? later', 'week(s)? later', 'finally', 'after months'),
        absence: 'Nothing addresses the timing between the conditions and the resignation.' },
    ],
  },
  {
    id: 'paga',
    tab: 'PAGA',
    title: 'PAGA — Aggregate Coverage',
    // Structurally different: aggregate, not single-worker. This single-intake v1 surfaces THIS
    // worker's violation material by section + whether any workforce-wide material is on file. True
    // cross-worker aggregate coverage ("nothing on file for anyone else at this facility") needs
    // multi-intake data — a later slice.
    elements: [
      { name: 'This worker’s own violation material, by Labor Code section',
        patterns: p('wage statement', 'pay ?stub', '\\b226\\b', '\\bmeal', 'rest (period|break)', 'overtime', '\\b510\\b', 'reimburs', '\\b2802\\b', 'final pay', 'waiting time', 'minimum wage', 'off the clock'),
        absence: 'No Labor Code violation material for this worker appears in the record.' },
      { name: 'Workforce-wide material',
        patterns: p('other (employee|worker)s?', 'all (employees|staff|workers)', 'everyone', 'company (policy|wide)', 'same (policy|practice)', 'facility', 'across the'),
        absence: 'No material applying to other workers or the workforce as a whole appears in the record.' },
      { name: 'LWDA notice — submission, date, sections, 65-day status',
        patterns: p('\\blwda\\b', 'paga notice', '65[- ]day', 'letter of intent'),
        absence: 'No LWDA/PAGA notice appears in the record.' },
      { name: 'Cure-eligible items',
        patterns: p('\\bcure\\b', 'wage statement', '\\b226\\b', '2810.5', 'notice at hire'),
        absence: 'No material addresses cure-eligible categories.' },
      { name: 'Pay periods documented, per worker',
        patterns: p('pay period', 'pay ?stub', 'wage statement', 'bi[- ]?weekly', 'semi[- ]?monthly'),
        absence: 'No pay-period span is documented in the record.' },
    ],
  },
  {
    id: 'calwarn',
    tab: 'CalWARN',
    title: 'CalWARN — Mass Layoff / Facility Closure',
    // Serves the fire-displaced surge: a 50-worker flood is a CalWARN fact pattern before it is 50
    // individual claims. Single-intake v1; cross-worker separation-date aggregation is a later slice.
    elements: [
      { name: 'Facility and address',
        patterns: p('facility', 'plant\\b', 'warehouse', 'location', 'address', 'site\\b', 'branch'),
        absence: 'No facility or address material appears in the record.' },
      { name: 'Headcount material',
        patterns: p('employees', 'headcount', 'staff of', 'workers (were|at)', '\\d{2,}\\s+(employees|workers)'),
        absence: 'No headcount material appears in the record.' },
      { name: 'Separation dates across workers',
        patterns: p('laid off', 'layoff', 'let go', 'terminat', 'separation', 'same (day|date)', 'all (on|let go)', '\\bmass\\b', 'reduction in force'),
        absence: 'No separation-date material across workers appears in the record.' },
      { name: 'Notice received — date, form, content — or its absence',
        patterns: p('60[- ]?day', 'warn notice', 'notice (received|given)', 'advance notice', 'no notice', 'without (notice|warning)'),
        absence: 'No layoff-notice material appears in the record.' },
      { name: 'Relocation or cessation material',
        patterns: p('closing', 'closure', 'shut(ting)? down', 'relocat', 'moving', 'ceased', 'went out of business'),
        absence: 'No relocation or cessation material appears in the record.' },
    ],
  },
];

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Split worker verbatim into reviewable sentence-ish statements. */
function workerStatements(ctx: string): string[] {
  return (ctx || '')
    .split(/(?<=[.;])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && !/^(full name|employer|employment dates|remote|reimburs)/i.test(s))
    .slice(0, 40);
}

// A "cluster" event is a category placeholder like "HR Documents (2 files)" — not a substantive
// fact. These pollute element matching (a category name isn't a disclosure), so they're skipped.
const isClusterEvent = (title: string): boolean => /\(\s*\d+\s*files?\s*\)/i.test(title);

/**
 * Collect the SUBSTANTIVE facts, tagged with source state. Deliberately leans on real content —
 * extracted structured facts, verbatim quotes, dated events, worker verbatim — and NOT on raw file
 * inventory or category placeholders, which only add noise (a handbook existing is not a complaint).
 * The file inventory still powers the existence-check strip; it just doesn't get matched into elements.
 */
function collectFacts(input: ClaimLensInput): LensItem[] {
  const out: LensItem[] = [];
  // Structured extracted facts carry their own label ("HR complaint topic — …") so the label itself
  // drives element assignment. Highest signal; treat as document-derived.
  for (const c of input.confirmed ?? []) {
    if (!c.value?.trim()) continue;
    out.push({ state: 'linked', text: `${c.label} — ${c.value}`, meta: 'extracted from documents' });
  }
  for (const e of input.events) {
    if (!e.title?.trim() || isClusterEvent(e.title)) continue;
    const meta = [e.date, e.sourceFile].filter(Boolean).join(' · ');
    out.push({ state: e.sourceFile ? 'linked' : 'named', text: e.title, meta: meta || 'timeline event' });
  }
  for (const q of input.quotes) {
    out.push({ state: 'linked', text: `"${q.quote}"`, meta: [q.category, q.fileName].filter(Boolean).join(' · ') || 'extracted quote' });
  }
  for (const iv of input.intervals) {
    out.push({ state: 'counted', text: iv.description, meta: `${iv.days} day${iv.days === 1 ? '' : 's'}` });
  }
  for (const s of workerStatements(input.workerContext)) {
    out.push({ state: 'worker', text: s, meta: 'worker narrative' });
  }
  return out;
}

// Match element assignment on the fact's TEXT only — never its category/meta. Matching on the
// category ("HR Documents") is what pulled a handbook into "protected activity."
function matchesElement(item: LensItem, el: ElementDef): boolean {
  return el.patterns.some((re) => re.test(item.text));
}

export function buildClaimLensView(lensId: string, input: ClaimLensInput): ClaimLensView {
  const lens = CLAIM_LENSES.find((l) => l.id === lensId) ?? CLAIM_LENSES[0];
  const facts = collectFacts(input);
  const tally = { total: 0, linked: 0, named: 0, worker: 0, counted: 0, gaps: 0 };

  const elements: LensElementView[] = lens.elements.map((el) => {
    const matched = facts.filter((f) => matchesElement(f, el));
    // Dedupe by normalized text prefix; prefer higher-provenance state (linked > named > counted > worker).
    const rank: Record<LensSourceState, number> = { linked: 3, named: 2, counted: 1, worker: 0 };
    const byKey = new Map<string, LensItem>();
    for (const it of matched) {
      const key = norm(it.text).slice(0, 48);
      const prev = byKey.get(key);
      if (!prev || rank[it.state] > rank[prev.state]) byKey.set(key, it);
    }
    const items = [...byKey.values()].sort((a, b) => rank[b.state] - rank[a.state]);
    if (items.length === 0) {
      tally.gaps += 1;
      return { name: el.name, note: el.note, items: [], empty: el.absence };
    }
    for (const it of items) {
      tally.total += 1;
      tally[it.state] += 1;
    }
    return { name: el.name, note: el.note, items };
  });

  const totalElements = elements.length;
  const withMaterial = totalElements - tally.gaps;
  const coverage = {
    withMaterial,
    total: totalElements,
    pct: totalElements ? Math.round((withMaterial / totalElements) * 100) : 0,
  };

  return { title: lens.title, tally, coverage, elements };
}

/** Layer 0 — the lens-independent flag row. Pure existence facts — no legal judgment. */
export function buildExistenceChecks(input: ClaimLensInput): ExistenceCheck[] {
  const allText = norm(
    [
      input.workerContext,
      ...input.events.map((e) => e.title),
      ...input.files.map((f) => f.fileName),
      ...input.quotes.map((q) => q.quote),
      ...(input.confirmed ?? []).map((c) => `${c.label} ${c.value}`),
    ].join(' ')
  );
  const has = (...kw: string[]) => kw.some((k) => allText.includes(k));
  const fileCount = (re: RegExp) => input.files.filter((f) => re.test(f.fileName)).length;

  const wageCount = fileCount(/pay ?stub|paystub|wage|earnings/i);
  // "On file" requires actual date evidence — an offer letter or a stated start/hire date — NOT
  // merely that some events exist (events can be undated, which is why the intake may still flag the
  // start date as unconfirmed).
  const hasDates = has('employment dates', 'start date', 'date of hire', 'offer letter', 'hire date') ||
    fileCount(/offer[_\s-]?letter/i) > 0;
  const hasSeparation = has('terminat', 'separation', 'final pay') || fileCount(/terminat|separation/i) > 0;
  const hasEeoc = has('eeoc');
  const hasLwda = has('lwda', 'paga notice');
  const hasArb = has('arbitrat');
  const hasRts = has('right-to-sue', 'right to sue');
  const hasHeadcount = has('employees', 'headcount', 'staff of');
  const hasDamages = has('mitigation', 'new job', 'new employment', 'looking for work', 'unemployment', 'medical bill', 'therapy', 'wage loss');
  const hasPrior = has('severance', 'release', 'settlement', 'prior (suit|claim|complaint)', 'prior eeoc');

  return [
    { label: 'Arbitration agreement', value: hasArb ? 'Referenced' : 'Not on file', present: hasArb, note: hasArb ? '' : 'not addressed in intake' },
    { label: 'Employment dates', value: hasDates ? 'On file' : 'Not on file', present: hasDates, note: hasDates ? '' : 'not addressed in intake' },
    { label: 'Employer headcount', value: hasHeadcount ? 'Referenced' : 'Not on file', present: hasHeadcount, note: 'not addressed in intake' },
    { label: 'CRD right-to-sue', value: hasRts ? 'Referenced' : 'Not on file', present: hasRts, note: 'not addressed in intake' },
    { label: 'EEOC charge', value: hasEeoc ? 'Referenced' : 'Not on file', present: hasEeoc, note: 'not addressed in intake' },
    { label: 'LWDA / PAGA notice', value: hasLwda ? 'Referenced' : 'Not on file', present: hasLwda, note: 'not addressed in intake' },
    { label: 'Wage statements', value: wageCount > 0 ? `${wageCount} on file` : 'Not on file', present: wageCount > 0, note: wageCount > 0 ? '' : 'not addressed in intake' },
    { label: 'Separation date', value: hasSeparation ? 'On file' : 'Not on file', present: hasSeparation, note: hasSeparation ? '' : 'not addressed in intake' },
    { label: 'Damages material', value: hasDamages ? 'Referenced' : 'Not on file', present: hasDamages, note: 'not addressed in intake' },
    { label: 'Prior claims / agreements', value: hasPrior ? 'Referenced' : 'Not on file', present: hasPrior, note: 'not addressed in intake' },
  ];
}
