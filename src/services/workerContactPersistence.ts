import { supabase } from '../lib/supabaseClient';

/**
 * Worker contact (name + phone) delivery to firms.
 *
 * Privacy model: the worker's contact details live only in their own profile until
 * they choose to SHARE an intake with a firm. At that consent moment we copy name/phone
 * into the firm-readable `intake_summaries.overview` as a hidden block. The firm view
 * extracts it (see loadFirmLiveIntakeView) and surfaces it on the packet cover; the raw
 * block is stripped from all display prose by sanitizeFirmFacingText. No firm ever reads
 * the worker's profile row directly, so no cross-table RLS surface is opened.
 */

export type WorkerContact = {
  name: string | null;
  phone: string | null;
};

const WORKER_CONTACT_BLOCK_RE =
  /\n?--- O3S_WORKER_CONTACT ---\n([\s\S]*?)\n--- O3S_WORKER_CONTACT_END ---\n?/;

function parseContactLine(body: string, key: string): string {
  const re = new RegExp(`^${key}:(.*)$`, 'm');
  return body.match(re)?.[1]?.trim() ?? '';
}

export function extractWorkerContactFromOverview(
  overview: string | null | undefined
): WorkerContact | null {
  const m = (overview ?? '').match(WORKER_CONTACT_BLOCK_RE);
  if (!m?.[1]) return null;
  const name = parseContactLine(m[1], 'name');
  const phone = parseContactLine(m[1], 'phone');
  if (!name && !phone) return null;
  return { name: name || null, phone: phone || null };
}

export function stripWorkerContactBlock(overview: string): string {
  return overview.replace(WORKER_CONTACT_BLOCK_RE, '');
}

function buildWorkerContactBlock(contact: WorkerContact): string {
  const lines: string[] = [];
  const name = (contact.name ?? '').trim().replace(/\n/g, ' ');
  const phone = (contact.phone ?? '').trim().replace(/\n/g, ' ');
  if (name) lines.push(`name:${name}`);
  if (phone) lines.push(`phone:${phone}`);
  if (!lines.length) return '';
  return `--- O3S_WORKER_CONTACT ---\n${lines.join('\n')}\n--- O3S_WORKER_CONTACT_END ---`;
}

/**
 * Copy the worker's contact into the latest intake summary so a firm they shared with
 * can see it on the packet. Called at the share/approve consent moment. Idempotent —
 * replaces any prior block. No-op when there is no name/phone or no summary row yet.
 */
export async function mergeWorkerContactIntoLatestIntakeSummary(
  intakeId: string,
  contact: WorkerContact
): Promise<{ error?: string }> {
  const block = buildWorkerContactBlock(contact);
  if (!block) return {};

  const { data: row, error } = await supabase
    .from('intake_summaries')
    .select('id, overview')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return {};

  const overview = (row.overview as string | null) ?? '';
  const base = stripWorkerContactBlock(overview).replace(/\s+$/u, '');
  const next = base ? `${base}\n${block}` : block;

  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}
