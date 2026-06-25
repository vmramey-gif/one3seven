/**
 * Pure analytics for the founder CRM revenue + daily-targets features. No I/O — unit-tested.
 */
import type { CrmFirm } from './crmService';

export const TIER_PRICES = { solo: 199, practice: 499, firm: 899 } as const;
export type SubscriptionTier = 'solo' | 'practice' | 'firm';

export const PHASE1_PAYING_TARGET = 3;
export const PIPELINE_CONVERSION_RATE = 0.3;
export const COMMISSION_RATE = 0.2;
const FORECAST_TIER_PRICE = TIER_PRICES.practice; // forecast assumes Practice tier

/**
 * Average firm-estimated minutes saved per intake, across firms that gave an estimate.
 * This is the core value claim made measurable. Returns the rounded average and the sample
 * size n (so it's quotable honestly: "firms report ~X min saved, n=Y").
 */
export function avgMinutesSaved(firms: { est_minutes_saved?: number | null }[]): { avg: number; n: number } {
  const vals = firms
    .map((f) => f.est_minutes_saved)
    .filter((v): v is number => typeof v === 'number' && v >= 0);
  if (vals.length === 0) return { avg: 0, n: 0 };
  return { avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length), n: vals.length };
}

/** Monthly price for a tier; null/unknown defaults to Practice ($499). */
export function tierPrice(tier: string | null | undefined): number {
  if (tier === 'solo') return TIER_PRICES.solo;
  if (tier === 'firm') return TIER_PRICES.firm;
  return TIER_PRICES.practice;
}

export interface RevenueSummary {
  paidCount: number;
  currentMrr: number;
  commissionMonthly: number;
  perTier: { tier: SubscriptionTier; count: number; mrr: number }[];
  candidateCount: number;
  projectedMrr: number;
}

/** Current MRR from paid firms + a conservative pipeline forecast. */
export function computeRevenue(firms: CrmFirm[]): RevenueSummary {
  const paid = firms.filter((f) => f.stage === 'paid');
  const tiers: SubscriptionTier[] = ['solo', 'practice', 'firm'];
  const perTier = tiers.map((tier) => {
    const count = paid.filter((f) => (f.subscription_tier ?? 'practice') === tier).length;
    return { tier, count, mrr: count * TIER_PRICES[tier] };
  });
  const currentMrr = paid.reduce((sum, f) => sum + tierPrice(f.subscription_tier), 0);
  const candidates = firms.filter(
    (f) => f.stage === 'pilot' || f.stage === 'demo_done' || f.stage === 'demo_booked'
  );
  const projectedMrr = Math.round(candidates.length * PIPELINE_CONVERSION_RATE * FORECAST_TIER_PRICE);
  return {
    paidCount: paid.length,
    currentMrr,
    commissionMonthly: Math.round(currentMrr * COMMISSION_RATE),
    perTier,
    candidateCount: candidates.length,
    projectedMrr,
  };
}

export const DAILY_TARGETS = { calls: 10, emails: 10, demos: 3 } as const;
export type TargetColor = 'green' | 'amber' | 'gray';

/** green = at/over target, amber = at least halfway, gray = below halfway. */
export function targetColor(count: number, target: number): TargetColor {
  if (count >= target) return 'green';
  if (count >= Math.floor(target * 0.5)) return 'amber';
  return 'gray';
}

/** One coaching line derived from today's call/email counts and demos this week. */
export function dailyTargetsContext(calls: number, emails: number, demos: number): string {
  if (calls >= DAILY_TARGETS.calls && emails >= DAILY_TARGETS.emails && demos >= DAILY_TARGETS.demos)
    return 'On target today. Keep the calls moving.';
  if (demos >= 1 && calls < 5)
    return 'Demo booked — now protect the pipeline. More calls today.';
  if (calls === 0 && emails === 0 && demos === 0)
    return 'Nothing logged yet today. First call of the day is the hardest.';
  if (calls >= 5 && demos === 0)
    return 'Calls are moving. Push for the demo booking.';
  return 'Log every call and email — the data tells you where to push.';
}
