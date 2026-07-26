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
  elements: LensElementView[];
};

export type ExistenceCheck = { label: string; value: string; present: boolean; note: string };

type ElementDef = { name: string; note?: string; patterns: RegExp[]; absence: string };
type LensDef = { id: string; tab: string; title: string; elements: ElementDef[] };

const p = (...s: string[]): RegExp[] => s.map((x) => new RegExp(x, 'i'));

export const CLAIM_LENSES: LensDef[] = [
  {
    id: 'retaliation',
    tab: '§1102.5 Retaliation',
    title: 'Retaliation',
    elements: [
      {
        name: 'Protected activity — a disclosure or complaint',
        // Requires the worker DOING something protected — not merely an HR document existing. Bare
        // "hr"/"human resources" were removed; they matched handbooks and generic HR files.
        patterns: p('complain', 'grievance', 'reported\\b', 'reporting', 'rais(e|ed|ing)\\b', 'disclos', 'whistle', 'safety concern', 'unsafe', 'hazard', 'unpaid (wage|overtime)', 'wage theft', 'refus', 'objected', 'protested'),
        absence: 'Nothing in the record identifies a protected activity — a complaint, report, or disclosure by the worker.',
      },
      {
        name: 'Adverse employment action',
        patterns: p('terminat', 'fired', 'discharg', 'laid off', 'layoff', 'written warning', 'write[- ]?up', 'written up', 'disciplin', 'demot', 'suspend', 'hours (cut|reduced)', 'pay cut', 'separation', 'final pay'),
        absence: 'No adverse employment action is documented in the record.',
      },
      {
        name: 'Material relating the activity to the action',
        note: 'Includes material pointing in both directions. one3seven does not omit items that cut against a theory.',
        patterns: p('day(s)? (after|before|between)', 'interval', 'terminat.*complain', 'complain.*terminat', 'warning.*complain', 'shortly (after|before)'),
        absence: 'No material in the record speaks to the timing or connection between the activity and the action.',
      },
      {
        name: 'What the worker understood or intended at the time',
        patterns: p('believ', 'understood', 'thought', 'concerned that', 'in good faith', 'because'),
        absence: 'Nothing in the record addresses what the worker understood or intended when they acted.',
      },
    ],
  },
  {
    id: 'wage',
    tab: 'Wage statements & final pay',
    title: 'Wage statements & final pay',
    elements: [
      {
        name: 'Employment relationship and dates',
        patterns: p('offer letter', 'employment agreement', 'hire', 'start date', 'employment (began|begins|start)', 'terminat', 'separation', 'employment dates'),
        absence: 'No document establishes the employment relationship or its dates.',
      },
      {
        name: 'Wage statements in the record',
        patterns: p('pay ?stub', 'paycheck', 'wage statement', 'earnings statement', 'payroll', 'pay period', 'wage record'),
        absence: 'No wage statements are in the record.',
      },
      {
        name: 'Timing of final payment',
        patterns: p('final pay', 'final paycheck', 'last paycheck', 'final wage', 'separation.*pay', 'pay.*separation'),
        absence: 'No material addresses the timing of the final payment relative to separation.',
      },
      {
        name: 'Meal and rest period records',
        patterns: p('meal', 'rest', 'break', 'time ?record', 'timesheet', 'timecard', 'hours worked'),
        absence: 'No time records on file, and the worker narrative does not address break timing.',
      },
    ],
  },
  {
    id: 'feha',
    tab: 'FEHA disability',
    title: 'FEHA disability & interactive process',
    elements: [
      {
        name: 'Condition disclosed to the employer',
        patterns: p('disab', 'medical', 'injur', 'condition', 'doctor', 'restriction', 'diagnos', 'back strain', 'health'),
        absence: 'No medical documentation on file, and the record does not describe a condition disclosed to the employer.',
      },
      {
        name: 'Accommodation requested',
        patterns: p('accommodat', 'lighter', 'reassign', 'modified (duty|schedule)', 'restriction', 'requested.*(help|assign)', 'asked for'),
        absence: 'Nothing in the record describes an accommodation the worker requested.',
      },
      {
        name: 'Employer response and interactive process',
        patterns: p('interactive process', 'responded', 'met with', 'offered', 'denied.*(request|accommodat)', 'hr.*(respon|met)'),
        absence: 'Nothing in the record addresses whether the employer responded, met, or offered anything in reply.',
      },
      {
        name: 'Adverse employment action',
        patterns: p('terminat', 'fired', 'written warning', 'write[- ]?up', 'disciplin', 'demot', 'suspend', 'separation'),
        absence: 'No adverse employment action is documented in the record.',
      },
      {
        name: 'Administrative filing',
        patterns: p('right[- ]?to[- ]?sue', '\\bcrd\\b', '\\bdfeh\\b', 'administrative (charge|filing)', 'complaint filed with'),
        absence: 'No CRD right-to-sue letter on file, and no filing date recorded in intake.',
      },
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

  return { title: lens.title, tally, elements };
}

/** The lens-independent case-killer strip. Pure existence facts — no legal judgment. */
export function buildExistenceChecks(input: ClaimLensInput): ExistenceCheck[] {
  const allText = norm(
    [
      input.workerContext,
      ...input.events.map((e) => e.title),
      ...input.files.map((f) => f.fileName),
      ...input.quotes.map((q) => q.quote),
    ].join(' ')
  );
  const has = (...kw: string[]) => kw.some((k) => allText.includes(k));
  const fileCount = (re: RegExp) => input.files.filter((f) => re.test(f.fileName)).length;

  const wageCount = fileCount(/pay ?stub|paystub|wage|earnings/i);
  const hasDates = has('employment dates', 'start date', 'offer', 'hire') || input.events.length > 0;
  const hasSeparation = has('terminat', 'separation', 'final pay') || fileCount(/terminat|separation/i) > 0;

  return [
    { label: 'Arbitration agreement', value: has('arbitrat') ? 'Referenced' : 'Not on file', present: has('arbitrat'), note: has('arbitrat') ? '' : 'not addressed in intake' },
    { label: 'Employment dates', value: hasDates ? 'On file' : 'Not on file', present: hasDates, note: hasDates ? '' : 'not addressed in intake' },
    { label: 'Employer headcount', value: has('employees', 'headcount', 'staff of') ? 'Referenced' : 'Not on file', present: has('employees', 'headcount'), note: 'not addressed in intake' },
    { label: 'Right-to-sue letter', value: has('right-to-sue', 'right to sue', 'crd', 'dfeh') ? 'Referenced' : 'Not on file', present: has('right-to-sue', 'right to sue'), note: 'not addressed in intake' },
    { label: 'Wage statements', value: wageCount > 0 ? `${wageCount} on file` : 'Not on file', present: wageCount > 0, note: wageCount > 0 ? '' : 'not addressed in intake' },
    { label: 'Separation date', value: hasSeparation ? 'On file' : 'Not on file', present: hasSeparation, note: hasSeparation ? '' : 'not addressed in intake' },
  ];
}
