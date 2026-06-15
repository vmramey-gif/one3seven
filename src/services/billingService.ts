/**
 * one3Seven billing service — Stripe via Supabase Edge Functions.
 *
 * Plans:
 *   solo       $199/mo   up to 15 intakes · 1 seat
 *   practice   $499/mo   up to 50 intakes · 3 seats
 *   firm       $899/mo   unlimited intakes · 10 seats
 *   enterprise custom
 *
 * Edge Functions:
 *   create-checkout-session  POST { firmProfileId, priceId } → { url }
 *   create-portal-session    POST { firmProfileId }          → { url }
 *
 * Stripe price IDs are pulled from env vars injected at build time.
 * Set VITE_STRIPE_PRICE_SOLO, VITE_STRIPE_PRICE_PRACTICE, VITE_STRIPE_PRICE_FIRM
 * in your .env.local and in Vercel/hosting environment variables.
 */

import { supabase } from '../lib/supabaseClient';

// ── Plan definitions ──────────────────────────────────────────────────────────

export type FirmPlanId = 'beta_pilot' | 'solo' | 'practice' | 'firm' | 'enterprise';

export interface FirmPlan {
  id: FirmPlanId;
  label: string;
  price: number | null;           // monthly USD, null = custom
  intakesPerMonth: number | null; // null = unlimited
  seats: number | null;           // null = unlimited
  highlight: boolean;
  priceId: string | null;         // Stripe price ID from env
}

export const FIRM_PLANS: FirmPlan[] = [
  {
    id: 'solo',
    label: 'Solo',
    price: 199,
    intakesPerMonth: 15,
    seats: 1,
    highlight: false,
    priceId: import.meta.env.VITE_STRIPE_PRICE_SOLO ?? null,
  },
  {
    id: 'practice',
    label: 'Practice',
    price: 499,
    intakesPerMonth: 50,
    seats: 3,
    highlight: true,
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRACTICE ?? null,
  },
  {
    id: 'firm',
    label: 'Firm',
    price: 899,
    intakesPerMonth: null,
    seats: 10,
    highlight: false,
    priceId: import.meta.env.VITE_STRIPE_PRICE_FIRM ?? null,
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
    id === 'solo'       ? 'Solo' :
    id === 'practice'   ? 'Practice' :
    id === 'firm'       ? 'Firm' :
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
