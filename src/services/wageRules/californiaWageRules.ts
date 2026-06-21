import type { JurisdictionRuleset } from './types';

/**
 * California wage-exposure rules. The only jurisdiction with a wage layer today.
 * - Overtime premium under Cal. Lab. Code §510 (the 0.5x additional half per OT hour).
 * - Meal/rest premium under Cal. Lab. Code §226.7 (1 hour at the regular rate per missed break).
 *
 * (Texas is intentionally NOT represented here — it is organize-only. No texasWageRules module
 * exists, so getWageRules returns null for Texas and Section 8B never runs for a Texas intake.)
 */
export const californiaWageRules: JurisdictionRuleset = {
  code: 'CA',
  label: 'California',
  overtimeStatute: 'Cal. Lab. Code §510(a)',
  mealRestStatute: 'Cal. Lab. Code §226.7',
};
