import { describe, it, expect } from 'vitest';
import {
  buildClaimLensView,
  buildExistenceChecks,
  CLAIM_LENSES,
  lensEligibleForStrongestRanking,
  type ClaimLensInput,
} from '../claimLens';

const rosa: ClaimLensInput = {
  events: [
    { title: 'Complaint submitted to Human Resources', date: 'Mar 4, 2026', category: 'HR', sourceFile: 'Rosa_HR_Complaint.pdf' },
    { title: 'Written warning issued', date: 'Mar 13, 2026', category: 'Discipline', sourceFile: 'Rosa_WrittenWarning.pdf' },
    { title: 'Termination documented', date: 'Apr 8, 2026', category: 'Separation', sourceFile: 'Rosa_TerminationLetter.pdf' },
  ],
  quotes: [
    { quote: 'my pay statements reflect straight-time hours only, with no overtime rate applied.', fileName: 'Rosa_HR_Complaint.pdf', category: 'HR' },
  ],
  intervals: [{ label: 'Written warning', days: 9, description: 'Written warning: 9 days after complaint' }],
  workerContext: 'I filed a written HR complaint about unpaid overtime. Nine days later I got a written warning.',
  files: [
    { fileName: 'Rosa_PayStub_Feb2026.pdf', category: 'Wage Records' },
    { fileName: 'Rosa_TerminationLetter.pdf', category: 'Separation' },
  ],
};

// New doctrine-clean element names (verb test: labels LOCATE, never CHARACTERIZE).
const REPORTS = /reports and complaints/i;
const ACTIONS = /employment actions after/i;
const SEQUENCE = /sequence and interval/i;

describe('buildClaimLensView', () => {
  it('maps facts into the §1102.5 retaliation elements and counts them', () => {
    const v = buildClaimLensView('retaliation_1102_5', rosa);
    expect(v.title).toBe('Labor Code §1102.5 — Retaliation');
    expect(v.elements.find((e) => REPORTS.test(e.name))?.items.length).toBeGreaterThan(0);
    expect(v.elements.find((e) => ACTIONS.test(e.name))?.items.some((i) => /terminat/i.test(i.text))).toBe(true);
    expect(v.elements.find((e) => SEQUENCE.test(e.name))?.items.some((i) => i.state === 'counted')).toBe(true);
    expect(v.tally.total).toBeGreaterThan(0);
  });

  it('computes Coverage Rate as a structural fact (elements with material / total)', () => {
    const v = buildClaimLensView('retaliation_1102_5', rosa);
    expect(v.coverage.total).toBe(v.elements.length);
    expect(v.coverage.withMaterial).toBe(v.elements.length - v.tally.gaps);
    expect(v.coverage.pct).toBe(Math.round((v.coverage.withMaterial / v.coverage.total) * 100));
    // an empty record is 0% coverage, never NaN
    const empty = buildClaimLensView('feha_disability', { events: [], quotes: [], intervals: [], workerContext: '', files: [] });
    expect(empty.coverage.pct).toBe(0);
  });

  it('renders a loud absence when an element has no material', () => {
    const empty: ClaimLensInput = { events: [], quotes: [], intervals: [], workerContext: '', files: [] };
    const v = buildClaimLensView('feha_disability', empty);
    expect(v.elements.every((e) => e.empty)).toBe(true);
    expect(v.tally.gaps).toBe(v.elements.length);
    expect(v.tally.total).toBe(0);
  });

  it('never omits: a fact that cuts against the theory still appears', () => {
    const withCounter: ClaimLensInput = {
      ...rosa,
      events: [
        ...rosa.events,
        { title: 'Written warning for attendance predating the complaint', date: 'Jan 2026', category: 'Discipline', sourceFile: 'attendance_writeup.pdf' },
      ],
    };
    const v = buildClaimLensView('retaliation_1102_5', withCounter);
    const actions = v.elements.find((e) => ACTIONS.test(e.name));
    // the earlier write-up (predating the complaint — cuts against the theory) is surfaced, not hidden
    expect(actions?.items.some((i) => /attendance/i.test(i.text))).toBe(true);
  });

  it('does not pull a handbook or generic HR file into the reports element (mis-sort fix)', () => {
    const noisy: ClaimLensInput = {
      events: [{ title: 'HR Documents (2 files)', date: '2023', category: 'HR Documents' }],
      quotes: [],
      intervals: [],
      confirmed: [],
      workerContext: '',
      files: [{ fileName: 'Employee Handbook Revised 2023.pdf', category: 'HR Documents' }],
    };
    const v = buildClaimLensView('retaliation_1102_5', noisy);
    const reports = v.elements.find((e) => REPORTS.test(e.name));
    expect(reports?.items ?? []).toHaveLength(0);
    expect(reports?.empty).toBeTruthy();
  });

  it('re-sorts: the same record produces different element maps per lens', () => {
    const ret = buildClaimLensView('retaliation_1102_5', rosa);
    const wage = buildClaimLensView('wage_statements', rosa);
    expect(ret.title).not.toBe(wage.title);
    expect(ret.elements.map((e) => e.name)).not.toEqual(wage.elements.map((e) => e.name));
  });

  it('scopes report elements to the lens subject — a wage complaint is not a FEHA harassment report', () => {
    // rosa's complaint is about unpaid overtime: a §1102.5 report, NOT a harassment report.
    // The lens must actually filter — the same record produces different item sets per theory.
    const ret = buildClaimLensView('retaliation_1102_5', rosa);
    const harass = buildClaimLensView('feha_harassment', rosa);

    const retReports = ret.elements.find((e) => REPORTS.test(e.name));
    expect(retReports?.items.length).toBeGreaterThan(0); // wage complaint IS a §1102.5 report

    const harassReports = harass.elements.find((e) => /reports made/i.test(e.name));
    expect(harassReports?.items ?? []).toHaveLength(0); // ...but NOT a harassment report → absence
    expect(harassReports?.empty).toBeTruthy();
  });

  it('keeps the retaliation statutes separate (no single merged retaliation lens)', () => {
    const ids = ['retaliation_1102_5', 'feha_retaliation', 'lc_98_6', 'lc_6310'];
    const titles = ids.map((id) => buildClaimLensView(id, rosa).title);
    expect(new Set(titles).size).toBe(4);
  });

  it('wage cluster is split into five separate statutory lenses (no merged wage lens)', () => {
    const ids = ['overtime', 'meal_rest', 'wage_statements', 'final_pay', 'expense_2802'];
    const titles = ids.map((id) => buildClaimLensView(id, rosa).title);
    expect(new Set(titles).size).toBe(5);
    expect(CLAIM_LENSES.some((l) => l.id === 'wage')).toBe(false);
  });

  it('PAGA + CalWARN build as distinct aggregate lenses', () => {
    const paga = buildClaimLensView('paga', rosa);
    const warn = buildClaimLensView('calwarn', rosa);
    expect(paga.title).toMatch(/PAGA/);
    expect(warn.title).toMatch(/CalWARN/);
    // PAGA surfaces this worker's own violation material by section (rosa has overtime/wage material)
    expect(paga.elements.find((e) => /by Labor Code section/i.test(e.name))?.items.length).toBeGreaterThan(0);
    expect(paga.coverage.total).toBe(paga.elements.length);
    expect(warn.coverage.total).toBe(warn.elements.length);
  });

  it('SB 951 tech-displacement lens builds, is element-scoped, and locates (never characterizes)', () => {
    const v = buildClaimLensView('tech_displacement_sb951', rosa);
    expect(v.title).toMatch(/SB 951/);
    expect(v.coverage.total).toBe(v.elements.length);
    // Labels LOCATE material — none may CHARACTERIZE (verb test): no "protected", "adverse",
    // "wrongful", "pretext", "severity", "strong".
    for (const el of v.elements) {
      expect(el.name).not.toMatch(/\b(protected|adverse|wrongful|pretext|severity|strong|liable|valid)\b/i);
    }
    // The "technology as a factor" element exists and renders as absence for a wage-only record
    // (rosa's overtime complaint says nothing about automation/AI) — it locates, doesn't assume.
    const tech = v.elements.find((e) => /automation, AI, or technology/i.test(e.name));
    expect(tech).toBeDefined();
    expect(tech?.items ?? []).toHaveLength(0);
    expect(tech?.empty).toBeTruthy();
  });

  it('Tier 2 wave 1: leave cluster + pay equity + records lenses build distinctly', () => {
    const ids = ['cfra', 'fmla', 'pdl', 'lactation', 'sick_leave', 'other_leave', 'equal_pay', 'records_requests', 'wage_theft_notice'];
    const titles = ids.map((id) => buildClaimLensView(id, rosa).title);
    expect(new Set(titles).size).toBe(9);
    for (const id of ids) {
      const v = buildClaimLensView(id, rosa);
      expect(v.coverage.total).toBe(v.elements.length);
    }
  });
});

describe('buildExistenceChecks (Layer 0 flag row)', () => {
  it('flags case-killers present/absent as pure facts', () => {
    const checks = buildExistenceChecks(rosa);
    expect(checks.find((c) => /arbitration/i.test(c.label))?.present).toBe(false); // not mentioned → not on file
    expect(checks.find((c) => /separation/i.test(c.label))?.present).toBe(true); // termination is in the record
  });

  it('includes the expanded flags (EEOC, LWDA/PAGA, damages, prior claims)', () => {
    const labels = buildExistenceChecks(rosa).map((c) => c.label).join(' | ');
    expect(labels).toMatch(/EEOC/);
    expect(labels).toMatch(/LWDA/);
    expect(labels).toMatch(/Damages/);
    expect(labels).toMatch(/Prior claims/);
  });
});

// Element-precision regression — the "does-not-prove" gate. Locks the two false positives seen in a
// real disability-accommodation intake (Marquez/Cedarline): a REQUEST / doctor's restriction must not
// count as an accommodation PROVIDED, and a request FOR leave must not count as leave USED.
describe('element precision — does-not-prove exclusions (Marquez regression)', () => {
  const marquez: ClaimLensInput = {
    events: [
      { title: 'Worker requests leave or accommodation', date: 'February 3, 2026', sourceFile: '4_Marquez_DoctorNote_2026-02-03.pdf' },
    ],
    quotes: [],
    intervals: [],
    confirmed: [],
    workerContext:
      'my doctor gave me a lifting restriction (no lifting over 15 pounds) and I sent HR an accommodation request on February 5 asking for lighter duty. I took about a week of sick leave later that month.',
    files: [],
  };

  it('a REQUEST / doctor restriction does NOT satisfy "Accommodations provided"', () => {
    const v = buildClaimLensView('feha_disability', marquez);
    const provided = v.elements.find((e) => /Accommodations provided/i.test(e.name));
    expect(provided?.items ?? []).toHaveLength(0);
    expect(provided?.empty).toBeTruthy();
  });

  it('a request FOR leave does NOT satisfy "Leave used as accommodation"', () => {
    const v = buildClaimLensView('feha_disability', marquez);
    const leaveUsed = v.elements.find((e) => /Leave used as accommodation/i.test(e.name));
    // the source-linked "requests leave or accommodation" event must not be counted as leave USED
    expect((leaveUsed?.items ?? []).some((i) => /request/i.test(i.text))).toBe(false);
  });

  it('the request STILL satisfies "Accommodation requested" (precision, not suppression)', () => {
    const v = buildClaimLensView('feha_disability', marquez);
    const requested = v.elements.find((e) => /Accommodation requested/i.test(e.name));
    expect((requested?.items ?? []).length).toBeGreaterThan(0);
  });

  it('coverage is no longer inflated — "provided" reads as a genuine gap', () => {
    const v = buildClaimLensView('feha_disability', marquez);
    expect(v.coverage.withMaterial).toBeLessThan(v.coverage.total);
  });

  it('a REQUEST does not satisfy disability "Employer response"', () => {
    const v = buildClaimLensView('feha_disability', marquez);
    const resp = v.elements.find((e) => /Employer response/i.test(e.name));
    expect(resp?.items ?? []).toHaveLength(0);
    expect(resp?.empty).toBeTruthy();
  });

  it('a complaint is NOT counted as an employer "employment action" (§1102.5) — but real actions are', () => {
    const v = buildClaimLensView('retaliation_1102_5', rosa);
    const actions = v.elements.find((e) => /Employment actions after the report/i.test(e.name));
    // rosa's HR complaint EVENT must not appear as an adverse ACTION against her…
    expect((actions?.items ?? []).some((i) => /complaint submitted/i.test(i.text))).toBe(false);
    // …while the genuine actions (termination) still do.
    expect((actions?.items ?? []).some((i) => /terminat/i.test(i.text))).toBe(true);
  });
});

// does-not-prove exclusions are CLAUSE-scoped, matching the negation guard's clause-boundary
// discipline — a "doctor gave a restriction" / "requested" word in one clause of a compound
// sentence must not blank out a genuine "granted" in a DIFFERENT clause of the same item text.
describe('element precision — does-not-prove exclusions are clause-scoped, not whole-text', () => {
  it('a request-then-grant sentence correctly registers "Accommodations provided" (the audit-failing sentence)', () => {
    const grant: ClaimLensInput = {
      events: [],
      quotes: [],
      intervals: [],
      confirmed: [],
      workerContext: 'After my doctor gave me a restriction, HR granted modified duty for six weeks.',
      files: [],
    };
    const v = buildClaimLensView('feha_disability', grant);
    const provided = v.elements.find((e) => /Accommodations provided/i.test(e.name));
    // the grant is in a DIFFERENT clause than "doctor gave"/"restriction" — must be ON FILE, not excluded
    expect((provided?.items ?? []).some((i) => /granted/i.test(i.text))).toBe(true);
    expect(provided?.empty).toBeFalsy();
  });

  it('a request-only sentence, comma variant (restriction + request in the SAME clause as the only affirmative wording, no separate grant clause) still does NOT register as provided (Marquez regression)', () => {
    const requestOnly: ClaimLensInput = {
      events: [],
      quotes: [],
      intervals: [],
      confirmed: [],
      workerContext: 'My doctor gave me a restriction, and I requested modified duty from HR.',
      files: [],
    };
    const v = buildClaimLensView('feha_disability', requestOnly);
    const provided = v.elements.find((e) => /Accommodations provided/i.test(e.name));
    // "gave me" is the only affirmative match, and "restriction"/"doctor gave" sit in that SAME
    // clause ("My doctor gave me a restriction") — still correctly excluded. The second clause
    // ("I requested modified duty from HR") never affirmatively matches "provided" at all.
    expect(provided?.items ?? []).toHaveLength(0);
    expect(provided?.empty).toBeTruthy();
  });

  it('an exclude phrase in the SAME clause as the match still correctly excludes (fix is scoped, not disabled)', () => {
    const sameClause: ClaimLensInput = {
      events: [],
      quotes: [],
      intervals: [],
      confirmed: [],
      workerContext: 'HR responded to the restriction from my doctor.',
      files: [],
    };
    const v = buildClaimLensView('feha_disability', sameClause);
    const resp = v.elements.find((e) => /Employer response/i.test(e.name));
    // "responded" and "restriction" are in the same single clause (no comma/semicolon/conjunction
    // boundary) — this is the same event, not a different one, so the exclude must still fire.
    expect(resp?.items ?? []).toHaveLength(0);
    expect(resp?.empty).toBeTruthy();
  });
});

// Negation guard (messy-cases gauntlet Case C finding) — a worker's own DENIAL of a complaint
// ("I don't have any complaints...") must not register as an affirmative report/complaint just
// because the substring "complain" appears inside "complaints". This is a shared helper used by
// every element match, not four ad-hoc patches — verified here across the four lenses the
// gauntlet found lighting up on the same denied sentence.
describe('negation guard — a denied complaint is not an affirmative match', () => {
  const priyaDenial: ClaimLensInput = {
    events: [],
    quotes: [],
    intervals: [],
    workerContext:
      "I don't have any complaints about how things went there. I got along well with my manager and the team, and my reviews were positive both years.",
    files: [],
  };

  it('retaliation_1102_5 "Reports and complaints made" does not fire on the denial', () => {
    const v = buildClaimLensView('retaliation_1102_5', priyaDenial);
    const reports = v.elements.find((e) => /Reports and complaints made/i.test(e.name));
    expect((reports?.items ?? []).some((i) => /complain/i.test(i.text))).toBe(false);
  });

  it('constructive_discharge "Reports made about those conditions" does not fire on the denial', () => {
    const v = buildClaimLensView('constructive_discharge', priyaDenial);
    const reports = v.elements.find((e) => /Reports made about those conditions/i.test(e.name));
    expect((reports?.items ?? []).some((i) => /complain/i.test(i.text))).toBe(false);
  });

  it('lactation "Complaint material" does not fire on the denial', () => {
    const v = buildClaimLensView('lactation', priyaDenial);
    const complaintMaterial = v.elements.find((e) => /Complaint material/i.test(e.name));
    expect((complaintMaterial?.items ?? []).some((i) => /complain/i.test(i.text))).toBe(false);
  });

  it('separation_public_policy "Policy or statute the worker points to" does not fire on the denial', () => {
    const v = buildClaimLensView('separation_public_policy', priyaDenial);
    const policy = v.elements.find((e) => /Policy or statute the worker points to/i.test(e.name));
    expect((policy?.items ?? []).some((i) => /complain/i.test(i.text))).toBe(false);
  });

  it('a genuine, non-negated complaint still registers (negation guard is not over-broad)', () => {
    const genuine: ClaimLensInput = {
      ...priyaDenial,
      workerContext: 'I complained to HR about unpaid overtime on March 3rd.',
    };
    const v = buildClaimLensView('retaliation_1102_5', genuine);
    const reports = v.elements.find((e) => /Reports and complaints made/i.test(e.name));
    expect((reports?.items ?? []).some((i) => /complain/i.test(i.text))).toBe(true);
  });

  it('a non-negated match elsewhere in the same sentence still registers even when an earlier pattern is negated', () => {
    // "don't have complaints" is negated, but "reported the unsafe wiring" a few words later is a
    // real, non-negated report — the guard must not let one negated pattern hide another pattern's
    // genuine affirmative match in the same text.
    const mixed: ClaimLensInput = {
      events: [],
      quotes: [],
      intervals: [],
      workerContext: "I don't have complaints, but I reported the unsafe wiring to my manager.",
      files: [],
    };
    const v = buildClaimLensView('retaliation_1102_5', mixed);
    const reports = v.elements.find((e) => /Reports and complaints made/i.test(e.name));
    expect((reports?.items ?? []).some((i) => /reported/i.test(i.text))).toBe(true);
  });

  it('the Rosa/Francis-style real complaint still registers normally (regression guard)', () => {
    const v = buildClaimLensView('retaliation_1102_5', rosa);
    const reports = v.elements.find((e) => REPORTS.test(e.name));
    expect((reports?.items ?? []).length).toBeGreaterThan(0);
  });
});

// FEHA harassment "Participants and witnesses" must not fire on a bare role noun with zero
// harassment-adjacent context (messy-cases gauntlet Case C finding).
describe('feha_harassment — bare role nouns require harassment context', () => {
  it('a benign "manager" mention with no harassment content does not trip "Participants and witnesses"', () => {
    const benign: ClaimLensInput = {
      events: [],
      quotes: [],
      intervals: [],
      workerContext: 'I got along well with my manager and the team, and my reviews were positive both years.',
      files: [],
    };
    const v = buildClaimLensView('feha_harassment', benign);
    const participants = v.elements.find((e) => /Participants and witnesses/i.test(e.name));
    expect(participants?.items ?? []).toHaveLength(0);
    expect(participants?.empty).toBeTruthy();
  });

  it('"manager" co-occurring with real harassment-context language still trips the element', () => {
    const real: ClaimLensInput = {
      events: [],
      quotes: [],
      intervals: [],
      workerContext: 'My manager made an inappropriate comment about my appearance in front of two coworkers.',
      files: [],
    };
    const v = buildClaimLensView('feha_harassment', real);
    const participants = v.elements.find((e) => /Participants and witnesses/i.test(e.name));
    expect((participants?.items ?? []).length).toBeGreaterThan(0);
  });
});

// PAGA joins final_pay on the cross-lens "strongest theory" ranking gate — ordinary, undisputed
// pay stubs alone must not make PAGA eligible to out-rank other theories, though it still renders
// fully in its own tab regardless of eligibility (messy-cases gauntlet Case C finding).
describe('paga ranking eligibility gate', () => {
  const ordinaryPayStubs: ClaimLensInput = {
    events: [{ title: 'Pay period or overtime record documented', date: 'June 1, 2026', sourceFile: 'stub.pdf' }],
    quotes: [],
    intervals: [],
    workerContext: '',
    files: [{ fileName: 'stub.pdf', category: 'Pay Records' }],
  };

  it('is NOT eligible for strongest-theory ranking on ordinary pay stubs alone', () => {
    expect(lensEligibleForStrongestRanking('paga', ordinaryPayStubs)).toBe(false);
  });

  it('IS eligible once a concrete pay-gap/violation fact is present', () => {
    const withViolation: ClaimLensInput = {
      ...ordinaryPayStubs,
      workerContext: 'I was never paid overtime — I worked off the clock most closing shifts.',
    };
    expect(lensEligibleForStrongestRanking('paga', withViolation)).toBe(true);
  });

  it('final_pay is unaffected by adding paga to the gate (regression guard)', () => {
    expect(lensEligibleForStrongestRanking('final_pay', ordinaryPayStubs)).toBe(false);
  });
});
