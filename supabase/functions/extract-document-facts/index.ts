/**
 * Supabase Edge Function: extract-document-facts
 * Downloads a file from storage, sends it to Claude as a PDF document,
 * and stores structured facts in file_text_extractions.document_facts.
 *
 * POST body: { uploaded_file_id, intake_id, category, file_name, file_path? }
 *
 * Strategy:
 *   1. If file_text_extractions already has extraction_status='completed' with text → use that text.
 *   2. Otherwise → download the file from storage and send to Claude as a base64 PDF document.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
// Model is an ENV VAR so it can be changed via `supabase secrets set EXTRACTION_MODEL=...` WITHOUT a
// code redeploy. Fallbacks are tried in order if the primary is rejected (renamed / removed / access).
const MODEL = Deno.env.get('EXTRACTION_MODEL')?.trim() || 'claude-sonnet-5';
const MODEL_FALLBACKS = (Deno.env.get('EXTRACTION_MODEL_FALLBACKS')?.trim() || 'claude-sonnet-4-5')
  .split(',').map((m) => m.trim()).filter(Boolean);
const BUCKET = 'intake-files';
const MAX_TEXT_CHARS = 12_000;
const MAX_TOKENS = 3000;

// Scanned-PDF chunking (live Francis intake: a 58-page image-only personnel file sent as ONE
// Claude call inside a 17-file sequential batch blew the invocation wall-clock, so every scan —
// including the case's Final Warning — silently produced no facts). A no-text-layer PDF larger
// than SCAN_CHUNK_PAGES is split into page-range chunks, each extracted in its own Claude call,
// and the chunk facts merged. SCAN_TIME_BUDGET_MS caps one file's chunk loop; if it trips we keep
// the chunks we have and flag `partial_scan_extraction` (visible, precision-first) instead of
// failing the whole file. BATCH_TIME_BUDGET_MS caps how long batch mode keeps STARTING new files;
// leftovers are reported in `remaining` and the client re-invokes until none remain, so every
// invocation gets a fresh edge-function wall-clock.
const SCAN_CHUNK_PAGES = 10;
const SCAN_TIME_BUDGET_MS = 75_000;
const BATCH_TIME_BUDGET_MS = 45_000;

// ---------------------------------------------------------------------------
// System prompt — establishes role and non-negotiable legal guardrails.
// Kept in the system slot (not the user turn) so the constraints are anchored
// independently of per-document content. one3seven organizes information for
// attorney review; it never evaluates, predicts, or concludes.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the document-extraction engine for one3seven, an employment-intake organization system used by attorneys.

Your only job is to extract facts that are EXPLICITLY STATED in a document and return them as structured JSON. You organize information; you never evaluate it.

ABSOLUTE RULES:
- Extract only what the document explicitly states. Never infer, assume, or supplement from outside knowledge.
- Never make or imply a legal conclusion. Never use words such as "illegal", "unlawful", "wrongful", "violated", "discrimination", "retaliation", "harassment", "proves", "liable", "valid claim", or "strong case".
- Never assess the merits, strength, value, or likely outcome of any matter.
- Quote the document verbatim for key_quote (under 200 characters). Never paraphrase a quote.
- If a field is not explicitly present, return null (or an empty array). Do not guess.
- Calibrate confidence honestly: "high" only when the relevant fields are clearly and unambiguously stated; "medium" when some are ambiguous; "low" when the document is unclear, partial, or hard to read.
- Output raw JSON only — no prose, no markdown, no code fences.

Attorneys independently review every source document. Accuracy and restraint matter more than completeness.`;

// ---------------------------------------------------------------------------
// DocumentFacts schema
// ---------------------------------------------------------------------------

type DocumentFacts = {
  category: string;
  file_name: string;
  extracted_at: string;
  confidence: 'high' | 'medium' | 'low';
  document_date: string | null;
  people_mentioned: string[];
  employer_name: string | null;
  stated_reason: string | null;
  issued_by: string | null;
  policy_cited: string | null;
  complaint_topic: string | null;
  complaint_date: string | null;
  resolution_summary: string | null;
  start_date: string | null;
  position_title: string | null;
  pay_rate: string | null;
  pay_period_start: string | null;
  pay_period_end: string | null;
  gross_pay: string | null;
  net_pay: string | null;
  regular_hours: string | null;
  overtime_hours: string | null;
  overtime_rate: string | null;
  missed_breaks: string | null;
  period_covered: string | null;
  schedule_change_description: string | null;
  effective_date: string | null;
  witness_name: string | null;
  events_corroborated: string[];
  relationship_to_worker: string | null;
  key_quote: string | null;
  flags: string[];
  text_truncated?: boolean;
  // Phase 2b: every explicitly-stated date in the document, each with a short context label.
  document_dates?: Array<{ date: string; context: string }>;
  // Phase 2b: documents this file explicitly references (may not themselves be uploaded).
  referenced_documents?: string[];
  // Phase 2b: people party to communications in this document, with stated roles.
  communication_parties?: Array<{ name: string; role: string }>;
  // Phase 2c: verbatim source snippet for each wage field, for the firm-facing
  // wage-exposure estimate. Snippet only — the panel locates/highlights it in the
  // rendered PDF (pdf.js). source_doc_id is the row's uploaded_file_id (known already).
  damages_sources?: {
    pay_rate?: string | null;
    overtime_hours?: string | null;
    overtime_rate?: string | null;
    missed_breaks?: string | null;
  };
};

// ---------------------------------------------------------------------------
// Category-specific extraction guidance
// ---------------------------------------------------------------------------

const CATEGORY_GUIDANCE: Record<string, string> = {
  'Workplace Communications': `
This is an HR complaint, HR email, or workplace communication.
Extract: the date of the communication, who sent it, who received it, what the worker's concern or complaint was about (complaint_topic), and what response or resolution was mentioned (resolution_summary).
Set complaint_date to the date the complaint was submitted.
Set key_quote to the most significant sentence — the core concern raised or the employer's substantive response.`,

  'Performance / discipline records': `
This is a written warning, performance improvement plan, or disciplinary record.
Extract: issue date (document_date), who issued it (issued_by), the stated reason (stated_reason), any policy cited (policy_cited), and effective_date if different.
Set key_quote to the exact sentence stating the reason for the warning.
If the document mentions a prior complaint or HR interaction, note it in flags.`,

  'Separation Records': `
This is a termination letter, separation agreement, or final pay notice.
Extract: termination date (document_date), employer-stated reason (stated_reason), who issued it (issued_by), whether final pay or COBRA is mentioned (flags).
Set key_quote to the exact sentence stating the reason for termination.
If the stated reason appears inconsistent with a prior complaint timeline, add "reason_may_conflict_with_timeline" to flags.`,

  'Offer Letters': `
This is an employment offer letter or onboarding document.
Extract: start date (start_date and document_date), position title (position_title), pay rate (pay_rate), employer name, who signed it (issued_by).
Note if an arbitration clause or non-compete is mentioned in flags.`,

  'Pay Records / Payroll': `
This is a pay stub or payroll record.
Extract: pay period start and end dates, pay date (document_date), gross pay, net pay, regular hours, overtime hours, overtime rate.
If overtime hours are listed but no overtime rate or premium is shown, add "overtime_rate_missing" to flags.
If this appears to be a final paycheck, add "final_pay" to flags.`,

  'Meal & Rest Period Records': `
This is a meal break log, timekeeping record, or rest period document.
Extract: the period covered (period_covered), any missed or short breaks (missed_breaks), employer name.
If breaks under 30 minutes are shown, add "short_breaks_recorded" to flags.
If any breaks show "0" or "missed", add "missed_breaks_recorded" to flags.
Set key_quote to any line showing a pattern of missed or short breaks.`,

  'Schedules': `
This is a schedule change notice or shift schedule.
Extract: effective date (effective_date and document_date), description of what changed (schedule_change_description), who issued it (issued_by).
If the change reduces hours or duties, add "hours_reduced" or "duties_changed" to flags.`,

  'Witness Statement': `
This is a coworker statement or witness declaration.
Extract: date (document_date), witness name (witness_name), relationship to worker (relationship_to_worker), specific events personally observed (events_corroborated as array).
Set key_quote to the sentence most directly corroborating the worker's account.
If the statement is dated after the worker's termination, add "post_termination_statement" to flags.`,
};

const JSON_SCHEMA = `{
  "document_date": string | null,
  "people_mentioned": string[],
  "employer_name": string | null,
  "stated_reason": string | null,
  "issued_by": string | null,
  "policy_cited": string | null,
  "complaint_topic": string | null,
  "complaint_date": string | null,
  "resolution_summary": string | null,
  "start_date": string | null,
  "position_title": string | null,
  "pay_rate": string | null,
  "pay_period_start": string | null,
  "pay_period_end": string | null,
  "gross_pay": string | null,
  "net_pay": string | null,
  "regular_hours": string | null,
  "overtime_hours": string | null,
  "overtime_rate": string | null,
  "missed_breaks": string | null,
  "period_covered": string | null,
  "schedule_change_description": string | null,
  "effective_date": string | null,
  "witness_name": string | null,
  "events_corroborated": string[],
  "relationship_to_worker": string | null,
  "key_quote": string | null,
  "document_dates": [{ "date": string, "context": string }],
  "referenced_documents": string[],
  "communication_parties": [{ "name": string, "role": string }],
  "damages_sources": { "pay_rate": string | null, "overtime_hours": string | null, "overtime_rate": string | null, "missed_breaks": string | null },
  "confidence": "high" | "medium" | "low",
  "flags": string[]
}`;

function buildTextPrompt(category: string, fileName: string, text: string): { role: string; content: string }[] {
  const guidance = CATEGORY_GUIDANCE[category] ??
    `Extract: document date, people mentioned, employer name, and key_quote (most significant sentence).`;

  const truncated = text.length > MAX_TEXT_CHARS;
  const body = truncated ? text.slice(0, MAX_TEXT_CHARS) : text;

  const prompt = `Extract structured facts from this employment document.

Document category: ${category}
File name: ${fileName}${truncated ? `\nNote: this document is long; only the first portion is shown below.` : ''}

Reminders: quote verbatim for key_quote (under 200 characters); use null / [] for anything not explicitly present; no legal conclusions; raw JSON only.
Capture EVERY date explicitly stated in the document in "document_dates", each as { "date": "<as written>", "context": "<short factual label, e.g. 'complaint filed', 'warning issued'>" }. Include only dates the text actually states; never infer a date. Keep context labels factual, never conclusory.
In "referenced_documents", list other documents this file explicitly mentions or refers to but does not itself contain (e.g. "performance improvement plan", "offer letter dated March 2021", "the attached schedule"). Use the document's own wording. Include only documents the text actually references; never infer documents that "should" exist.
In "communication_parties", list the people party to any communication in this document — sender, recipient, and anyone explicitly named — as { "name": "<as written>", "role": "<role/title exactly as the document states it, e.g. 'sender', 'recipient', 'HR representative', 'supervisor'; empty string if none stated>" }. Include only people the document actually names; never infer a person or a role.
For each wage field you fill (pay_rate, overtime_hours, overtime_rate, missed_breaks), also return in "damages_sources" the VERBATIM sentence or line the value was read from — copied exactly as written, under 200 characters, never paraphrased — e.g. "damages_sources": { "pay_rate": "Regular rate of pay: $22.00 per hour" }. Omit a field (or use null) when its value is null. This is a quotation only; it asserts nothing about the value.

CATEGORY-SPECIFIC GUIDANCE:
${guidance}

Return ONLY valid JSON matching this schema — no markdown, no code fences:
${JSON_SCHEMA}

DOCUMENT TEXT:
---
${body}
---`;

  return [{ role: 'user', content: prompt }];
}

function buildPdfPrompt(category: string, fileName: string, base64Pdf: string, pageNote = ''): { role: string; content: unknown }[] {
  const guidance = CATEGORY_GUIDANCE[category] ??
    `Extract: document date, people mentioned, employer name, and key_quote (most significant sentence).`;

  return [{
    role: 'user',
    content: [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Pdf,
        },
      },
      {
        type: 'text',
        text: `Extract structured facts from the attached employment document.

Document category: ${category}
File name: ${fileName}${pageNote}

Reminders: quote verbatim for key_quote (under 200 characters); use null / [] for anything not explicitly present; no legal conclusions; raw JSON only.
Capture EVERY date explicitly stated in the document in "document_dates", each as { "date": "<as written>", "context": "<short factual label, e.g. 'complaint filed', 'warning issued'>" }. Include only dates the text actually states; never infer a date. Keep context labels factual, never conclusory.
In "referenced_documents", list other documents this file explicitly mentions or refers to but does not itself contain (e.g. "performance improvement plan", "offer letter dated March 2021", "the attached schedule"). Use the document's own wording. Include only documents the text actually references; never infer documents that "should" exist.
In "communication_parties", list the people party to any communication in this document — sender, recipient, and anyone explicitly named — as { "name": "<as written>", "role": "<role/title exactly as the document states it, e.g. 'sender', 'recipient', 'HR representative', 'supervisor'; empty string if none stated>" }. Include only people the document actually names; never infer a person or a role.
For each wage field you fill (pay_rate, overtime_hours, overtime_rate, missed_breaks), also return in "damages_sources" the VERBATIM sentence or line the value was read from — copied exactly as written, under 200 characters, never paraphrased — e.g. "damages_sources": { "pay_rate": "Regular rate of pay: $22.00 per hour" }. Omit a field (or use null) when its value is null. This is a quotation only; it asserts nothing about the value.

CATEGORY-SPECIFIC GUIDANCE:
${guidance}

Return ONLY valid JSON matching this schema — no markdown, no code fences:
${JSON_SCHEMA}`,
      },
    ],
  }];
}

function buildImagePrompt(category: string, fileName: string, base64Image: string, mediaType: string): { role: string; content: unknown }[] {
  const guidance = CATEGORY_GUIDANCE[category] ??
    `Extract: document date, people mentioned, employer name, and key_quote (most significant sentence).`;

  return [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Image,
        },
      },
      {
        type: 'text',
        text: `Extract structured facts from the attached photo of an employment document. This is a photo, not a scan — read whatever text is legible; if part of it is blurry, cut off, or unreadable, leave those fields null rather than guessing.

Document category: ${category}
File name: ${fileName}

Reminders: quote verbatim for key_quote (under 200 characters); use null / [] for anything not explicitly present or not legible; no legal conclusions; raw JSON only.
Capture EVERY date explicitly stated in the document in "document_dates", each as { "date": "<as written>", "context": "<short factual label, e.g. 'complaint filed', 'warning issued'>" }. Include only dates the text actually states; never infer a date. Keep context labels factual, never conclusory.
In "referenced_documents", list other documents this file explicitly mentions or refers to but does not itself contain (e.g. "performance improvement plan", "offer letter dated March 2021", "the attached schedule"). Use the document's own wording. Include only documents the text actually references; never infer documents that "should" exist.
In "communication_parties", list the people party to any communication in this document — sender, recipient, and anyone explicitly named — as { "name": "<as written>", "role": "<role/title exactly as the document states it, e.g. 'sender', 'recipient', 'HR representative', 'supervisor'; empty string if none stated>" }. Include only people the document actually names; never infer a person or a role.
For each wage field you fill (pay_rate, overtime_hours, overtime_rate, missed_breaks), also return in "damages_sources" the VERBATIM sentence or line the value was read from — copied exactly as written, under 200 characters, never paraphrased — e.g. "damages_sources": { "pay_rate": "Regular rate of pay: $22.00 per hour" }. Omit a field (or use null) when its value is null. This is a quotation only; it asserts nothing about the value.

CATEGORY-SPECIFIC GUIDANCE:
${guidance}

Return ONLY valid JSON matching this schema — no markdown, no code fences:
${JSON_SCHEMA}`,
      },
    ],
  }];
}

// Image-type routing: Claude's vision input accepts these directly; anything else (notably HEIC/HEIF,
// the default iPhone camera format) isn't supported and gets an honest 'skipped' status (the closest
// fit in file_text_extractions' fact_extraction_status CHECK constraint -- pending/processing/
// completed/failed/skipped, see 20260608120000_document_facts_extraction.sql; a first pass used the
// invented value 'unsupported_type', which silently violated that constraint and left the row stuck
// at 'processing' forever, caught only by reading the row back after a live stress test) instead of
// silently being sent mislabeled as a PDF (the bug this whole file replaces — see extractionAccuracy
// audit 2026-08-17: images previously fell through to buildPdfPrompt with media_type hardcoded to
// 'application/pdf', so Claude silently failed to parse raw JPEG/PNG bytes it was told were a PDF).
const IMAGE_MEDIA_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};
const UNSUPPORTED_IMAGE_EXTENSIONS = new Set(['heic', 'heif']);
// Anthropic's vision guidance recommends keeping image payloads well under ~5MB; there's no
// server-side resize step (Deno edge functions have no image-processing runtime available here), so
// this is a hard cap rather than a compress-then-send step. An oversized photo gets an honest status
// instead of a risky/likely-to-fail API call.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function fileExtension(fileName: string): string {
  return (fileName.split('.').pop() ?? '').toLowerCase();
}

function detectImageMediaType(fileName: string): string | null {
  return IMAGE_MEDIA_TYPES[fileExtension(fileName)] ?? null;
}

function isUnsupportedImageType(fileName: string): boolean {
  return UNSUPPORTED_IMAGE_EXTENSIONS.has(fileExtension(fileName));
}

// ---------------------------------------------------------------------------
// Scanned-PDF chunk helpers
// ---------------------------------------------------------------------------

/** Chunked base64 — avoids call-stack overflow on large buffers. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Split a PDF into ≤ SCAN_CHUNK_PAGES sub-PDFs. Returns null when the PDF can't be parsed
 *  (corrupt/encrypted) — caller falls back to the whole-file single call. */
async function splitPdfIntoChunks(
  bytes: Uint8Array
): Promise<Array<{ base64: string; firstPage: number; lastPage: number; totalPages: number }> | null> {
  try {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();
    if (total <= SCAN_CHUNK_PAGES) return null;
    const chunks: Array<{ base64: string; firstPage: number; lastPage: number; totalPages: number }> = [];
    for (let start = 0; start < total; start += SCAN_CHUNK_PAGES) {
      const end = Math.min(start + SCAN_CHUNK_PAGES, total);
      const sub = await PDFDocument.create();
      const pages = await sub.copyPages(src, Array.from({ length: end - start }, (_, i) => start + i));
      for (const p of pages) sub.addPage(p);
      const saved = await sub.save();
      chunks.push({ base64: bytesToBase64(saved), firstPage: start + 1, lastPage: end, totalPages: total });
    }
    return chunks;
  } catch (e) {
    console.error('[extract] splitPdfIntoChunks failed — falling back to whole-file call', e);
    return null;
  }
}

/** Merge per-chunk facts into one document_facts object: scalars first-non-empty (page order),
 *  arrays concatenated + deduped, objects shallow-merged first-wins. The downstream sanitizers
 *  still enforce their own caps and banned-vocabulary guards on the merged result. */
function mergeChunkFacts(parts: DocumentFacts[]): DocumentFacts {
  const merged: Record<string, unknown> = {};
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    for (const [k, v] of Object.entries(part)) {
      if (isEmpty(v)) continue;
      const cur = merged[k];
      if (isEmpty(cur)) {
        merged[k] = v;
      } else if (Array.isArray(cur) && Array.isArray(v)) {
        const seen = new Set(cur.map((x) => JSON.stringify(x)));
        for (const item of v) {
          const key = JSON.stringify(item);
          if (!seen.has(key)) { seen.add(key); (cur as unknown[]).push(item); }
        }
      } else if (
        typeof cur === 'object' && cur !== null && !Array.isArray(cur) &&
        typeof v === 'object' && v !== null && !Array.isArray(v)
      ) {
        merged[k] = { ...(v as Record<string, unknown>), ...(cur as Record<string, unknown>) };
      }
      // scalar already set → first (earliest pages) wins
    }
  }
  return merged as DocumentFacts;
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

/** Robustly parse Claude's response into JSON — tolerates code fences and stray prose. */
function parseFacts(content: string): DocumentFacts | null {
  let s = content.trim();
  // Strip a leading/trailing markdown code fence if the model added one.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(s) as DocumentFacts;
  } catch {
    const match = s.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as DocumentFacts; } catch { /* fall through */ }
    }
    return null;
  }
}

async function callClaude(
  messages: unknown[],
  apiKey: string
): Promise<DocumentFacts | null> {
  const MAX_ATTEMPTS = 3;
  const models = [MODEL, ...MODEL_FALLBACKS];
  // Optional tuning params Anthropic MAY deprecate over time (this is how `temperature` broke us).
  // Kept here so a 400 that names one auto-strips it and retries, instead of failing the whole call.
  // `thinking: disabled` — Claude 5 models think adaptively by default; extraction needs a fast
  // deterministic JSON reply, and thinking tokens would eat the MAX_TOKENS budget. In `tuning`
  // (not the body) so the 400 self-heal strips it for models that reject the param.
  const tuning: Record<string, unknown> = { thinking: { type: 'disabled' } };
  let lastError = '';

  for (const model of models) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'pdfs-2024-09-25',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages,
          ...tuning,
        }),
      });

      // Transient (rate limit / overloaded) — back off and retry the SAME model.
      if (response.status === 429 || response.status === 503 || response.status === 529) {
        lastError = `Anthropic API ${response.status} (transient)`;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        // Always log the real error to Supabase function logs — never let it hide again.
        console.error(`[extract] Anthropic ${response.status} (model=${model}): ${errText}`);
        if (response.status === 400) {
          // SELF-HEAL: if the 400 names a tuning param we sent, drop it and retry the same model.
          const field = errText.match(/`([a-zA-Z_]+)`/)?.[1];
          if (field && field in tuning) { delete tuning[field]; attempt--; continue; }
          // A model-specific 400 → try the next fallback model.
          if (/\bmodel\b/i.test(errText)) { lastError = errText; break; }
        }
        // Model not found → try the next fallback model.
        if (response.status === 404) { lastError = errText; break; }
        // Anything else is a genuine error — surface it (auth, overloaded content, etc.).
        throw new Error(`Anthropic API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      // Join ALL text blocks — models with thinking enabled put a thinking block first,
      // so content[0].text is undefined and the old read produced '' → "Unparseable".
      const blocks: { type?: string; text?: string }[] = Array.isArray(data?.content) ? data.content : [];
      const content = blocks.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('\n');
      if (data?.stop_reason === 'max_tokens') {
        console.error(`[extract] response truncated at max_tokens (model=${model}) — JSON likely cut off`);
      }
      const parsed = parseFacts(content);
      if (!parsed) {
        // Never log `content` here — it's the model's real extracted document facts (names,
        // pay figures, quoted statements). Length/shape only; enough to diagnose a parse failure
        // without writing worker PII into Supabase's unredacted function logs.
        console.error(
          `[extract] unparseable response (model=${model}, stop=${data?.stop_reason}, blocks=${blocks.map((b) => b?.type).join(',')}, contentLength=${content.length})`
        );
      }
      return parsed;
    }
  }

  throw new Error(lastError || 'Anthropic API call failed after all models/retries');
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500 });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: {
    uploaded_file_id?: string;
    intake_id: string;
    category?: string;
    file_name?: string;
    file_path?: string;
    batch?: boolean; // if true, look up all files for intake_id and process them all
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { intake_id } = body;
  if (!intake_id) {
    return new Response(JSON.stringify({ error: 'intake_id required' }), { status: 400 });
  }

  // ------------------------------------------------------------------
  // AUTH + OWNERSHIP: require a signed-in caller who owns this intake.
  // (Service-role reads below bypass RLS, so we gate access here to prevent
  // a caller from triggering extraction on another worker's documents.)
  // ------------------------------------------------------------------
  const authHeader = req.headers.get('authorization') ?? '';
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
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
  // Allow the intake OWNER (worker) OR a firm reviewer whose firm holds a full_access route to this
  // intake. (Previously owner-only, which 403'd every firm reviewer — firms couldn't run extraction.)
  const { data: ownerRows } = await supabase
    .from('uploaded_files')
    .select('worker_id')
    .eq('intake_id', intake_id)
    .limit(1);
  const ownerId = ownerRows?.[0]?.worker_id ?? null;
  const isOwner = !!ownerId && ownerId === user.id;
  let firmHasAccess = false;
  if (!isOwner) {
    const { data: route } = await supabase
      .from('intake_routes')
      .select('id')
      .eq('intake_id', intake_id)
      .eq('route_status', 'full_access')
      .in('firm_id', (
        await supabase
          .from('firm_profiles')
          .select('id')
          .eq('profile_id', user.id)
          .then(({ data }) => (data ?? []).map((r: any) => r.id as string))
      ))
      .maybeSingle();
    firmHasAccess = !!route;
  }
  if (!isOwner && !firmHasAccess) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // ------------------------------------------------------------------
  // BATCH MODE: look up all files for this intake via service role
  // ------------------------------------------------------------------
  if (!body.uploaded_file_id || body.batch) {
    const { data: allFiles, error: filesErr } = await supabase
      .from('uploaded_files')
      .select('id, file_name, category, file_path, worker_id')
      .eq('intake_id', intake_id);

    if (filesErr || !allFiles?.length) {
      return new Response(
        JSON.stringify({ error: filesErr?.message ?? 'No files found for intake' }),
        { status: 404 }
      );
    }

    // Check which are already done
    const fileIds = allFiles.map((f: any) => f.id as string);
    const { data: existingFacts } = await supabase
      .from('file_text_extractions')
      .select('uploaded_file_id, fact_extraction_status')
      .in('uploaded_file_id', fileIds);

    const alreadyDone = new Set(
      (existingFacts ?? [])
        .filter((r: any) => r.fact_extraction_status === 'completed')
        .map((r: any) => r.uploaded_file_id as string)
    );

    const results: { file: string; ok: boolean; error?: string }[] = [];

    // Resumable batch: stop STARTING new files once the budget is spent — the invocation
    // wall-clock is finite, and one chunked scan can consume most of it. Whatever is left is
    // returned in `remaining`; the client re-invokes batch mode until remaining is 0, giving
    // every round a fresh wall-clock (the alreadyDone check makes re-invocation idempotent).
    const batchStarted = Date.now();
    let remaining = 0;

    for (const file of allFiles as Array<{ id: string; file_name: string; category: string | null; file_path: string | null; worker_id: string | null }>) {
      if (alreadyDone.has(file.id)) {
        results.push({ file: file.file_name, ok: true });
        continue;
      }
      if (Date.now() - batchStarted > BATCH_TIME_BUDGET_MS) {
        remaining++;
        continue;
      }
      const result = await processSingleFile({
        supabase,
        apiKey: ANTHROPIC_API_KEY,
        uploadedFileId: file.id,
        intakeId: intake_id,
        workerId: file.worker_id || undefined,
        category: normalizeCategory(file.category || '', file.file_name || ''),
        fileName: file.file_name,
        filePath: file.file_path || undefined,
      });
      results.push({ file: file.file_name, ok: result.ok, error: result.error });
    }

    const processed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    return new Response(
      JSON.stringify({ ok: true, processed, failed, remaining, results }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // ------------------------------------------------------------------
  // SINGLE FILE MODE
  // ------------------------------------------------------------------
  // SECURITY (audit #2): authorize the SPECIFIC file, not just the intake. The owner check above
  // resolves the caller-supplied intake_id to its worker, but the file actually processed is
  // body.uploaded_file_id — which must itself belong to the caller. Look the file up by id, confirm
  // ownership, and use the STORED path/name/category (never the caller-supplied ones) so a caller
  // can't point extraction at another worker's stored object.
  const { data: fileRow, error: fileErr } = await supabase
    .from('uploaded_files')
    .select('id, worker_id, intake_id, file_name, file_path, category')
    .eq('id', body.uploaded_file_id!)
    .maybeSingle();
  if (fileErr || !fileRow) {
    return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
  }
  if (fileRow.worker_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const singleResult = await processSingleFile({
    supabase,
    apiKey: ANTHROPIC_API_KEY,
    uploadedFileId: fileRow.id as string,
    intakeId: (fileRow.intake_id as string) ?? intake_id,
    category: normalizeCategory((fileRow.category as string) || body.category || '', (fileRow.file_name as string) || body.file_name || ''),
    fileName: (fileRow.file_name as string) || body.file_name || '',
    filePath: (fileRow.file_path as string) || body.file_path,
  });

  if (!singleResult.ok) {
    return new Response(JSON.stringify({ error: singleResult.error }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, facts: singleResult.facts }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// Wrap the handler so EVERY response — including all error paths and uncaught throws — carries CORS
// headers. Without this the browser blocks reading error responses and the supabase-js client only
// surfaces the opaque "Failed to send a request to the Edge Function", hiding the real error.
Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const res = await handle(req);
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    if (!headers.has('Content-Type') && res.body) headers.set('Content-Type', 'application/json');
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message ?? 'Unhandled edge error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

// ---------------------------------------------------------------------------
// processSingleFile — shared by both batch and single-file modes
// ---------------------------------------------------------------------------
async function processSingleFile(params: {
  supabase: ReturnType<typeof createClient>;
  apiKey: string;
  uploadedFileId: string;
  intakeId: string;
  workerId?: string;
  category: string;
  fileName: string;
  filePath?: string;
}): Promise<{ ok: boolean; facts?: unknown; error?: string }> {
  const { supabase, apiKey, uploadedFileId, intakeId, workerId, category, fileName, filePath } = params;

  // Check for existing row — only update fact_extraction_status, never overwrite Phase 2A extraction_status
  const { data: existingRow } = await supabase
    .from('file_text_extractions')
    .select('extracted_text, extraction_status, worker_id')
    .eq('uploaded_file_id', uploadedFileId)
    .maybeSingle();

  if (existingRow) {
    // Row exists — just mark fact extraction as processing
    await supabase.from('file_text_extractions')
      .update({ fact_extraction_status: 'processing' })
      .eq('uploaded_file_id', uploadedFileId);
  } else {
    // No row yet — insert minimal row (service role bypasses RLS)
    const insertData: Record<string, unknown> = {
      uploaded_file_id: uploadedFileId,
      intake_id: intakeId,
      fact_extraction_status: 'processing',
      extraction_status: 'pending',
    };
    if (workerId) insertData.worker_id = workerId;
    await supabase.from('file_text_extractions').insert(insertData);
  }

  let messages: unknown[] | null = null;
  let textTruncated = false;
  let facts: DocumentFacts | null = null;
  const scanFlags: string[] = [];

  if (existingRow?.extraction_status === 'completed' && existingRow?.extracted_text?.trim()) {
    // Phase 2A text is available — use it
    textTruncated = existingRow.extracted_text.length > MAX_TEXT_CHARS;
    messages = buildTextPrompt(category, fileName, existingRow.extracted_text);
  } else {
    // No text layer — download file and route by type: photo → Claude vision, unsupported photo
    // format (HEIC/HEIF) → honest not-yet-readable status, otherwise → PDF (chunked when large).
    if (isUnsupportedImageType(fileName)) {
      const msg = `${fileName} is a HEIC/HEIF photo, which can't be read yet — re-upload as JPG or PNG to have it read. The original file is still safely on file.`;
      const { error: skipErr } = await supabase.from('file_text_extractions')
        .update({ fact_extraction_status: 'skipped', fact_extraction_error: msg })
        .eq('uploaded_file_id', uploadedFileId);
      if (skipErr) console.error(`[extract] failed to persist 'skipped' status for ${fileName}`, skipErr);
      return { ok: false, error: msg };
    }

    const storagePath = filePath || (await resolveFilePath(supabase, uploadedFileId));
    if (!storagePath) {
      await supabase.from('file_text_extractions')
        .update({ fact_extraction_status: 'failed', fact_extraction_error: 'No file path available' })
        .eq('uploaded_file_id', uploadedFileId);
      return { ok: false, error: 'No file path available' };
    }

    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(storagePath);
    if (dlErr || !blob) {
      await supabase.from('file_text_extractions')
        .update({ fact_extraction_status: 'failed', fact_extraction_error: dlErr?.message ?? 'Storage download failed' })
        .eq('uploaded_file_id', uploadedFileId);
      return { ok: false, error: dlErr?.message ?? 'Download failed' };
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const imageMediaType = detectImageMediaType(fileName);

    if (imageMediaType) {
      if (bytes.length > MAX_IMAGE_BYTES) {
        const msg = `${fileName} is too large to read as a photo (${(bytes.length / (1024 * 1024)).toFixed(1)}MB, limit ${(MAX_IMAGE_BYTES / (1024 * 1024)).toFixed(0)}MB) — the original file is still safely on file.`;
        const { error: skipErr } = await supabase.from('file_text_extractions')
          .update({ fact_extraction_status: 'skipped', fact_extraction_error: msg })
          .eq('uploaded_file_id', uploadedFileId);
        if (skipErr) console.error(`[extract] failed to persist 'skipped' status for ${fileName}`, skipErr);
        return { ok: false, error: msg };
      }
      messages = buildImagePrompt(category, fileName, bytesToBase64(bytes), imageMediaType);
    } else {
      const chunks = await splitPdfIntoChunks(bytes);

      if (chunks) {
        // Large scan: one Claude call per page-range chunk, merged. A single failed chunk is
        // logged and skipped (partial facts, flagged) rather than failing the whole file.
        const started = Date.now();
        const parts: DocumentFacts[] = [];
        let attempted = 0;
        for (const chunk of chunks) {
          if (Date.now() - started > SCAN_TIME_BUDGET_MS) {
            scanFlags.push('partial_scan_extraction');
            scanFlags.push(`scan_pages_extracted_${chunk.firstPage - 1}_of_${chunk.totalPages}`);
            break;
          }
          attempted++;
          const pageNote = `\nNote: this is pages ${chunk.firstPage}-${chunk.lastPage} of a ${chunk.totalPages}-page scanned file; extract only what these pages state.`;
          try {
            const part = await callClaude(buildPdfPrompt(category, fileName, chunk.base64, pageNote), apiKey);
            if (part) parts.push(part);
          } catch (e) {
            console.error(`[extract] chunk ${chunk.firstPage}-${chunk.lastPage} of ${fileName} failed`, e);
            scanFlags.push(`scan_chunk_error_pages_${chunk.firstPage}_${chunk.lastPage}`);
          }
        }
        if (parts.length === 0) {
          const msg = `All ${attempted} scan chunks failed for ${fileName}`;
          await supabase.from('file_text_extractions').update({
            fact_extraction_status: 'failed', fact_extraction_error: msg,
          }).eq('uploaded_file_id', uploadedFileId);
          return { ok: false, error: msg };
        }
        facts = mergeChunkFacts(parts);
        scanFlags.push('multi_chunk_scan');
      } else {
        messages = buildPdfPrompt(category, fileName, bytesToBase64(bytes));
      }
    }
  }

  // Call Claude (single-call paths; chunked scans already populated `facts`)
  if (!facts && messages) {
    try {
      facts = await callClaude(messages, apiKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from('file_text_extractions').update({
        fact_extraction_status: 'failed', fact_extraction_error: msg,
      }).eq('uploaded_file_id', uploadedFileId);
      return { ok: false, error: msg };
    }
  }

  if (!facts) {
    await supabase.from('file_text_extractions').update({
      fact_extraction_status: 'failed', fact_extraction_error: 'Unparseable Claude response',
    }).eq('uploaded_file_id', uploadedFileId);
    return { ok: false, error: 'Parse failed' };
  }

  const mergedFlags = Array.isArray((facts as { flags?: unknown }).flags)
    ? [...new Set([...((facts as { flags: string[] }).flags), ...scanFlags])]
    : scanFlags;

  const enriched = {
    ...facts,
    flags: mergedFlags,
    category,
    file_name: fileName,
    extracted_at: new Date().toISOString(),
    text_truncated: textTruncated,
    document_dates: sanitizeDocumentDates(facts.document_dates),
    referenced_documents: sanitizeReferencedDocuments(facts.referenced_documents),
    communication_parties: sanitizeCommunicationParties(facts.communication_parties),
    damages_sources: sanitizeDamagesSources(facts.damages_sources),
  };

  const { error: writeErr } = await supabase.from('file_text_extractions').update({
    document_facts: enriched,
    fact_extraction_status: 'completed',
    fact_extraction_error: null,
    extraction_status: 'completed',
    damages_provenance_version: 1,
  }).eq('uploaded_file_id', uploadedFileId);

  if (writeErr) return { ok: false, error: writeErr.message };
  return { ok: true, facts: enriched };
}

// ---------------------------------------------------------------------------
// Phase 2b: validate the multi-date array before storage. Shape-checks each
// entry, drops dateless entries, and clears any context label carrying a
// conclusory term (the date itself — a plain fact — is retained). Compact mirror
// of the client-side normalizeDocumentDates banned-vocabulary guard.
// ---------------------------------------------------------------------------
const DOCUMENT_DATE_BANNED = /\b(illegal|unlawful|wrongful|violat|discriminat|retaliat|harassment|proves?|liable|liability|strong case|weak case|valid claim|wage theft|damages|settlement|case value|case score)\b/i;

function sanitizeDocumentDates(raw: unknown): Array<{ date: string; context: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ date: string; context: string }> = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const rawDate = (entry as { date?: unknown }).date;
    const date = typeof rawDate === 'string' ? rawDate.trim() : '';
    if (!date) continue;
    const rawContext = (entry as { context?: unknown }).context;
    let context = typeof rawContext === 'string' ? rawContext.trim() : '';
    if (context && DOCUMENT_DATE_BANNED.test(context)) context = '';
    const key = `${date.toLowerCase()}::${context.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date, context });
    if (out.length >= 12) break;
  }
  return out;
}

// Phase 2b: validate referenced-document mentions before storage. Drops non-strings
// and any reference carrying a conclusory term. Compact mirror of the client-side
// normalizeReferencedDocuments banned-vocabulary guard.
function sanitizeReferencedDocuments(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || trimmed.length > 200) continue;
    if (DOCUMENT_DATE_BANNED.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 12) break;
  }
  return out;
}

// Phase 2b: validate communication parties before storage. Drops malformed/blank
// entries and scrubs any conclusory term from name or role. Mirror of the client-side
// normalizeCommunicationParties guard.
// Phase 2c: keep only verbatim wage-field source snippets. Drops non-strings, blanks,
// over-long entries, and any snippet carrying a conclusory term (the snippet is a plain
// quotation; if it trips the banned-vocab guard we omit it rather than risk conclusory copy).
function sanitizeDamagesSources(raw: unknown): {
  pay_rate?: string;
  overtime_hours?: string;
  overtime_rate?: string;
  missed_breaks?: string;
} {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  const allowed = ['pay_rate', 'overtime_hours', 'overtime_rate', 'missed_breaks'] as const;
  for (const key of allowed) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (!trimmed || trimmed.length > 200) continue;
    if (DOCUMENT_DATE_BANNED.test(trimmed)) continue;
    out[key] = trimmed;
  }
  return out;
}

function sanitizeCommunicationParties(raw: unknown): Array<{ name: string; role: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ name: string; role: string }> = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const rawName = (entry as { name?: unknown }).name;
    const rawRole = (entry as { role?: unknown }).role;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name || name.length > 120 || DOCUMENT_DATE_BANNED.test(name)) continue;
    let role = typeof rawRole === 'string' ? rawRole.trim() : '';
    if (role.length > 80 || DOCUMENT_DATE_BANNED.test(role)) role = '';
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, role });
    if (out.length >= 12) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Category normalizer — maps DB category values to CATEGORY_GUIDANCE keys
// ---------------------------------------------------------------------------
function normalizeCategory(raw: string, fileName = ''): string {
  // FILENAME-FIRST classification. Mirrors the client's attorneyCategoryLabel
  // (locked by documentClassificationContract.test.ts) so the extraction guidance
  // the server picks can't drift from the attorney-facing label. The stored DB
  // `category` is only a fallback — a descriptive filename is the stronger signal
  // and was previously ignored here, which is the root of the mislabel family
  // (a written warning guided as payroll, a paycheck as an HR complaint, etc.).
  // CamelCase is split BEFORE lowercasing ("WrittenWarning" -> "written warning"),
  // separators collapsed, and the string padded so the ( |$) word-boundary checks fire.
  const f = ' ' + fileName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').toLowerCase() + ' ';
  if (/witness statement/.test(f)) return 'Witness Statement';
  if (/written warning|final warning|write ?up|disciplin/.test(f)) return 'Performance / discipline records';
  if (/terminat/.test(f) && !/terminat.*review/.test(f)) return 'Separation Records';
  if (/complaint to hr|hr complaint|complaint hr|complaint to supervisor|complaint supervisor/.test(f)) return 'Workplace Communications';
  if (/project removal|coaching memo/.test(f)) return 'Performance / discipline records';
  // Separation BEFORE payroll so "final paycheck" reads as separation, not pay.
  if (/severance|separation|layoff|laid off|resignation|resign|final pay|final paycheck/.test(f)) return 'Separation Records';
  if (/pay ?stub|paycheck|payroll|wage statement|earnings statement|wage record|pay record/.test(f)) return 'Pay Records / Payroll';
  // A bare statement/declaration/affidavit (not a bank/income/pay statement) is a worker/coworker account.
  if (/(^| )(statement|declaration|affidavit)( |$)/.test(f) && !/bank|income|financial|account/.test(f)) return 'Witness Statement';

  // Fallback: the stored DB category string (previous behavior).
  const c = raw.trim().toLowerCase();
  if (c.includes('workplace') || c.includes('communication') || c.includes('hr complaint') || c.includes('email')) return 'Workplace Communications';
  if (c.includes('discipline') || c.includes('disciplinary') || c.includes('performance') || c.includes('warning')) return 'Performance / discipline records';
  if (c.includes('separation') || c.includes('termination') || c.includes('final pay')) return 'Separation Records';
  if (c.includes('offer') || c.includes('onboarding')) return 'Offer Letters';
  if (c.includes('pay') || c.includes('payroll') || c.includes('paystub') || c.includes('wage')) return 'Pay Records / Payroll';
  if (c.includes('meal') || c.includes('break') || c.includes('rest period') || c.includes('timekeeping')) return 'Meal & Rest Period Records';
  if (c.includes('schedule') || c.includes('scheduling') || c.includes('shift')) return 'Schedules';
  if (c.includes('witness') || c.includes('coworker') || c.includes('statement')) return 'Witness Statement';
  return raw || 'General';
}

// ---------------------------------------------------------------------------
// Helper: resolve file_path from uploaded_files
// ---------------------------------------------------------------------------
async function resolveFilePath(supabase: ReturnType<typeof createClient>, uploadedFileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('uploaded_files')
    .select('file_path')
    .eq('id', uploadedFileId)
    .maybeSingle();
  return typeof data?.file_path === 'string' && data.file_path.trim() ? data.file_path.trim() : null;
}
