import { describe, it, expect } from 'vitest';
import { formatSourceFileChipLabel } from '../workerIntakePresentationUtils';

describe('formatSourceFileChipLabel', () => {
  it('humanizes Rosa filenames without cutting mid-name or dropping the date', () => {
    // Regression: the old hard slice produced "Rosa_WrittenWarning_2026-03." — lost the day + ext.
    expect(formatSourceFileChipLabel('Rosa_WrittenWarning_2026-03-13.pdf')).toBe('Rosa Written Warning 2026-03-13');
    expect(formatSourceFileChipLabel('Rosa_HR_Complaint_2026-03-04.pdf')).toBe('Rosa HR Complaint 2026-03-04');
    expect(formatSourceFileChipLabel('Rosa_Statement.pdf')).toBe('Rosa Statement');
  });

  it('never emits a trailing lone period (the broken-extension look)', () => {
    expect(formatSourceFileChipLabel('Rosa_WrittenWarning_2026-03-13.pdf')).not.toMatch(/[^…]\.$/);
  });

  it('keeps the date hyphens intact', () => {
    expect(formatSourceFileChipLabel('Rosa_TerminationLetter_2026-04-08.pdf')).toContain('2026-04-08');
  });

  it('ellipsizes only very long names, with a real … not a period', () => {
    const long = 'A_Very_Long_Supporting_Record_Filename_That_Exceeds_The_Cap_2026-01-01.pdf';
    const out = formatSourceFileChipLabel(long);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(40);
  });

  it('handles empty / whitespace safely', () => {
    expect(formatSourceFileChipLabel('')).toBe('');
    expect(formatSourceFileChipLabel('   ')).toBe('');
  });
});
