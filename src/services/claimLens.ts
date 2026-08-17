/**
 * Claim Lens (codename) — the Element Lens engine (firm-side; customer-facing name = "Element Lens").
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

export type LensItem = {
  state: LensSourceState;
  text: string;
  meta: string;
  /** Source PDF file name, when the item is source-linked — used to open the citation. */
  sourceFile?: string;
  /** Verbatim text to anchor/highlight in the source PDF (quote text, or the event title). */
  snippet?: string;
};
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

// `exclude` = the "does-not-prove" gate: a fact whose text trips an exclude pattern does NOT satisfy
// this element even if an include pattern matched. This is what stops an accommodation REQUEST (or a
// doctor's restriction) from counting as accommodation PROVIDED — the #1 element-precision fix.
type ElementDef = { name: string; note?: string; patterns: RegExp[]; exclude?: RegExp[]; absence: string };
type LensDef = { id: string; tab: string; title: string; elements: ElementDef[] };

const p = (...s: string[]): RegExp[] => s.map((x) => new RegExp(x, 'i'));

/**
 * Default Library (Tier-1 subset). Every element label LOCATES material — it never CHARACTERIZES it
 * (verb test: no "protected activity"/"adverse action"/"comparators"/"pretext"/"severity"/"strong
 * facts"). Absence is a fact, rendered loudly. The retaliation statutes are kept SEPARATE on purpose
 * (different reports, recipients, and windows). Element sets are data; firm-level editing + a
 * DB-backed store are a later slice.
 *
 * 33 theories as of 2026-08-17 (up from 27): exempt/non-exempt classification (§515), independent
 * contractor misclassification (§2775 ABC test), piece-rate pay (§226.2), written commission
 * agreements (§2751), pay transparency (§432.3), non-compete voidness (§16600/.1/.5), and a
 * workplace-violence-prevention compliance view (§6401.9) added after a verify-first legal
 * research pass cross-referencing this library against current CA employment law -- see each new
 * lens's own comment for sourcing/verification notes and what still needs counsel confirmation.
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
        // does-not-prove: the worker's own report is NOT an employer action against them. Targets the
        // report ITEM (e.g. "Complaint submitted…") — not any text merely mentioning a complaint, so a
        // write-up "…predating the complaint" (a real action) still counts.
        exclude: p('complaint submitted', 'submitted (a |an )?(complaint|grievance)', 'filed (a |an )(complaint|grievance)', 'reported to (hr|human resources|management|the)'),
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
        // Scoped to the FEHA subject: a wage/hour or safety complaint is not a §12940(h) report.
        // Require a protected-characteristic term near the report verb so the lens actually filters.
        patterns: p(
          '(harass|discriminat|accommodat|hostile|\\brace\\b|\\bsex\\b|gender|\\bage\\b|disab|religio|national origin|retaliat)[\\s\\S]{0,60}(complain|report|grievance|objected|told (hr|human resources)|wrote to)',
          '(complain|report|grievance|objected|told (hr|human resources)|wrote to)[\\s\\S]{0,60}(harass|discriminat|accommodat|hostile|\\brace\\b|\\bsex\\b|gender|\\bage\\b|disab|religio|national origin|retaliat)'
        ),
        absence: 'Nothing in the record identifies a FEHA-related complaint by the worker.' },
      { name: 'Internal HR / EEO channel used',
        patterns: p('hr complaint', 'human resources', '\\beeo\\b', 'ethics (line|hotline)', 'reported to', 'filed (a|an) (complaint|grievance)'),
        absence: 'Nothing identifies the internal channel the worker used.' },
      { name: 'Witnesses to the complaint',
        patterns: p('witness', 'coworker (saw|heard|present)', 'in front of', 'others (present|saw|heard)'),
        absence: 'No witnesses to the complaint are identified.' },
      { name: 'Employment actions after the complaint, with dates',
        patterns: p('terminat', 'fired', 'written warning', 'disciplin', 'demot', 'suspend', 'hours (cut|reduced)', 'transfer', 'separation'),
        // does-not-prove: the worker's own complaint is NOT an employer action against them (targets
        // the report ITEM, not any text mentioning a complaint).
        exclude: p('complaint submitted', 'submitted (a |an )?(complaint|grievance)', 'filed (a |an )(complaint|grievance)', 'reported to (hr|human resources|management|the)'),
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
        // Widened 2026-08-17 to include workplace-violence vocabulary: SB 553 (Labor Code
        // §6401.9) has no private right of action of its own (Cal/OSHA-enforced only, verified
        // against the enacted bill text) -- a worker retaliated against for reporting a violence
        // hazard has a real §6310 claim, not a standalone SB 553 one. See the sb553_wvpp lens
        // below for the presence-only compliance-record view (no retaliation elements there).
        patterns: p('unsafe', 'safety (concern|report|complaint)', 'hazard', 'injur', 'osha', '\\bguard\\b', '\\bppe\\b', 'accident', 'dangerous', 'workplace violence', 'violent (incident|threat)', 'threat(ened)? (of )?violence', '\\bwvpp\\b'),
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
        // Bare role nouns ("manager", "supervisor", "coworker") are not harassment-adjacent on
        // their own — a benign "I got along well with my manager" sentence must not count as
        // identifying a harassment participant. Require co-occurrence with actual
        // harassment-context vocabulary nearby (same ~60-char window as the "Reports made"
        // element below). "witness"/"in front of"/"others (saw|heard|present)" stay bare since
        // those phrasings already imply witnessing something, not a role alone.
        patterns: p(
          '(coworker|supervisor|manager)[\\s\\S]{0,60}(harass|hostile|inappropriate|unwanted|slur|comment|remark|touch|\\bjoke|yelled|conduct)',
          '(harass|hostile|inappropriate|unwanted|slur|comment|remark|touch|\\bjoke|yelled|conduct)[\\s\\S]{0,60}(coworker|supervisor|manager)',
          'witness', 'in front of', 'others (saw|heard|present)'
        ),
        absence: 'No participants or witnesses are identified.' },
      { name: 'Reports made, and to whom',
        // Scoped to the harassing conduct: a wage/hour complaint is not a report of harassment.
        patterns: p(
          '(harass|hostile|slur|inappropriate|comment|remark|touch|conduct)[\\s\\S]{0,60}(complain|report|grievance|told (hr|human resources|my (manager|supervisor)))',
          '(complain|report|grievance|told (hr|human resources|my (manager|supervisor)))[\\s\\S]{0,60}(harass|hostile|slur|inappropriate|comment|remark|touch|conduct)'
        ),
        absence: 'No report of the harassing conduct appears in the record.' },
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
        // does-not-prove: the worker's REQUEST (or a doctor's restriction) is not the employer's response.
        exclude: p('\\brequest', 'asked for', 'restriction', 'doctor gave'),
        absence: 'Nothing addresses whether the employer responded.' },
      { name: 'Accommodations provided, and duration',
        patterns: p('provided', 'granted', 'allowed', 'gave me', 'for (weeks|months)', 'temporar'),
        // A REQUEST, or a doctor's restriction, does NOT prove the employer PROVIDED an accommodation.
        exclude: p('\\brequest', 'asked for', 'restriction', 'doctor gave', 'no lifting'),
        absence: 'No material describes accommodations provided.' },
      { name: 'Leave used as accommodation',
        patterns: p('\\bleave\\b', 'time off', '\\bfmla\\b', '\\bcfra\\b', 'medical leave', 'out (for|on)'),
        // A request FOR leave/accommodation is not leave USED.
        exclude: p('\\brequest', 'asked for'),
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
    id: 'overtime',
    tab: 'Hours & Overtime §510',
    title: 'Hours & Overtime — §510',
    elements: [
      { name: 'Schedules and timekeeping records',
        patterns: p('schedule', 'time ?record', 'timesheet', 'timecard', 'clock (in|out)', 'punch'),
        absence: 'No schedules or timekeeping records appear in the record.' },
      { name: 'Hours as described by the worker vs. hours recorded',
        patterns: p('hours (worked|long)', 'more than forty', '40 hours', 'long hours', 'overtime hours'),
        absence: 'Nothing compares the hours the worker describes to the hours recorded.' },
      { name: 'Overtime paid, and the rate applied',
        patterns: p('overtime (rate|paid|pay)', 'time and a half', 'straight[- ]?time', 'no overtime', 'no overtime rate'),
        absence: 'No material addresses whether overtime was paid or at what rate.' },
      { name: 'Rate-of-pay documents',
        patterns: p('rate of pay', 'hourly rate', 'wage statement', 'pay ?stub', 'offer letter'),
        absence: 'No rate-of-pay document appears in the record.' },
      { name: 'Off-the-clock material',
        patterns: p('off the clock', 'before (my|the) shift', 'after (my|the) shift', 'security check', 'donning', 'bag check', 'pre[- ]shift', 'post[- ]shift'),
        absence: 'No off-the-clock material appears in the record.' },
      { name: 'Rounding material',
        patterns: p('round', 'nearest (quarter|15)', 'grace period'),
        absence: 'No time-rounding material appears in the record.' },
    ],
  },
  {
    id: 'meal_rest',
    tab: 'Meal & Rest §226.7',
    title: 'Meal & Rest — §226.7 / §512',
    elements: [
      { name: 'Shift lengths',
        patterns: p('\\bshift', 'hours (long|worked)', 'schedule', '\\d+[- ]hour'),
        absence: 'No shift-length material appears in the record.' },
      { name: 'Meal periods recorded',
        patterns: p('meal (period|break)', '\\blunch', 'meal (taken|missed)', 'no meal'),
        absence: 'No meal-period records appear in the record.' },
      { name: 'Rest periods',
        patterns: p('rest (period|break)', '10[- ]minute', 'break (taken|missed)'),
        absence: 'No rest-period material appears in the record.' },
      { name: 'Meal/rest waivers on file',
        patterns: p('waiver', 'waived', 'meal waiver'),
        absence: 'No meal/rest waivers appear in the record.' },
      { name: 'Premium pay line items',
        patterns: p('premium (pay|hour)', 'meal premium', 'rest premium', 'one hour of pay'),
        absence: 'No meal/rest premium-pay line items appear in the record.' },
      { name: 'Policy documents and statements about coverage or workload',
        patterns: p('\\bpolicy', 'coverage', 'workload', 'too busy', 'no coverage', 'could not (take|leave)', 'short[- ]staffed'),
        absence: 'No policy or coverage/workload material appears in the record.' },
    ],
  },
  {
    id: 'wage_statements',
    tab: 'Wage Statements §226',
    title: 'Wage Statements — §226',
    elements: [
      { name: 'Statements on file (count and pay periods)',
        patterns: p('wage statement', 'pay ?stub', 'paycheck', 'earnings statement', 'pay period'),
        absence: 'No wage statements are in the record.' },
      { name: 'Required items present or absent, per statement',
        patterns: p('\\bhours', '\\brate', 'gross', '\\bnet\\b', 'deduction', 'employer name', 'address', 'pay period', '\\bblank', 'missing'),
        absence: 'Nothing addresses which required items are present or absent on the statements.' },
      { name: 'Employer name and address on the statement',
        patterns: p('employer (name|address)', 'legal name', 'name and address'),
        absence: 'No material addresses the employer name and address on the statements.' },
      { name: 'Gaps in the series',
        patterns: p('\\bgap', 'missing', 'no statement', 'not (on file|represented)', 'months not'),
        absence: 'No material addresses gaps in the statement series.' },
    ],
  },
  {
    id: 'final_pay',
    tab: 'Final Pay §201–203',
    title: 'Final Pay & Waiting Time — §201–203',
    elements: [
      { name: 'Separation date',
        patterns: p('terminat', 'separation', 'last day', 'fired', '\\bquit\\b', 'resign', 'laid off'),
        absence: 'No separation date appears in the record.' },
      { name: 'Final check date and amount',
        patterns: p('final (check|pay|paycheck|wage)', 'last (check|paycheck)', 'paid (out|on)'),
        absence: 'No material addresses the final check date or amount.' },
      { name: 'Unpaid items claimed',
        patterns: p('unpaid', '\\bowed', 'not paid', 'still (owe|owed)', 'missing (wage|pay)'),
        absence: 'No unpaid items are claimed in the record.' },
      { name: 'Vacation / PTO payout',
        patterns: p('vacation', '\\bpto\\b', 'paid time off', 'accrued'),
        absence: 'No vacation/PTO payout material appears in the record.' },
      { name: 'Method and timing of delivery',
        patterns: p('mailed', 'direct deposit', 'handed', 'received.*(check|pay)', 'day(s)? (after|later)', 'waiting time'),
        absence: 'No material addresses the method or timing of the final payment.' },
    ],
  },
  {
    id: 'expense_2802',
    tab: 'Expenses §2802',
    title: 'Expense Reimbursement — §2802',
    elements: [
      { name: 'Expenses described',
        patterns: p('expense', 'paid for', 'out of pocket', 'my own (money|phone|car)', 'purchased'),
        absence: 'No expenses are described in the record.' },
      { name: 'Phone, internet, mileage, tools, remote-work equipment',
        patterns: p('\\bphone', 'internet', 'mileage', '\\bgas\\b', '\\btools', 'equipment', 'home office', 'remote', '\\bcell'),
        absence: 'No material identifies phone, internet, mileage, tools, or remote-work costs.' },
      { name: 'Reimbursement policy on file',
        patterns: p('reimburs', 'expense policy', '\\bpolicy'),
        absence: 'No reimbursement policy appears in the record.' },
      { name: 'Requests submitted',
        patterns: p('submitted', 'requested reimburs', 'expense report', 'asked (for|to be) reimburs'),
        absence: 'No reimbursement request appears in the record.' },
      { name: 'Payments received',
        patterns: p('reimbursed', 'paid back', 'received.*reimburs', 'never reimbursed', 'not reimbursed'),
        absence: 'No material addresses reimbursement payments received.' },
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
    id: 'cfra',
    tab: 'CFRA §12945.2',
    title: 'CFRA Leave — §12945.2',
    elements: [
      { name: 'Eligibility material (tenure, hours, employer headcount)',
        patterns: p('year of (service|employment)', '1,?250 hours', 'hours worked', 'headcount', 'employees', 'tenure'),
        absence: 'No eligibility material (tenure, hours, headcount) appears in the record.' },
      { name: 'Leave request',
        patterns: p('\\bleave\\b', 'time off', 'requested.*leave', '\\bcfra\\b', 'family (leave|care)', 'medical leave'),
        absence: 'No leave request appears in the record.' },
      { name: 'Certification',
        patterns: p('certification', 'doctor(\'s)? note', 'medical (certification|documentation)', 'health care provider'),
        absence: 'No leave certification appears in the record.' },
      { name: 'Designation notice',
        patterns: p('designat', 'approved', 'granted', 'leave (approved|denied)'),
        absence: 'No leave designation notice appears in the record.' },
      { name: 'Leave taken, and return date',
        patterns: p('leave (taken|began|started)', 'returned', 'return date', 'came back', 'out (from|until)'),
        absence: 'No material addresses leave taken or the return date.' },
      { name: 'Position on return',
        patterns: p('same (position|job|role)', 'reinstate', 'different (position|role)', 'demot', 'no longer', 'reassign'),
        absence: 'No material addresses the position on return.' },
      { name: 'Employment actions following',
        patterns: p('terminat', 'fired', 'written warning', 'disciplin', 'demot', 'hours (cut|reduced)', 'separation'),
        absence: 'No employment action following the leave is documented.' },
    ],
  },
  {
    id: 'fmla',
    tab: 'FMLA',
    title: 'FMLA — Federal Leave (overlay)',
    elements: [
      { name: 'Eligibility material (12 months, 1,250 hours, 50-employee/75-mile)',
        patterns: p('12 months', '1,?250 hours', '50 employees', '\\bfmla\\b', 'eligib'),
        absence: 'No FMLA eligibility material appears in the record.' },
      { name: 'Leave request and qualifying reason',
        patterns: p('\\bfmla\\b', '\\bleave\\b', 'serious health condition', 'family (leave|care)', 'medical leave'),
        absence: 'No FMLA leave request or qualifying reason appears in the record.' },
      { name: 'Employer notice and designation',
        patterns: p('designat', 'eligibility notice', 'rights and responsibilities', 'approved', 'granted'),
        absence: 'No employer notice or designation appears in the record.' },
      { name: 'Leave taken and reinstatement',
        patterns: p('leave (taken|began)', 'returned', 'reinstate', 'same (position|job)', 'return date'),
        absence: 'No material addresses leave taken or reinstatement.' },
      { name: 'Differences from the CFRA track',
        patterns: p('\\bfmla\\b', '\\bcfra\\b', 'concurrent', 'federal', 'baby bonding', '\\bpdl\\b'),
        absence: 'No material addresses how the federal track differs from CFRA.' },
    ],
  },
  {
    id: 'pdl',
    tab: 'PDL §12945',
    title: 'Pregnancy Disability Leave — §12945',
    elements: [
      { name: 'Pregnancy-related condition material',
        patterns: p('pregnan', 'prenatal', 'postpartum', 'childbirth', 'maternity'),
        absence: 'No pregnancy-related condition material appears in the record.' },
      { name: 'Leave request',
        patterns: p('\\bleave\\b', 'time off', 'requested.*leave', 'maternity', '\\bpdl\\b'),
        absence: 'No leave request appears in the record.' },
      { name: 'Four-month tracking',
        patterns: p('four month', '4 month', '17 weeks', 'leave (period|length)'),
        absence: 'No four-month leave tracking appears in the record.' },
      { name: 'Transfer requests',
        patterns: p('transfer', 'lighter (duty|work)', 'reassign', 'modified (duty|schedule)'),
        absence: 'No transfer request appears in the record.' },
      { name: 'Reinstatement',
        patterns: p('reinstate', 'same (position|job)', 'returned', 'return date'),
        absence: 'No reinstatement material appears in the record.' },
    ],
  },
  {
    id: 'lactation',
    tab: 'Pregnancy / Lactation Accommodation',
    title: 'Pregnancy / Lactation Accommodation — §12945(a) / §1030–1034',
    elements: [
      { name: 'Accommodation requested',
        patterns: p('accommodat', 'lighter (duty|work)', 'lactation', '\\bpump', 'nursing', 'break to (pump|nurse)', 'requested.*(help|assign)'),
        absence: 'No accommodation request appears in the record.' },
      { name: 'Lactation space, time, and break material',
        patterns: p('lactation (room|space)', 'private (space|room)', 'break to (pump|nurse)', 'refrigerat', 'no (space|room|time)'),
        absence: 'No lactation space, time, or break material appears in the record.' },
      { name: 'Employer response',
        patterns: p('responded', 'offered', 'denied', 'granted', 'no (space|room)', 'told (me|her)'),
        absence: 'Nothing addresses the employer response.' },
      { name: 'Complaint material',
        patterns: p('complain', 'reported\\b', 'told (hr|human resources)', 'grievance'),
        absence: 'No complaint material appears in the record.' },
    ],
  },
  {
    id: 'sick_leave',
    tab: 'Paid Sick Leave §246',
    title: 'Paid Sick Leave — §246',
    elements: [
      { name: 'Accrual records',
        patterns: p('sick (leave|time|day|pay|hours)', 'accru', 'paid sick', 'balance'),
        absence: 'No sick-leave accrual records appear in the record.' },
      { name: 'Requests',
        patterns: p('called (in|out) sick', 'requested.*sick', 'asked (for|to use).*sick', 'sick day'),
        absence: 'No sick-leave requests appear in the record.' },
      { name: 'Denials',
        patterns: p('denied', 'not (allowed|approved)', 'refused.*sick', 'told (me|no)'),
        absence: 'No sick-leave denials appear in the record.' },
      { name: 'Discipline tied to absences',
        patterns: p('attendance', 'point(s)? (system|for)', 'disciplin.*(absence|sick)', 'written up.*(absence|sick)', 'occurrence'),
        absence: 'No discipline tied to absences appears in the record.' },
      { name: 'Attendance policy documents',
        patterns: p('attendance policy', 'no[- ]?fault', 'point system', '\\bpolicy'),
        absence: 'No attendance policy documents appear in the record.' },
    ],
  },
  {
    id: 'other_leave',
    tab: 'Other Protected Leave',
    title: 'Other Protected Leave — §230, AB 1949, SB 848, USERRA',
    elements: [
      { name: 'Jury / witness duty material (§230)',
        patterns: p('jury', 'witness (duty|leave)', 'subpoena', 'court (appearance|duty)'),
        absence: 'No jury or witness-duty material appears in the record.' },
      { name: 'Domestic violence / crime-victim material (§230(c)/(e))',
        patterns: p('domestic violence', 'restraining order', '\\bvictim', 'stalk', 'assault'),
        absence: 'No domestic-violence or crime-victim material appears in the record.' },
      { name: 'Bereavement material (AB 1949)',
        patterns: p('bereavement', 'funeral', 'death (of|in)', 'passed away', 'family member died'),
        absence: 'No bereavement material appears in the record.' },
      { name: 'Reproductive loss material (SB 848)',
        patterns: p('reproductive loss', 'miscarriage', 'stillbirth', 'failed (adoption|ivf)', 'pregnancy loss'),
        absence: 'No reproductive-loss material appears in the record.' },
      { name: 'Military / USERRA material',
        patterns: p('military', 'deploy', 'reserve', 'national guard', 'userra', 'active duty'),
        absence: 'No military/USERRA material appears in the record.' },
    ],
  },
  {
    id: 'equal_pay',
    tab: 'Equal Pay §1197.5',
    title: 'Equal Pay Act — §1197.5',
    elements: [
      { name: 'Pay records',
        patterns: p('pay ?stub', 'wage statement', 'salary', 'hourly rate', 'rate of pay', 'earnings'),
        absence: 'No pay records appear in the record.' },
      { name: 'Roles compared and basis for comparison',
        patterns: p('same (role|job|position|work)', 'coworker', 'compared to', 'paid (more|less) than', 'similar work'),
        absence: 'No comparison of roles appears in the record.' },
      { name: 'Substantially similar work material',
        patterns: p('same (duties|work|responsibilities)', 'similar work', 'same job', 'skill.*effort'),
        absence: 'No substantially-similar-work material appears in the record.' },
      { name: 'Employer’s stated factors',
        patterns: p('seniority', 'merit', 'experience', 'production', 'reason (for|given).*pay', '\\bfactor'),
        absence: 'No employer-stated pay factors appear in the record.' },
    ],
  },
  {
    id: 'records_requests',
    tab: 'Records Requests',
    title: 'Records Requests — §1198.5 / §226(b) / §432',
    elements: [
      { name: 'Personnel file request (§1198.5)',
        patterns: p('personnel (file|record)', '1198.5', 'requested.*(file|record)', 'my file'),
        absence: 'No personnel-file request appears in the record.' },
      { name: 'Wage statement request (§226(b))',
        patterns: p('wage statement', 'pay ?stub', 'payroll (record|request)', 'copies of.*(pay|wage)'),
        absence: 'No wage-statement request appears in the record.' },
      { name: 'Signed documents request (§432)',
        patterns: p('signed (document|paperwork)', '\\b432\\b', 'documents i signed', 'copies of.*signed'),
        absence: 'No signed-documents request appears in the record.' },
      { name: 'Request date',
        patterns: p('requested (on|in)', 'sent.*request', 'asked (for|on)', 'date.*request'),
        absence: 'No request date appears in the record.' },
      { name: 'Response date and what was produced',
        patterns: p('responded', 'provided', 'produced', 'received.*(file|record)', 'never (received|got)', 'no response'),
        absence: 'No response date or production material appears in the record.' },
    ],
  },
  {
    id: 'wage_theft_notice',
    tab: 'Wage Theft Notice §2810.5',
    title: 'Wage Theft Notice — §2810.5',
    elements: [
      { name: 'Notice at hire on file',
        patterns: p('notice (at|of) hire', '2810.5', 'wage (notice|theft notice)', 'given at hire'),
        absence: 'No wage-theft notice at hire appears in the record.' },
      { name: 'Content completeness',
        patterns: p('rate of pay', 'pay day', 'employer (name|address)', 'allowances', 'missing.*notice'),
        absence: 'Nothing addresses the completeness of the notice content.' },
      { name: 'Updates on pay change',
        patterns: p('pay change', 'rate change', 'updated notice', 'new notice', '\\braise\\b', 'pay cut'),
        absence: 'No material addresses notice updates on a pay change.' },
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
      // Label LOCATES material the worker ties to Labor Code sections — it never CHARACTERIZES it
      // as a violation (verb test; "violation" is on the banned-vocabulary list this codebase
      // enforces everywhere else).
      { name: 'This worker’s own material, by Labor Code section',
        patterns: p('wage statement', 'pay ?stub', '\\b226\\b', '\\bmeal', 'rest (period|break)', 'overtime', '\\b510\\b', 'reimburs', '\\b2802\\b', 'final pay', 'waiting time', 'minimum wage', 'off the clock'),
        absence: 'No material referencing a Labor Code section appears in this worker’s record.' },
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
  {
    id: 'tech_displacement_sb951',
    tab: 'Tech Displacement §SB 951',
    title: 'SB 951 — Worker Technological Displacement (60-day notice)',
    // First-to-market pack for the AI/automation displacement wave the CA Worker Technological
    // Displacement Act legislated (60-day notice; the AI analog of CalWARN). Labels LOCATE material,
    // they do not CHARACTERIZE — element 2 finds material tying the separation to technology, it does
    // NOT conclude the separation WAS caused by it. COUNSEL-GATED: verify the actual SB 951 elements +
    // coverage threshold against the enacted bill text before this surfaces to any real firm.
    elements: [
      { name: 'Separation records, and the employer’s stated reason',
        patterns: p('terminat', 'laid off', 'layoff', 'let go', 'separation', 'position (eliminated|cut)', 'reduction in force', '\\bRIF\\b', 'displaced'),
        absence: 'No record of the separation or the employer’s stated reason appears in the file.' },
      { name: 'Material describing automation, AI, or technology as a factor',
        note: 'Locates material tying the separation to technology. It does not conclude the separation was caused by it.',
        patterns: p('automat', 'artificial intelligence', '\\bA\\.?I\\.?\\b', 'algorithm', 'machine learning', 'technolog', 'robot', 'software (replaced|took over)', 'replaced by (a |an )?(system|software|machine|bot|program|tool)'),
        absence: 'Nothing in the record ties the separation to automation, AI, or technological change.' },
      { name: 'Employer size or headcount material',
        patterns: p('\\d{2,}\\s+(employees|workers)', 'headcount', 'workforce of', 'staff of', 'number of employees', 'company (size|of \\d)'),
        absence: 'No material establishes the employer’s size relative to the statute’s coverage threshold.' },
      { name: 'Advance notice given — its date and form — or its absence',
        patterns: p('60[- ]?day', 'sixty[- ]?day', 'advance notice', 'notice (given|received|provided)', 'notified', 'no notice', 'without (notice|warning)', 'notice (letter|email)'),
        absence: 'No advance-notice material appears in the record.' },
      { name: 'What the notice stated',
        patterns: p('notice (stated|said|explained|cited|reads)', 'reason (given|stated) in (the )?notice', 'letter (stated|said|explained)', 'told (us|me|workers) (that|the)'),
        absence: 'Nothing shows the content of any notice provided.' },
      { name: 'Timing between notice and separation',
        note: 'Includes material pointing in both directions. one3seven does not omit items that cut against a theory.',
        patterns: p('day(s)? (before|after)', 'week(s)? (before|after)', '60[- ]?day', 'same (day|week)', 'notice[\\s\\S]{0,60}(terminat|layoff|separation)', '(terminat|layoff|separation)[\\s\\S]{0,60}notice'),
        absence: 'No material speaks to how many days separated any notice from the separation.' },
      { name: 'Pay and benefits for the notice period',
        note: 'Locates pay/benefit material on file. one3seven does not compute an amount owed.',
        patterns: p('back pay', 'wages', 'benefits', 'pay period', 'severance', 'final pay', 'compensation for', '60 days (of )?pay'),
        absence: 'No material addresses pay or benefits for the notice period.' },
    ],
  },
  // ---------------------------------------------------------------------------------------
  // Six theories added 2026-08-17, plus the SB 553 workplace-violence widening above, closing
  // gaps found by cross-referencing this library against current CA employment law. Every
  // citation below was verified against real primary/regulatory sources (leginfo.legislature.ca.gov
  // statutory text, DIR/DLSE, Cal/OSHA) before being written -- not filled in from general
  // knowledge. Two corrections worth recording: (1) the non-compete research initially assumed a
  // "§16600.2" that does not exist -- the real sections are §16600.1 and §16600.5; (2) SB 553 was
  // initially going to be modeled as a standalone retaliation lens like §6310, but it has NO
  // private right of action (Cal/OSHA-enforced only) -- forcing a retaliation-sequence lens onto
  // it would have implied a cause of action that doesn't exist, so it stays presence-only below
  // and the real retaliation path was folded into the existing §6310 lens instead. COUNSEL-GATED
  // like every lens in this file, same as SB 951 above -- ship the engine, gate the surface.
  {
    id: 'exempt_classification',
    tab: 'Exempt/Non-Exempt §515',
    title: 'Exempt/Non-Exempt Classification — Labor Code §515',
    // Duties-test element phrasing is paraphrased from DIR's own DLSE glossary and secondary
    // legal summaries, not read verbatim off IWC Wage Order 4-2001 (the source PDF could not be
    // machine-parsed during research) -- verify against the actual wage-order text before this
    // surfaces to any real firm. The salary-basis threshold itself (Labor Code §515(a), 2x
    // minimum wage) and the "primarily = more than half of worktime" standard (§515(e)) ARE
    // confirmed against the current statute.
    elements: [
      { name: 'Job title, offer letter, or posting describing duties',
        patterns: p('job title', 'offer letter', 'job (posting|description)', 'duties (include|are)', 'role (is|was|involves)', 'position (description|summary)'),
        absence: 'No job title, offer letter, or posting describing duties appears in the record.' },
      { name: 'Pay structure — salary, hourly, or day-rate — as described',
        patterns: p('salary', 'salaried', 'hourly (rate|pay|wage)', 'day[- ]rate', 'annual (salary|pay)', 'paid (a salary|hourly|by the (day|hour))'),
        absence: 'No material describes the worker’s pay structure.' },
      { name: 'Deductions for partial-day absences or short weeks',
        patterns: p('dock', 'deduct.{0,20}(day|hour|absence)', 'partial[- ]day', 'short (week|day)', 'pay (cut|reduced) for'),
        absence: 'No material addresses deductions for partial-day absences or short weeks.' },
      { name: 'Supervisory or hiring/firing language',
        patterns: p('supervis', 'directed (other|the work)', 'hir(e|ing)', 'fir(e|ing)', 'discipline others', 'manage(d|s)? (a team|other|staff|employees)', 'no (supervisory|management) (role|duties)'),
        absence: 'No material addresses supervisory or hiring/firing responsibility.' },
      { name: 'Day-to-day task description — hands-on vs. planning/oversight work',
        patterns: p('day[- ]to[- ]day', 'typical (day|shift|week)', 'spent (most|the majority)', 'primarily (did|worked|performed)', 'hands[- ]on', 'mostly (did|performed|worked)', 'my (job|role|work) (was|involved|included)', 'not (managing|supervising) (anyone|others|staff)'),
        absence: 'No material describes the worker’s day-to-day tasks.' },
      { name: 'Discretion or independent-judgment language',
        patterns: p('discretion', 'independent judgment', 'own (approach|decisions)', 'set my own', 'followed a (script|checklist)', 'required (approval|sign[- ]off)', 'no (discretion|independence)'),
        absence: 'No material addresses discretion or independent judgment in the role.' },
      { name: 'License, certification, or specialized training referenced',
        patterns: p('licens', 'certif', 'degree', '\\brn\\b', 'registered nurse', 'engineer', 'cpa\\b', 'accountant', 'specialized training'),
        absence: 'No license, certification, or specialized-training material appears in the record.' },
      { name: 'Time spent away from the employer’s place of business selling',
        patterns: p('outside sales', 'sold (to|at)', 'client (visit|site)', 'away from (the )?(office|store|business)', 'field sales', 'door[- ]to[- ]door'),
        absence: 'No material addresses time spent selling away from the employer’s place of business.' },
    ],
  },
  {
    id: 'independent_contractor',
    tab: 'Worker Classification §2775',
    title: 'Independent Contractor Misclassification — Labor Code §2775 (ABC Test)',
    // ABC test text (§2775(b)(1) prongs A/B/C) confirmed verbatim against leginfo.legislature.ca.gov.
    // The exemption categories that revert to the Borello multi-factor test (licensed professions,
    // B2B contracting, referral agencies, etc. under §§2776-2787) are summarized from DIR/DLSE's
    // FAQ, not independently verified section-by-section -- confirm exact exemption scope with
    // counsel before this surfaces to any real firm.
    elements: [
      { name: 'Tax and payment documents on file',
        patterns: p('1099', '\\bw[- ]?2\\b', 'tax (form|document)', 'independent contractor (tax|form)'),
        absence: 'Nothing in the record identifies a 1099, W-2, or other tax-status document.' },
      { name: 'Contractor agreement or independent-contractor language',
        patterns: p('independent contractor agreement', 'contractor agreement', '\\bic agreement\\b', 'freelance agreement', '1099 agreement'),
        absence: 'No contractor agreement or independent-contractor language appears in the record.' },
      { name: 'Instructions on how, when, or where the work was performed',
        patterns: p('told (me|to) (how|when|where)', 'instructed', 'required to (be|work|follow)', 'set (my )?(hours|schedule)', 'schedule (was )?(set|assigned|given)', 'trained (on|to)'),
        absence: 'Nothing in the record describes instructions given about how, when, or where the work was performed.' },
      { name: 'Description of the work performed, in the worker’s own words',
        patterns: p('my (job|work|role) (was|involved|included)', 'i (did|performed|worked as)', 'responsib(le|ilities)'),
        absence: 'Nothing in the record describes what the work itself consisted of.' },
      { name: 'Other clients, jobs, or business activity outside this relationship',
        patterns: p('other client', 'other (job|work|customers)', 'own (business|company)', 'business license', 'also (worked|did work) for', 'side (job|business|work)'),
        absence: 'No material identifies other clients or business activity outside this relationship.' },
      { name: 'Who supplied tools, equipment, vehicle, or workspace',
        patterns: p('provided (a |the )?(tool|equipment|vehicle|laptop|phone|uniform)', 'used (my|their) own (tool|equipment|vehicle|car)', 'company (car|vehicle|equipment|laptop)', 'workspace (provided|assigned)'),
        absence: 'Nothing in the record identifies who supplied tools, equipment, or a vehicle for the work.' },
      { name: 'Schedule, set hours, or exclusivity material',
        patterns: p('set hours', 'fixed schedule', 'exclusiv', 'could not work for (another|other)', 'required to work (only|exclusively)', 'flexible (hours|schedule)'),
        absence: 'No material addresses the worker’s schedule, set hours, or any restriction on other work.' },
      { name: 'Business license, registration, or invoicing material',
        patterns: p('business license', 'invoice', 'registered (business|entity)', '\\bllc\\b', 'sole proprietor', '\\bein\\b'),
        absence: 'No business license, registration, or invoice appears in the record.' },
    ],
  },
  {
    id: 'piece_rate',
    tab: 'Piece-Rate Pay §226.2',
    title: 'Piece-Rate Compensation — Labor Code §226.2',
    // Confirmed against the current text of §226.2 via leginfo.legislature.ca.gov: rest/recovery
    // periods and "other nonproductive time" must be paid separately from piece-rate earnings, at
    // specified rates, with dedicated wage-statement line items (waivable only under the §226.2(a)(7)
    // safe harbor of paying at least minimum wage for all hours worked in addition to piece-rate pay).
    elements: [
      { name: 'Piece-rate pay structure documented',
        patterns: p('piece[- ]?rate', 'per[- ]?(piece|unit|job)', 'paid per', 'commission per (item|unit)'),
        absence: 'No material identifies a piece-rate pay structure in the record.' },
      { name: 'Rest/recovery period pay as a separate line item',
        patterns: p('rest (period|break) pay', 'recovery period', 'separate.{0,20}(rest|recovery)', 'rest.{0,20}line item'),
        absence: 'No wage statement shows rest or recovery period pay as a separate line item.' },
      { name: 'Nonproductive time pay documented',
        patterns: p('nonproductive time', 'non[- ]productive', 'waiting time pay', 'training (time|pay)', 'cleanup time'),
        absence: 'No material shows separate pay for nonproductive time.' },
      { name: 'Hourly floor paid for all hours worked',
        patterns: p('hourly (rate|floor|minimum)', 'minimum wage for all hours', 'paid.{0,30}(hourly|by the hour).{0,20}in addition', 'guaranteed (minimum|hourly)'),
        absence: 'Nothing in the record addresses whether an hourly floor was paid for all hours worked.' },
      { name: 'Worker’s description of unpaid rest breaks or downtime',
        patterns: p('unpaid (rest|break)', 'not paid (for|during) (rest|break|downtime)', 'break.{0,20}not paid', 'waiting.{0,20}not paid'),
        absence: 'Nothing in the record describes unpaid rest breaks or downtime under a piece-rate structure.' },
    ],
  },
  {
    id: 'commission_agreement',
    tab: 'Commission Agreement §2751',
    title: 'Written Commission Agreement — Labor Code §2751',
    // Confirmed against the current text of §2751 via leginfo.legislature.ca.gov. Note for
    // counsel review: §2751 itself creates no private right of action -- enforcement runs through
    // PAGA and/or the Unfair Competition Law (Bus. & Prof. Code §17200), which changes how
    // "no written agreement" should be framed if this ever surfaces beyond organize-only display.
    elements: [
      { name: 'Written commission agreement on file',
        patterns: p('commission agreement', 'commission plan', 'compensation agreement.{0,20}commission', 'commission (structure|terms)'),
        absence: 'No written commission agreement appears in the record.' },
      { name: 'Commission calculation method stated',
        patterns: p('commission (rate|formula|calculat)', 'percent(age)? of (sales|revenue)', 'commission (tier|quota|schedule)'),
        absence: 'Nothing in the record describes how commissions are computed or paid.' },
      { name: 'Signed acknowledgment or signed receipt on file',
        patterns: p('signed (the )?(agreement|acknowledgment|receipt)', 'signature', 'acknowledged receipt'),
        absence: 'No signed acknowledgment of the commission agreement appears in the record.' },
      { name: 'Commission pay records',
        patterns: p('commission (paid|payment|earned)', 'pay ?stub.{0,20}commission', 'wage statement.{0,20}commission'),
        absence: 'No pay records referencing commission payments appear in the record.' },
      { name: 'How commission terms were communicated, and whether they changed',
        patterns: p('told (me|verbally)', 'terms (changed|were changed)', 'never (signed|received) (a|an|the)', 'verbal(ly)? (agreed|told)', 'no written'),
        absence: 'Nothing in the record describes how commission terms were communicated to the worker.' },
    ],
  },
  {
    id: 'pay_transparency',
    tab: 'Pay Transparency §432.3',
    title: 'Pay Transparency — Labor Code §432.3',
    // Confirmed against the current text of §432.3 via leginfo.legislature.ca.gov, including the
    // SB 642 amendment effective 1/1/2026 (tightened "pay scale" definition to a good-faith,
    // per-hire estimate). Individual pay-data reporting (100+-employee CRD filings) deliberately
    // excluded as an element -- it's an employer state filing, not something a worker's own
    // record would contain evidence of.
    elements: [
      { name: 'Job posting material — with or without a pay scale',
        patterns: p('job (posting|listing|ad)', 'position (posted|listed)', 'pay (scale|range) (posted|listed|shown)'),
        absence: 'No job-posting material appears in the record.' },
      { name: 'Salary history question asked during hiring',
        patterns: p('asked.{0,20}(salary|pay) history', 'previous (salary|pay)', 'current (salary|pay).{0,20}asked', 'salary history'),
        absence: 'No salary-history request during hiring appears in the record.' },
      { name: 'Pay scale request made by the worker',
        patterns: p('requested.{0,20}(pay scale|salary range|pay range)', 'asked (for|about) (the )?(pay|salary) (scale|range)'),
        absence: 'No pay-scale request appears in the record.' },
      { name: 'Employer response to a pay scale request',
        patterns: p('responded.{0,20}(pay|salary) (scale|range)', 'provided.{0,20}(pay|salary) (scale|range)', 'denied.{0,20}(pay|salary) (scale|range)', 'never (received|got).{0,20}(pay|salary) (scale|range)'),
        absence: 'No employer response to a pay-scale request appears in the record.' },
      { name: 'Employer size or headcount material',
        patterns: p('\\d{2,}\\s+(employees|workers)', 'headcount', 'company (size|of)', 'number of employees'),
        absence: 'No employer-headcount material appears in the record.' },
      { name: 'Labor Commissioner complaint or civil action material',
        patterns: p('labor commissioner', '\\bdlse\\b', 'civil action', 'complaint filed'),
        absence: 'No complaint or civil-action material appears in the record.' },
    ],
  },
  {
    id: 'non_compete',
    tab: 'Non-Compete Voidness §16600',
    title: 'Non-Compete Voidness / Notice — Bus. & Prof. Code §16600, §16600.1, §16600.5',
    // Confirmed against the current text of all three sections via leginfo.legislature.ca.gov.
    // §16600.1 (AB 1076) required individualized written notice to affected employees by
    // 2/14/2024 that any non-compete clause is void; §16600.5 (SB 699) reaches out-of-state
    // agreements and creates a private right of action for injunctive relief/damages plus
    // attorney's fees. Correction from initial research assumption: there is no "§16600.2".
    elements: [
      { name: 'Employment agreement containing a non-compete or similar restraint clause',
        patterns: p('non[- ]?compete', 'restrictive covenant', 'not (to )?work for a competitor', 'competing (business|employer)', 'non[- ]?solicit'),
        absence: 'Nothing in the record identifies a non-compete or similar restrictive clause in the worker’s employment agreement.' },
      { name: 'Employer notice regarding the non-compete’s voidness',
        patterns: p('notice.{0,20}(void|unenforceable)', 'clause is void', 'non[- ]?compete.{0,20}(void|unenforceable)', 'notified.{0,20}(void|no longer enforce)'),
        absence: 'Nothing in the record identifies a notice from the employer regarding the non-compete’s voidness.' },
      { name: 'Timing of employer notice',
        patterns: p('notice (sent|dated|received) (on|in)', 'notified (on|in)', 'letter dated', 'email dated'),
        absence: 'Nothing in the record establishes when, or whether, employer notice was sent.' },
      { name: 'Worker’s job search or new employment referencing the non-compete',
        patterns: p('turned down.{0,20}(job|offer|work)', 'could not (work|accept)', 'declined.{0,20}because of (the|a) non[- ]?compete', 'afraid to (work|accept)'),
        absence: 'Nothing in the record identifies job-search or new-employment activity referencing the non-compete.' },
      { name: 'Employer communications invoking or threatening to enforce the non-compete',
        patterns: p('cease and desist', 'threatened (to sue|legal action)', 'enforce.{0,20}non[- ]?compete', 'lawsuit.{0,20}non[- ]?compete'),
        absence: 'Nothing in the record identifies employer communications invoking or threatening to enforce the non-compete.' },
    ],
  },
  {
    id: 'sb553_wvpp',
    tab: 'Workplace Violence Prevention',
    title: 'Workplace Violence Prevention Plan — Labor Code §6401.9 (compliance record)',
    // Presence-only by design: §6401.9 (SB 553, enforceable 7/1/2024) is Cal/OSHA-enforced with
    // no private right of action -- confirmed against the enacted bill text. This lens
    // deliberately has NO retaliation-sequence elements (no "employment action after report", no
    // "interval") since including them would imply a cause of action the statute doesn't confer.
    // A worker retaliated against after a workplace-violence report has a real claim under the
    // lc_6310 lens above, whose "Safety reports made" patterns were widened for this same reason.
    // Cal/OSHA's Title 8 standard implementing this is still in draft (targeted Standards Board
    // adoption by end of 2026) -- re-verify before this surfaces to any real firm.
    elements: [
      { name: 'Written workplace violence prevention plan referenced or provided',
        patterns: p('violence prevention plan', '\\bwvpp\\b', 'workplace violence plan'),
        absence: 'Nothing in the record identifies a written workplace violence prevention plan.' },
      { name: 'Workplace violence or threat reported, and in what words',
        patterns: p('workplace violence', 'threat(ened)? (of )?violence', 'violent (incident|threat)', 'reported.{0,20}(threat|violence)'),
        absence: 'Nothing in the record identifies a workplace violence or threat report by the worker.' },
      { name: 'Violent incident log entry or reference',
        patterns: p('incident log', 'violence log', 'logged.{0,20}(incident|threat)'),
        absence: 'No violent incident log entry appears in the record.' },
      { name: 'Training records',
        patterns: p('violence prevention training', 'wvpp training', 'safety training.{0,20}violence'),
        absence: 'No workplace violence prevention training record appears in the record.' },
      { name: 'Employer’s response to a workplace violence report',
        patterns: p('responded.{0,20}(violence|threat)', 'investigat.{0,20}(violence|threat)', 'no (action|response).{0,20}(violence|threat)'),
        absence: 'Nothing addresses the employer’s response to a workplace violence report.' },
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
    out.push({
      state: e.sourceFile ? 'linked' : 'named',
      text: e.title,
      meta: meta || 'timeline event',
      sourceFile: e.sourceFile ?? undefined,
      snippet: e.title,
    });
  }
  for (const q of input.quotes) {
    out.push({
      state: 'linked',
      text: `"${q.quote}"`,
      meta: [q.category, q.fileName].filter(Boolean).join(' · ') || 'extracted quote',
      sourceFile: q.fileName ?? undefined,
      snippet: q.quote,
    });
  }
  for (const iv of input.intervals) {
    out.push({ state: 'counted', text: iv.description, meta: `${iv.days} day${iv.days === 1 ? '' : 's'}` });
  }
  for (const s of workerStatements(input.workerContext)) {
    out.push({ state: 'worker', text: s, meta: 'worker narrative' });
  }
  return out;
}

// Negation guard — shared by every element/lens keyword match (not four ad-hoc patches). A bare
// substring match can't tell "I reported unsafe conditions" from "I never reported anything" —
// both contain "reported". Before counting a match as affirmative, check a short window of
// preceding words in the same CLAUSE for a negation marker; if one precedes the match within that
// window, it is not counted. Clipped to the current clause (after the last comma/semicolon/
// coordinating conjunction) so a negation in an earlier clause of a compound sentence — "I don't
// have complaints, but I reported the unsafe wiring…" — doesn't blank out the later, unrelated,
// genuinely affirmative clause. Conservative (word-window, not full grammatical parsing) on
// purpose: it is meant to catch the common "I don't have any complaints…" pattern, not to be a
// general negation parser.
const NEGATION_MARKERS_RE = /\b(?:don'?t|does\s?n'?t|did\s?n'?t|was\s?n'?t|were\s?n'?t|has\s?n'?t|have\s?n'?t|had\s?n'?t|is\s?n'?t|are\s?n'?t|no|not|never|n\/a|none|without\s+any)\b/i;
const NEGATION_WINDOW_WORDS = 8;
const CLAUSE_BOUNDARY_RE = /[,;]|\b(?:but|however|although|though|yet|except|whereas)\b/gi;

function isNegatedMatch(text: string, matchIndex: number): boolean {
  const before = text.slice(0, matchIndex);
  let clauseStart = 0;
  CLAUSE_BOUNDARY_RE.lastIndex = 0;
  let boundary: RegExpExecArray | null;
  while ((boundary = CLAUSE_BOUNDARY_RE.exec(before))) {
    clauseStart = boundary.index + boundary[0].length;
  }
  const clause = before.slice(clauseStart);
  const words = clause.trim().split(/\s+/).filter(Boolean);
  const window = words.slice(-NEGATION_WINDOW_WORDS).join(' ');
  return NEGATION_MARKERS_RE.test(window);
}

// Same clause-boundary discipline as isNegatedMatch, but returns the full clause SPAN (start and
// end) around a match index, not just the preceding window. Used to scope "does-not-prove" exclude
// matching to the clause the include match actually occurred in.
function clauseBounds(text: string, index: number): { start: number; end: number } {
  let start = 0;
  let end = text.length;
  CLAUSE_BOUNDARY_RE.lastIndex = 0;
  let boundary: RegExpExecArray | null;
  while ((boundary = CLAUSE_BOUNDARY_RE.exec(text))) {
    const bStart = boundary.index;
    const bEnd = bStart + boundary[0].length;
    if (bEnd <= index) {
      start = bEnd;
      continue;
    }
    if (bStart >= index) {
      end = bStart;
      break;
    }
  }
  return { start, end };
}

// Match element assignment on the fact's TEXT only — never its category/meta. Matching on the
// category ("HR Documents") is what pulled a handbook into "protected activity."
function matchesElement(item: LensItem, el: ElementDef): boolean {
  // A pattern only counts if its match isn't negated, AND (when the element has "does-not-prove"
  // excludes) the exclude doesn't fire in the SAME CLAUSE as that match. Checked per-pattern (not
  // "first pattern wins" / "exclude anywhere in the item") so: (a) a negated match on one pattern
  // doesn't hide a genuine, non-negated match from another pattern in the same element (e.g. "I
  // don't have complaints, but I reported the unsafe wiring to my manager" should still register on
  // "reported"); and (b) an exclude phrase in one clause of a compound sentence doesn't wrongly
  // suppress a genuine match in a DIFFERENT clause of the same item text — e.g. "After my doctor
  // gave me a restriction, HR granted modified duty for six weeks." must still register "granted"
  // for "Accommodations provided" even though "restriction"/"doctor gave" appear earlier in the same
  // sentence, because they're in a different clause than the actual grant. An exclude in the SAME
  // clause as the match (e.g. "I requested lighter duty") still correctly suppresses it — a REQUEST,
  // or a doctor's restriction, does not prove an accommodation was PROVIDED.
  return el.patterns.some((re) => {
    const m = re.exec(item.text); // no 'g' flag on these patterns, so exec always starts at 0
    if (!m) return false;
    const idx = m.index ?? 0;
    if (isNegatedMatch(item.text, idx)) return false;
    if (!el.exclude?.length) return true;
    const { start, end } = clauseBounds(item.text, idx);
    const clause = item.text.slice(start, end);
    return !el.exclude.some((ex) => ex.test(clause));
  });
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

/**
 * Cross-lens ranking guard — the conservative fix for wage-lens keyword over-inclusion.
 *
 * The final-pay lens lights up from facts every terminated worker has (a termination event, a
 * routine final paycheck), so on keyword presence alone it can out-rank the theory the record is
 * actually about — a pregnancy-retaliation record presented "strongest" as a final-paycheck
 * matter. Element matching stays intentionally over-inclusive INSIDE a lens (see header note);
 * the cross-lens "strongest-covered theory" comparison is where over-inclusion misleads.
 *
 * Rule: a lens listed here participates in the cross-lens "strongest" comparison only when the
 * record carries a CONCRETE pay-gap fact — late/missing final pay, unpaid amounts, missed
 * meal/rest breaks or premium gaps, off-the-clock work — from extracted document facts, quotes,
 * or the worker's own words. Keyword presence alone (a paystub exists, a termination happened)
 * is not enough. The lens itself still builds and displays in its own tab either way.
 *
 * PAGA has the same shape of problem: its "own material"/"pay periods documented" elements match
 * on the bare existence of pay stubs / wage statements — the same triggers as the purely
 * administrative wage_statements lens — so ordinary, undisputed pay records alone could make PAGA
 * look like a competitive "strongest theory" on a record with no violation pattern at all. It
 * joins final_pay on this gate for the same reason.
 */
const RANKING_GATED_WAGE_LENSES = new Set<string>(['final_pay', 'paga']);

const CONCRETE_PAY_GAP_PATTERNS: RegExp[] = [
  /\bunpaid\b|\bnot paid\b|never paid|\bowed\b|still owe|missing (wage|pay|paycheck|premium)/i,
  /no overtime( pay| rate)?\b|without (a )?(matching )?overtime rate|straight[- ]time (for|only)/i,
  /off the clock/i,
  /wage theft/i,
  /missed (meal|rest|break)|no (meal|rest) (break|period)|never (got|took|received) a[^.]{0,40}break|skipped (meal|rest|break)/i,
  /(meal|rest|break)[^.]{0,30}premium|premium[^.]{0,30}(meal|rest|break)/i,
  /final (check|pay|paycheck|wages?)[^.]{0,60}(late\b|never|not (received|paid|arrived)|missing|didn.t (come|arrive)|days? (after|late))/i,
  /waiting[- ]time/i,
];

/**
 * Whether a lens may participate in the cross-lens "strongest-covered theory" comparison for this
 * record. Always true except for the ranking-gated wage lenses above, which additionally need a
 * concrete pay-gap fact somewhere in the collected facts. Ineligible lenses still display in
 * their own tab with full element detail — this gates only the cross-lens comparison.
 */
export function lensEligibleForStrongestRanking(lensId: string, input: ClaimLensInput): boolean {
  if (!RANKING_GATED_WAGE_LENSES.has(lensId)) return true;
  const facts = collectFacts(input);
  return facts.some((f) => CONCRETE_PAY_GAP_PATTERNS.some((re) => re.test(f.text)));
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
  // Separation date — the timeline is the single source of truth when it carries a
  // separation-categorized (or termination-titled) dated event; keyword scanning is only the
  // fallback. This is what keeps the flag row from contradicting the timeline it sits next to
  // (e.g. a termination communicated by text whose event title is generic "Employment and HR
  // paperwork" — the event's Separation Records category still establishes the date is on file).
  const SEPARATIONISH = /terminat|separation|employment end|final day|last day|fired|let go|laid off|dismiss/i;
  const separationEvent = input.events.find(
    (e) => !isClusterEvent(e.title) && (SEPARATIONISH.test(String(e.category ?? '')) || SEPARATIONISH.test(e.title))
  );
  const separationEventDate = (separationEvent?.date ?? '').trim();
  const hasSeparation =
    Boolean(separationEvent) ||
    has('terminat', 'separation', 'final pay', 'fired', 'let go', 'laid off', 'dismissed', 'last day', 'employment ended') ||
    fileCount(/terminat|separation/i) > 0;
  const separationValue = hasSeparation
    ? /\d{4}/.test(separationEventDate)
      ? `On file — ${separationEventDate}`
      : 'On file'
    : 'Not on file';
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
    { label: 'Separation date', value: separationValue, present: hasSeparation, note: hasSeparation ? '' : 'not addressed in intake' },
    { label: 'Damages material', value: hasDamages ? 'Referenced' : 'Not on file', present: hasDamages, note: 'not addressed in intake' },
    { label: 'Prior claims / agreements', value: hasPrior ? 'Referenced' : 'Not on file', present: hasPrior, note: 'not addressed in intake' },
  ];
}
