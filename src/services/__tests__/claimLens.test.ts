import { describe, it, expect } from 'vitest';
import { buildClaimLensView, buildExistenceChecks, CLAIM_LENSES, type ClaimLensInput } from '../claimLens';

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
