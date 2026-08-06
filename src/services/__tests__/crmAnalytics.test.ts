import { describe, it, expect } from 'vitest';
import {
  tierPrice, computeRevenue, targetColor, dailyTargetsContext, avgMinutesSaved,
  firstThreeBonus, commissionProjection, companyEconomics, ECON_DEFAULTS, type SubscriptionTier,
} from '../crmAnalytics';
import type { CrmFirm } from '../crmService';

function firm(stage: string, subscription_tier: SubscriptionTier | null = null): CrmFirm {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Test', attorney_name: null, phone: null, email: null, website: null,
    region: null, priority: null, stage: stage as CrmFirm['stage'], focus_areas: null,
    source: null, next_followup: null, notes: null, subscription_tier, est_minutes_saved: null, created_at: '',
    contacted_by: null, contacted_by_name: null, contacted_at: null,
  };
}

describe('avgMinutesSaved', () => {
  it('returns 0/0 when no firm has an estimate', () => {
    expect(avgMinutesSaved([{ est_minutes_saved: null }, {}])).toEqual({ avg: 0, n: 0 });
  });
  it('averages only the firms that gave an estimate (ignoring null)', () => {
    expect(avgMinutesSaved([{ est_minutes_saved: 30 }, { est_minutes_saved: 60 }, { est_minutes_saved: 0 }, { est_minutes_saved: null }]))
      .toEqual({ avg: 30, n: 3 });
  });
});

describe('tierPrice', () => {
  it('prices each tier; null/unknown = Starter', () => {
    // Flat 4-tier model (decided direction 2026-08-06): sticker monthly prices, no per-seat math.
    expect(tierPrice('starter')).toBe(350);
    expect(tierPrice('underwriting_low')).toBe(1500);
    expect(tierPrice('underwriting_mid')).toBe(2000);
    expect(tierPrice('underwriting_high')).toBe(2500);
    expect(tierPrice(null)).toBe(350);
    expect(tierPrice('mystery')).toBe(350);
  });
});

describe('computeRevenue', () => {
  it('sums MRR by tier, commission, and pipeline forecast', () => {
    const firms = [
      firm('paid', 'underwriting_low'),   // 1500/mo flat
      firm('paid', 'underwriting_high'),  // 2500/mo flat
      firm('paid', null),                 // null -> starter 350/mo flat
      firm('pilot'),
      firm('demo_booked'),
      firm('demo_done'),
      firm('target'),                     // not a candidate
    ];
    const r = computeRevenue(firms);
    expect(r.paidCount).toBe(3);
    expect(r.currentMrr).toBe(1500 + 2500 + 350); // 4350
    expect(r.commissionMonthly).toBe(Math.round(4350 * 0.2)); // 870
    expect(r.perTier.find((t) => t.tier === 'starter')).toEqual({ tier: 'starter', count: 1, mrr: 350 });
    expect(r.perTier.find((t) => t.tier === 'underwriting_low')).toEqual({ tier: 'underwriting_low', count: 1, mrr: 1500 });
    expect(r.perTier.find((t) => t.tier === 'underwriting_high')).toEqual({ tier: 'underwriting_high', count: 1, mrr: 2500 });
    expect(r.candidateCount).toBe(3); // pilot + demo_booked + demo_done
    expect(r.projectedMrr).toBe(Math.round(3 * 0.3 * 350)); // 315
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

describe('firstThreeBonus', () => {
  it('earns nothing at zero paid firms', () => {
    const b = firstThreeBonus(0);
    expect(b.earned).toBe(0);
    expect(b.nextAmount).toBe(100);
    expect(b.complete).toBe(false);
  });
  it('escalates 100 -> 250 -> 500 across the first three', () => {
    expect(firstThreeBonus(1).earned).toBe(100);
    expect(firstThreeBonus(2).earned).toBe(250);
    expect(firstThreeBonus(3).earned).toBe(500);
  });
  it('caps at three (a 4th firm adds no ladder bonus)', () => {
    const b = firstThreeBonus(4);
    expect(b.earned).toBe(500);
    expect(b.nextAmount).toBeNull();
    expect(b.complete).toBe(true);
  });
});

describe('commissionProjection', () => {
  it('3 starter firms held 12 months = recurring commission + the $500 ladder', () => {
    const r = commissionProjection({ firmCount: 3, tier: 'starter', months: 12 });
    expect(r.mrr).toBe(1050);              // 3 * 350 (flat Starter price)
    expect(r.monthlyCommission).toBe(210); // round(1050 * 0.2)
    expect(r.totalCommission).toBe(2520);  // 210 * 12
    expect(r.bonus).toBe(500);
    expect(r.total).toBe(3020);
  });
  it('zero firms earns zero', () => {
    expect(commissionProjection({ firmCount: 0, tier: 'underwriting_low', months: 6 }).total).toBe(0);
  });
  it('company economics: 3 starter firms, 12 months, default overhead', () => {
    const r = companyEconomics({ firmCount: 3, tier: 'starter', months: 12, ...ECON_DEFAULTS });
    expect(r.mrr).toBe(1050);
    expect(r.grossTotal).toBe(12600);     // 1050 * 12
    expect(r.commission).toBe(2520);      // 20%
    expect(r.ai).toBe(900);               // 3 * 25 * 12
    expect(r.fixed).toBe(900);            // 75 * 12
    expect(r.netTotal).toBeGreaterThan(4000);
    expect(r.marginPct).toBeGreaterThan(50);
  });
  it('scales to 500 firms (bonus still caps at the first 3)', () => {
    const r = commissionProjection({ firmCount: 500, tier: 'underwriting_low', months: 12 });
    expect(r.mrr).toBe(750000);              // 500 * 1500 (flat Underwriting Low price)
    expect(r.monthlyCommission).toBe(150000); // round(750000 * 0.2)
    expect(r.totalCommission).toBe(1800000);  // 150000 * 12
    expect(r.bonus).toBe(500);               // ladder caps at 3
    expect(r.total).toBe(1800500);
  });
});
