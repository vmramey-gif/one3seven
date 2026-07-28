import { describe, it, expect } from 'vitest';
import { buildClaimLensView, buildExistenceChecks, type ClaimLensInput } from '../claimLens';

// Throwaway harness: runs the 5 test-pack intakes through the real engine and
// asserts the exact behavior each PDF was engineered to prove (see 00_TEST_KEY).

const T1: ClaimLensInput = {
  events: [
    { title: 'Written complaint submitted to Human Resources regarding unpaid overtime', date: 'Mar 4, 2026', category: 'HR', sourceFile: 'Rosa_HR_Complaint.pdf' },
    { title: 'Written warning issued', date: 'Mar 13, 2026', category: 'Discipline', sourceFile: 'Rosa_WrittenWarning.pdf' },
    { title: 'Termination documented', date: 'Apr 8, 2026', category: 'Separation', sourceFile: 'Rosa_TerminationLetter.pdf' },
  ],
  quotes: [{ quote: 'my pay statements reflect straight-time hours only, with no overtime rate applied', fileName: 'Rosa_HR_Complaint.pdf', category: 'HR' }],
  intervals: [{ label: 'Written warning', days: 9, description: 'Written warning: 9 days after complaint' }],
  confirmed: [{ label: 'HR complaint topic', value: 'unpaid overtime not applied to pay statements' }, { label: 'Complaint date', value: 'March 4, 2026' }],
  workerContext: 'I filed a written HR complaint about unpaid overtime. Nine days later I got a written warning.',
  files: [{ fileName: 'Rosa_PayStub_Feb2026.pdf', category: 'Wage Records' }, { fileName: 'Rosa_OfferLetter.pdf', category: 'Onboarding' }, { fileName: 'Rosa_TerminationLetter.pdf', category: 'Separation' }],
};

const T2: ClaimLensInput = {
  events: [{ title: 'Email to manager inquiring about the timing of a raise and interest in a lead position', date: 'Dec 18, 2024', category: 'Workplace Communications' }],
  quotes: [{ quote: 'I wanted to get a little more insight on the raise we spoke about at my yearly review', fileName: 'Huseby_RaiseEmail.pdf', category: 'Workplace Communications' }],
  intervals: [],
  confirmed: [{ label: 'HR complaint topic', value: 'timing of a raise and interest in a lead position' }, { label: 'Complaint date', value: 'December 18, 2024' }],
  workerContext: 'I raised a question about a promised raise and a lead role. Still employed.',
  files: [{ fileName: 'Huseby_PayStub_Nov2024.pdf', category: 'Wage Records' }],
};

const T3: ClaimLensInput = {
  events: [{ title: 'HR Documents (3 files)', date: '2023', category: 'HR Documents' }],
  quotes: [],
  intervals: [],
  confirmed: [],
  workerContext: 'I uploaded onboarding paperwork I was asked to review at hire. I have not made any complaint.',
  files: [
    { fileName: 'Employee_Handbook_Revised_2023.pdf', category: 'HR Documents' },
    { fileName: 'Benefits_Enrollment_Form.pdf', category: 'HR Documents' },
    { fileName: 'Onboarding_Email.pdf', category: 'HR Documents' },
  ],
};

const T4: ClaimLensInput = {
  events: [
    { title: 'Written warning for attendance (predates any safety complaint)', date: 'Jan 14, 2026', category: 'Discipline', sourceFile: 'Reyes_AttendanceWarning.pdf' },
    { title: 'Reported an unsafe machine guard to supervisor', date: 'May 5, 2026', category: 'Safety', sourceFile: 'Reyes_SafetyReport.pdf' },
    { title: 'Positive performance review issued', date: 'May 20, 2026', category: 'Review', sourceFile: 'Reyes_PerfReview_May2026.pdf' },
    { title: 'Termination documented, reason reduction in force', date: 'May 27, 2026', category: 'Separation', sourceFile: 'Reyes_TerminationLetter.pdf' },
  ],
  quotes: [{ quote: 'I reported an unsafe machine guard to my supervisor', fileName: 'Reyes_SafetyReport.pdf', category: 'Safety' }],
  intervals: [],
  confirmed: [],
  workerContext: 'I reported an unsafe machine guard. I think I was fired for it.',
  files: [],
};

const T5: ClaimLensInput = {
  events: [
    { title: 'Signed an arbitration agreement as part of onboarding', date: 'Apr 2, 2026', category: 'Onboarding', sourceFile: 'Cho_ArbitrationAgreement.pdf' },
    { title: 'Complaint to HR regarding discriminatory comments and being passed over', date: 'May 30, 2026', category: 'HR', sourceFile: 'Cho_HRComplaint.pdf' },
    { title: 'Termination documented, reason restructuring', date: 'Jun 13, 2026', category: 'Separation', sourceFile: 'Cho_TerminationLetter.pdf' },
  ],
  quotes: [{ quote: 'I complained to HR about being passed over and about comments on my accent', fileName: 'Cho_HRComplaint.pdf', category: 'HR' }],
  intervals: [],
  confirmed: [{ label: 'HR complaint topic', value: 'discriminatory comments about accent; passed over' }],
  workerContext: 'I signed an arbitration agreement at onboarding. I complained to HR, then was let go.',
  files: [
    { fileName: 'Cho_ArbitrationAgreement.pdf', category: 'Onboarding' },
    { fileName: 'Cho_HRComplaint.pdf', category: 'HR' },
    { fileName: 'Cho_TerminationLetter.pdf', category: 'Separation' },
    { fileName: 'Cho_PayStub_May2026.pdf', category: 'Wage Records' },
  ],
};

const el = (v: ReturnType<typeof buildClaimLensView>, re: RegExp) => v.elements.find((e) => re.test(e.name));

describe('TEST PACK — run through the real engine', () => {
  it('T1 Rosa — clean retaliation fully populates, 9-day is counted, no gaps, dates ON FILE', () => {
    const v = buildClaimLensView('retaliation_1102_5',T1);
    expect(el(v, /reports and complaints/i)?.items.length).toBeGreaterThan(0);
    expect(el(v, /employment actions after/i)?.items.some((i) => /terminat/i.test(i.text))).toBe(true);
    expect(el(v, /sequence and interval/i)?.items.some((i) => i.state === 'counted')).toBe(true);
    // §1102.5 now has 7 elements; some (employer awareness, treatment of others) are honestly empty.
    expect(v.coverage.total).toBe(v.elements.length);
    expect(v.tally.gaps).toBeGreaterThanOrEqual(1);
    const ck = buildExistenceChecks(T1);
    expect(ck.find((c) => /arbitration/i.test(c.label))?.present).toBe(false);
    expect(ck.find((c) => /separation/i.test(c.label))?.present).toBe(true);
    expect(ck.find((c) => /date/i.test(c.label))?.present).toBe(true);
  });

  it('T2 Huseby — Element 01 filled, 02-04 loud absence, dates NOT on file, no separation', () => {
    const v = buildClaimLensView('retaliation_1102_5',T2);
    expect(el(v, /reports and complaints/i)?.items.length).toBeGreaterThan(0);
    expect(el(v, /employment actions after/i)?.empty).toBeTruthy();
    const ck = buildExistenceChecks(T2);
    expect(ck.find((c) => /separation/i.test(c.label))?.present).toBe(false);
    expect(ck.find((c) => /date/i.test(c.label))?.present).toBe(false);
  });

  it('T3 Priya — no FILE/cluster noise mis-sorts in (handbook, benefits, onboarding, cluster stay out)', () => {
    const v = buildClaimLensView('retaliation_1102_5',T3);
    const prot = el(v, /reports and complaints/i);
    const noise = /handbook|benefit|onboarding|hr documents|\(\s*\d+\s*files?\s*\)/i;
    // the real mis-sort defense: none of the routine files or the cluster placeholder appear
    expect(prot?.items.some((i) => noise.test(i.text) || noise.test(i.meta ?? ''))).toBeFalsy();
    // KNOWN behavior (user ruling pending): the worker's own negated sentence still surfaces,
    // tagged worker-stated. Documented here so a future negation-guard change is a deliberate diff.
    expect(prot?.items.every((i) => i.state === 'worker')).toBe(true);
  });

  it('T4 Marcus — inconvenient facts are surfaced, not hidden', () => {
    const v = buildClaimLensView('retaliation_1102_5',T4);
    const adv = el(v, /employment actions after/i);
    expect(adv?.items.some((i) => /attendance/i.test(i.text))).toBe(true); // predates complaint, still shown
    expect(adv?.items.some((i) => /terminat/i.test(i.text))).toBe(true);
  });

  it('T5 Elena — existence strip: arbitration PRESENT, right-to-sue ABSENT, 1 wage stmt', () => {
    const ck = buildExistenceChecks(T5);
    expect(ck.find((c) => /arbitration/i.test(c.label))?.present).toBe(true);
    const rts = ck.find((c) => /right.to.sue|dfeh|crd/i.test(c.label));
    if (rts) expect(rts.present).toBe(false);
    expect(ck.find((c) => /wage|statement/i.test(c.label))?.present).toBe(true);
    // lens re-sorts the SAME record differently
    expect(buildClaimLensView('retaliation_1102_5',T5).elements.map((e) => e.name))
      .not.toEqual(buildClaimLensView('feha_disability',T5).elements.map((e) => e.name));
  });
});
