/**
 * Supabase Edge Function: get-intake-intelligence
 * Reads document_facts from file_text_extractions (service role, bypasses RLS),
 * synthesizes IntakeIntelligence, and returns it to the firm client.
 *
 * POST body: { intake_id: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // --- Authorization ---
  // Step 1: require a bearer token from the caller.
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }

  // Step 2: resolve caller identity using their JWT (anon key client).
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }

  let body: { intake_id: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  const { intake_id } = body;
  if (!intake_id) {
    return new Response(JSON.stringify({ error: 'intake_id required' }), { status: 400, headers: CORS });
  }

  // Step 3: confirm caller's firm has a full_access route to this intake.
  // Uses service role to query intake_routes (no firm RLS on file_text_extractions,
  // so we enforce access here before touching that table).
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: route, error: routeErr } = await serviceClient
    .from('intake_routes')
    .select('id, route_status')
    .eq('intake_id', intake_id)
    .eq('route_status', 'full_access')
    .in('firm_id', (
      await serviceClient
        .from('firm_profiles')
        .select('id')
        .eq('profile_id', user.id)
        .then(({ data }) => (data ?? []).map((r: any) => r.id))
    ))
    .maybeSingle();

  if (routeErr || !route) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });
  }
  // --- End Authorization ---

  // Read all files + their extracted facts for this intake (service role, post-auth).
  const { data: files, error } = await serviceClient
    .from('uploaded_files')
    .select(`
      id,
      file_name,
      category,
      file_text_extractions (
        document_facts,
        fact_extraction_status
      )
    `)
    .eq('intake_id', intake_id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });

  // Build FileWithFacts array
  const filesWithFacts = (files ?? []).map((f: any) => {
    const exRow = Array.isArray(f.file_text_extractions)
      ? f.file_text_extractions[0]
      : f.file_text_extractions;
    return {
      uploaded_file_id: f.id,
      file_name: f.file_name ?? '',
      category: f.category ?? null,
      extraction_status: exRow?.fact_extraction_status ?? 'pending',
      fact_extraction_status: exRow?.fact_extraction_status ?? null,
      document_facts: (exRow?.fact_extraction_status === 'completed' && exRow?.document_facts)
        ? exRow.document_facts
        : null,
    };
  });

  const hasAnyFacts = filesWithFacts.some((f: any) => f.document_facts !== null);
  if (!hasAnyFacts) {
    return new Response(JSON.stringify({ intelligence: null, hasFacts: false }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const intelligence = synthesize(filesWithFacts);

  return new Response(JSON.stringify({ intelligence, hasFacts: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});

// ---------------------------------------------------------------------------
// Synthesis (mirrors documentFactsService.synthesizeIntakeIntelligence)
// ---------------------------------------------------------------------------

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}
function timingLabel(days: number, name: string): string {
  if (days === 0) return `${name}: same day as complaint`;
  if (days < 30) return `${name}: ${days} days after complaint`;
  const m = Math.round(days / 30.4);
  return `${name}: approximately ${m} month${m === 1 ? '' : 's'} after complaint`;
}

function synthesize(files: any[]): unknown {
  const byCategory = new Map<string, any[]>();
  for (const f of files) {
    if (!f.document_facts) continue;
    const cat = ((f.category || f.document_facts.category || 'General') as string).toLowerCase();
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), f.document_facts]);
  }

  const get = (k: string) => byCategory.get(k) ?? [];
  const communications = get('workplace communications');
  const warnings = get('performance / discipline records');
  const separation = get('separation records');
  const offers = get('offer letters');
  const paystubs = get('pay records / payroll');
  const mealBreaks = get('meal & rest period records');
  const witness = get('witness statement');
  const schedules = get('schedules');

  const confirmedEmployer =
    offers[0]?.employer_name ?? separation[0]?.employer_name ?? warnings[0]?.employer_name ?? null;
  const confirmedStartDate = offers[0]?.start_date ?? null;
  const termDoc = separation[0];
  const confirmedTerminationDate = termDoc?.document_date ?? null;
  const confirmedTerminationReason = termDoc?.stated_reason ?? null;
  const complaintDoc = communications.find((c: any) => c.complaint_topic || c.complaint_date);
  const confirmedComplaintTopic = complaintDoc?.complaint_topic ?? null;
  const confirmedComplaintDate = complaintDoc?.complaint_date ?? complaintDoc?.document_date ?? null;
  const responseDoc = communications.find((c: any) => c.resolution_summary);
  const confirmedHrResponseSummary = responseDoc?.resolution_summary ?? null;
  const warningDoc = warnings[0];
  const confirmedWarningReason = warningDoc?.stated_reason ?? null;
  const confirmedWarningDate = warningDoc?.document_date ?? null;

  const complaintDate = parseDate(confirmedComplaintDate);
  const timingIntervals: any[] = [];
  if (complaintDate) {
    const hrDate = parseDate(responseDoc?.document_date ?? null);
    if (hrDate && hrDate > complaintDate) {
      const d = daysBetween(complaintDate, hrDate);
      timingIntervals.push({ label: 'HR response', days: d, description: timingLabel(d, 'HR response') });
    }
    const schedDate = parseDate(schedules[0]?.document_date ?? schedules[0]?.effective_date ?? null);
    if (schedDate && schedDate > complaintDate) {
      const d = daysBetween(complaintDate, schedDate);
      timingIntervals.push({ label: 'Schedule change', days: d, description: timingLabel(d, 'Schedule change') });
    }
    const warnDate = parseDate(confirmedWarningDate);
    if (warnDate && warnDate > complaintDate) {
      const d = daysBetween(complaintDate, warnDate);
      timingIntervals.push({ label: 'Written warning', days: d, description: timingLabel(d, 'Written warning') });
    }
    const termDate = parseDate(confirmedTerminationDate);
    if (termDate && termDate > complaintDate) {
      const d = daysBetween(complaintDate, termDate);
      timingIntervals.push({ label: 'Termination', days: d, description: timingLabel(d, 'Termination') });
    }
  }

  const overtimeIssueDetected = paystubs.some(
    (p: any) => p.flags?.includes('overtime_rate_missing') ||
      (p.overtime_hours && parseFloat(p.overtime_hours) > 0 && !p.overtime_rate)
  );
  const finalPayPresent = paystubs.some((p: any) => p.flags?.includes('final_pay'));
  const coworkerCorroboration = witness.flatMap((w: any) => w.events_corroborated ?? []);

  const keyQuotes = files
    .filter((f: any) => f.document_facts?.key_quote)
    .map((f: any) => ({
      category: f.category || f.document_facts.category,
      file_name: f.file_name,
      quote: f.document_facts.key_quote,
      confidence: f.document_facts.confidence,
    }));

  const allFlags = [...new Set(files.flatMap((f: any) => f.document_facts?.flags ?? []))];

  const confirmationNeeded: string[] = [];
  if (!confirmedStartDate) confirmationNeeded.push('Employment start date not confirmed by documents.');
  if (!confirmedComplaintDate) confirmationNeeded.push('HR complaint date not confirmed by documents.');
  if (!confirmedTerminationReason) confirmationNeeded.push('Employer-stated reason for termination not yet extracted.');
  if (!confirmedWarningReason) confirmationNeeded.push('Employer-stated reason for written warning not yet extracted.');
  if (overtimeIssueDetected) confirmationNeeded.push('Overtime hours recorded without matching overtime rate — payroll review required.');
  if (mealBreaks.some((m: any) => m.flags?.includes('missed_breaks_recorded'))) {
    confirmationNeeded.push('Meal-break log shows missed breaks — count and dates require review.');
  }
  if (allFlags.includes('post_termination_statement')) {
    confirmationNeeded.push('Coworker statement is dated after termination — confirm independence from the claim.');
  }

  // ── Cross-document consistency (neutral — surfaced for attorney verification only) ──
  const distinctEmployers = [
    ...new Map(
      files
        .map((f: any) => f.document_facts?.employer_name?.trim())
        .filter((n: any): n is string => Boolean(n))
        .map((n: string) => [n.toLowerCase(), n] as const)
    ).values(),
  ];
  if (distinctEmployers.length > 1) {
    confirmationNeeded.push(
      `Employer name differs across documents (${distinctEmployers.join(' vs ')}) — confirm which employer name is correct.`
    );
  }

  const lowConfidenceCount = files.filter((f: any) => f.document_facts?.confidence === 'low').length;
  if (lowConfidenceCount > 0) {
    confirmationNeeded.push(
      `${lowConfidenceCount} document${lowConfidenceCount === 1 ? '' : 's'} produced low-confidence extractions — review those fields against the source.`
    );
  }

  const truncatedCount = files.filter((f: any) => f.document_facts?.text_truncated).length;
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
