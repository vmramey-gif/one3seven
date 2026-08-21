/**
 * Post-intake activity tracking: per-file provenance verification (content-hash + upload
 * timestamp), the in-app persistent notification feed, and firm-route event logging
 * (first_opened/accepted/declined, for CRM analytics). Extracted 2026-08-21 from
 * intakeDataService.ts (PR4, seam 2 -- the smallest, most self-contained remaining domain: zero
 * reverse dependencies from the rest of that file). Pure move, no behavior change.
 */
import { supabase } from '../lib/supabaseClient';
import * as notifications from './notificationService';
import { isSchemaRelationUnavailable } from './intakeDataService';
import { withProfileQueryTimeout, PROFILE_QUERY_TIMEOUT_MS } from './authProfileService';

export type RecordVerificationRow = {
  fileName: string;
  uploadedAt: string;
  /** SHA-256 content hash, computed once at upload (fileUploadIntegrity.ts). Null on rows
   * uploaded before the content_hash column existed, or if the column isn't provisioned yet. */
  contentHash: string | null;
};

/**
 * Per-file upload timestamp + content hash, already computed at upload time for dedup — this
 * just surfaces it. Answers "did this exist, unmodified, as of this date" without one3seven
 * making any claim about what the record shows or means.
 */
export async function loadRecordVerificationRows(intakeId: string): Promise<RecordVerificationRow[]> {
  const { data, error } = await supabase
    .from('uploaded_files')
    .select('file_name, created_at, content_hash')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[o3s-verification] loadRecordVerificationRows failed', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    fileName: (r.file_name as string) ?? 'Uploaded file',
    uploadedAt: (r.created_at as string) ?? '',
    contentHash: (r.content_hash as string | null) ?? null,
  }));
}

export type PersistentNotificationRow = {
  id: string;
  recipient_user_id: string;
  recipient_kind: 'worker' | 'firm';
  notification_type:
    | 'firm_document_request'
    | 'worker_documents_submitted'
    | 'worker_full_access_request'
    | 'firm_full_access_granted';
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  related_intake_id: string | null;
  related_route_id: string | null;
  created_at: string;
  updated_at: string;
};

const NOTIFICATIONS_SELECT =
  'id, recipient_user_id, recipient_kind, notification_type, title, body, payload, read_at, related_intake_id, related_route_id, created_at, updated_at';

/** Latest notifications for the signed-in user (recipient_user_id = auth.uid()). */
export async function listNotificationsForUser(limit = 40): Promise<{
  rows: PersistentNotificationRow[];
  error?: string;
}> {
  try {
    return await withProfileQueryTimeout('listNotificationsForUser', listNotificationsForUserQuery(limit));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timed out')) {
      console.error('[o3s-notifications] list timed out', { PROFILE_QUERY_TIMEOUT_MS });
      return { rows: [], error: 'Notifications load timed out.' };
    }
    return { rows: [], error: msg };
  }
}

async function listNotificationsForUserQuery(limit: number): Promise<{
  rows: PersistentNotificationRow[];
  error?: string;
}> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr) return { rows: [], error: authErr.message };
  if (!user) return { rows: [], error: 'Not signed in' };

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATIONS_SELECT)
    .eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isSchemaRelationUnavailable(error)) return { rows: [], error: error.message };
    console.error('[o3s-notifications] list', error);
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as PersistentNotificationRow[] };
}

/**
 * Realtime subscription for the signed-in user's own notifications (2026-08-18 hard-challenge
 * finding: the bell was fetch-on-trigger only -- a worker had to take an action or reload to see
 * a server-side change like a firm's document request). No `filter` is needed: `notifications`
 * RLS (`notifications_select_own`, recipient_user_id = auth.uid()) already scopes which rows a
 * given subscriber's postgres_changes stream can see, same pattern already proven for
 * crm_firms/crm_messages in crmService.ts. Caller re-fetches on any change rather than trying to
 * merge the raw payload, reusing the one already-correct read path (listNotificationsForUser)
 * instead of a second, divergent row-shaping implementation.
 */
export function subscribeToOwnNotifications(onChange: () => void): () => void {
  const channel = supabase
    .channel(`notifications_${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => onChange())
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function markNotificationRead(notificationId: string): Promise<{ error?: string }> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr) return { error: authErr.message };
  if (!user) return { error: 'Not signed in' };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: now, updated_at: now })
    .eq('id', notificationId)
    .eq('recipient_user_id', user.id);

  if (error) {
    console.error('[o3s-notifications] mark read', error);
    return { error: error.message };
  }
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Firm-side event timestamp instrumentation
// Records one-time action timestamps on intake_routes for pilot measurement.
// Each column is written at most once — the null-check guard prevents overwrite.
// ─────────────────────────────────────────────────────────────────────────────

export type FirmRouteEvent = 'first_opened' | 'accepted' | 'declined';

const ROUTE_EVENT_COLUMN: Record<FirmRouteEvent, string> = {
  first_opened: 'firm_first_opened_at',
  accepted: 'firm_accepted_at',
  declined: 'firm_declined_at',
};

/**
 * Records a one-time event timestamp on an intake_routes row.
 * The update is guarded by `.is(column, null)` so return visits never overwrite
 * the original timestamp. Silent no-op on demo/sample route IDs.
 */
export async function recordFirmRouteEvent(
  routeId: string,
  event: FirmRouteEvent,
): Promise<void> {
  // Skip demo / sample routes — they have no real DB rows
  if (!routeId || routeId.startsWith('demo-') || routeId.startsWith('sample-')) return;

  const column = ROUTE_EVENT_COLUMN[event];
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('intake_routes')
    .update({ [column]: now, updated_at: now })
    .eq('id', routeId)
    .is(column, null); // one-time write guard

  if (error) {
    // Non-fatal — log and continue
    console.warn(`[o3s-events] recordFirmRouteEvent(${event})`, error.message);
  }
}
