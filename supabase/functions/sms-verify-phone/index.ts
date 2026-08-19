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

// Same cross-origin reasoning as sms-link-request — see that file's comment.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  let body: { phoneNumber?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const phone = (body.phoneNumber ?? '').trim();
  const code = (body.code ?? '').trim();
  if (!phone || !code) return json({ error: 'phoneNumber and code are required' }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: link, error: linkErr } = await supabase
    .from('worker_sms_links')
    .select('id, worker_id, status, verification_code_hash, verification_expires_at')
    .eq('phone_number', phone)
    .maybeSingle();
  if (linkErr || !link || link.worker_id !== user.id) return json({ error: 'No pending code for this number.' }, 404);
  if (link.status === 'verified') return json({ verified: true, alreadyVerified: true });
  if (!link.verification_expires_at || new Date(link.verification_expires_at).getTime() < Date.now()) {
    return json({ error: 'This code has expired. Request a new one.' }, 410);
  }

  const candidateHash = await hashCode(code);
  if (!link.verification_code_hash || !timingSafeEqual(candidateHash, link.verification_code_hash)) {
    return json({ error: 'That code is not right.' }, 401);
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
    return json({ error: 'Could not confirm this number. Try again.' }, 500);
  }

  // Carrier-required opt-in confirmation (2026-08-19: the A2P 10DLC campaign was rejected for
  // opt-in information -- no such message existed anywhere; the verification-code text doesn't
  // count, it has no Msg&Data-rates/STOP/HELP language). Best-effort: the link is already
  // verified above, which is what actually matters -- a failed confirmation text shouldn't roll
  // back a successful verification.
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    try {
      const twilioResp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phone,
            From: TWILIO_PHONE_NUMBER,
            Body:
              'one3seven: This number is now linked to text documents into your record. ' +
              'Msg frequency varies. Msg&Data rates may apply. Reply STOP to opt out, HELP for help.',
          }),
        },
      );
      if (!twilioResp.ok) {
        const detail = await twilioResp.text().catch(() => '');
        console.error('[sms-verify-phone] opt-in confirmation send failed', twilioResp.status, detail);
      }
    } catch (e) {
      console.error('[sms-verify-phone] opt-in confirmation send threw', e instanceof Error ? e.message : String(e));
    }
  }

  return json({ verified: true });
});
