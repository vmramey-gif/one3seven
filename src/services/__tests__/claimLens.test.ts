import { describe, it, expect } from 'vitest';
import { buildClaimLensView, buildExistenceChecks, type ClaimLensInput } from '../claimLens';

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

describe('buildClaimLensView', () => {
  it('maps facts into the retaliation elements and counts them', () => {
    const v = buildClaimLensView('retaliation', rosa);
    expect(v.title).toBe('Retaliation');
    // protected activity element gets the complaint/overtime material
    const prot = v.elements.find((e) => /protected activity/i.test(e.name));
    expect(prot?.items.length).toBeGreaterThan(0);
    // adverse action element gets the warning + termination
    const adv = v.elements.find((e) => /adverse/i.test(e.name));
    expect(adv?.items.some((i) => /terminat/i.test(i.text))).toBe(true);
    // the 9-day interval is a counted fact under the relating-material element
    const rel = v.elements.find((e) => /relating/i.test(e.name));
    expect(rel?.items.some((i) => i.state === 'counted')).toBe(true);
    expect(v.tally.total).toBeGreaterThan(0);
  });

  it('renders a loud absence when an element has no material', () => {
    const empty: ClaimLensInput = { events: [], quotes: [], intervals: [], workerContext: '', files: [] };
    const v = buildClaimLensView('feha', empty);
    expect(v.elements.every((e) => e.empty)).toBe(true);
    expect(v.tally.gaps).toBe(v.elements.length);
    expect(v.tally.total).toBe(0);
  });

  it('never omits: a document that cuts against the theory still appears', () => {
    const withCounter: ClaimLensInput = {
      ...rosa,
      files: [...rosa.files, { fileName: 'Prior_Attendance_Writeup_Jan.pdf', category: 'Discipline' }],
    };
    const v = buildClaimLensView('retaliation', withCounter);
    const adv = v.elements.find((e) => /adverse/i.test(e.name));
    // the earlier write-up (a discipline doc predating the complaint) is surfaced, not hidden
    expect(adv?.items.some((i) => /attendance writeup/i.test(i.text))).toBe(true);
  });

  it('re-sorts: the same record produces different element maps per lens', () => {
    const ret = buildClaimLensView('retaliation', rosa);
    const wage = buildClaimLensView('wage', rosa);
    expect(ret.title).not.toBe(wage.title);
    expect(ret.elements.map((e) => e.name)).not.toEqual(wage.elements.map((e) => e.name));
  });
});

describe('buildExistenceChecks', () => {
  it('flags case-killers present/absent as pure facts', () => {
    const checks = buildExistenceChecks(rosa);
    const arb = checks.find((c) => /arbitration/i.test(c.label));
    expect(arb?.present).toBe(false); // not mentioned anywhere → not on file
    const sep = checks.find((c) => /separation/i.test(c.label));
    expect(sep?.present).toBe(true); // termination is in the record
  });
});
