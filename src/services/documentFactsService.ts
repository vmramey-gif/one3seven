/**
 * Phase 2B: Client-side interface for document fact extraction.
 * Triggers the edge function and reads stored facts for display.
 */

import { supabase } from '../lib/supabaseClient';

export type DocumentFacts = {
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
  /** Phase 2b: every explicitly-stated date in the document, each with a short context label. */
  document_dates?: import('./documentDateExtraction').DocumentDate[];
  /** Phase 2b: documents this file explicitly references (may not themselves be uploaded). */
  referenced_documents?: string[];
  /** Phase 2b: people party to communications in this document, with stated roles. */
  communication_parties?: import('./communicationPartyExtraction').CommunicationParty[];
};

export type FileWithFacts = {
  uploaded_file_id: string;
  file_name: string;
  category: string | null;
  extraction_status: string;
  fact_extraction_status: string | null;
  document_facts: DocumentFacts | null;
};

// ---------------------------------------------------------------------------
// Trigger fact extraction for a single file
// ---------------------------------------------------------------------------

export async function triggerDocumentFactExtraction(params: {
  uploadedFileId: string;
  intakeId: string;
  category: string;
  fileName: string;
  filePath?: string;
}): Promise<{ ok: boolean; facts?: DocumentFacts; error?: string }> {
  const { data, error } = await supabase.functions.invoke('extract-document-facts', {
    body: {
      uploaded_file_id: params.uploadedFileId,
      intake_id: params.intakeId,
      category: params.category,
      file_name: params.fileName,
      file_path: params.filePath,
    },
  });

  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, facts: data?.facts };
}

// ---------------------------------------------------------------------------
// Trigger extraction for all files in an intake that haven't been processed yet
// ---------------------------------------------------------------------------

/**
 * Batch extraction: sends a single request to the edge function with just the intake_id.
 * The edge function looks up all files via service role (bypasses RLS) and processes each.
 */
export async function triggerIntakeFactExtraction(
  intakeId: string,
  _files?: unknown[] // kept for API compatibility, not used in batch mode
): Promise<{ triggered: number; skipped: number; errors: string[] }> {
  const { data, error } = await supabase.functions.invoke('extract-document-facts', {
    body: { intake_id: intakeId, batch: true },
  });

  console.log('[o3s-extraction] invoke response:', { data, error });

  if (error) return { triggered: 0, skipped: 0, errors: [error.message] };
  if (data?.error) return { triggered: 0, skipped: 0, errors: [data.error] };

  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    triggered: data?.processed ?? 0,
    skipped: data?.skipped ?? 0,
    errors: results
      .filter((r: any) => r && !r.ok)
      .map((r: any) => `${r.file ?? 'unknown'}: ${r.error ?? 'unknown error'}`),
  };
}

// ---------------------------------------------------------------------------
// Read facts for all files in an intake (firm-side)
// ---------------------------------------------------------------------------

export async function loadIntakeDocumentFacts(
  intakeId: string
): Promise<{ facts: FileWithFacts[]; error?: string }> {
  // Join file_text_extractions with uploaded_files for metadata
  const { data, error } = await supabase
    .from('file_text_extractions')
    .select(`
      uploaded_file_id,
      extraction_status,
      fact_extraction_status,
      document_facts,
      uploaded_files!inner (
        file_name,
        category,
        intake_id
      )
    `)
    .eq('intake_id', intakeId)
    .eq('extraction_status', 'completed')
    .not('document_facts', 'is', null);

  if (error) return { facts: [], error: error.message };

  const facts: FileWithFacts[] = (data ?? []).map((row: any) => ({
    uploaded_file_id: row.uploaded_file_id,
    file_name: row.uploaded_files?.file_name ?? '',
    category: row.uploaded_files?.category ?? null,
    extraction_status: row.extraction_status,
    fact_extraction_status: row.fact_extraction_status,
    document_facts: row.document_facts as DocumentFacts | null,
  }));

  return { facts };
}

// ---------------------------------------------------------------------------
// Synthesize intake-level intelligence from all document facts
// ---------------------------------------------------------------------------

export type IntakeIntelligence = {
  // Confirmed facts (present in documents)
  confirmedEmployer: string | null;
  confirmedStartDate: string | null;
  confirmedTerminationDate: string | null;
  confirmedTerminationReason: string | null;
  confirmedComplaintTopic: string | null;
  confirmedComplaintDate: string | null;
  confirmedHrResponseSummary: string | null;
  confirmedWarningReason: string | null;
  confirmedWarningDate: string | null;
  // Timing intervals (days between key events)
  timingIntervals: Array<{ label: string; days: number; description: string }>;
  // Payroll flags
  overtimeIssueDetected: boolean;
  finalPayPresent: boolean;
  // Witness
  coworkerCorroboration: string[];
  // Key quotes per document category
  keyQuotes: Array<{ category: string; file_name: string; quote: string; confidence: string }>;
  // Flags across all documents
  allFlags: string[];
  // Items requiring confirmation
  confirmationNeeded: string[];
  // Phase 2a: deterministic clarification questions (template-based, from known gaps)
  clarificationQuestions: string[];
};

/**
 * Phase 2a Clarification Engine (deterministic, no LLM).
 * Generates safe, template-based questions from signals already detected.
 * Stays inside the one3seven rule book: organize, source-link, separate
 * worker-reported from documented, flag unclear areas — never conclude.
 */
function buildClarificationQuestions(input: {
  distinctEmployers: string[];
  confirmedComplaintTopic: string | null;
  confirmedComplaintDate: string | null;
  confirmedHrResponseSummary: string | null;
  confirmedStartDate: string | null;
  confirmedTerminationDate: string | null;
  finalPayPresent: boolean;
  overtimeIssueDetected: boolean;
  hasComplaintRecord: boolean;
  hasSeparationRecord: boolean;
  hasOffer: boolean;
  hasWitness: boolean;
  missedBreaksRecorded: boolean;
}): string[] {
  const q: string[] = [];

  if (input.distinctEmployers.length > 1) {
    q.push(`The records show more than one employer name (${input.distinctEmployers.join(', ')}). Which name appears on your paystub or offer letter?`);
  }
  if (input.confirmedComplaintTopic && !input.confirmedHrResponseSummary) {
    q.push('The records include a workplace concern but do not show who received it or how it was handled. Who did you report it to?');
  }
  if ((input.hasComplaintRecord || input.confirmedComplaintTopic) && !input.confirmedComplaintDate) {
    q.push('A workplace concern is noted but its date is not clear in the records. When did you first raise it?');
  }
  if (input.hasSeparationRecord && !input.finalPayPresent) {
    // A separation record is already present — ask only for the genuinely-missing final pay,
    // not for the termination letter (which is what hasSeparationRecord means is uploaded).
    q.push('A separation is documented, but a final paystub for that period was not detected. Do you have the final paystub or wage statement to upload?');
  }
  if (!input.confirmedStartDate && !input.hasOffer) {
    q.push('The records do not yet show an employment start date. Do you have an offer letter or an early paystub that shows when you started?');
  }
  if (input.overtimeIssueDetected) {
    q.push('Pay records show overtime hours without a matching overtime rate. Do you have additional paystubs or wage statements for those periods?');
  }
  if (input.missedBreaksRecorded) {
    q.push('Break records show missed or short breaks. Do you have time records or schedules for the same dates?');
  }
  if (!input.hasWitness && input.confirmedComplaintTopic && (input.hasSeparationRecord || input.confirmedTerminationDate)) {
    q.push('No coworker statement is in the records. Is there anyone who saw what happened who could share what they observed?');
  }

  return q.slice(0, 6);
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

function timingLabel(days: number, eventName: string): string {
  if (days === 0) return `${eventName}: same day as complaint`;
  if (days < 30) return `${eventName}: ${days} days after complaint`;
  const months = Math.round(days / 30.4);
  return `${eventName}: approximately ${months} month${months === 1 ? '' : 's'} after complaint`;
}

export function synthesizeIntakeIntelligence(files: FileWithFacts[]): IntakeIntelligence {
  const byCategory = new Map<string, DocumentFacts[]>();
  for (const f of files) {
    if (!f.document_facts) continue;
    const cat = (f.category || f.document_facts.category || 'General').toLowerCase();
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), f.document_facts]);
  }

  const get = (cat: string) => byCategory.get(cat) ?? [];

  const communications = get('workplace communications');
  const warnings = get('performance / discipline records');
  const separation = get('separation records');
  const offers = get('offer letters');
  const paystubs = get('pay records / payroll');
  const mealBreaks = get('meal & rest period records');
  const witness = get('witness statement');
  const schedules = get('schedules');

  // Confirmed facts
  const confirmedEmployer =
    offers[0]?.employer_name ??
    separation[0]?.employer_name ??
    warnings[0]?.employer_name ??
    null;

  const confirmedStartDate = offers[0]?.start_date ?? null;

  const termDoc = separation[0];
  const confirmedTerminationDate = termDoc?.document_date ?? null;
  const confirmedTerminationReason = termDoc?.stated_reason ?? null;

  const complaintDoc = communications.find((c) => c.complaint_topic || c.complaint_date);
  const confirmedComplaintTopic = complaintDoc?.complaint_topic ?? null;
  const confirmedComplaintDate = complaintDoc?.complaint_date ?? complaintDoc?.document_date ?? null;

  const responseDoc = communications.find((c) => c.resolution_summary);
  const confirmedHrResponseSummary = responseDoc?.resolution_summary ?? null;

  const warningDoc = warnings[0];
  const confirmedWarningReason = warningDoc?.stated_reason ?? null;
  const confirmedWarningDate = warningDoc?.document_date ?? null;

  // Timing intervals from complaint date
  const complaintDate = parseDate(confirmedComplaintDate);
  const timingIntervals: IntakeIntelligence['timingIntervals'] = [];

  if (complaintDate) {
    const hrResponseDate = parseDate(responseDoc?.document_date ?? null);
    if (hrResponseDate && hrResponseDate > complaintDate) {
      const days = daysBetween(complaintDate, hrResponseDate);
      timingIntervals.push({ label: 'HR response', days, description: timingLabel(days, 'HR response') });
    }
    const scheduleDate = parseDate(schedules[0]?.document_date ?? schedules[0]?.effective_date ?? null);
    if (scheduleDate && scheduleDate > complaintDate) {
      const days = daysBetween(complaintDate, scheduleDate);
      timingIntervals.push({ label: 'Schedule change', days, description: timingLabel(days, 'Schedule change') });
    }
    const warningDate = parseDate(confirmedWarningDate);
    if (warningDate && warningDate > complaintDate) {
      const days = daysBetween(complaintDate, warningDate);
      timingIntervals.push({ label: 'Written warning', days, description: timingLabel(days, 'Written warning') });
    }
    const termDate = parseDate(confirmedTerminationDate);
    if (termDate && termDate > complaintDate) {
      const days = daysBetween(complaintDate, termDate);
      timingIntervals.push({ label: 'Termination', days, description: timingLabel(days, 'Termination') });
    }
  }

  // Payroll flags
  const overtimeIssueDetected = paystubs.some(
    (p) => p.flags?.includes('overtime_rate_missing') ||
      (p.overtime_hours && parseFloat(p.overtime_hours) > 0 && !p.overtime_rate)
  );
  // Detect a final paystub regardless of how it was categorized — final-pay docs are
  // often filed under Separation Records, not Pay Records, so a Pay-Records-only check
  // misses them and causes "do you have a final paystub?" to fire when one is present.
  const finalPayPresent = files.some(
    (f) =>
      f.document_facts?.flags?.includes('final_pay') ||
      /final[\s_]?pay(stub|check)?/i.test(f.file_name || ''),
  );

  // Witness corroboration
  const coworkerCorroboration = witness.flatMap((w) => w.events_corroborated ?? []);

  // Key quotes
  const keyQuotes: IntakeIntelligence['keyQuotes'] = files
    .filter((f) => f.document_facts?.key_quote)
    .map((f) => ({
      // Prefer a real category; fall back to the facts' category before "Uncategorized"
      // so the key-quote label matches the Supporting Records list (no split identity).
      category:
        f.category && f.category !== 'Uncategorized'
          ? f.category
          : f.document_facts!.category || f.category || 'Uncategorized',
      file_name: f.file_name,
      quote: f.document_facts!.key_quote!,
      confidence: f.document_facts!.confidence,
    }));

  // All flags across documents
  const allFlags = [...new Set(files.flatMap((f) => f.document_facts?.flags ?? []))];

  // Items requiring confirmation
  const confirmationNeeded: string[] = [];
  // A quote from the relevant document already surfaces the reason for review — don't
  // then ask the firm to confirm something the packet has already shown.
  const hasSeparationQuote = keyQuotes.some((q) => /separation|termination/i.test(q.category));
  const hasWarningQuote = keyQuotes.some((q) => /discipline|warning|performance/i.test(q.category));
  if (!confirmedStartDate) confirmationNeeded.push('Employment start date not confirmed by documents.');
  if (!confirmedComplaintDate) confirmationNeeded.push('HR complaint date not confirmed by documents.');
  if (!confirmedTerminationReason && !hasSeparationQuote) confirmationNeeded.push('Employer-stated reason for termination not yet extracted.');
  if (!confirmedWarningReason && !hasWarningQuote) confirmationNeeded.push('Employer-stated reason for written warning not yet extracted.');
  if (overtimeIssueDetected) confirmationNeeded.push('Overtime hours recorded without matching overtime rate — payroll review required.');
  if (mealBreaks.some((m) => m.flags?.includes('missed_breaks_recorded'))) {
    confirmationNeeded.push('Meal-break log shows missed breaks — count and dates require review.');
  }
  if (allFlags.includes('post_termination_statement')) {
    confirmationNeeded.push('Coworker statement is dated after termination — confirm independence from the claim.');
  }

  // ── Cross-document consistency (neutral — surfaced for attorney verification only) ──
  const distinctEmployers = [
    ...new Map(
      files
        .map((f) => f.document_facts?.employer_name?.trim())
        .filter((n): n is string => Boolean(n))
        .map((n) => [n.toLowerCase(), n] as const)
    ).values(),
  ];
  // Note: employer-name divergence is surfaced once, as a clarification question
  // (see buildClarificationQuestions). It is intentionally NOT duplicated here.

  const lowConfidenceCount = files.filter((f) => f.document_facts?.confidence === 'low').length;
  if (lowConfidenceCount > 0) {
    confirmationNeeded.push(
      `${lowConfidenceCount} document${lowConfidenceCount === 1 ? '' : 's'} need clarification — review those fields against the source.`
    );
  }

  const truncatedCount = files.filter((f) => f.document_facts?.text_truncated).length;
  if (truncatedCount > 0) {
    confirmationNeeded.push(
      `${truncatedCount === 1 ? 'One document was' : `${truncatedCount} documents were`} long; only the first portion was processed — review the full source for completeness.`
    );
  }

  if (allFlags.includes('reason_may_conflict_with_timeline')) {
    confirmationNeeded.push(
      'Separation reason and complaint date should be reviewed together — confirm the sequence against the source records.'
    );
  }

  const clarificationQuestions = buildClarificationQuestions({
    distinctEmployers,
    confirmedComplaintTopic,
    confirmedComplaintDate,
    confirmedHrResponseSummary,
    confirmedStartDate,
    confirmedTerminationDate,
    finalPayPresent,
    overtimeIssueDetected,
    hasComplaintRecord: communications.length > 0,
    hasSeparationRecord: separation.length > 0,
    hasOffer: offers.length > 0,
    hasWitness: witness.length > 0,
    missedBreaksRecorded: mealBreaks.some((m) => m.flags?.includes('missed_breaks_recorded') || m.flags?.includes('short_breaks_recorded')),
  });

  return {
    confirmedEmployer,
    confirmedStartDate,
    confirmedTerminationDate,
    confirmedTerminationReason,
    confirmedComplaintTopic,
    confirmedComplaintDate,
    confirmedHrResponseSummary,
    confirmedWarningReason,
    confirmedWarningDate,
    timingIntervals,
    overtimeIssueDetected,
    finalPayPresent,
    coworkerCorroboration,
    keyQuotes,
    allFlags,
    confirmationNeeded,
    clarificationQuestions,
  };
}
