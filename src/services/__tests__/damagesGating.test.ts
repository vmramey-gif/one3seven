import { describe, it, expect } from 'vitest';
import { firmTierIncludesDamagesFeature } from '../billingService';
import { resolveWageExposure } from '../firmIntakeSummaryDownload';
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
 * tier tests below exercise the tier gate, not the jurisdiction gate.
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

describe('firmTierIncludesDamagesFeature', () => {
  it('includes Practice+, Firm+, Enterprise only', () => {
    expect(firmTierIncludesDamagesFeature('practice_plus')).toBe(true);
    expect(firmTierIncludesDamagesFeature('firm_plus')).toBe(true);
    expect(firmTierIncludesDamagesFeature('enterprise')).toBe(true);
  });
  it('excludes Solo, Practice, Firm, beta_pilot, null', () => {
    expect(firmTierIncludesDamagesFeature('solo')).toBe(false);
    expect(firmTierIncludesDamagesFeature('practice')).toBe(false);
    expect(firmTierIncludesDamagesFeature('firm')).toBe(false);
    expect(firmTierIncludesDamagesFeature('beta_pilot')).toBe(false);
    expect(firmTierIncludesDamagesFeature(null)).toBe(false);
    expect(firmTierIncludesDamagesFeature(undefined)).toBe(false);
  });
});

describe('resolveWageExposure tier gate', () => {
  it('Practice tier with valid wage facts + unambiguous base rate → null (gate blocks)', () => {
    expect(resolveWageExposure(makeView('practice'))).toBeNull();
  });
  it('Firm tier (non-plus) → null', () => {
    expect(resolveWageExposure(makeView('firm'))).toBeNull();
  });
  it('Practice+ tier with the same data → populated wageExposure', () => {
    const result = resolveWageExposure(makeView('practice_plus'));
    expect(result).not.toBeNull();
    expect(result?.report.baseHourlyRate?.value).toBe(22);
    expect(result?.disclaimer.length).toBeGreaterThan(0);
  });
  it('Firm+ tier → populated', () => {
    expect(resolveWageExposure(makeView('firm_plus'))).not.toBeNull();
  });
});

describe('resolveWageExposure jurisdiction gate', () => {
  it('California work state + Practice+ + valid facts → populated', () => {
    expect(resolveWageExposure(makeView('practice_plus', 'CA'))).not.toBeNull();
  });
  it('Texas work state → null even with Practice+ and valid facts (organize-only)', () => {
    expect(resolveWageExposure(makeView('practice_plus', 'TX'))).toBeNull();
  });
  it('unset work state → null (no jurisdiction-gated feature activates without it set)', () => {
    expect(resolveWageExposure(makeView('practice_plus', ''))).toBeNull();
  });
});
