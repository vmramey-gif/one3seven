import { describe, it, expect } from 'vitest';
import {
  DAMAGES_SURFACING_COUNSEL_APPROVED,
  firmTierDamagesEntitlement,
  firmTierIncludesDamagesFeature,
  FIRM_PLANS,
} from '../billingService';
import { resolveWageExposure } from '../firmIntakeSummaryDownload';
import { assembleDamagesInput } from '../damagesAssembly';
import { calculateDamages } from '../damagesCalculator';
import type { FirmLiveIntakeView } from '../firmRoutingService';
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
    for (const tier of [
      'underwriting_low', 'underwriting_mid', 'underwriting_high', 'enterprise',
      // legacy tier ids (pre 2026-08-06 flat-pricing rename)
      'firm', 'surge', 'firm_plus', 'practice_plus',
      'starter', 'solo', 'beta_pilot', '', null, undefined,
    ]) {
      expect(firmTierIncludesDamagesFeature(tier as never)).toBe(false);
    }
  });

  it('resolveWageExposure → null for entitled tiers with valid facts + CA (8B unreachable in prod)', () => {
    expect(resolveWageExposure(makeView('underwriting_low'))).toBeNull();
    expect(resolveWageExposure(makeView('underwriting_mid'))).toBeNull();
    expect(resolveWageExposure(makeView('underwriting_high'))).toBeNull();
    expect(resolveWageExposure(makeView('enterprise'))).toBeNull();
    // legacy tier ids still resolve to null (fails closed) too
    expect(resolveWageExposure(makeView('firm'))).toBeNull();
    expect(resolveWageExposure(makeView('surge'))).toBeNull();
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
  it('includes all 3 Underwriting bands + Enterprise', () => {
    expect(firmTierDamagesEntitlement('underwriting_low')).toBe(true);
    expect(firmTierDamagesEntitlement('underwriting_mid')).toBe(true);
    expect(firmTierDamagesEntitlement('underwriting_high')).toBe(true);
    expect(firmTierDamagesEntitlement('enterprise')).toBe(true);
  });
  it('still honors legacy tier ids so pre-2026-08-06-rename subscribers keep the entitlement', () => {
    expect(firmTierDamagesEntitlement('firm')).toBe(true);
    expect(firmTierDamagesEntitlement('surge')).toBe(true);
    expect(firmTierDamagesEntitlement('firm_plus')).toBe(true);
    expect(firmTierDamagesEntitlement('practice_plus')).toBe(true);
  });
  it('excludes Starter, Solo, beta_pilot, null', () => {
    expect(firmTierDamagesEntitlement('starter')).toBe(false);
    expect(firmTierDamagesEntitlement('solo')).toBe(false);
    expect(firmTierDamagesEntitlement('beta_pilot')).toBe(false);
    expect(firmTierDamagesEntitlement(null)).toBe(false);
    expect(firmTierDamagesEntitlement(undefined)).toBe(false);
  });
});

describe('resolveWageExposure — the other gates still hold independently', () => {
  it('non-entitled tiers with valid wage facts → null regardless of the counsel flag', () => {
    expect(resolveWageExposure(makeView('starter'))).toBeNull();
    expect(resolveWageExposure(makeView('beta_pilot'))).toBeNull();
  });
  it('Texas / unset work state → null (jurisdiction gate; organize-only)', () => {
    expect(resolveWageExposure(makeView('underwriting_low', 'TX'))).toBeNull();
    expect(resolveWageExposure(makeView('underwriting_low', ''))).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FIRM_PLANS — the flat 4-tier model decided 2026-08-06. Locks the exact numbers from the
// founder's pricing table so a future edit can't silently drift the sticker prices.
// ────────────────────────────────────────────────────────────────────────────
describe('FIRM_PLANS (flat 4-tier model)', () => {
  it('has exactly the 4 tiers, in order', () => {
    expect(FIRM_PLANS.map((p) => p.id)).toEqual([
      'starter', 'underwriting_low', 'underwriting_mid', 'underwriting_high',
    ]);
  });

  it('no plan is per-seat — the old perSeat/minSeats fields are gone', () => {
    for (const plan of FIRM_PLANS) {
      expect(plan).not.toHaveProperty('perSeat');
      expect(plan).not.toHaveProperty('minSeats');
    }
  });

  it('Starter: $350/mo, $3,500/yr, no 8B', () => {
    const p = FIRM_PLANS.find((x) => x.id === 'starter')!;
    expect(p.monthlyPrice).toBe(350);
    expect(p.annualPrice).toBe(3500);
    expect(p.includesDamages).toBe(false);
  });

  it('Underwriting Low: $1,500/mo, $15,000/yr, 8B included', () => {
    const p = FIRM_PLANS.find((x) => x.id === 'underwriting_low')!;
    expect(p.monthlyPrice).toBe(1500);
    expect(p.annualPrice).toBe(15000);
    expect(p.includesDamages).toBe(true);
  });

  it('Underwriting Mid: $2,000/mo, $20,000/yr, 8B included', () => {
    const p = FIRM_PLANS.find((x) => x.id === 'underwriting_mid')!;
    expect(p.monthlyPrice).toBe(2000);
    expect(p.annualPrice).toBe(20000);
    expect(p.includesDamages).toBe(true);
  });

  it('Underwriting High: $2,500/mo, $25,000/yr, 8B included', () => {
    const p = FIRM_PLANS.find((x) => x.id === 'underwriting_high')!;
    expect(p.monthlyPrice).toBe(2500);
    expect(p.annualPrice).toBe(25000);
    expect(p.includesDamages).toBe(true);
  });

  it('annual price is always 10x monthly (2 months free)', () => {
    for (const plan of FIRM_PLANS) {
      expect(plan.annualPrice).toBe((plan.monthlyPrice as number) * 10);
    }
  });
});
