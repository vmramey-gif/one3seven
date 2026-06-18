/**
 * Wage-exposure estimate — firm/attorney-facing arithmetic ONLY.
 *
 * This is the one deliberate carve-out from one3seven's "organize and reflect, never
 * conclude" philosophy (see project memory, 2026-06-18 founder sign-off). It computes
 * arithmetic from explicitly-stated record values; it does NOT assess liability, claim
 * strength, recoverable amounts, or merit. Output renders only in the firm intake PDF
 * (section 8B) and the attorney review UI — never to a worker.
 *
 * Statutory formulas (arithmetic only, not a legal determination):
 *   - Cal. Lab. Code §510(a): overtime premium = 0.5× the regular rate per overtime hour
 *     (the additional half beyond straight time, not the full 1.5×).
 *   - Cal. Lab. Code §226.7: meal/rest premium = 1 hour at the regular rate per missed break.
 *
 * Hard rule: if the base hourly rate cannot be determined from records, we do NOT estimate.
 */

export interface SourceCitation {
  docId: string;
  docName: string;
  page: number;
  charStart: number;
  charEnd: number;
  sourceText: string;
}

export interface DamagesLineItem {
  label: string;
  formula: string;
  value: number;
  citation: SourceCitation | null;
  /** true = derived from a Labor Code formula (no source document); false = value taken from a record. */
  isStatutory: boolean;
  statutoryRef?: string;
}

export interface DamagesReport {
  /** null when the base rate is not determinable from records (we do not estimate). */
  baseHourlyRate: DamagesLineItem | null;
  overtimeRate: DamagesLineItem | null;
  overtimeHoursUnderpaid: DamagesLineItem | null;
  overtimePremiumPerHour: DamagesLineItem | null;
  overtimeTotalEstimate: number;
  mealBreaksMissed: DamagesLineItem | null;
  mealBreakPremiumPerBreak: DamagesLineItem | null;
  mealBreakTotalEstimate: number;
  combinedEstimate: number;
  isPartialData: boolean;
  missingRecordsWarning: string | null;
  calculatedAt: string;
}

/** A value extracted from records, with its source citation (null when not stated/located). */
export interface ProvenancedNumber {
  value: number | null;
  citation: SourceCitation | null;
}

export interface DamagesCalculatorInput {
  /** Regular hourly rate stated in records. value=null when not determinable. */
  regularHourlyRate: ProvenancedNumber;
  /**
   * Overtime rate the records show was actually applied/paid, if stated.
   * value=null when records do not state an applied OT rate (treated as "no matching premium").
   */
  overtimeRateApplied: ProvenancedNumber;
  /** Total overtime hours worked per records. */
  overtimeHoursWorked: ProvenancedNumber;
  /** Count of meal breaks recorded as missed or short per records. */
  mealBreaksMissed: ProvenancedNumber;
  /** Pay periods actually present in the uploaded records. */
  payPeriodsPresent: number;
  /** Pay periods expected across the covered span (for partial-data detection). 0 = unknown. */
  expectedPayPeriods: number;
}

const OT_STATUTE = 'Cal. Lab. Code §510(a)';
const MEAL_STATUTE = 'Cal. Lab. Code §226.7';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** True when records show an OT premium at least equal to the §510 correct rate (1.5× regular). */
function overtimePaidCorrectly(regularRate: number, appliedRate: number | null): boolean {
  if (appliedRate === null) return false;
  const correct = round2(regularRate * 1.5);
  // small epsilon to absorb rounding in stated rates
  return appliedRate + 0.005 >= correct;
}

export function calculateDamages(input: DamagesCalculatorInput): DamagesReport {
  const calculatedAt = new Date().toISOString();
  const regular = input.regularHourlyRate.value;

  // Partial-data detection is independent of rate determinability.
  const partialPayPeriods =
    input.expectedPayPeriods > 0 && input.payPeriodsPresent < input.expectedPayPeriods;

  // ---- Hard rule: no base rate => do not estimate. ----
  if (regular === null || !(regular > 0)) {
    return {
      baseHourlyRate: null,
      overtimeRate: null,
      overtimeHoursUnderpaid: null,
      overtimePremiumPerHour: null,
      overtimeTotalEstimate: 0,
      mealBreaksMissed: null,
      mealBreakPremiumPerBreak: null,
      mealBreakTotalEstimate: 0,
      combinedEstimate: 0,
      isPartialData: true,
      missingRecordsWarning:
        'Base hourly rate could not be determined from the records provided. No wage-exposure figures were calculated. Additional pay records may allow a calculation.',
      calculatedAt,
    };
  }

  const baseHourlyRate: DamagesLineItem = {
    label: 'Base hourly rate',
    formula: 'Regular rate stated in pay records',
    value: round2(regular),
    citation: input.regularHourlyRate.citation,
    isStatutory: false,
  };

  const correctOtRate = round2(regular * 1.5);
  const overtimeRate: DamagesLineItem = {
    label: 'Overtime rate (1.5×)',
    formula: 'Base hourly rate × 1.5',
    value: correctOtRate,
    citation: null,
    isStatutory: true,
    statutoryRef: OT_STATUTE,
  };

  const otPremiumPerHourValue = round2(regular * 0.5);
  const overtimePremiumPerHour: DamagesLineItem = {
    label: 'Overtime premium per hour',
    formula: 'Base hourly rate × 0.5 (the additional half beyond straight time)',
    value: otPremiumPerHourValue,
    citation: null,
    isStatutory: true,
    statutoryRef: OT_STATUTE,
  };

  // OT hours without a matching premium. If records show OT was paid at the correct
  // rate, none are flagged as underpaid.
  const otHours = input.overtimeHoursWorked.value ?? 0;
  const paidCorrectly = overtimePaidCorrectly(regular, input.overtimeRateApplied.value);
  const otHoursUnderpaidValue = paidCorrectly ? 0 : round2(otHours);
  const overtimeHoursUnderpaid: DamagesLineItem = {
    label: 'Overtime hours without matching premium',
    formula: paidCorrectly
      ? 'Records show overtime paid at 1.5× — none flagged'
      : 'Overtime hours where records show no matching overtime premium',
    value: otHoursUnderpaidValue,
    citation: input.overtimeHoursWorked.citation,
    isStatutory: false,
  };

  const overtimeTotalEstimate = round2(otPremiumPerHourValue * otHoursUnderpaidValue);

  // Meal/rest premium: 1 hour at the regular rate per missed break (§226.7).
  const mealBreaksMissedValue = round2(input.mealBreaksMissed.value ?? 0);
  const mealBreaksMissed: DamagesLineItem = {
    label: 'Meal breaks recorded as missed or short',
    formula: 'Count from meal/rest period records',
    value: mealBreaksMissedValue,
    citation: input.mealBreaksMissed.citation,
    isStatutory: false,
  };

  const mealPremiumPerBreakValue = round2(regular); // 1 hour × regular rate
  const mealBreakPremiumPerBreak: DamagesLineItem = {
    label: 'Meal break premium per occurrence',
    formula: '1 hour × base hourly rate',
    value: mealPremiumPerBreakValue,
    citation: null,
    isStatutory: true,
    statutoryRef: MEAL_STATUTE,
  };

  const mealBreakTotalEstimate = round2(mealPremiumPerBreakValue * mealBreaksMissedValue);

  const combinedEstimate = round2(overtimeTotalEstimate + mealBreakTotalEstimate);

  // isPartialData: fewer than expected pay periods, or required inputs absent.
  const otInputMissing = input.overtimeHoursWorked.value === null;
  const mealInputMissing = input.mealBreaksMissed.value === null;
  const isPartialData = partialPayPeriods || otInputMissing || mealInputMissing;

  let missingRecordsWarning: string | null = null;
  if (isPartialData) {
    const parts: string[] = [];
    if (partialPayPeriods) {
      parts.push(
        `Records cover ${input.payPeriodsPresent} of ${input.expectedPayPeriods} expected pay periods`
      );
    }
    if (otInputMissing) parts.push('overtime hours were not stated in the records');
    if (mealInputMissing) parts.push('missed-break counts were not stated in the records');
    missingRecordsWarning = `${parts.join('; ')}. Figures are calculated only from the records provided and may be incomplete.`;
  }

  return {
    baseHourlyRate,
    overtimeRate,
    overtimeHoursUnderpaid,
    overtimePremiumPerHour,
    overtimeTotalEstimate,
    mealBreaksMissed,
    mealBreakPremiumPerBreak,
    mealBreakTotalEstimate,
    combinedEstimate,
    isPartialData,
    missingRecordsWarning,
    calculatedAt,
  };
}
