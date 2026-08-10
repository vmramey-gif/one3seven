/**
 * Supabase Edge Function: sms-verify-phone
 *
 * Step 2 of linking a worker's phone number for SMS document upload. The worker submits the
 * code they were texted; on match, `worker_sms_links.status` flips to 'verified' and the inbound
 * webhook (sms-inbound-webhook) will start accepting files sent from that number. This is the
 * only code path allowed to set status='verified' — RLS has no client update policy on this
 * table, so a worker cannot mark their own number verified without actually receiving the code.
 *
 * POST body: { phoneNumber: string, code: string }
 *
 * Deploy WITH JWT verification (default) — the caller must be the phone number's own worker.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function hashCode(code: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { phoneNumber?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  const phone = (body.phoneNumber ?? '').trim();
  const code = (body.code ?? '').trim();
  if (!phone || !code) {
    return new Response(JSON.stringify({ error: 'phoneNumber and code are required' }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: link, error: linkErr } = await supabase
    .from('worker_sms_links')
    .select('id, worker_id, status, verification_code_hash, verification_expires_at')
    .eq('phone_number', phone)
    .maybeSingle();
  if (linkErr || !link || link.worker_id !== user.id) {
    return new Response(JSON.stringify({ error: 'No pending code for this number.' }), { status: 404 });
  }
  if (link.status === 'verified') {
    return new Response(JSON.stringify({ verified: true, alreadyVerified: true }), { status: 200 });
  }
  if (!link.verification_expires_at || new Date(link.verification_expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: 'This code has expired. Request a new one.' }), { status: 410 });
  }

  const candidateHash = await hashCode(code);
  if (!link.verification_code_hash || !timingSafeEqual(candidateHash, link.verification_code_hash)) {
    return new Response(JSON.stringify({ error: 'That code is not right.' }), { status: 401 });
  }

  const { error: updateErr } = await supabase
    .from('worker_sms_links')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verification_code_hash: null,
      verification_expires_at: null,
    })
    .eq('id', link.id);
  if (updateErr) {
    console.error('[sms-verify-phone] update failed', updateErr.message);
    return new Response(JSON.stringify({ error: 'Could not confirm this number. Try again.' }), { status: 500 });
  }

  return new Response(JSON.stringify({ verified: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
