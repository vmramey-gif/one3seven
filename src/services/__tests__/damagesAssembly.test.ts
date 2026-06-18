import { describe, it, expect } from 'vitest';
import { assembleDamagesInput, parseMoney, parseQuantity } from '../damagesAssembly';
import { calculateDamages } from '../damagesCalculator';
import type { WageFactsDocument } from '../documentFactsService';

function doc(p: Partial<WageFactsDocument>): WageFactsDocument {
  return {
    docId: p.docId ?? 'd1',
    docName: p.docName ?? 'Paystub.pdf',
    category: p.category ?? 'Pay Records / Payroll',
    payRate: p.payRate ?? null,
    overtimeHours: p.overtimeHours ?? null,
    overtimeRate: p.overtimeRate ?? null,
    missedBreaks: p.missedBreaks ?? null,
    sources: p.sources ?? {},
  };
}

describe('parseMoney / parseQuantity', () => {
  it('parses common rate formats', () => {
    expect(parseMoney('$22.00/hr')).toBe(22);
    expect(parseMoney('$22.00 per hour')).toBe(22);
    expect(parseMoney('22')).toBe(22);
    expect(parseMoney('$1,250.50')).toBe(1250.5);
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney('no rate stated')).toBeNull();
    expect(parseMoney('$0.00')).toBeNull(); // non-positive => not a usable rate
  });
  it('parses quantities incl. zero', () => {
    expect(parseQuantity('10')).toBe(10);
    expect(parseQuantity('0')).toBe(0);
    expect(parseQuantity(null)).toBeNull();
  });
});

describe('assembleDamagesInput — the no-wrong-number guard', () => {
  it('returns null when no base rate is present in any record', () => {
    expect(assembleDamagesInput([doc({ missedBreaks: '4' })])).toBeNull();
    expect(assembleDamagesInput([])).toBeNull();
  });

  it('returns null when base rates conflict across records (ambiguous)', () => {
    const a = doc({ docId: 'a', payRate: '$20.00/hr' });
    const b = doc({ docId: 'b', payRate: '$25.00/hr' });
    expect(assembleDamagesInput([a, b])).toBeNull();
  });

  it('produces an input only on an unambiguous base rate, with citation from the snippet', () => {
    const assembled = assembleDamagesInput([
      doc({
        payRate: '$20.00/hr',
        overtimeHours: '10',
        missedBreaks: '4',
        sources: { pay_rate: 'Regular rate of pay: $20.00 per hour', overtime_hours: 'Overtime: 10.00 hrs', missed_breaks: 'Missed meal breaks: 4' },
      }),
    ]);
    expect(assembled).not.toBeNull();
    expect(assembled!.input.regularHourlyRate.value).toBe(20);
    expect(assembled!.input.regularHourlyRate.citation?.sourceText).toBe('Regular rate of pay: $20.00 per hour');
    expect(assembled!.input.overtimeHoursWorked.value).toBe(10);
    expect(assembled!.input.mealBreaksMissed.value).toBe(4);
  });

  it('treats consistent repeated rates as unambiguous and sums hours/breaks across periods', () => {
    const assembled = assembleDamagesInput([
      doc({ docId: 'p1', payRate: '$20.00', overtimeHours: '5', missedBreaks: '2' }),
      doc({ docId: 'p2', payRate: '$20.00', overtimeHours: '5', missedBreaks: '3' }),
    ]);
    expect(assembled).not.toBeNull();
    expect(assembled!.input.overtimeHoursWorked.value).toBe(10);
    expect(assembled!.input.mealBreaksMissed.value).toBe(5);
    expect(assembled!.input.payPeriodsPresent).toBe(2);
  });
});

describe('assembleDamagesInput + calculateDamages end-to-end', () => {
  it('flags OT premium when no matching OT rate is shown', () => {
    const assembled = assembleDamagesInput([
      doc({ payRate: '$20.00/hr', overtimeHours: '10', missedBreaks: '4' }),
    ])!;
    const report = calculateDamages(assembled.input);
    expect(report.baseHourlyRate?.value).toBe(20);
    expect(report.overtimePremiumPerHour?.value).toBe(10); // 0.5 × 20
    expect(report.overtimeTotalEstimate).toBe(100); // 10/hr × 10 hrs
    expect(report.mealBreakPremiumPerBreak?.value).toBe(20); // 1 hr × 20
    expect(report.mealBreakTotalEstimate).toBe(80); // 20 × 4
    expect(report.combinedEstimate).toBe(180);
  });

  it('does NOT flag OT when records show overtime paid at the correct 1.5x rate', () => {
    const assembled = assembleDamagesInput([
      doc({ payRate: '$20.00/hr', overtimeRate: '$30.00', overtimeHours: '10' }),
    ])!;
    const report = calculateDamages(assembled.input);
    expect(report.overtimeHoursUnderpaid?.value).toBe(0);
    expect(report.overtimeTotalEstimate).toBe(0);
  });
});
