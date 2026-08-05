/**
 * one3seven billing service — Stripe via Supabase Edge Functions.
 *
 * Plans (PER-SEAT; core organize/source-link value is identical on every tier; worker never pays):
 *   practice   $400/seat/mo   1–2 seats · ~15 intakes/seat (fair-use) · no 8B wage-exposure
 *   firm       $375/seat/mo   min 3 seats · ~20 intakes/seat (fair-use) · includes 8B · priority
 *   surge      $3,500/mo flat unlimited seats + intakes · 8B · priority · branded packets (a cost CEILING)
 *   enterprise custom         multi-vertical / new packs / multi-state
 *
 * Priced on avoided cost, not a competitor benchmark: a firm underwrites each case by hand at an
 * industry-reported $3,500–$13,000, so these tiers capture well under 15% of the cost removed. Firm
 * is cheaper per-seat than Practice by design (volume discount + it unlocks 8B); Surge is a ceiling
 * that caps a large firm's cost (per-seat crosses $3,500 at ~9 attorneys). See project_pricing memory.
 *
 * Edge Functions:
 *   create-checkout-session  POST { firmProfileId, priceId } → { url }
 *   create-portal-session    POST { firmProfileId }          → { url }
 *
 * Stripe price IDs are pulled from env vars injected at build time.
 * Set VITE_STRIPE_PRICE_PRACTICE, VITE_STRIPE_PRICE_FIRM, VITE_STRIPE_PRICE_SURGE
 * in your .env.local and in Vercel/hosting environment variables.
 */

import { supabase } from '../lib/supabaseClient';

// ── Plan definitions ──────────────────────────────────────────────────────────

export type FirmPlanId = 'beta_pilot' | 'practice' | 'firm' | 'surge' | 'enterprise';

/**
 * Single source of truth for which tiers include the wage-exposure estimate (section 8B)
 * + live source citations. Firm and above (Firm $375/seat, Surge $3,500 flat, Enterprise) — NOT
 * Practice ($400/seat). Checked at the data-assembly layer (resolveWageExposure) so the feature
 * never reaches an ineligible firm — not a client-side-only restriction.
 *
 * The legacy names (practice_plus / firm_plus) are still accepted so any firm_profiles row
 * or Stripe metadata written before the tier rename keeps its entitlement; new sales use
 * the current tier ids only.
 */
export function firmTierIncludesDamagesFeature(planId: string | null | undefined): boolean {
  return (
    planId === 'firm' ||
    planId === 'surge' ||
    planId === 'enterprise' ||
    // legacy tier ids (pre-rename) — kept so existing subscribers don't lose the feature
    planId === 'firm_plus' ||
    planId === 'practice_plus'
  );
}

export interface FirmPlan {
  id: FirmPlanId;
  label: string;
  price: number | null;           // headline monthly USD — PER SEAT when perSeat, else flat. null = custom
  perSeat: boolean;               // true = price is per attorney-seat
  minSeats: number;               // minimum billable seats (0 = flat plan)
  intakesPerMonth: number | null; // soft cap (per seat when perSeat); fair-use at launch. null = unlimited
  includesDamages: boolean;       // Section 8B wage-exposure layer (see firmTierIncludesDamagesFeature)
  highlight: boolean;
  annualOnly?: boolean;           // billed yearly only (Surge)
  priceId: string | null;         // Stripe price ID from env
}

export const FIRM_PLANS: FirmPlan[] = [
  {
    id: 'practice',
    label: 'Practice',
    price: 400,
    perSeat: true,
    minSeats: 1,
    intakesPerMonth: 15,
    includesDamages: false,
    highlight: false,
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRACTICE ?? null,
  },
  {
    id: 'firm',
    label: 'Firm',
    price: 375,
    perSeat: true,
    minSeats: 3,
    intakesPerMonth: 20,
    includesDamages: true,
    highlight: true,
    priceId: import.meta.env.VITE_STRIPE_PRICE_FIRM ?? null,
  },
  {
    id: 'surge',
    label: 'Surge',
    price: 3500,
    perSeat: false,
    minSeats: 0,
    intakesPerMonth: null,
    includesDamages: true,
    highlight: false,
    annualOnly: true,
    priceId: import.meta.env.VITE_STRIPE_PRICE_SURGE ?? null,
  },
];

export interface FirmSubscriptionSnapshot {
  planId: FirmPlanId;
  subscriptionStatus: string;
  isActive: boolean;
  isTrial: boolean;
  isPaid: boolean;
  label: string;
}

export function getFirmSubscriptionStatus(
  planId: string,
  subscriptionStatus: string,
): FirmSubscriptionSnapshot {
  const id = (planId as FirmPlanId) || 'beta_pilot';
  const status = subscriptionStatus || 'trialing';
  const isActive = status === 'active';
  const isTrial = status === 'trialing';
  const isPaid = isActive && id !== 'beta_pilot';

  const planLabel =
    id === 'beta_pilot' ? 'Beta Pilot' :
    id === 'practice'   ? 'Practice' :
    id === 'firm'       ? 'Firm' :
    id === 'surge'      ? 'Surge' :
    id === 'enterprise' ? 'Enterprise' : id;

  return { planId: id, subscriptionStatus: status, isActive, isTrial, isPaid, label: planLabel };
}

// ── Checkout session ──────────────────────────────────────────────────────────

export async function createCheckoutSession(params: {
  firmProfileId: string;
  priceId: string;
}): Promise<{ url: string | null; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { firmProfileId: params.firmProfileId, priceId: params.priceId },
    });
    if (error) return { url: null, error: error.message };
    if (!data?.url) return { url: null, error: 'No checkout URL returned.' };
    return { url: data.url as string };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ── Customer portal session ───────────────────────────────────────────────────

export async function createCustomerPortalSession(params: {
  firmProfileId: string;
}): Promise<{ url: string | null; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: { firmProfileId: params.firmProfileId },
    });
    if (error) return { url: null, error: error.message };
    if (!data?.url) return { url: null, error: 'No portal URL returned.' };
    return { url: data.url as string };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
