/**
 * Supabase Edge Function: send-intake-to-firm-email
 *
 * Lets a signed-in worker email their organized-summary PDF to ANY email address they type in --
 * unlike send-worker-summary-email, which deliberately hard-codes the recipient to the caller's
 * own verified auth email. This is the intentional exception to that rule: the whole point is
 * reaching a firm that has no one3seven account of its own (see FIRM_CODE_ROUTING_LIVE /
 * project_strategy_pause_attorney_push_worker -- routing through an in-app firm account is paused,
 * but a worker directly emailing their own packet to a firm's public intake address is not, since
 * it implies nothing about one3seven having a relationship with that firm).
 *
 * A client-supplied recipient on an authenticated attachment-email endpoint is a real open-relay
 * abuse vector, so this function adds what send-worker-summary-email doesn't need:
 *   - ownership check (the intake must belong to the caller)
 *   - recipient email format validation
 *   - a rolling-24h send cap per worker, backed by worker_intake_firm_emails
 *   - every attempt (sent or failed) is logged to that table for audit/traceability
 *
 * POST body: { intakeId: string, recipientEmail: string, firmName?: string, pdfBase64: string, intakeNumber?: string }
 * Auth: Bearer JWT (the worker's own session)
 * Required function secrets: RESEND_API_KEY, and either WORKER_EMAIL_FROM or PILOT_NOTIFY_FROM
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_PDF_BYTES * 4) / 3);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX_SENDS = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('WORKER_EMAIL_FROM') ?? Deno.env.get('PILOT_NOTIFY_FROM');
  if (!RESEND_API_KEY || !FROM) {
    return json({ error: 'Email not configured (RESEND_API_KEY / WORKER_EMAIL_FROM)' }, 503);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: userErr } = await anonClient.auth.getUser(jwt);
  if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

  let body: {
    intakeId?: string;
    recipientEmail?: string;
    firmName?: string;
    pdfBase64?: string;
    intakeNumber?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const intakeId = typeof body.intakeId === 'string' ? body.intakeId.trim() : '';
  const recipientEmail = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim() : '';
  const firmName = typeof body.firmName === 'string' ? body.firmName.trim().slice(0, 200) : '';
  const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : '';
  const intakeNumber = typeof body.intakeNumber === 'string' ? body.intakeNumber.trim() : '';

  if (!intakeId) return json({ error: 'intakeId required' }, 400);
  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    return json({ error: 'Enter a valid email address for the firm.' }, 400);
  }
  if (!pdfBase64) return json({ error: 'pdfBase64 required' }, 400);
  if (pdfBase64.length > MAX_BASE64_CHARS) return json({ error: 'PDF too large to email' }, 413);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Ownership check -- service-role writes below bypass RLS, so this is the only gate.
  const { data: intakeRow, error: intakeErr } = await supabase
    .from('intakes')
    .select('id, worker_id')
    .eq('id', intakeId)
    .maybeSingle();
  if (intakeErr || !intakeRow || intakeRow.worker_id !== user.id) {
    return json({ error: 'Intake not found' }, 404);
  }

  // Rate limit: cap sends per worker in a rolling window, regardless of destination, so a
  // compromised or malicious session can't use one3seven's sending reputation to spam arbitrary
  // inboxes with attachments.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count: recentSends, error: countErr } = await supabase
    .from('worker_intake_firm_emails')
    .select('id', { count: 'exact', head: true })
    .eq('worker_id', user.id)
    .gte('created_at', windowStart);
  if (countErr) {
    console.error('[send-intake-to-firm-email] rate limit count failed', countErr.message);
    return json({ error: 'Could not send right now. Try again.' }, 500);
  }
  if ((recentSends ?? 0) >= RATE_LIMIT_MAX_SENDS) {
    return json(
      { error: `You've reached the limit of ${RATE_LIMIT_MAX_SENDS} firm emails per day. Try again tomorrow.` },
      429,
    );
  }

  const fileName = `one3seven-intake-${(intakeNumber || 'summary').replace(/[^\w-]/g, '_')}.pdf`;
  const workerLabel = (user.email ?? 'A one3seven user').trim();
  const firmLabel = firmName || 'your firm';
  const subject = `Organized intake from ${workerLabel}${intakeNumber ? ` (Ref ${intakeNumber})` : ''}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#17181C">
      <p>Attached is an organized intake packet that ${workerLabel} prepared and sent to ${escapeHtml(firmLabel)} using one3seven, a self-service record-organization tool.</p>
      <p style="margin-top:16px;color:#6b7280;font-size:13px">
        one3seven is not a law firm and does not provide legal advice. This packet organizes facts
        and records the worker chose to include, for the recipient's own review. one3seven did not
        select this recipient and has no relationship with this address beyond delivering this
        message at the worker's request.
      </p>
    </div>`;
  const text =
    `Attached is an organized intake packet that ${workerLabel} prepared and sent to ${firmLabel} ` +
    'using one3seven, a self-service record-organization tool.\n\n' +
    'one3seven is not a law firm and does not provide legal advice. This packet organizes facts ' +
    "and records the worker chose to include, for the recipient's own review.";

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [recipientEmail],
      reply_to: user.email || undefined,
      subject,
      html,
      text,
      attachments: [{ filename: fileName, content: pdfBase64 }],
    }),
  });

  const logRow = {
    worker_id: user.id,
    intake_id: intakeId,
    recipient_email: recipientEmail,
    firm_name: firmName || null,
  };

  if (!res.ok) {
    const detail = await res.text();
    await supabase
      .from('worker_intake_firm_emails')
      .insert({ ...logRow, status: 'failed', error_detail: detail.slice(0, 2000) });
    return json({ error: 'Email send failed', status: res.status, detail }, 502);
  }

  const { error: logErr } = await supabase
    .from('worker_intake_firm_emails')
    .insert({ ...logRow, status: 'sent' });
  if (logErr) console.error('[send-intake-to-firm-email] audit log insert failed', logErr.message);

  return json({ ok: true });
});
