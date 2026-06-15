/**
 * Supabase Edge Function: create-portal-session
 * Creates a Stripe Billing Portal session so a firm can manage their subscription.
 *
 * POST body: { firmProfileId: string }
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
  let body: { firmProfileId: string };
  try { body = await req.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { firmProfileId } = body;
  if (!firmProfileId) return json({ error: 'firmProfileId required' }, 400);

  // ── Service-role client ───────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Verify firm belongs to this user ─────────────────────────────────────
  const { data: firmProfile, error: fpErr } = await supabase
    .from('firm_profiles')
    .select('id')
    .eq('id', firmProfileId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (fpErr || !firmProfile) return json({ error: 'Firm profile not found' }, 404);

  // ── Look up Stripe customer ID ────────────────────────────────────────────
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('external_customer_id')
    .eq('firm_profile_id', firmProfileId)
    .maybeSingle();

  const customerId = sub?.external_customer_id;
  if (!customerId) return json({ error: 'No billing account found. Please subscribe first.' }, 404);

  // ── Create Portal Session ─────────────────────────────────────────────────
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/?billing=portal_return`,
  });

  return json({ url: session.url });
});
