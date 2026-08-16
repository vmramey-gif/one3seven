/**
 * Supabase Edge Function: send-worker-summary-email
 *
 * Emails a signed-in worker a copy of their own organized-summary PDF. The PDF bytes are
 * generated CLIENT-SIDE (buildIntakeSummaryPdfBytes in intakeSummaryDownload.ts -- the exact
 * same renderer the in-app "Download" button uses) and posted here as base64; this function only
 * sends, it never re-renders the PDF, so there is exactly one place that builds worker summary
 * PDFs, not two that could drift apart.
 *
 * Recipient is ALWAYS the caller's own verified Supabase Auth email -- never client-supplied.
 * This is deliberate: an editable "send to" address on an authenticated attachment-email
 * endpoint is an open-relay abuse vector (anyone with a session could spam arbitrary inboxes
 * with an attachment via this project's sending reputation). A worker who wants a copy
 * somewhere else can forward it themselves once it's in their own inbox.
 *
 * POST body: { pdfBase64: string, intakeNumber?: string }
 * Auth: Bearer JWT (the worker's own session)
 * Required function secrets (npx supabase secrets set KEY=value):
 *   RESEND_API_KEY, and either WORKER_EMAIL_FROM or (falls back to) PILOT_NOTIFY_FROM
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
// Generous for a text-based summary PDF; guards the request body against abuse. Base64 runs
// ~4/3 the size of the raw bytes it encodes.
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_PDF_BYTES * 4) / 3);

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('WORKER_EMAIL_FROM') ?? Deno.env.get('PILOT_NOTIFY_FROM');
  if (!RESEND_API_KEY || !FROM) {
    return json({ error: 'Email not configured (RESEND_API_KEY / WORKER_EMAIL_FROM)' }, 503);
  }

  // ── Auth: verify JWT, recipient comes from here -- never from the request body ──
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
  const { data: { user }, error: userErr } = await anonClient.auth.getUser(jwt);
  if (userErr || !user || !user.email) return json({ error: 'Unauthorized' }, 401);

  let body: { pdfBase64?: string; intakeNumber?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : '';
  const intakeNumber = typeof body.intakeNumber === 'string' ? body.intakeNumber.trim() : '';
  if (!pdfBase64) return json({ error: 'pdfBase64 required' }, 400);
  if (pdfBase64.length > MAX_BASE64_CHARS) return json({ error: 'PDF too large to email' }, 413);

  const fileName = `one3seven-intake-${(intakeNumber || 'summary').replace(/[^\w-]/g, '_')}.pdf`;
  const subject = 'Your organized one3seven summary';
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#17181C">
      <p>Attached is a copy of your organized intake summary from one3seven.</p>
      <p style="margin-top:16px;color:#6b7280;font-size:13px">
        one3seven is not a law firm and does not provide legal advice. This summary organizes
        facts from your own records for your review.
      </p>
    </div>`;
  const text =
    'Attached is a copy of your organized intake summary from one3seven.\n\n' +
    'one3seven is not a law firm and does not provide legal advice. This summary organizes ' +
    'facts from your own records for your review.';

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [user.email],
      subject,
      html,
      text,
      attachments: [{ filename: fileName, content: pdfBase64 }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: 'Email send failed', status: res.status, detail }, 502);
  }
  return json({ ok: true });
});
