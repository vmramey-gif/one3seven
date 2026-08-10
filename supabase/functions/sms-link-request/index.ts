/**
 * Supabase Edge Function: sms-link-request
 *
 * Step 1 of linking a worker's phone number for SMS document upload. The signed-in worker
 * requests a code be texted to a phone number; on success it is stored as an unverified
 * `worker_sms_links` row. The worker proves control of the number in a second step
 * (sms-verify-phone) before the inbound webhook will ever accept files from it — otherwise
 * anyone who learned a worker's number could try to text files into their record.
 *
 * POST body: { intakeId: string, phoneNumber: string }  (phoneNumber must be E.164, e.g. +14155551234)
 *
 * SCAFFOLDING: returns 503 until TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER are
 * set as function secrets (no Twilio account exists yet). The DB row + code-hashing logic below is
 * otherwise complete and ready to send once those secrets are set.
 *
 * Deploy WITH JWT verification (default) — the caller must be the intake's own worker.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const E164 = /^\+[1-9]\d{6,14}$/;
const CODE_TTL_MINUTES = 10;

async function hashCode(code: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
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

  let body: { intakeId?: string; phoneNumber?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  const { intakeId, phoneNumber } = body;
  if (!intakeId || !phoneNumber) {
    return new Response(JSON.stringify({ error: 'intakeId and phoneNumber are required' }), { status: 400 });
  }
  const phone = phoneNumber.trim();
  if (!E164.test(phone)) {
    return new Response(
      JSON.stringify({ error: 'Enter your phone number in the form +1XXXXXXXXXX.' }),
      { status: 400 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Ownership check: the caller must own this intake (service-role writes below bypass RLS).
  const { data: intakeRow, error: intakeErr } = await supabase
    .from('intakes')
    .select('id, worker_id')
    .eq('id', intakeId)
    .maybeSingle();
  if (intakeErr || !intakeRow || intakeRow.worker_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Intake not found' }), { status: 404 });
  }

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const { error: upsertErr } = await supabase
    .from('worker_sms_links')
    .upsert(
      {
        worker_id: user.id,
        intake_id: intakeId,
        phone_number: phone,
        status: 'pending_verification',
        verification_code_hash: codeHash,
        verification_expires_at: expiresAt,
        verified_at: null,
      },
      { onConflict: 'phone_number' },
    );
  if (upsertErr) {
    console.error('[sms-link-request] upsert failed', upsertErr.message);
    return new Response(JSON.stringify({ error: 'Could not save this phone number. Try again.' }), { status: 500 });
  }

  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return new Response(
      JSON.stringify({ error: 'Text-in upload is not turned on yet. Check back soon.' }),
      { status: 503 },
    );
  }

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
        Body: `Your one3seven verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
      }),
    },
  );
  if (!twilioResp.ok) {
    const detail = await twilioResp.text().catch(() => '');
    console.error('[sms-link-request] Twilio send failed', twilioResp.status, detail);
    return new Response(JSON.stringify({ error: 'Could not send the code. Try again.' }), { status: 502 });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
