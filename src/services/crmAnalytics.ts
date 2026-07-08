/**
 * Pure analytics for the founder CRM revenue + daily-targets features. No I/O — unit-tested.
 */
import type { CrmFirm } from './crmService';

/** Sticker price per tier. Practice/Firm are billed monthly; Surge is billed
 *  annually ($1,490/yr). Use this for DISPLAY; use tierPrice() for MRR math. */
export const TIER_PRICES = { practice: 249, firm: 549, surge: 1490 } as const;
export type SubscriptionTier = 'practice' | 'firm' | 'surge';

/** Billing cadence per tier. MRR math divides annual tiers by 12. */
export const TIER_BILLING: Record<SubscriptionTier, 'monthly' | 'annual'> = {
  practice: 'monthly',
  firm: 'monthly',
  surge: 'annual',
};

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

/** Monthly-recurring-revenue contribution for a tier (annual tiers ÷ 12, rounded).
 *  null/unknown defaults to Practice ($249/mo). For the sticker price use TIER_PRICES. */
export function tierPrice(tier: string | null | undefined): number {
  const t: SubscriptionTier = tier === 'firm' || tier === 'surge' ? tier : 'practice';
  const sticker = TIER_PRICES[t];
  return TIER_BILLING[t] === 'annual' ? Math.round(sticker / 12) : sticker;
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
  const tiers: SubscriptionTier[] = ['practice', 'firm', 'surge'];
  const perTier = tiers.map((tier) => {
    const count = paid.filter((f) => (f.subscription_tier ?? 'practice') === tier).length;
    return { tier, count, mrr: count * tierPrice(tier) };
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

// ── Compensation: First-3 bonus + commission calculator ──────────────────────

/** Escalating one-time bonus for the first three firms that convert pilot -> paid. */
export const BONUS_LADDER = [100, 150, 250] as const;
/** Extra one-time bonus if all three land inside the sprint window (date-gated, founder-set). */
export const SPRINT_BONUS = 250;

export interface BonusProgress {
  paidCount: number;
  earned: number;            // total bonus earned so far from the ladder
  steps: { n: number; amount: number; hit: boolean }[];
  nextAmount: number | null; // bonus for the next firm, or null once 3 are paid
  complete: boolean;         // all three paid
}

/** Bonus earned from the first-3 ladder given how many firms are at the 'paid' stage. */
export function firstThreeBonus(paidCount: number): BonusProgress {
  const n = Math.max(0, Math.floor(paidCount));
  const steps = BONUS_LADDER.map((amount, i) => ({ n: i + 1, amount, hit: n >= i + 1 }));
  const earned = steps.filter((s) => s.hit).reduce((sum, s) => sum + s.amount, 0);
  const nextAmount = n < BONUS_LADDER.length ? BONUS_LADDER[n] : null;
  return { paidCount: n, earned, steps, nextAmount, complete: n >= BONUS_LADDER.length };
}

export interface CommissionScenario {
  firmCount: number;
  tier: SubscriptionTier;
  months: number;
}
export interface CommissionResult {
  mrr: number;               // monthly recurring revenue from these firms
  monthlyCommission: number; // 20% of MRR
  totalCommission: number;   // monthlyCommission * months
  bonus: number;             // first-3 ladder bonus for these firms
  total: number;             // totalCommission + bonus
}

/** Pure "what could I earn" calculator for the rep sandbox. Bonus counts the first 3 firms. */
export function commissionProjection({ firmCount, tier, months }: CommissionScenario): CommissionResult {
  const firms = Math.max(0, Math.floor(firmCount));
  const m = Math.max(0, Math.floor(months));
  const mrr = firms * tierPrice(tier);
  const monthlyCommission = Math.round(mrr * COMMISSION_RATE);
  const totalCommission = monthlyCommission * m;
  const bonus = firstThreeBonus(firms).earned;
  return { mrr, monthlyCommission, totalCommission, bonus, total: totalCommission + bonus };
}

// ── Company economics: net to one3seven after overhead ───────────────────────

/** Default overhead assumptions — all editable in the UI. */
export const ECON_DEFAULTS = {
  commissionPct: 20,   // rep commission, % of revenue
  stripePct: 2.9,      // Stripe % fee
  stripeFlat: 0.3,     // Stripe per-charge flat fee
  aiCostPerFirm: 25,   // est. Anthropic extraction cost per firm / month
  fixedInfraMonthly: 75, // Supabase + Vercel + domains/email, company-wide
} as const;

export interface EconomicsInput {
  firmCount: number;
  tier: SubscriptionTier;
  months: number;
  commissionPct: number;
  stripePct: number;
  stripeFlat: number;
  aiCostPerFirm: number;
  fixedInfraMonthly: number;
}
export interface EconomicsResult {
  mrr: number;          // monthly recurring revenue
  grossTotal: number;   // revenue over the period
  commission: number;
  stripe: number;
  ai: number;
  fixed: number;
  totalCost: number;
  netTotal: number;     // company net over the period
  netMonthly: number;   // company net per month
  marginPct: number;    // netTotal / grossTotal * 100
}

/** Company net revenue after overhead. Pure; all assumptions are inputs. */
export function companyEconomics(i: EconomicsInput): EconomicsResult {
  const firms = Math.max(0, Math.floor(i.firmCount));
  const m = Math.max(0, Math.floor(i.months));
  const mrr = firms * tierPrice(i.tier);
  const grossTotal = mrr * m;
  const charges = firms * m; // one subscription charge per firm per month
  const commission = grossTotal * (i.commissionPct / 100);
  const stripe = grossTotal * (i.stripePct / 100) + charges * i.stripeFlat;
  const ai = firms * i.aiCostPerFirm * m;
  const fixed = i.fixedInfraMonthly * m;
  const totalCost = commission + stripe + ai + fixed;
  const netTotal = grossTotal - totalCost;
  return {
    mrr,
    grossTotal: Math.round(grossTotal),
    commission: Math.round(commission),
    stripe: Math.round(stripe),
    ai: Math.round(ai),
    fixed: Math.round(fixed),
    totalCost: Math.round(totalCost),
    netTotal: Math.round(netTotal),
    netMonthly: m > 0 ? Math.round(netTotal / m) : 0,
    marginPct: grossTotal > 0 ? Math.round((netTotal / grossTotal) * 100) : 0,
  };
}
