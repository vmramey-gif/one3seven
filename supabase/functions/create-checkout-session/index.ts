/**
 * Supabase Edge Function: create-checkout-session
 * Creates a Stripe Checkout Session for a firm upgrading to a paid plan.
 *
 * POST body: { firmProfileId: string, priceId: string }
 * Auth: Bearer JWT (must be the firm's own user)
 * Returns: { url: string }
 */

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ── Env ──────────────────────────────────────────────────────────────────
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://one3seven.com';

  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe not configured' }, 503);

  // ── Auth: verify JWT ──────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
  const { data: { user }, error: userErr } = await anonClient.auth.getUser(jwt);
  if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { firmProfileId: string; priceId: string };
  try { body = await req.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { firmProfileId, priceId } = body;
  if (!firmProfileId || !priceId) return json({ error: 'firmProfileId and priceId required' }, 400);

  // ── Allowlist the price ──────────────────────────────────────────────────
  // priceId is client-supplied; only accept our own configured plan prices (same env vars
  // the webhook maps price -> plan with). If none are configured yet, skip (setup phase).
  const allowedPriceIds = new Set(
    ['STRIPE_PRICE_SOLO', 'STRIPE_PRICE_PRACTICE', 'STRIPE_PRICE_FIRM', 'STRIPE_PRICE_PRACTICE_PLUS', 'STRIPE_PRICE_FIRM_PLUS']
      .map((k) => Deno.env.get(k)?.trim())
      .filter((v): v is string => Boolean(v)),
  );
  if (allowedPriceIds.size > 0 && !allowedPriceIds.has(priceId)) {
    return json({ error: 'Unknown price' }, 400);
  }

  // ── Service-role client ───────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Verify firm belongs to this user ─────────────────────────────────────
  const { data: firmProfile, error: fpErr } = await supabase
    .from('firm_profiles')
    .select('id, firm_name, contact_email')
    .eq('id', firmProfileId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (fpErr || !firmProfile) return json({ error: 'Firm profile not found' }, 404);

  // ── Get or create Stripe customer ─────────────────────────────────────────
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('external_customer_id')
    .eq('firm_profile_id', firmProfileId)
    .maybeSingle();

  let customerId = sub?.external_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: firmProfile.contact_email ?? user.email ?? undefined,
      name: firmProfile.firm_name,
      metadata: { firm_profile_id: firmProfileId, user_id: user.id },
    });
    customerId = customer.id;

    // Upsert subscription row with customer ID
    await supabase.from('subscriptions').upsert({
      firm_profile_id: firmProfileId,
      status: 'trialing',
      plan_id: 'beta_pilot',
      provider: 'stripe',
      external_customer_id: customerId,
    }, { onConflict: 'firm_profile_id' });
  }

  // ── Create Checkout Session ───────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${APP_URL}/?billing=success`,
    cancel_url: `${APP_URL}/?billing=canceled`,
    subscription_data: {
      trial_period_days: 30,
      metadata: { firm_profile_id: firmProfileId },
    },
    metadata: { firm_profile_id: firmProfileId },
    allow_promotion_codes: true,
  });

  return json({ url: session.url });
});
