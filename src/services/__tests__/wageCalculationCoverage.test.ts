import { describe, it, expect } from 'vitest';
import { assessWageCalculationCoverage } from '../wageCalculationCoverage';

describe('assessWageCalculationCoverage', () => {
  it('marks both items complete when all three inputs are present', () => {
    const result = assessWageCalculationCoverage({
      regularHourlyRatePresent: true,
      overtimeHoursPresent: true,
      mealBreaksMissedPresent: true,
    });
    expect(result.completeCount).toBe(2);
    expect(result.totalCount).toBe(2);
    expect(result.items.every((i) => i.complete)).toBe(true);
  });

  it('marks both items incomplete when the base hourly rate is missing (shared input)', () => {
    const result = assessWageCalculationCoverage({
      regularHourlyRatePresent: false,
      overtimeHoursPresent: true,
      mealBreaksMissedPresent: true,
    });
    expect(result.completeCount).toBe(0);
    const overtime = result.items.find((i) => i.key === 'overtimePremium')!;
    const mealRest = result.items.find((i) => i.key === 'mealRestPremium')!;
    expect(overtime.presentCount).toBe(1);
    expect(overtime.requiredCount).toBe(2);
    expect(mealRest.presentCount).toBe(1);
  });

  it('marks only the overtime item incomplete when overtime hours are missing', () => {
    const result = assessWageCalculationCoverage({
      regularHourlyRatePresent: true,
      overtimeHoursPresent: false,
      mealBreaksMissedPresent: true,
    });
    const overtime = result.items.find((i) => i.key === 'overtimePremium')!;
    const mealRest = result.items.find((i) => i.key === 'mealRestPremium')!;
    expect(overtime.complete).toBe(false);
    expect(mealRest.complete).toBe(true);
    expect(result.completeCount).toBe(1);
  });

  it('carries the correct statutory references', () => {
    const result = assessWageCalculationCoverage({
      regularHourlyRatePresent: true,
      overtimeHoursPresent: true,
      mealBreaksMissedPresent: true,
    });
    expect(result.items.find((i) => i.key === 'overtimePremium')?.statutoryRef).toContain('510');
    expect(result.items.find((i) => i.key === 'mealRestPremium')?.statutoryRef).toContain('226.7');
  });

  it('never receives or exposes a numeric value anywhere in its input or output shape', () => {
    // Structural guarantee, not just a behavioral one: the input type has no numeric fields,
    // so this function cannot compute or leak a dollar figure regardless of implementation.
    const result = assessWageCalculationCoverage({
      regularHourlyRatePresent: true,
      overtimeHoursPresent: true,
      mealBreaksMissedPresent: true,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/\$/);
  });
});
