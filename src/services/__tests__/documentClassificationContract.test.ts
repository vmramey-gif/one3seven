import { describe, it, expect } from 'vitest';
import { attorneyCategoryLabel } from '../packetStoryPresentation';
import { classifyEventRole } from '../caseTimelinePatterns';
import { assessEmployerRecordCoverage } from '../caEmployerRecordRequirements';

/**
 * DOCUMENT-CLASSIFICATION CONTRACT — the lock.
 *
 * The logic that decides "what is this document / event" is spread across several engines. When those
 * copies drift out of sync, documents get mislabeled (this is the root of a whole family of bugs seen
 * in production: a written warning shown as "Performance Reviews", a paycheck under "HR Complaints",
 * a worker statement titled "Schedule change"). This table pins the AGREED-CORRECT classification for
 * a battery of real-world filenames and event titles. Any change that regresses a row fails CI.
 *
 * When you intentionally change a classification: update the expected value here IN THE SAME COMMIT,
 * so the contract always reflects a deliberate decision — never silent drift.
 */

// filename -> attorney-facing display category
const CATEGORY_CONTRACT: Array<[string, string]> = [
  // discipline
  ['Rosa_WrittenWarning_2026-03-13.pdf', 'Disciplinary Materials'],
  ['WrittenWarning.pdf', 'Disciplinary Materials'],
  ['write-up-2026.pdf', 'Disciplinary Materials'],
  ['CoachingMemo_2025.pdf', 'Disciplinary Materials'],
  ['ProjectRemoval.pdf', 'Disciplinary Materials'],
  // separation
  ['Rosa_TerminationLetter_2026-04-08.pdf', 'Separation Documents'],
  ['separation_agreement.pdf', 'Separation Documents'],
  ['severance.pdf', 'Separation Documents'],
  ['final_pay.pdf', 'Separation Documents'],
  ['FinalPaycheck.pdf', 'Separation Documents'],
  ['LayoffNotice.pdf', 'Separation Documents'],
  ['ResignationEmail.pdf', 'Separation Documents'],
  // payroll
  ['Rosa_PayStub_Feb2026.pdf', 'Payroll & Compensation Records'],
  ['WageStatement.pdf', 'Payroll & Compensation Records'],
  ['EarningsStatement.pdf', 'Payroll & Compensation Records'],
  // HR complaints
  ['Rosa_HR_Complaint_2026-03-04.pdf', 'HR Complaints & Responses'],
  ['ComplaintToSupervisor.pdf', 'HR Complaints & Responses'],
  // statements (worker's / coworker's own account — NOT an HR complaint)
  ['Rosa_Statement.pdf', 'Witness Statements'],
  ['WitnessStatement_John.pdf', 'Witness Statements'],
  ['CoworkerDeclaration.pdf', 'Witness Statements'],
];

// event title -> proximity role
const ROLE_CONTRACT: Array<[string, 'protected_activity' | 'adverse_action' | 'neutral']> = [
  // protected activity
  ['Complaint submitted to Human Resources', 'protected_activity'],
  ['Worker raises safety concerns', 'protected_activity'],
  ['Requested reasonable accommodation', 'protected_activity'],
  ['Reported unpaid overtime', 'protected_activity'],
  // adverse action
  ['Written warning issued', 'adverse_action'],
  ['Termination documented', 'adverse_action'],
  ['Hours reduced', 'adverse_action'],
  ['Removed from project', 'adverse_action'],
  ['Denied promotion', 'adverse_action'],
  ['Written up for attitude', 'adverse_action'],
  ['Placed on performance improvement plan', 'adverse_action'],
  // neutral — must NOT create false proximity
  ['Pay period or overtime record documented', 'neutral'],
  ['Employment begins', 'neutral'],
  ['Performance review completed', 'neutral'],
  ['Worker statement provided', 'neutral'],
  ['Promotion awarded', 'neutral'],
  ['Schedule change documented', 'neutral'],
];

describe('document-classification contract (lock against drift)', () => {
  it.each(CATEGORY_CONTRACT)('categorizes %s as %s', (fileName, expected) => {
    expect(attorneyCategoryLabel('', fileName)).toBe(expected);
  });

  it.each(ROLE_CONTRACT)('classifies "%s" role as %s', (title, expected) => {
    expect(classifyEventRole(title)).toBe(expected);
  });

  it('coverage: §2802 reimbursement is a tracked requirement and absent by default', () => {
    const r = assessEmployerRecordCoverage([{ fileName: 'PayStub.pdf', category: 'Wage Records' }]);
    const item = r.items.find((i) => i.key === 'expense_reimbursement');
    expect(item).toBeDefined();
    expect(item?.state).toBe('not_in_record');
    // and a real reimbursement record is detected as present
    const present = assessEmployerRecordCoverage([{ fileName: 'ExpenseReport.pdf', category: '' }]);
    expect(present.items.find((i) => i.key === 'expense_reimbursement')?.state).toBe('on_file');
  });
});
