import { describe, it, expect } from 'vitest';
import { extractPayRecordFacts, type PayRecordExtractionInput } from '../documentFactExtractionService';

// Messy-cases gauntlet finding: findGrossAmount (the readiness-digest gross-pay miner) took the
// FIRST line containing "gross" with a dollar figure, with no preference for the actual per-period
// "Gross Pay" line over a "YTD Gross" recap line. On a common ADP-style stub layout where the YTD
// recap line appears before (or instead of) the period figure, this stated the accumulating YTD
// total as if it were the period's gross pay. All fixture text below is synthetic.

function baseRow(extracted_text: string): PayRecordExtractionInput {
  return {
    uploaded_file_id: 'test-file-1',
    file_name: 'Test Pay Stub.pdf',
    category: 'Pay Records / Payroll',
    extracted_text,
  };
}

describe('extractPayRecordFacts — gross-pay YTD-line skip', () => {
  it('prefers the period "Gross Pay" line over an earlier "YTD Gross" recap line', () => {
    const text = [
      'EARNINGS STATEMENT',
      'Employer: Acme Test Co',
      'Employee: Jane Worker',
      'Pay Period: 06/01/2026 - 06/15/2026',
      'Pay Date: 06/20/2026',
      'YTD Gross: 9600.00',
      'Gross Pay: 1600.00',
      'Net Pay: 1200.00',
    ].join('\n');

    const facts = extractPayRecordFacts(baseRow(text));
    expect(facts).not.toBeNull();
    // The period figure ($1,600.00), not the accumulating YTD total ($9,600.00).
    expect(facts!.grossPay).toBe('$1600.00');
  });

  it('is case-insensitive and matches "year to date" phrasing too', () => {
    const text = [
      'EARNINGS STATEMENT',
      'Employer: Acme Test Co',
      'Employee: Jane Worker',
      'Pay Period: 06/01/2026 - 06/15/2026',
      'Pay Date: 06/20/2026',
      'year to date gross: 9600.00',
      'Gross Pay: 1600.00',
      'Net Pay: 1200.00',
    ].join('\n');

    const facts = extractPayRecordFacts(baseRow(text));
    expect(facts).not.toBeNull();
    expect(facts!.grossPay).toBe('$1600.00');
  });

  it('falls back to the YTD line when no other gross-bearing line exists at all', () => {
    const text = [
      'EARNINGS STATEMENT',
      'Employer: Acme Test Co',
      'Employee: Jane Worker',
      'Pay Period: 06/01/2026 - 06/15/2026',
      'Pay Date: 06/20/2026',
      'YTD Gross: 9800.00',
      'Net Pay: 1200.00',
    ].join('\n');

    const facts = extractPayRecordFacts(baseRow(text));
    expect(facts).not.toBeNull();
    expect(facts!.grossPay).toBe('$9800.00');
  });

  it('still finds the correct gross figure when it is the only/first "gross" line (regression guard)', () => {
    const text = [
      'EARNINGS STATEMENT',
      'Employer: Acme Test Co',
      'Employee: Jane Worker',
      'Pay Period: 06/01/2026 - 06/15/2026',
      'Pay Date: 06/20/2026',
      'Gross Pay: 2000.00',
      'Net Pay: 1500.00',
    ].join('\n');

    const facts = extractPayRecordFacts(baseRow(text));
    expect(facts).not.toBeNull();
    expect(facts!.grossPay).toBe('$2000.00');
  });
});
