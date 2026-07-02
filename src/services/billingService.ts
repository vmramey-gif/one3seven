/**
 * one3seven billing service — Stripe via Supabase Edge Functions.
 *
 * Plans (volume-based; core organize/source-link value is identical on every tier):
 *   practice   $249/mo    up to 20 intakes · 2 seats · standard processing
 *   firm       $549/mo    up to 60 intakes · 5 seats · priority processing
 *   surge      $1,490/mo  unlimited intakes · unlimited seats · dedicated onboarding (annual only)
 *   enterprise custom
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
 * + live source citations. Practice+, Firm+, and Enterprise only. Checked at the
 * data-assembly layer (resolveWageExposure) so the feature never reaches an ineligible
 * firm — not a client-side-only restriction. Compares plan-id strings directly so it does
 * not depend on the FirmPlanId union (the new paid tiers are not yet wired into pricing).
 */
export function firmTierIncludesDamagesFeature(planId: string | null | undefined): boolean {
  return planId === 'practice_plus' || planId === 'firm_plus' || planId === 'enterprise';
}

export interface FirmPlan {
  id: FirmPlanId;
  label: string;
  price: number | null;           // monthly USD, null = custom
  intakesPerMonth: number | null; // null = unlimited
  seats: number | null;           // null = unlimited
  highlight: boolean;
  annualOnly?: boolean;           // billed yearly only (Surge)
  priceId: string | null;         // Stripe price ID from env
}

export const FIRM_PLANS: FirmPlan[] = [
  {
    id: 'practice',
    label: 'Practice',
    price: 249,
    intakesPerMonth: 20,
    seats: 2,
    highlight: false,
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRACTICE ?? null,
  },
  {
    id: 'firm',
    label: 'Firm',
    price: 549,
    intakesPerMonth: 60,
    seats: 5,
    highlight: true,
    priceId: import.meta.env.VITE_STRIPE_PRICE_FIRM ?? null,
  },
  {
    id: 'surge',
    label: 'Surge',
    price: 1490,
    intakesPerMonth: null,
    seats: null,
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
