import { supabase } from '../lib/supabaseClient';

/**
 * Mitigation (job-search) log — WORKER-OWNED.
 *
 * Every wrongful-termination case's damages turn on mitigation (the worker's duty to look for
 * comparable work), and plaintiffs document it terribly. This preserves the worker's own record of
 * that search so it isn't reconstructed from memory later.
 *
 * DOCTRINE (hard line): this COUNTS and ORGANIZES — it NEVER scores adequacy, sets a target, or
 * judges whether the search is "enough." Whether mitigation is sufficient is a legal-adequacy call
 * (UPL + an anxiety engine for the worker); the FIRM sets any expectation, not the tool. So the
 * entry shape carries NO score / target / goal / adequacy field, by design. `outcome` is the
 * factual status of one application (applied, interview, …) — a fact about the record, never a
 * judgment of the worker.
 *
 * Storage: an `--- O3S_MITIGATION_LOG ---` JSON block inside `intake_summaries.overview` — the same
 * migration-free, worker-writable pattern as the story follow-up. The generic O3S-block stripper in
 * firmIntakeDisplay (`stripFirmFacingArtifacts`) keeps the raw block out of firm-facing prose; a
 * structured firm-side view is a later slice.
 */

export type MitigationOutcome =
  | 'applied'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'declined'
  | 'no_response';

export interface MitigationLogEntry {
  id: string;
  /** Date the worker applied / took the action (worker-entered, e.g. "2026-07-20"). */
  date: string;
  employer: string;
  role: string;
  outcome: MitigationOutcome;
  notes?: string;
  /** When the entry was logged (ISO timestamp). */
  loggedAt: string;
}

const BLOCK_RE = /\n?--- O3S_MITIGATION_LOG ---\n([\s\S]*?)\n--- O3S_MITIGATION_LOG_END ---\n?/;

const OUTCOMES: readonly MitigationOutcome[] = ['applied', 'interview', 'offer', 'hired', 'declined', 'no_response'];

function isEntry(v: unknown): v is MitigationLogEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.date === 'string' &&
    typeof e.employer === 'string' &&
    typeof e.role === 'string' &&
    typeof e.outcome === 'string' &&
    (OUTCOMES as readonly string[]).includes(e.outcome) &&
    typeof e.loggedAt === 'string'
  );
}

export function extractMitigationLog(overview: string | null | undefined): MitigationLogEntry[] {
  const m = (overview ?? '').match(BLOCK_RE);
  if (!m?.[1]) return [];
  try {
    const parsed = JSON.parse(m[1]) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function stripMitigationLogBlock(overview: string): string {
  return (overview ?? '').replace(BLOCK_RE, '\n').replace(/\n{3,}/g, '\n\n');
}

export function buildMitigationLogBlock(entries: MitigationLogEntry[]): string {
  if (!entries.length) return '';
  return `--- O3S_MITIGATION_LOG ---\n${JSON.stringify(entries)}\n--- O3S_MITIGATION_LOG_END ---`;
}

export function mergeMitigationLogIntoOverview(overview: string, entries: MitigationLogEntry[]): string {
  const base = stripMitigationLogBlock(overview ?? '').replace(/\s+$/u, '');
  const block = buildMitigationLogBlock(entries);
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

export async function loadMitigationLog(
  intakeId: string
): Promise<{ entries: MitigationLogEntry[]; error?: string }> {
  const { data, error } = await latestSummaryRow(intakeId);
  if (error) return { entries: [], error: error.message };
  return { entries: extractMitigationLog((data?.overview as string | null) ?? '') };
}

/** Read-modify-write the worker's own summary overview (same path as the story follow-up). */
export async function saveMitigationLog(
  intakeId: string,
  entries: MitigationLogEntry[]
): Promise<{ error?: string }> {
  const { data: row, error } = await latestSummaryRow(intakeId);
  if (error) return { error: error.message };
  if (!row) return { error: 'Your intake summary isn’t ready yet — add your story first, then your job-search record will save here.' };
  const next = mergeMitigationLogIntoOverview((row.overview as string | null) ?? '', entries);
  const { error: up } = await supabase.from('intake_summaries').update({ overview: next }).eq('id', row.id as string);
  return up ? { error: up.message } : {};
}
