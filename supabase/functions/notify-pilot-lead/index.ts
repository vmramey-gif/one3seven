/**
 * Supabase Edge Function: notify-pilot-lead
 * Emails the founders the moment a firm submits the "Start free pilot" form — AND the moment a
 * new WORKER creates an account (so you know instantly when someone shows up to try one3seven).
 *
 * Triggers (two Supabase DATABASE WEBHOOKS → this one function; Dashboard: Database → Webhooks):
 *   1. INSERT into public.pilot_interest  → firm pilot request email  (existing)
 *   2. INSERT into public.profiles        → new-worker email, but ONLY for a plain worker signup
 *      (role='worker', not a founder/rep). Firm/founder/rep profiles are ignored.
 * Both webhooks POST the standard payload:
 *   { type: 'INSERT', table: 'pilot_interest' | 'profiles', schema: 'public', record: {...} }
 *
 * Email is sent via Resend. No inbound Supabase session auth — a shared-secret header (set on
 * BOTH webhooks) is what proves it's our own webhook calling.
 *
 * Required function secrets (npx supabase secrets set KEY=value):
 *   RESEND_API_KEY · PILOT_NOTIFY_FROM · PILOT_NOTIFY_TO · PILOT_WEBHOOK_SECRET
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

  let payload: { table?: string; record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const table = payload.table ?? 'pilot_interest';
  const r = payload.record ?? {};
  const when = (r.created_at as string) ?? new Date().toISOString();

  let subject: string;
  let html: string;
  let text: string;
  let replyTo: string | undefined;

  if (table === 'profiles') {
    // New WORKER signup. Alert ONLY for a plain worker — skip firms, founders, and reps so we
    // don't ping on internal/team accounts. Heads-up only: no records or story, just "someone showed up".
    const role = (r.role as string) ?? '';
    const isFounder = Boolean(r.is_founder);
    const crmRole = (r.crm_role as string) ?? '';
    if (role !== 'worker' || isFounder || crmRole) {
      return json({ ok: true, skipped: 'not a plain worker profile' });
    }
    const first = (r.first_name as string) ?? '';
    const last = (r.last_name as string) ?? '';
    const nm = (((r.name as string) || [first, last].filter(Boolean).join(' ')) as string).trim() || '(name not set yet)';
    const phone = (r.phone as string) ?? '';
    const loc = [r.city, r.state].filter(Boolean).join(', ');
    subject = 'New worker signed up on one3seven';
    html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#17181C">
        <h2 style="margin:0 0 12px">A worker just signed up 🌱</h2>
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td><td><strong>${esc(nm)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td><td>${phone ? `<a href="tel:${esc(phone)}">${esc(phone)}</a>` : '<em>—</em>'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Location</td><td>${esc(loc) || '<em>—</em>'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Signed up</td><td>${esc(when)}</td></tr>
        </table>
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px">
          They created an account to try one3seven. Heads-up only — their records and story stay private to them.
        </p>
      </div>`;
    text = `A worker just signed up on one3seven\n\nName: ${nm}\nPhone: ${phone || '—'}\nLocation: ${loc || '—'}\nSigned up: ${when}\n\nHeads-up only — their records stay private to them.`;
    replyTo = undefined;
  } else {
    // Firm pilot request (existing behavior).
    const name = (r.name as string) ?? '(no name)';
    const firm = (r.firm_name as string) ?? '(not given)';
    const email = (r.email as string) ?? '(no email)';
    const phone = (r.phone as string) ?? '';
    const note = (r.note as string) ?? '';
    subject = `New pilot request: ${firm !== '(not given)' ? firm : name}`;
    html = `
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
    text = `New free-pilot request\n\nName: ${name}\nFirm: ${firm}\nEmail: ${email}\nPhone: ${phone || '—'}\nNote: ${note || '—'}\nSubmitted: ${when}\n\nAlready in your /hq CRM as a priority-A card.`;
    replyTo = email;
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, reply_to: replyTo, subject, html, text }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: 'Email send failed', status: res.status, detail }, 502);
  }
  return json({ ok: true });
});
