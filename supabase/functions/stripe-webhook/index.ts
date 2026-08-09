/**
 * Supabase Edge Function: stripe-webhook
 *
 * The durable source of truth for a firm's active tier. Stripe calls this on
 * subscription lifecycle events; we map the subscription's price ID → plan_id and
 * write subscriptions.plan_id + status. Without this, plan_id stays at its initial
 * 'beta_pilot' value forever (no other code advances it), which is why tier-based
 * feature gating (e.g. the section 8B wage-exposure estimate) cannot be trusted until
 * this exists.
 *
 * Deploy WITHOUT JWT verification — Stripe authenticates via the signature header:
 *   npx supabase functions deploy stripe-webhook --no-verify-jwt --project-ref <ref>
 *
 * Required env (Supabase function secrets):
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_STARTER_ANNUAL,
 *   STRIPE_PRICE_UNDERWRITING_LOW_MONTHLY, STRIPE_PRICE_UNDERWRITING_LOW_ANNUAL,
 *   STRIPE_PRICE_UNDERWRITING_MID_MONTHLY, STRIPE_PRICE_UNDERWRITING_MID_ANNUAL,
 *   STRIPE_PRICE_UNDERWRITING_HIGH_MONTHLY, STRIPE_PRICE_UNDERWRITING_HIGH_ANNUAL
 *   (4-tier flat model, decided 2026-08-06 — legacy solo/practice/firm/*_plus ids retired)
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type PlanId = 'beta_pilot' | 'starter' | 'underwriting_low' | 'underwriting_mid' | 'underwriting_high' | 'enterprise';

/** Build the price-ID → plan-ID map from env. Unset prices are simply absent (safe). Both the
 * monthly and annual price of a tier map to the same plan_id — billing interval doesn't change tier. */
function buildPriceToPlanMap(): Record<string, PlanId> {
  const pairs: Array<[string | undefined, PlanId]> = [
    [Deno.env.get('STRIPE_PRICE_STARTER_MONTHLY'), 'starter'],
    [Deno.env.get('STRIPE_PRICE_STARTER_ANNUAL'), 'starter'],
    [Deno.env.get('STRIPE_PRICE_UNDERWRITING_LOW_MONTHLY'), 'underwriting_low'],
    [Deno.env.get('STRIPE_PRICE_UNDERWRITING_LOW_ANNUAL'), 'underwriting_low'],
    [Deno.env.get('STRIPE_PRICE_UNDERWRITING_MID_MONTHLY'), 'underwriting_mid'],
    [Deno.env.get('STRIPE_PRICE_UNDERWRITING_MID_ANNUAL'), 'underwriting_mid'],
    [Deno.env.get('STRIPE_PRICE_UNDERWRITING_HIGH_MONTHLY'), 'underwriting_high'],
    [Deno.env.get('STRIPE_PRICE_UNDERWRITING_HIGH_ANNUAL'), 'underwriting_high'],
  ];
  const map: Record<string, PlanId> = {};
  for (const [priceId, plan] of pairs) {
    if (priceId && priceId.trim()) map[priceId.trim()] = plan;
  }
  return map;
}

/** Normalize a Stripe subscription status to the values the app reasons about. */
function normalizeStatus(stripeStatus: string): string {
  // Stripe: active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired, paused
  return stripeStatus || 'canceled';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 503 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  // Verify signature against the RAW body (constructEventAsync — Deno/SubtleCrypto).
  const signature = req.headers.get('stripe-signature') ?? '';
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'signature verification failed';
    return new Response(JSON.stringify({ error: `Webhook signature invalid: ${msg}` }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null;
    const firmProfileId = (subscription.metadata?.firm_profile_id as string | undefined) ?? null;

    // Resolve plan_id from the subscription's price. On delete, drop to beta_pilot so
    // tier-gated features (section 8B) are denied immediately.
    const priceToPlan = buildPriceToPlanMap();
    const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
    let planId: PlanId;
    if (event.type === 'customer.subscription.deleted') {
      planId = 'beta_pilot';
    } else {
      planId = (priceId && priceToPlan[priceId]) ? priceToPlan[priceId] : 'beta_pilot';
      if (priceId && !priceToPlan[priceId]) {
        console.warn('[stripe-webhook] unmapped price ID — defaulting plan to beta_pilot', { priceId });
      }
    }

    const status = event.type === 'customer.subscription.deleted'
      ? 'canceled'
      : normalizeStatus(subscription.status);

    // Resolve the firm. Prefer subscription metadata (set at checkout); fall back to the
    // Stripe customer id recorded in the subscriptions bookkeeping table.
    let fpId: string | null = firmProfileId;
    if (!fpId && customerId) {
      const { data } = await supabase
        .from('subscriptions')
        .select('firm_profile_id')
        .eq('external_customer_id', customerId)
        .maybeSingle();
      fpId = (data?.firm_profile_id as string | undefined) ?? null;
    }
    if (!fpId) {
      // error, not warn: this event is dropped with no retry (Stripe sees 200) and no other
      // code path ever revisits it — a real subscription state change (plan/status) silently
      // never reaches firm_profiles. Log everything needed to reconcile by hand from Supabase's
      // function logs, since nothing currently alerts on this automatically.
      console.error('[stripe-webhook] UNMAPPED FIRM — subscription event dropped, no automatic retry', {
        eventType: event.type,
        subscriptionId: subscription.id,
        customerId,
        priceId,
      });
      return new Response(JSON.stringify({ received: true, note: 'unmapped firm' }), { status: 200 });
    }

    // Authoritative tier lives on firm_profiles — this is what feature gating reads.
    const { error: fpErr } = await supabase
      .from('firm_profiles')
      .update({ plan_id: planId, subscription_status: status })
      .eq('id', fpId);
    if (fpErr) {
      console.error('[stripe-webhook] firm_profiles update failed', fpErr.message);
      return new Response(JSON.stringify({ error: fpErr.message }), { status: 500 });
    }

    // Keep the subscriptions bookkeeping row in sync (best-effort; known columns only).
    const { error: subErr } = await supabase
      .from('subscriptions')
      .update({ plan_id: planId, status })
      .eq('firm_profile_id', fpId);
    if (subErr) console.warn('[stripe-webhook] subscriptions sync failed (non-fatal)', subErr.message);

    console.info('[stripe-webhook] applied', { type: event.type, firmProfileId: fpId, planId, status });
  }

  // Always 200 for handled/ignored events so Stripe does not retry indefinitely.
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
