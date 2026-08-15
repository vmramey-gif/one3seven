/**
 * Wage-calculation input coverage — organize-only counterpart to damagesCalculator.ts.
 *
 * States which record-derived inputs a wage-premium calculation under a given Labor Code
 * section would need, and whether each is present in the uploaded records — the same "record
 * coverage" pattern already used elsewhere (caEmployerRecordRequirements, gapDetection).
 *
 * It never receives the underlying numeric values (hourly rate, hours worked, break counts) and
 * performs no arithmetic, so it cannot produce a dollar figure by construction, not by choice.
 * This describes the record's readiness for a calculation an attorney runs themselves; it does
 * not run the calculation. See damagesCalculator.ts for the (separately, counsel-gated)
 * arithmetic that actually computes an estimate.
 */

export interface WageCalculationInputStatus {
  key: string;
  label: string;
  present: boolean;
}

export interface WageCalculationCoverageItem {
  key: string;
  label: string;
  statutoryRef: string;
  inputs: WageCalculationInputStatus[];
  presentCount: number;
  requiredCount: number;
  complete: boolean;
}

export interface WageCalculationCoverageInput {
  regularHourlyRatePresent: boolean;
  overtimeHoursPresent: boolean;
  mealBreaksMissedPresent: boolean;
}

export interface WageCalculationCoverageResult {
  items: WageCalculationCoverageItem[];
  completeCount: number;
  totalCount: number;
}

function buildItem(
  key: string,
  label: string,
  statutoryRef: string,
  inputs: WageCalculationInputStatus[],
): WageCalculationCoverageItem {
  const presentCount = inputs.filter((i) => i.present).length;
  return {
    key,
    label,
    statutoryRef,
    inputs,
    presentCount,
    requiredCount: inputs.length,
    complete: presentCount === inputs.length,
  };
}

export function assessWageCalculationCoverage(
  input: WageCalculationCoverageInput,
): WageCalculationCoverageResult {
  const baseRate: WageCalculationInputStatus = {
    key: 'regularHourlyRate',
    label: 'Base hourly rate',
    present: input.regularHourlyRatePresent,
  };

  const items: WageCalculationCoverageItem[] = [
    buildItem('overtimePremium', 'Overtime premium', 'Cal. Lab. Code §510(a)', [
      baseRate,
      { key: 'overtimeHours', label: 'Overtime hours worked', present: input.overtimeHoursPresent },
    ]),
    buildItem('mealRestPremium', 'Meal/rest premium', 'Cal. Lab. Code §226.7', [
      baseRate,
      { key: 'mealBreaksMissed', label: 'Missed meal/rest breaks', present: input.mealBreaksMissedPresent },
    ]),
  ];

  return {
    items,
    completeCount: items.filter((i) => i.complete).length,
    totalCount: items.length,
  };
}
