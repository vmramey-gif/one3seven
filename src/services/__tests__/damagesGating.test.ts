import { describe, it, expect } from 'vitest';
import {
  DAMAGES_SURFACING_COUNSEL_APPROVED,
  firmTierDamagesEntitlement,
  firmTierIncludesDamagesFeature,
} from '../billingService';
import { resolveWageExposure } from '../firmIntakeSummaryDownload';
import { assembleDamagesInput } from '../damagesAssembly';
import { calculateDamages } from '../damagesCalculator';
import type { FirmLiveIntakeView } from '../intakeDataService';
import type { WageFactsDocument } from '../documentFactsService';

const wageDoc: WageFactsDocument = {
  docId: 'd1',
  docName: 'Paystub.pdf',
  category: 'Pay Records / Payroll',
  payRate: '$22.00/hr',
  overtimeHours: '10',
  overtimeRate: null,
  missedBreaks: '3',
  sources: { pay_rate: 'Regular rate of pay: $22.00 per hour' },
};

/**
 * Minimal full-access firm view carrying valid wage facts, a given tier, and a work state.
 * Work state defaults to California (the only jurisdiction with a wage-exposure layer) so the
 * tier tests below exercise the tier/counsel gates, not the jurisdiction gate.
 */
function makeView(planId: string, workState: string = 'CA'): FirmLiveIntakeView {
  return {
    previewOnly: false,
    isFirmCodeIntake: true, // → full access (not limited_preview)
    firmPlanId: planId,
    workerFollowUp: { workState },
    intelligence: { wageFacts: [wageDoc] },
  } as unknown as FirmLiveIntakeView;
}

// ────────────────────────────────────────────────────────────────────────────
// COUNSEL GATE — fails closed until DAMAGES_SURFACING_COUNSEL_APPROVED flips.
// Founder-locked doctrine: readiness/exposure surfacing is demo-only until counsel sign-off.
// These tests codify the fails-CLOSED contract; flip the flag ONLY on counsel sign-off and
// update this block deliberately when that happens.
// ────────────────────────────────────────────────────────────────────────────
describe('damages surfacing counsel gate (fails closed)', () => {
  it('the counsel flag is OFF until counsel signs off', () => {
    expect(DAMAGES_SURFACING_COUNSEL_APPROVED).toBe(false);
  });

  it('firmTierIncludesDamagesFeature is false for EVERY tier while the flag is off', () => {
    for (const tier of ['firm', 'surge', 'enterprise', 'firm_plus', 'practice_plus', 'practice', 'solo', 'beta_pilot', '', null, undefined]) {
      expect(firmTierIncludesDamagesFeature(tier as never)).toBe(false);
    }
  });

  it('resolveWageExposure → null for entitled tiers with valid facts + CA (8B unreachable in prod)', () => {
    expect(resolveWageExposure(makeView('firm'))).toBeNull();
    expect(resolveWageExposure(makeView('surge'))).toBeNull();
    expect(resolveWageExposure(makeView('enterprise'))).toBeNull();
  });

  it('the demo arithmetic path (calculateDamages on direct inputs) is NOT gated — demos keep working', () => {
    // /fire-demo and the case-facts demo compute illustrative figures directly, never through
    // resolveWageExposure. The counsel gate closes the production surface, not the arithmetic.
    const assembled = assembleDamagesInput([wageDoc]);
    expect(assembled).not.toBeNull();
    const report = calculateDamages(assembled!.input);
    expect(report.baseHourlyRate?.value).toBe(22);
    expect(report.combinedEstimate).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tier ENTITLEMENT — which tiers include 8B once counsel approves surfacing.
// Kept separately tested so the entitlement logic stays correct while the gate is closed,
// and flipping the counsel flag restores the feature to exactly these tiers.
// ────────────────────────────────────────────────────────────────────────────
describe('firmTierDamagesEntitlement (tier entitlement, independent of the counsel gate)', () => {
  it('includes Firm, Surge, Enterprise (Firm and above)', () => {
    expect(firmTierDamagesEntitlement('firm')).toBe(true);
    expect(firmTierDamagesEntitlement('surge')).toBe(true);
    expect(firmTierDamagesEntitlement('enterprise')).toBe(true);
  });
  it('still honors legacy tier ids so pre-rename subscribers keep the entitlement', () => {
    expect(firmTierDamagesEntitlement('firm_plus')).toBe(true);
    expect(firmTierDamagesEntitlement('practice_plus')).toBe(true);
  });
  it('excludes Practice, Solo, beta_pilot, null', () => {
    expect(firmTierDamagesEntitlement('practice')).toBe(false);
    expect(firmTierDamagesEntitlement('solo')).toBe(false);
    expect(firmTierDamagesEntitlement('beta_pilot')).toBe(false);
    expect(firmTierDamagesEntitlement(null)).toBe(false);
    expect(firmTierDamagesEntitlement(undefined)).toBe(false);
  });
});

describe('resolveWageExposure — the other gates still hold independently', () => {
  it('non-entitled tiers with valid wage facts → null regardless of the counsel flag', () => {
    expect(resolveWageExposure(makeView('practice'))).toBeNull();
    expect(resolveWageExposure(makeView('beta_pilot'))).toBeNull();
  });
  it('Texas / unset work state → null (jurisdiction gate; organize-only)', () => {
    expect(resolveWageExposure(makeView('firm', 'TX'))).toBeNull();
    expect(resolveWageExposure(makeView('firm', ''))).toBeNull();
  });
});
