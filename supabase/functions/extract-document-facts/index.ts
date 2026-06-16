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

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const BUCKET = 'intake-files';
const MAX_TEXT_CHARS = 12_000;
const MAX_TOKENS = 3000;

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

function buildPdfPrompt(category: string, fileName: string, base64Pdf: string): { role: string; content: unknown }[] {
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
File name: ${fileName}

Reminders: quote verbatim for key_quote (under 200 characters); use null / [] for anything not explicitly present; no legal conclusions; raw JSON only.
Capture EVERY date explicitly stated in the document in "document_dates", each as { "date": "<as written>", "context": "<short factual label, e.g. 'complaint filed', 'warning issued'>" }. Include only dates the text actually states; never infer a date. Keep context labels factual, never conclusory.

CATEGORY-SPECIFIC GUIDANCE:
${guidance}

Return ONLY valid JSON matching this schema — no markdown, no code fences:
${JSON_SCHEMA}`,
      },
    ],
  }];
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
  let lastError = '';

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
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0, // deterministic extraction — reproducible for legal review
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    // Transient errors (rate limit / overloaded) — back off and retry.
    if (response.status === 429 || response.status === 503 || response.status === 529) {
      lastError = `Anthropic API ${response.status} (transient)`;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text ?? '';
    const parsed = parseFacts(content);
    if (parsed) return parsed;

    // Parse failed — at temperature 0 a retry would be identical, so stop here.
    return null;
  }

  throw new Error(lastError || 'Anthropic API call failed after retries');
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
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

    for (const file of allFiles as Array<{ id: string; file_name: string; category: string | null; file_path: string | null; worker_id: string | null }>) {
      if (alreadyDone.has(file.id)) {
        results.push({ file: file.file_name, ok: true });
        continue;
      }
      const result = await processSingleFile({
        supabase,
        apiKey: ANTHROPIC_API_KEY,
        uploadedFileId: file.id,
        intakeId: intake_id,
        workerId: file.worker_id || undefined,
        category: normalizeCategory(file.category || ''),
        fileName: file.file_name,
        filePath: file.file_path || undefined,
      });
      results.push({ file: file.file_name, ok: result.ok, error: result.error });
    }

    const processed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    return new Response(
      JSON.stringify({ ok: true, processed, failed, results }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // ------------------------------------------------------------------
  // SINGLE FILE MODE
  // ------------------------------------------------------------------
  const singleResult = await processSingleFile({
    supabase,
    apiKey: ANTHROPIC_API_KEY,
    uploadedFileId: body.uploaded_file_id!,
    intakeId: intake_id,
    category: normalizeCategory(body.category || ''),
    fileName: body.file_name || '',
    filePath: body.file_path,
  });

  if (!singleResult.ok) {
    return new Response(JSON.stringify({ error: singleResult.error }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, facts: singleResult.facts }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
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

  let messages: unknown[];
  let textTruncated = false;

  if (existingRow?.extraction_status === 'completed' && existingRow?.extracted_text?.trim()) {
    // Phase 2A text is available — use it
    textTruncated = existingRow.extracted_text.length > MAX_TEXT_CHARS;
    messages = buildTextPrompt(category, fileName, existingRow.extracted_text);
  } else {
    // No text layer — download file and send as PDF to Claude
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

    // Chunked base64 encoding — avoids call-stack overflow on large PDFs
    const arrayBuf = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    messages = buildPdfPrompt(category, fileName, base64);
  }

  // Call Claude
  let facts: DocumentFacts | null = null;
  try {
    facts = await callClaude(messages, apiKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from('file_text_extractions').update({
      fact_extraction_status: 'failed', fact_extraction_error: msg,
    }).eq('uploaded_file_id', uploadedFileId);
    return { ok: false, error: msg };
  }

  if (!facts) {
    await supabase.from('file_text_extractions').update({
      fact_extraction_status: 'failed', fact_extraction_error: 'Unparseable Claude response',
    }).eq('uploaded_file_id', uploadedFileId);
    return { ok: false, error: 'Parse failed' };
  }

  const enriched = {
    ...facts,
    category,
    file_name: fileName,
    extracted_at: new Date().toISOString(),
    text_truncated: textTruncated,
    document_dates: sanitizeDocumentDates(facts.document_dates),
  };

  const { error: writeErr } = await supabase.from('file_text_extractions').update({
    document_facts: enriched,
    fact_extraction_status: 'completed',
    fact_extraction_error: null,
    extraction_status: 'completed',
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

// ---------------------------------------------------------------------------
// Category normalizer — maps DB category values to CATEGORY_GUIDANCE keys
// ---------------------------------------------------------------------------
function normalizeCategory(raw: string): string {
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
