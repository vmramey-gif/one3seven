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
};

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
  const finalPayPresent = paystubs.some((p) => p.flags?.includes('final_pay'));

  // Witness corroboration
  const coworkerCorroboration = witness.flatMap((w) => w.events_corroborated ?? []);

  // Key quotes
  const keyQuotes: IntakeIntelligence['keyQuotes'] = files
    .filter((f) => f.document_facts?.key_quote)
    .map((f) => ({
      category: f.category || f.document_facts!.category,
      file_name: f.file_name,
      quote: f.document_facts!.key_quote!,
      confidence: f.document_facts!.confidence,
    }));

  // All flags across documents
  const allFlags = [...new Set(files.flatMap((f) => f.document_facts?.flags ?? []))];

  // Items requiring confirmation
  const confirmationNeeded: string[] = [];
  if (!confirmedStartDate) confirmationNeeded.push('Employment start date not confirmed by documents.');
  if (!confirmedComplaintDate) confirmationNeeded.push('HR complaint date not confirmed by documents.');
  if (!confirmedTerminationReason) confirmationNeeded.push('Employer-stated reason for termination not yet extracted.');
  if (!confirmedWarningReason) confirmationNeeded.push('Employer-stated reason for written warning not yet extracted.');
  if (overtimeIssueDetected) confirmationNeeded.push('Overtime hours recorded without matching overtime rate — payroll review required.');
  if (mealBreaks.some((m) => m.flags?.includes('missed_breaks_recorded'))) {
    confirmationNeeded.push('Meal-break log shows missed breaks — count and dates require review.');
  }
  if (allFlags.includes('post_termination_statement')) {
    confirmationNeeded.push('Coworker statement is dated after termination — confirm independence from the claim.');
  }

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
  };
}
