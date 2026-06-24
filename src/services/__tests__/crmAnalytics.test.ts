import { describe, it, expect } from 'vitest';
import {
  tierPrice, computeRevenue, targetColor, dailyTargetsContext, type SubscriptionTier,
} from '../crmAnalytics';
import type { CrmFirm } from '../crmService';

function firm(stage: string, subscription_tier: SubscriptionTier | null = null): CrmFirm {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Test', attorney_name: null, phone: null, email: null, website: null,
    region: null, priority: null, stage: stage as CrmFirm['stage'], focus_areas: null,
    source: null, next_followup: null, notes: null, subscription_tier, created_at: '',
  };
}

describe('tierPrice', () => {
  it('prices each tier; null/unknown = Practice', () => {
    expect(tierPrice('solo')).toBe(199);
    expect(tierPrice('practice')).toBe(499);
    expect(tierPrice('firm')).toBe(899);
    expect(tierPrice(null)).toBe(499);
    expect(tierPrice('mystery')).toBe(499);
  });
});

describe('computeRevenue', () => {
  it('sums MRR by tier, commission, and pipeline forecast', () => {
    const firms = [
      firm('paid', 'solo'),       // 199
      firm('paid', 'firm'),       // 899
      firm('paid', null),         // null -> practice 499
      firm('pilot'),
      firm('demo_booked'),
      firm('demo_done'),
      firm('target'),             // not a candidate
    ];
    const r = computeRevenue(firms);
    expect(r.paidCount).toBe(3);
    expect(r.currentMrr).toBe(199 + 899 + 499); // 1597
    expect(r.commissionMonthly).toBe(Math.round(1597 * 0.2)); // 319
    expect(r.perTier.find((t) => t.tier === 'solo')).toEqual({ tier: 'solo', count: 1, mrr: 199 });
    expect(r.perTier.find((t) => t.tier === 'practice')).toEqual({ tier: 'practice', count: 1, mrr: 499 });
    expect(r.perTier.find((t) => t.tier === 'firm')).toEqual({ tier: 'firm', count: 1, mrr: 899 });
    expect(r.candidateCount).toBe(3); // pilot + demo_booked + demo_done
    expect(r.projectedMrr).toBe(Math.round(3 * 0.3 * 499)); // 449
  });

  it('is zero with no paid firms (honest)', () => {
    const r = computeRevenue([firm('target'), firm('contacted')]);
    expect(r.currentMrr).toBe(0);
    expect(r.commissionMonthly).toBe(0);
    expect(r.projectedMrr).toBe(0);
  });
});

describe('targetColor', () => {
  it('green at/over target', () => { expect(targetColor(10, 10)).toBe('green'); expect(targetColor(12, 10)).toBe('green'); });
  it('amber at least halfway', () => { expect(targetColor(5, 10)).toBe('amber'); expect(targetColor(1, 3)).toBe('amber'); });
  it('gray below halfway', () => { expect(targetColor(4, 10)).toBe('gray'); expect(targetColor(0, 3)).toBe('gray'); });
});

describe('dailyTargetsContext (five branches)', () => {
  it('all at/over target', () => { expect(dailyTargetsContext(10, 10, 3)).toBe('On target today. Keep the calls moving.'); });
  it('demo booked but few calls', () => { expect(dailyTargetsContext(4, 0, 1)).toBe('Demo booked — now protect the pipeline. More calls today.'); });
  it('nothing logged', () => { expect(dailyTargetsContext(0, 0, 0)).toBe('Nothing logged yet today. First call of the day is the hardest.'); });
  it('calls moving, no demo', () => { expect(dailyTargetsContext(6, 0, 0)).toBe('Calls are moving. Push for the demo booking.'); });
  it('default', () => { expect(dailyTargetsContext(3, 3, 0)).toBe('Log every call and email — the data tells you where to push.'); });
});
