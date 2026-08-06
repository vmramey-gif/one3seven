/**
 * one3seven billing service — Stripe via Supabase Edge Functions.
 *
 * Plans (FLAT — no per-seat pricing; core organize/source-link value is identical on every tier;
 * worker never pays). Decided direction 2026-08-06: replaces the old per-seat Practice/Firm/Surge
 * structure.
 *   starter             $350/mo flat   1–2 seats (not per-seat priced) · Tier-1 lens only · no 8B
 *   underwriting_low    $1,500/mo flat unlimited-ish · ≤~15 intakes/mo (soft fair-use) · 8B included
 *   underwriting_mid    $2,000/mo flat unlimited-ish · ~16–35 intakes/mo (soft fair-use) · 8B included
 *   underwriting_high   $2,500/mo flat unlimited-ish · ~36+ intakes/mo (soft fair-use) · 8B included
 *   enterprise          custom         multi-vertical / new packs / multi-state
 *
 * The Underwriting bands are distinguished by intake VOLUME, not seats — `intakesPerMonth` is a
 * soft fair-use signal for which band a firm should pick, not a hard metered gate (same
 * "generous fair-use, don't hard-block" policy the old model used).
 *
 * Edge Functions:
 *   create-checkout-session  POST { firmProfileId, priceId } → { url }
 *   create-portal-session    POST { firmProfileId }          → { url }
 *
 * Stripe price IDs are pulled from env vars injected at build time.
 * Set VITE_STRIPE_PRICE_STARTER_MONTHLY / _ANNUAL,
 *     VITE_STRIPE_PRICE_UNDERWRITING_LOW_MONTHLY / _ANNUAL,
 *     VITE_STRIPE_PRICE_UNDERWRITING_MID_MONTHLY / _ANNUAL,
 *     VITE_STRIPE_PRICE_UNDERWRITING_HIGH_MONTHLY / _ANNUAL
 * in your .env.local and in Vercel/hosting environment variables.
 */

import { supabase } from '../lib/supabaseClient';

// ── Plan definitions ──────────────────────────────────────────────────────────

export type FirmPlanId =
  | 'beta_pilot'
  | 'starter'
  | 'underwriting_low'
  | 'underwriting_mid'
  | 'underwriting_high'
  | 'enterprise';

/**
 * ⚠️ COUNSEL GATE — DO NOT FLIP WITHOUT COUNSEL SIGN-OFF. ⚠️
 *
 * Founder-locked doctrine (project_readiness_counsel_gate): readiness-band and wage-exposure
 * surfacing are demo-only (/fire-demo) until counsel signs off. While this flag is false, the
 * section 8B wage-exposure surface FAILS CLOSED for EVERY tier — including the Underwriting bands
 * and Enterprise, whose plans list it as an entitlement. The tier entitlement itself is preserved separately in
 * `firmTierDamagesEntitlement` (and in FIRM_PLANS.includesDamages for pricing display), so
 * flipping this single constant to `true` on counsel sign-off restores the feature to exactly
 * the entitled tiers and nothing else. The /fire-demo and case-facts demo surfaces compute their
 * illustrative arithmetic directly (calculateDamages on hardcoded demo inputs) and do not pass
 * through this gate — they keep working while it is closed.
 */
export const DAMAGES_SURFACING_COUNSEL_APPROVED: boolean = false;

/**
 * Tier ENTITLEMENT only — which tiers' plans include the wage-exposure estimate (section 8B)
 * + live source citations once counsel approves surfacing. All three Underwriting bands and
 * Enterprise — NOT Starter.
 *
 * The legacy tier ids (firm / surge / firm_plus / practice_plus — pre the 2026-08-06 flat-pricing
 * rename) are still accepted so any firm_profiles row or Stripe metadata written before the rename
 * keeps its entitlement; new sales use the current tier ids only.
 *
 * This function answers "which tiers pay for the feature" — it deliberately does NOT decide
 * whether the feature may surface. Use `firmTierIncludesDamagesFeature` for that.
 */
export function firmTierDamagesEntitlement(planId: string | null | undefined): boolean {
  return (
    planId === 'underwriting_low' ||
    planId === 'underwriting_mid' ||
    planId === 'underwriting_high' ||
    planId === 'enterprise' ||
    // legacy tier ids (pre 2026-08-06 rename) — kept so existing subscribers don't lose the feature
    planId === 'firm' ||
    planId === 'surge' ||
    planId === 'firm_plus' ||
    planId === 'practice_plus'
  );
}

/**
 * Single source of truth for whether the wage-exposure estimate (section 8B) may surface for a
 * firm: tier entitlement AND counsel sign-off. Checked at the data-assembly layer
 * (resolveWageExposure) so the feature never reaches production surfaces while the counsel gate
 * is closed — today this returns FALSE for every tier (fails closed) until
 * `DAMAGES_SURFACING_COUNSEL_APPROVED` flips on counsel sign-off.
 */
export function firmTierIncludesDamagesFeature(planId: string | null | undefined): boolean {
  return DAMAGES_SURFACING_COUNSEL_APPROVED && firmTierDamagesEntitlement(planId);
}

export interface FirmPlan {
  id: FirmPlanId;
  label: string;
  monthlyPrice: number | null;    // flat monthly USD. null = custom (Enterprise)
  annualPrice: number | null;     // flat annual USD (2 months free = 10x monthly). null = custom
  intakesPerMonth: number | null; // soft fair-use band signal (NOT a hard metered gate). null = unlimited-ish
  includesDamages: boolean;       // Section 8B wage-exposure layer (see firmTierIncludesDamagesFeature)
  highlight: boolean;
  monthlyPriceId: string | null;  // Stripe monthly price ID from env
  annualPriceId: string | null;   // Stripe annual price ID from env
}

export const FIRM_PLANS: FirmPlan[] = [
  {
    id: 'starter',
    label: 'Starter',
    monthlyPrice: 350,
    annualPrice: 3500,
    intakesPerMonth: null,
    includesDamages: false,
    highlight: false,
    monthlyPriceId: import.meta.env.VITE_STRIPE_PRICE_STARTER_MONTHLY ?? null,
    annualPriceId: import.meta.env.VITE_STRIPE_PRICE_STARTER_ANNUAL ?? null,
  },
  {
    id: 'underwriting_low',
    label: 'Underwriting — Low',
    monthlyPrice: 1500,
    annualPrice: 15000,
    intakesPerMonth: 15,
    includesDamages: true,
    highlight: false,
    monthlyPriceId: import.meta.env.VITE_STRIPE_PRICE_UNDERWRITING_LOW_MONTHLY ?? null,
    annualPriceId: import.meta.env.VITE_STRIPE_PRICE_UNDERWRITING_LOW_ANNUAL ?? null,
  },
  {
    id: 'underwriting_mid',
    label: 'Underwriting — Mid',
    monthlyPrice: 2000,
    annualPrice: 20000,
    intakesPerMonth: 35,
    includesDamages: true,
    highlight: true,
    monthlyPriceId: import.meta.env.VITE_STRIPE_PRICE_UNDERWRITING_MID_MONTHLY ?? null,
    annualPriceId: import.meta.env.VITE_STRIPE_PRICE_UNDERWRITING_MID_ANNUAL ?? null,
  },
  {
    id: 'underwriting_high',
    label: 'Underwriting — High',
    monthlyPrice: 2500,
    annualPrice: 25000,
    intakesPerMonth: null,
    includesDamages: true,
    highlight: false,
    monthlyPriceId: import.meta.env.VITE_STRIPE_PRICE_UNDERWRITING_HIGH_MONTHLY ?? null,
    annualPriceId: import.meta.env.VITE_STRIPE_PRICE_UNDERWRITING_HIGH_ANNUAL ?? null,
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
    id === 'beta_pilot'         ? 'Beta Pilot' :
    id === 'starter'            ? 'Starter' :
    id === 'underwriting_low'   ? 'Underwriting — Low' :
    id === 'underwriting_mid'   ? 'Underwriting — Mid' :
    id === 'underwriting_high'  ? 'Underwriting — High' :
    id === 'enterprise'         ? 'Enterprise' : id;

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
