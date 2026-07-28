import { supabase } from '../lib/supabaseClient';

/**
 * Records-request log — WORKER-OWNED, worker-sent.
 *
 * The worker requests copies of THEIR OWN employment records (personnel file, pay records, time
 * records, documents they signed). one3seven COMPOSES the plain-language request and KEEPS A DATED
 * RECORD of it — the worker SENDS it themselves (their own email). one3seven is the composer +
 * record-keeper, never the sender/agent and never a drafter of legal demands.
 *
 * DOCTRINE: pre-representation, the worker exercising their own right to their own records — plain
 * language, no legal argument, no statute citations in the sent text (statute-citation templates
 * are a counsel-gated enhancement). `sentAt` is the worker's own "I sent this on X" mark — self-
 * evidence, NOT certified proof of service (one3seven is not the channel). POST-representation,
 * records-gathering is the attorney's discovery role → gate any post-rep use behind firm authorization.
 *
 * Storage: an `--- O3S_RECORDS_REQUEST_LOG ---` JSON block in `intake_summaries.overview` (same
 * migration-free, worker-writable pattern as the mitigation log; the generic O3S-block stripper
 * keeps it out of firm-facing prose).
 */

export type RecordType = 'personnel_file' | 'pay_records' | 'time_records' | 'signed_documents';

export const RECORD_TYPES: readonly RecordType[] = ['personnel_file', 'pay_records', 'time_records', 'signed_documents'];

export interface RecordsRequestEntry {
  id: string;
  recordTypes: RecordType[];
  /** Who the worker addressed the request to (e.g. an HR email). */
  recipient: string;
  /** Worker's own "I sent this on X" timestamp (ISO). Self-evidence, not proof of service. */
  sentAt: string;
  /** Optional: when the worker marks a response received (ISO). */
  responseReceivedAt?: string;
}

const BLOCK_RE = /\n?--- O3S_RECORDS_REQUEST_LOG ---\n([\s\S]*?)\n--- O3S_RECORDS_REQUEST_LOG_END ---\n?/;

function isEntry(v: unknown): v is RecordsRequestEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    Array.isArray(e.recordTypes) &&
    (e.recordTypes as unknown[]).every((t) => (RECORD_TYPES as readonly string[]).includes(t as string)) &&
    typeof e.recipient === 'string' &&
    typeof e.sentAt === 'string'
  );
}

export function extractRecordsRequests(overview: string | null | undefined): RecordsRequestEntry[] {
  const m = (overview ?? '').match(BLOCK_RE);
  if (!m?.[1]) return [];
  try {
    const parsed = JSON.parse(m[1]) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function stripRecordsRequestBlock(overview: string): string {
  return (overview ?? '').replace(BLOCK_RE, '\n').replace(/\n{3,}/g, '\n\n');
}

export function buildRecordsRequestBlock(entries: RecordsRequestEntry[]): string {
  if (!entries.length) return '';
  return `--- O3S_RECORDS_REQUEST_LOG ---\n${JSON.stringify(entries)}\n--- O3S_RECORDS_REQUEST_LOG_END ---`;
}

export function mergeRecordsRequestsIntoOverview(overview: string, entries: RecordsRequestEntry[]): string {
  const base = stripRecordsRequestBlock(overview ?? '').replace(/\s+$/u, '');
  const block = buildRecordsRequestBlock(entries);
  if (!block) return base;
  return base ? `${base}\n${block}\n` : `${block}\n`;
}

async function latestSummaryRow(intakeId: string) {
  return supabase
    .from('intake_summaries')
    .select('id, overview')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function loadRecordsRequests(
  intakeId: string
): Promise<{ entries: RecordsRequestEntry[]; error?: string }> {
  const { data, error } = await latestSummaryRow(intakeId);
  if (error) return { entries: [], error: error.message };
  return { entries: extractRecordsRequests((data?.overview as string | null) ?? '') };
}

export async function saveRecordsRequests(
  intakeId: string,
  entries: RecordsRequestEntry[]
): Promise<{ error?: string }> {
  const { data: row, error } = await latestSummaryRow(intakeId);
  if (error) return { error: error.message };
  if (!row) return { error: 'Your intake summary isn’t ready yet — add your story first, then your records requests will save here.' };
  const next = mergeRecordsRequestsIntoOverview((row.overview as string | null) ?? '', entries);
  const { error: up } = await supabase.from('intake_summaries').update({ overview: next }).eq('id', row.id as string);
  return up ? { error: up.message } : {};
}
