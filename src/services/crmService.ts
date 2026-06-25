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
    .select('stage, next_followup')
    .eq('id', input.firm_id)
    .single();
  if (fErr || !firm) return { error: fErr?.message ?? 'Firm not found.' };

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

  const { error: uErr } = await supabase
    .from('crm_firms')
    .update({ stage: nextStage, next_followup: nextFollowup })
    .eq('id', input.firm_id);
  if (uErr) return { error: uErr.message };
  return {};
}
