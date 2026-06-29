/**
 * Founder CRM data access. All reads/writes hit public.crm_firms and public.crm_activity,
 * which are protected by founder-only RLS (see migration 20260623120000_crm_founder). A
 * non-founder session is denied at the database level regardless of what the client does.
 */

import { supabase } from '../lib/supabaseClient';
import {
  deriveStageFromActivity,
  deriveNextFollowup,
  type CrmStage,
} from './crmStageLogic';

export interface CrmFirm {
  id: string;
  name: string;
  attorney_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  region: string | null;
  priority: 'A' | 'B' | 'C' | null;
  stage: CrmStage;
  focus_areas: string | null;
  source: string | null;
  next_followup: string | null;
  notes: string | null;
  subscription_tier: 'solo' | 'practice' | 'firm' | null;
  /** Firm's own estimate of minutes saved per intake — the value claim, measured. */
  est_minutes_saved: number | null;
  /** Rep attribution — who first contacted this firm (claim model) and when. */
  contacted_by: string | null;
  contacted_by_name: string | null;
  contacted_at: string | null;
  created_at: string;
}

export interface CrmActivity {
  id: string;
  firm_id: string | null;
  activity_type: 'call' | 'email' | 'demo' | null;
  activity_date: string;
  outcome: string | null;
  who_answered: string | null;
  objection: string | null;
  interest_level: 'hot' | 'warm' | 'cold' | null;
  next_followup: string | null;
  new_stage: CrmStage | null;
  notes: string | null;
  logged_by: string | null;
  logged_by_name: string | null;
  created_at: string;
}

/** Activity row with the firm name joined in for display. */
export type CrmActivityWithFirm = CrmActivity & { firm_name: string | null };

export interface NewFirmInput {
  name: string;
  attorney_name?: string;
  phone?: string;
  email?: string;
  website?: string;
  region?: string;
  priority?: 'A' | 'B' | 'C' | '';
  stage?: CrmStage;
  focus_areas?: string;
  source?: string;
  next_followup?: string;
  notes?: string;
}

export interface LogActivityInput {
  firm_id: string;
  activity_type: 'call' | 'email' | 'demo';
  activity_date: string;
  outcome?: string;
  who_answered?: string;
  objection?: string;
  interest_level?: 'hot' | 'warm' | 'cold' | '';
  next_followup?: string;
  new_stage?: CrmStage | '';
  notes?: string;
}

const clean = (v: string | undefined | null): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

/** Update a firm's stage directly (e.g. "Mark demo done"). */
export async function setFirmStage(firmId: string, stage: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('crm_firms').update({ stage }).eq('id', firmId);
  if (error) return { error: error.message };
  return {};
}

/** Record the firm's estimate of minutes saved per intake (the value claim, measured). */
export async function setFirmMinutesSaved(firmId: string, minutes: number): Promise<{ error?: string }> {
  const { error } = await supabase.from('crm_firms').update({ est_minutes_saved: minutes }).eq('id', firmId);
  if (error) return { error: error.message };
  return {};
}

/**
 * Founder-only COUNT of worker intakes (proof of traction). Calls the intakes_count() RPC,
 * which returns an integer only — never rows or PII. Returns 0 on any error or non-numeric
 * result (e.g. before the migration is applied), so founder access is never affected.
 */
export async function getIntakesCount(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('intakes_count');
    if (error || typeof data !== 'number') return 0;
    return data;
  } catch {
    return 0;
  }
}

// ── Shared team notes board ──────────────────────────────────────────────────

export interface CrmNote {
  id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export async function listNotes(limit = 200): Promise<{ data: CrmNote[]; error?: string }> {
  const { data, error } = await supabase
    .from('crm_notes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CrmNote[] };
}

export async function addNote(body: string, authorName: string): Promise<{ error?: string }> {
  const text = body.trim();
  if (!text) return { error: 'Note is empty.' };
  const { error } = await supabase.from('crm_notes').insert({ body: text, author_name: authorName });
  if (error) return { error: error.message };
  return {};
}

export async function deleteNote(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('crm_notes').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// ── Sales reps (founder-managed invite allowlist) ────────────────────────────

export interface CrmInvite {
  id: string;
  email: string;
  name: string | null;
  status: 'invited' | 'accepted' | 'revoked';
  created_at: string;
}

export async function addRepInvite(input: { name: string; email: string }): Promise<{ error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' };
  const { error } = await supabase
    .from('crm_invites')
    .insert({ email, name: clean(input.name), status: 'invited' });
  if (error) {
    if (error.code === '23505') return { error: 'That email is already invited.' };
    return { error: error.message };
  }
  return {};
}

export async function listRepInvites(): Promise<{ data: CrmInvite[]; error?: string }> {
  const { data, error } = await supabase
    .from('crm_invites')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CrmInvite[] };
}

export async function revokeRepInvite(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('crm_invites').update({ status: 'revoked' }).eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// ── Team chat (founder + reps share one channel) ─────────────────────────────

export interface CrmMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  body: string;
  created_at: string;
}

/** Current member's display name + id, for labeling their messages. */
export async function getCurrentMember(): Promise<{ id: string | null; name: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, name: 'Member' };
  const { data } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const name = (data?.full_name && data.full_name.trim()) || data?.email || user.email || 'Member';
  return { id: user.id, name };
}

export async function listMessages(limit = 200): Promise<{ data: CrmMessage[]; error?: string }> {
  const { data, error } = await supabase
    .from('crm_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CrmMessage[] };
}

/** Timestamp of the most recent team message (for the unread indicator). Null if none. */
export async function getLatestMessageAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from('crm_messages')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { created_at: string }).created_at;
}

/**
 * Subscribe to new shared team-chat messages in real time. Returns an unsubscribe fn.
 * onStatus receives the channel state ('SUBSCRIBED' when the realtime socket is live).
 */
export function subscribeTeamMessages(
  onInsert: (m: CrmMessage) => void,
  onStatus?: (status: string) => void
): () => void {
  const channel = supabase
    .channel(`crm_team_messages_${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages' }, (payload) => {
      onInsert(payload.new as CrmMessage);
    })
    .subscribe((status) => { onStatus?.(status); });
  return () => { void supabase.removeChannel(channel); };
}

// ── Direct messages / inbox (1:1 between CRM members) ─────────────────────────

export interface CrmMember { id: string; name: string; email: string | null; is_founder: boolean; }

export interface CrmDirectMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  recipient_id: string;
  recipient_name: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}

/** People you can message: founder + reps (excludes yourself in the picker, done client-side). */
export async function listCrmMembers(): Promise<{ data: CrmMember[]; error?: string }> {
  const { data, error } = await supabase.rpc('list_crm_members');
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CrmMember[] };
}

/** All direct messages involving the current user (both directions), newest last. */
export async function listMyDirectMessages(limit = 500): Promise<{ data: CrmDirectMessage[]; error?: string }> {
  const { data, error } = await supabase
    .from('crm_direct_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CrmDirectMessage[] };
}

export async function sendDirectMessage(input: { recipientId: string; recipientName: string; body: string }): Promise<{ error?: string }> {
  const text = input.body.trim();
  if (!text) return { error: 'Message is empty.' };
  const me = await getCurrentMember();
  if (!me.id) return { error: 'Sign in to send a message.' };
  const { error } = await supabase.from('crm_direct_messages').insert({
    sender_id: me.id,
    sender_name: me.name,
    recipient_id: input.recipientId,
    recipient_name: input.recipientName,
    body: text,
  });
  if (error) return { error: error.message };
  return {};
}

/** Mark every message in a thread (from the other person to me) as read. */
export async function markThreadRead(otherId: string): Promise<{ error?: string }> {
  const me = await getCurrentMember();
  if (!me.id) return {};
  const { error } = await supabase
    .from('crm_direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me.id)
    .eq('sender_id', otherId)
    .is('read_at', null);
  if (error) return { error: error.message };
  return {};
}

/** Count of unread messages addressed to the current user (for the inbox badge). */
export async function getUnreadDmCount(): Promise<number> {
  const me = await getCurrentMember();
  if (!me.id) return 0;
  const { count, error } = await supabase
    .from('crm_direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', me.id)
    .is('read_at', null);
  if (error || typeof count !== 'number') return 0;
  return count;
}

/** Subscribe to direct-message changes for the current user (sent or received). */
export function subscribeDirectMessages(onChange: () => void): () => void {
  const channel = supabase
    .channel(`crm_direct_messages_${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_direct_messages' }, () => onChange())
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function sendMessage(body: string, senderName: string): Promise<{ error?: string }> {
  const text = body.trim();
  if (!text) return { error: 'Message is empty.' };
  // sender_id defaults to auth.uid() in the DB; RLS checks it matches the caller.
  const { error } = await supabase.from('crm_messages').insert({ body: text, sender_name: senderName });
  if (error) return { error: error.message };
  return {};
}

/**
 * For a signed-in non-founder: provisions rep access if their email is on the allowlist.
 * Returns true if the caller is now (or already) an active rep. Errors are swallowed to false
 * (e.g. if the migration isn't applied yet) so founder access is never affected.
 */
export async function claimRepAccess(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('claim_crm_rep_access');
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export interface SignupRow {
  name: string;
  email: string;
  created_at: string;
  tier: string | null;
  sub_status: string;
}
export interface TierCount { tier: string; count: number; }
export interface DailyPoint { day: string; visits: number; signups: number; }
export interface SiteAnalytics {
  landing_visits: number;
  for_firms_visits: number;
  demo_visits: number;
  total_sessions: number;
  avg_session_seconds: number;
  demo_avg_session_seconds: number;
  pilot_submits: number;
  pilot_success: number;
  signups_count: number;
  tier_breakdown: TierCount[];
  daily: DailyPoint[];
  recent_signups: SignupRow[];
}

/** Growth analytics (traffic + signups + tier). Gated server-side to founder/allowlisted emails. */
export async function getSiteAnalytics(): Promise<{ data?: SiteAnalytics; error?: string }> {
  const { data, error } = await supabase.rpc('crm_site_analytics');
  if (error) return { error: error.message };
  return { data: data as SiteAnalytics };
}

export async function listFirms(): Promise<{ data: CrmFirm[]; error?: string }> {
  const { data, error } = await supabase
    .from('crm_firms')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CrmFirm[] };
}

export async function addFirm(input: NewFirmInput): Promise<{ error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: 'Firm name is required.' };
  const row = {
    name,
    attorney_name: clean(input.attorney_name),
    phone: clean(input.phone),
    email: clean(input.email),
    website: clean(input.website),
    region: clean(input.region),
    priority: input.priority ? input.priority : null,
    stage: input.stage ?? 'target',
    focus_areas: clean(input.focus_areas),
    source: clean(input.source),
    next_followup: input.next_followup || null,
    notes: clean(input.notes),
  };
  const { error } = await supabase.from('crm_firms').insert(row);
  if (error) return { error: error.message };
  return {};
}

/**
 * Explicitly claim a firm for the current rep, with a timestamp. Atomic: the update only
 * applies when the firm is still unclaimed (`contacted_by is null`), so two reps tapping at
 * once can't both win — the second gets "already claimed". No new migration needed; reuses
 * the existing contacted_by / contacted_by_name / contacted_at columns as the claim record.
 */
export async function claimFirm(firmId: string): Promise<{ error?: string; claimedBy?: string }> {
  const me = await getCurrentMember();
  if (!me.id) return { error: 'Sign in to claim a firm.' };
  const { data, error } = await supabase
    .from('crm_firms')
    .update({ contacted_by: me.id, contacted_by_name: me.name, contacted_at: new Date().toISOString() })
    .eq('id', firmId)
    .is('contacted_by', null)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    // Someone else already owns it — report who, so the UI can show it.
    const { data: firm } = await supabase
      .from('crm_firms')
      .select('contacted_by_name')
      .eq('id', firmId)
      .maybeSingle();
    return { error: 'This firm is already claimed.', claimedBy: firm?.contacted_by_name ?? undefined };
  }
  return {};
}

/** Release a claim — allowed for the owning rep (or a founder via RLS). Returns it to the pool. */
export async function releaseFirm(firmId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('crm_firms')
    .update({ contacted_by: null, contacted_by_name: null, contacted_at: null })
    .eq('id', firmId);
  if (error) return { error: error.message };
  return {};
}

export async function updateFirm(id: string, patch: Partial<CrmFirm>): Promise<{ error?: string }> {
  const { error } = await supabase.from('crm_firms').update(patch).eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function listActivity(limit = 100): Promise<{ data: CrmActivityWithFirm[]; error?: string }> {
  const { data, error } = await supabase
    .from('crm_activity')
    .select('*, crm_firms(name)')
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []).map((r: Record<string, unknown>) => {
    const firm = r.crm_firms as { name?: string } | null;
    const { crm_firms: _omit, ...rest } = r;
    void _omit;
    return { ...(rest as unknown as CrmActivity), firm_name: firm?.name ?? null };
  });
  return { data: rows };
}

/**
 * Log an activity AND advance the firm's stage + follow-up date per crmStageLogic.
 * The stage/follow-up derivation is the unit-tested pure logic; this wraps it with persistence.
 */
export async function logActivity(input: LogActivityInput): Promise<{ error?: string }> {
  const { data: firm, error: fErr } = await supabase
    .from('crm_firms')
    .select('stage, next_followup, contacted_by')
    .eq('id', input.firm_id)
    .single();
  if (fErr || !firm) return { error: fErr?.message ?? 'Firm not found.' };

  // Who is logging this — for per-rep credit.
  const me = await getCurrentMember();

  const activityRow = {
    firm_id: input.firm_id,
    activity_type: input.activity_type,
    activity_date: input.activity_date,
    outcome: clean(input.outcome),
    who_answered: clean(input.who_answered),
    objection: clean(input.objection),
    interest_level: input.interest_level ? input.interest_level : null,
    next_followup: input.next_followup || null,
    new_stage: input.new_stage ? input.new_stage : null,
    notes: clean(input.notes),
    logged_by: me.id,
    logged_by_name: me.name,
  };
  const { error: aErr } = await supabase.from('crm_activity').insert(activityRow);
  if (aErr) return { error: aErr.message };

  const nextStage = deriveStageFromActivity(
    { outcome: input.outcome, newStage: input.new_stage || null, nextFollowup: input.next_followup },
    firm.stage as CrmStage
  );
  const nextFollowup = deriveNextFollowup(
    { nextFollowup: input.next_followup },
    (firm.next_followup as string | null) ?? null
  );

  // Claim model: the first rep to log a firm owns the credit. Don't overwrite once set.
  const firmUpdate: Record<string, unknown> = { stage: nextStage, next_followup: nextFollowup };
  if (!firm.contacted_by && me.id) {
    firmUpdate.contacted_by = me.id;
    firmUpdate.contacted_by_name = me.name;
    firmUpdate.contacted_at = new Date().toISOString();
  }

  const { error: uErr } = await supabase
    .from('crm_firms')
    .update(firmUpdate)
    .eq('id', input.firm_id);
  if (uErr) return { error: uErr.message };
  return {};
}
