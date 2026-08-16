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

describe('buildLetter — zero record types selected', () => {
  it('never silently substitutes a different request than what was selected', () => {
    const letter = buildLetter({ ...base, records: { ...noRecords } });
    expect(letter).toMatch(/no record types were selected/i);
    expect(letter).not.toMatch(/payroll records, personnel file, signed documents, and timekeeping/i);
  });

  it('does not reference a deadline "as noted above" when nothing was selected', () => {
    const letter = buildLetter({ ...base, records: { ...noRecords } });
    expect(letter).not.toMatch(/as noted above/i);
  });
});

describe('buildLetter — dangling deadline reference', () => {
  it('omits "as noted above" when only non-dated record types are selected', () => {
    const letter = buildLetter({ ...base, records: { ...noRecords, signed: true } });
    expect(letter).not.toMatch(/as noted above/i);
    expect(letter).toMatch(/at your earliest convenience/i);
  });

  it('keeps "as noted above" when a dated record type (payroll or personnel) is selected', () => {
    const letter = buildLetter({ ...base, records: { ...noRecords, payroll: true } });
    expect(letter).toMatch(/as noted above/i);
  });
});

describe('buildLetter — current employee with no end date', () => {
  it('substitutes "present" instead of a literal [end date] bracket', () => {
    const letter = buildLetter({
      ...base,
      employmentStatus: 'current',
      startDate: 'March 2022',
      endDate: '',
      records: { ...noRecords, payroll: true },
    });
    expect(letter).toMatch(/to present\./);
    expect(letter).not.toMatch(/\[end date\]/);
  });

  it('still shows the bracket placeholder for a former employee with no end date', () => {
    const letter = buildLetter({
      ...base,
      employmentStatus: 'former',
      startDate: 'March 2022',
      endDate: '',
      records: { ...noRecords, payroll: true },
    });
    expect(letter).toMatch(/\[end date\]/);
  });
});

describe('buildLetter — double period when employer name ends with a period', () => {
  it('does not produce two periods after the employer name', () => {
    const letter = buildLetter({ ...base, employerName: 'Acme Logistics Inc.', records: { ...noRecords, payroll: true } });
    expect(letter).not.toMatch(/Inc\.\./);
    expect(letter).toMatch(/Acme Logistics Inc\.[^.]/);
  });
});
