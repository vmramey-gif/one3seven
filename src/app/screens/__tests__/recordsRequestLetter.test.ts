import { describe, it, expect } from 'vitest';
import { buildLetter } from '../RecordsRequestScreen';

const base = {
  workerName: 'Marcus Rivera',
  employerName: 'Pacific Ridge',
  employerAddress: 'hr@pacificridge.example',
  employmentStatus: 'former' as const,
  startDate: 'March 2022',
  endDate: 'January 2026',
  contactBack: 'marcus@example.com',
};

const noRecords = { payroll: false, personnel: false, signed: false, timekeeping: false, reimbursement: false };

describe('buildLetter — §2802 expense-reimbursement records', () => {
  it('includes the §2802 reimbursement item when selected', () => {
    const letter = buildLetter({ ...base, records: { ...noRecords, reimbursement: true } });
    expect(letter).toMatch(/§ 2802/);
    expect(letter).toMatch(/phone, internet, vehicle, equipment/i);
  });

  it('omits the reimbursement item when not selected', () => {
    const letter = buildLetter({ ...base, records: { ...noRecords, payroll: true } });
    expect(letter).not.toMatch(/2802/);
  });

  it('still self-help only — addresses the worker to the employer, no legal conclusion', () => {
    const letter = buildLetter({ ...base, records: { ...noRecords, reimbursement: true } });
    expect(letter).toMatch(/Marcus Rivera/);
    expect(letter).not.toMatch(/you are owed|you have a case|entitled to damages|violated/i);
  });
});
