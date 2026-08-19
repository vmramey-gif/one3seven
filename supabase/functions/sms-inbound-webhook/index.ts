/**
 * Supabase Edge Function: sms-inbound-webhook
 *
 * Receives Twilio's inbound MMS webhook when a worker texts a photo/document to the one3seven
 * number. Verifies the request actually came from Twilio (X-Twilio-Signature), matches the
 * sender's phone number to a VERIFIED worker_sms_links row (unverified links are never
 * matched — see 20260810120000_worker_sms_links.sql for why), downloads each attached media
 * item, and lands it in storage + `uploaded_files` exactly like a browser upload does
 * (src/services/intakeDataService.ts persistUploadedFile) so it shows up on the worker's
 * timeline the same way.
 *
 * KNOWN GAP (documented, not fixed here): text extraction (file_text_extractions) currently only
 * runs client-side (fileTextExtractionService.ts, triggered after a browser upload). A file landed
 * by this webhook will NOT be auto-extracted until the worker next opens the app and an existing
 * client-side re-extraction pass (e.g. Re-organize) picks up files missing extracted text. Wiring
 * server-side extraction here is a reasonable follow-up once this ships for real, not required for
 * the file to be safely stored and visible.
 *
 * Deploy WITHOUT JWT verification — Twilio cannot send a Supabase JWT; the signature check below
 * is the real authentication:
 *   npx supabase functions deploy sms-inbound-webhook --no-verify-jwt --project-ref <ref>
 *
 * Required env (Supabase function secrets): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Configure this function's URL as the "A message comes
 * in" webhook on the Twilio phone number (must match EXACTLY, including https:// and no trailing
 * slash mismatch — Twilio signs over the literal URL it POSTed to).
 *
 * SCAFFOLDING: functionally complete, but cannot receive real traffic until a Twilio account and
 * phone number exist and the secrets above are set.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'intake-files';
const MAX_MEDIA_ITEMS = 10; // Twilio's own per-message MMS cap

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
};

function extForMime(mime: string): string {
  return EXT_BY_MIME[mime.toLowerCase()] ?? 'bin';
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Twilio's documented request-validation algorithm: HMAC-SHA1(authToken, url + sorted "key"+"value" pairs), base64. */
async function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): Promise<boolean> {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return timingSafeEqual(computed, signature);
}

function twiml(message: string): Response {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!TWILIO_AUTH_TOKEN || !TWILIO_ACCOUNT_SID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Not configured', { status: 503 });
  }

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const valid = await verifyTwilioSignature(TWILIO_AUTH_TOKEN, req.url, params, signature);
  if (!valid) {
    console.warn('[sms-inbound-webhook] signature verification failed', { url: req.url });
    return new Response('Forbidden', { status: 403 });
  }

  const from = (params['From'] ?? '').trim();
  const numMedia = Number(params['NumMedia'] ?? '0') || 0;
  if (!from) {
    return twiml("We couldn't tell where that text came from. Nothing was saved.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Keyword sets match exactly what's declared on the Twilio A2P campaign registration — every
  // declared opt-out/help keyword must actually do something here, or the registration is lying
  // about what the number does. CTIA-standard set plus our own UNLINK alias.
  const OPT_OUT_KEYWORDS = new Set([
    'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'REVOKE', 'UNLINK',
  ]);
  const HELP_KEYWORDS = new Set(['HELP', 'INFO']);
  // Resubscribe keywords (CTIA-standard for A2P 10DLC campaigns). Cannot actually restore the
  // link from a text reply alone -- STOP deletes the worker_sms_links row entirely, and
  // re-linking requires proving control of the number again via a fresh OTP (sms-verify-phone),
  // which only the signed-in website flow can do. Still must be RECOGNIZED and answered here: an
  // A2P campaign registration that declares these keywords but has the webhook fall through to
  // the generic "not linked" reply is an inconsistency a carrier reviewer will flag (2026-08-19,
  // exactly the "Opt-in information" rejection this closes).
  const RESUBSCRIBE_KEYWORDS = new Set(['START', 'YES', 'UNSTOP']);

  const bodyKeyword = (params['Body'] ?? '').trim().toUpperCase();
  if (OPT_OUT_KEYWORDS.has(bodyKeyword)) {
    await supabase.from('worker_sms_links').delete().eq('phone_number', from);
    // Twilio also enforces STOP at the carrier level for future delivery — this just clears our
    // link. Wording matches the A2P 10DLC campaign's declared opt-out message verbatim
    // (2026-08-19) -- the two had drifted apart, itself a consistency flag on resubmission.
    return twiml(
      'You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.',
    );
  }
  // HELP message matches the campaign's dedicated "What is the help message?" field verbatim
  // (2026-08-19) -- that field is the canonical declared text for this exact reply; it must not
  // be a paraphrase or a superset/subset of what actually gets sent.
  if (HELP_KEYWORDS.has(bodyKeyword)) {
    return twiml('Reply STOP to unsubscribe. Msg&Data Rates May Apply.');
  }
  if (RESUBSCRIBE_KEYWORDS.has(bodyKeyword)) {
    return twiml(
      'one3seven: To resume texting documents to one3seven, sign in at one3seven.com and re-link your phone under Upload (a new verification code is required).',
    );
  }

  const { data: link, error: linkErr } = await supabase
    .from('worker_sms_links')
    .select('worker_id, intake_id, status')
    .eq('phone_number', from)
    .maybeSingle();
  if (linkErr || !link || link.status !== 'verified') {
    console.info('[sms-inbound-webhook] no verified link for sender', { from });
    // Wording matches the campaign's declared Sample Message #3 verbatim (2026-08-19) -- see the
    // brand-prefix note on Sample Message #2's reply below.
    return twiml(
      "one3seven: This number isn't linked to a one3seven account yet. Sign in at one3seven.com and link your phone under Upload to text documents in.",
    );
  }
  if (numMedia === 0) {
    // Wording matches the campaign's declared Sample Message #4 verbatim.
    return twiml('one3seven: Got your text. To add a document, attach a photo or PDF to your next message.');
  }

  const { workerId, intakeId } = { workerId: link.worker_id as string, intakeId: link.intake_id as string };
  let savedCount = 0;
  const errors: string[] = [];

  const mediaCount = Math.min(numMedia, MAX_MEDIA_ITEMS);
  for (let i = 0; i < mediaCount; i++) {
    const mediaUrl = params[`MediaUrl${i}`];
    const mediaType = params[`MediaContentType${i}`] ?? 'application/octet-stream';
    if (!mediaUrl) continue;
    try {
      // Twilio media URLs require the account's own Basic Auth to fetch.
      const mediaResp = await fetch(mediaUrl, {
        headers: { Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}` },
      });
      if (!mediaResp.ok) {
        errors.push(`media ${i}: fetch failed (${mediaResp.status})`);
        continue;
      }
      const bytes = new Uint8Array(await mediaResp.arrayBuffer());
      const contentHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const { data: existing } = await supabase
        .from('uploaded_files')
        .select('id')
        .eq('intake_id', intakeId)
        .eq('content_hash', contentHash)
        .limit(1);
      if (existing && existing.length > 0) {
        savedCount += 1; // already on record — count as success from the worker's perspective
        continue;
      }

      const ext = extForMime(mediaType);
      const fileName = `sms-${Date.now()}-${i}.${ext}`;
      const path = `${workerId}/${intakeId}/${fileName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: mediaType,
        upsert: false,
      });
      if (upErr) {
        errors.push(`media ${i}: storage upload failed (${upErr.message})`);
        continue;
      }
      const { error: dbErr } = await supabase.from('uploaded_files').insert({
        intake_id: intakeId,
        worker_id: workerId,
        file_name: fileName,
        file_path: path,
        file_type: mediaType,
        file_size: bytes.byteLength,
        content_hash: contentHash,
      });
      if (dbErr) {
        console.error('[sms-inbound-webhook] uploaded_files insert failed, rolling back storage', dbErr.message);
        await supabase.storage.from(BUCKET).remove([path]);
        errors.push(`media ${i}: record creation failed`);
        continue;
      }
      savedCount += 1;
    } catch (e) {
      errors.push(`media ${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.info('[sms-inbound-webhook] processed', { from, intakeId, savedCount, errors });

  if (savedCount === 0) {
    return twiml("We couldn't save that. Try sending the photo again, one at a time.");
  }
  // Wording matches the campaign's declared Sample Message #2 verbatim (2026-08-19) -- every
  // declared sample carries a "one3seven: " brand-identification prefix; this reply, the "not
  // linked yet" reply, and the "got your text" reply above were the three still missing it (found
  // by a character-by-character diff against every declared sample after two "Opt-in information"
  // rejections in a row on a resubmission that had already fixed the more obvious keyword/
  // consent-capture gaps).
  return twiml(
    `one3seven: Got it — ${savedCount} file${savedCount === 1 ? '' : 's'} added to your record. Reply STOP to unlink this number.`,
  );
});
