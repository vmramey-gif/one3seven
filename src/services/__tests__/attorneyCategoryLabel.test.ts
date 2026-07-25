import { describe, it, expect } from 'vitest';
import { attorneyCategoryLabel, ATTORNEY_BUCKET_CATEGORY_LABELS } from '../packetStoryPresentation';

describe('attorneyCategoryLabel — Rosa Delgado real filenames', () => {
  it('labels a CamelCase written warning as Disciplinary Materials, not Performance Reviews', () => {
    // Regression: "Rosa_WrittenWarning_2026-03-13.pdf" normalizes to "rosa written warning …".
    // Before the filename-normalization fix it fell through to the "Performance Reviews" rule,
    // softening the single most decision-relevant adverse action.
    expect(attorneyCategoryLabel('', 'Rosa_WrittenWarning_2026-03-13.pdf')).toBe('Disciplinary Materials');
    // Also holds for the pure-CamelCase and hyphen variants.
    expect(attorneyCategoryLabel('', 'WrittenWarning.pdf')).toBe('Disciplinary Materials');
    expect(attorneyCategoryLabel('', 'write-up-2026.pdf')).toBe('Disciplinary Materials');
  });

  it('routes the rest of Rosa\'s file to the right categories', () => {
    expect(attorneyCategoryLabel('', 'Rosa_TerminationLetter_2026-04-08.pdf')).toBe('Separation Documents');
    expect(attorneyCategoryLabel('', 'Rosa_HR_Complaint_2026-03-04.pdf')).toBe('HR Complaints & Responses');
    expect(attorneyCategoryLabel('', 'Rosa_PayStub_Feb2026.pdf')).toBe('Payroll & Compensation Records');
  });
});

describe('generic supporting-records bucket', () => {
  it('does NOT invent a reimbursement signal for miscellaneous records', () => {
    // Regression: the catch-all bucket used to map to "Reimbursement-Related Records", inventing a
    // §2802 signal no document supported. Reimbursement must come only from real reimbursement records.
    expect(ATTORNEY_BUCKET_CATEGORY_LABELS['Additional Supporting Records']).not.toMatch(/reimburs/i);
  });
});
