/**
 * Supabase Edge Function: notify-pilot-lead
 * Emails the founders the moment a firm submits the "Start free pilot" form.
 *
 * Trigger: a Supabase DATABASE WEBHOOK on INSERT into public.pilot_interest (set up in the
 * dashboard: Database → Webhooks). The webhook POSTs the standard payload:
 *   { type: 'INSERT', table: 'pilot_interest', schema: 'public', record: {...}, old_record: null }
 *
 * Email is sent via Resend (https://resend.com). No inbound auth from a Supabase session here —
 * instead we require a shared-secret header so only our own webhook can invoke it.
 *
 * Required function secrets (set with: npx supabase secrets set KEY=value):
 *   RESEND_API_KEY     — Resend API key (server-side only; never exposed to the browser)
 *   PILOT_NOTIFY_FROM  — verified sender, e.g. "one3seven <alerts@one3seven.com>"
 *   PILOT_NOTIFY_TO    — comma-separated recipients, e.g. "vmramey@gmail.com,tadmor86@gmail.com"
 *   PILOT_WEBHOOK_SECRET — any long random string; also set as a custom header on the webhook
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // --- Only our own Supabase webhook may invoke this. ---
  const expected = Deno.env.get('PILOT_WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret');
  if (!expected || provided !== expected) return json({ error: 'Unauthorized' }, 401);

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('PILOT_NOTIFY_FROM');
  const TO = (Deno.env.get('PILOT_NOTIFY_TO') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!RESEND_API_KEY || !FROM || TO.length === 0) {
    return json({ error: 'Email not configured (RESEND_API_KEY / PILOT_NOTIFY_FROM / PILOT_NOTIFY_TO)' }, 500);
  }

  let payload: { record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const r = payload.record ?? {};
  const name = (r.name as string) ?? '(no name)';
  const firm = (r.firm_name as string) ?? '(not given)';
  const email = (r.email as string) ?? '(no email)';
  const phone = (r.phone as string) ?? '';
  const note = (r.note as string) ?? '';
  const when = (r.created_at as string) ?? new Date().toISOString();

  const subject = `New pilot request: ${firm !== '(not given)' ? firm : name}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#1E1B4B">
      <h2 style="margin:0 0 12px">New free-pilot request</h2>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td><td><strong>${esc(name)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Firm</td><td><strong>${esc(firm)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td><td>${phone ? `<a href="tel:${esc(phone)}">${esc(phone)}</a>` : '<em>—</em>'}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">Note</td><td>${esc(note) || '<em>—</em>'}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Submitted</td><td>${esc(when)}</td></tr>
      </table>
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px">
        Already in your /hq CRM as a priority-A card. Reply fast — inbound firms go cold within hours.
      </p>
    </div>`;

  const text = `New free-pilot request\n\nName: ${name}\nFirm: ${firm}\nEmail: ${email}\nPhone: ${phone || '—'}\nNote: ${note || '—'}\nSubmitted: ${when}\n\nAlready in your /hq CRM as a priority-A card.`;

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, reply_to: email, subject, html, text }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: 'Email send failed', status: res.status, detail }, 502);
  }
  return json({ ok: true });
});
