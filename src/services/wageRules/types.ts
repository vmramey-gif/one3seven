/**
 * A jurisdiction's wage-exposure rule layer. A jurisdiction only appears here if it has a
 * fully-built, independently-correct wage-exposure layer. Jurisdictions without a ruleset are
 * organize-only — Section 8B is genuinely unreachable for them (the calculation path is never
 * entered), not computed-then-blanked.
 */
export interface JurisdictionRuleset {
  /** Two-letter postal code. */
  code: string;
  label: string;
  /** Overtime statute applied for this jurisdiction. */
  overtimeStatute: string;
  /** Meal/rest premium statute, or null when the jurisdiction has no such premium in law. */
  mealRestStatute: string | null;
}
