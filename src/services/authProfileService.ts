/**
 * Auth/profile domain: the `profiles` and `firm_profiles` row shapes, ensuring a profile row
 * exists post-auth, role commit (worker/firm), worker contact details, and firm profile basics
 * (including firm-code assignment). Extracted 2026-08-21 from intakeDataService.ts (PR4, seam 4
 * -- the last major domain in that file). Pure move, no behavior change.
 *
 * One real reverse dependency: generateFirmCode() stays in intakeDataService.ts (it's shared
 * category/generator utility code, not auth-specific) and is imported back here -- both
 * insertFirmProfileWithUniqueCode() and saveFirmProfileBasicsInner() call it when assigning a
 * firm's first firm_code.
 */
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { generateFirmCode } from './intakeDataService';

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'worker' | 'firm' | null;
  /** Founder-only internal tooling (CRM) access. Set operator-side; never via the app. */
  is_founder?: boolean | null;
  /** Sales-rep CRM access marker. */
  crm_role?: string | null;
  /** Access gate: false until an operator approves the account (worker/firm hold during beta). */
  approved?: boolean | null;
  created_at: string;
  // Worker contact details (persisted in DB — see migration 20260609_worker_contact_details)
  middle_initial?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type FirmProfileRow = {
  id: string;
  profile_id: string;
  firm_name: string;
  firm_code: string;
  contact_email: string | null;
  practice_areas: string[];
  geographic_filters: string[];
  subscription_status: string;
  plan_id: string;
  created_at: string;
  bar_number: string | null;
  bar_state: string | null;
  accepting_cases: boolean;
};

const PLACEHOLDER_FIRM_NAME = 'my firm (update in settings)';

/** Legacy auto-provisioned label; not treated as a saved firm name. */
export function isPlaceholderFirmName(firmName: string | null | undefined): boolean {
  const t = (firmName ?? '').trim().toLowerCase();
  return !t || t === PLACEHOLDER_FIRM_NAME;
}

/** True when the firm has a user-saved name and an assigned firm code. */
export function isFirmProfileComplete(fp: FirmProfileRow | null | undefined): boolean {
  if (!fp) return false;
  const name = (fp.firm_name ?? '').trim();
  const code = (fp.firm_code ?? '').trim();
  return name.length > 0 && !isPlaceholderFirmName(name) && code.length >= 4;
}

export function firmProfileNeedsSetup(fp: FirmProfileRow | null | undefined): boolean {
  return !isFirmProfileComplete(fp);
}

/** Avoid indefinite hang when Supabase auth lock blocks DB during onAuthStateChange. */
export const PROFILE_QUERY_TIMEOUT_MS = 12_000;
export const FIRM_SAVE_OVERALL_TIMEOUT_MS = 36_000;

type ProfileQueryResult = {
  profile: ProfileRow | null;
  timedOut: boolean;
  error?: string;
};

export async function withProfileQueryTimeout<T>(
  label: string,
  // PromiseLike, not Promise: Supabase query builders are thenable but not real Promise
  // instances, so a Promise<T> parameter type fails structural inference and T collapses to
  // {} at every call site — that was the single root cause behind ~25 of the tsc baseline errors.
  promise: PromiseLike<T>,
  timeoutMs: number = PROFILE_QUERY_TIMEOUT_MS
): Promise<T> {
  // number, not ReturnType<typeof setTimeout>: @types/node's ambient setTimeout declaration
  // pollutes the merged global scope (even Window's), so any ReturnType-derived type here
  // resolves to NodeJS.Timeout — this is always browser code (window.setTimeout), which truly
  // returns a number at runtime regardless of what the merged ambient types claim.
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`[o3s-ensure-profile] ${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

async function fetchProfileQuery(userId: string): Promise<ProfileQueryResult> {
  console.info('[o3s-ensure-profile] fetchProfile: before query', { userId });
  try {
    const { data, error } = await withProfileQueryTimeout(
      'fetchProfile',
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    );
    console.info('[o3s-ensure-profile] fetchProfile: after query', {
      userId,
      hasData: Boolean(data),
      error: error?.message ?? null,
    });
    if (error) {
      console.error('[o3s-ensure-profile] fetchProfile error', error);
      return { profile: null, timedOut: false, error: error.message };
    }
    return { profile: (data as ProfileRow | null) ?? null, timedOut: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timed out')) {
      console.error('[o3s-ensure-profile] fetchProfile: query timed out', { userId, PROFILE_QUERY_TIMEOUT_MS });
      return { profile: null, timedOut: true, error: msg };
    }
    console.error('[o3s-ensure-profile] fetchProfile: unexpected failure', e);
    return { profile: null, timedOut: false, error: msg };
  }
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const result = await fetchProfileQuery(userId);
  return result.profile;
}

function profileRoleFromUserMetadata(user: User): 'worker' | 'firm' | null {
  const r = user.user_metadata?.role;
  if (r === 'worker' || r === 'firm') return r;
  return null;
}

function profileFullNameFromUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  for (const k of ['full_name', 'name'] as const) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Ensures a `public.profiles` row exists for the authenticated user (e.g. trigger missing or legacy users).
 * Safe to call on every session: returns existing row without overwriting role/email when already present.
 * Requires RLS policy allowing insert where auth.uid() = id (see schema / migrations).
 */
let ensureUserProfileInflight: Promise<{ profile: ProfileRow | null; error?: string }> | null = null;
let ensureUserProfileInflightUserId: string | null = null;

export async function ensureUserProfile(
  user: User,
  opts?: { role?: 'worker' | 'firm' | null }
): Promise<{ profile: ProfileRow | null; error?: string }> {
  if (ensureUserProfileInflight && ensureUserProfileInflightUserId === user.id) {
    console.info('[o3s-ensure-profile] coalescing in-flight ensureUserProfile', { userId: user.id });
    return ensureUserProfileInflight;
  }

  const run = async (): Promise<{ profile: ProfileRow | null; error?: string }> => {
    console.info('[o3s-ensure-profile] start', { userId: user.id });

    console.info('[o3s-ensure-profile] before fetchProfile (existing check)');
    const existingResult = await fetchProfileQuery(user.id);
    console.info('[o3s-ensure-profile] after fetchProfile (existing check)', {
      userId: user.id,
      hasExisting: Boolean(existingResult.profile),
      timedOut: existingResult.timedOut,
    });
    if (existingResult.timedOut) {
      return {
        profile: null,
        error: 'Profile lookup timed out. Refresh the page and try signing in again.',
      };
    }
    if (existingResult.error && !existingResult.profile) {
      return { profile: null, error: existingResult.error };
    }
    if (existingResult.profile) return { profile: existingResult.profile };

    const role = opts?.role !== undefined ? opts.role : profileRoleFromUserMetadata(user);

    const row = {
      id: user.id,
      email: user.email ?? null,
      full_name: profileFullNameFromUser(user),
      role: role ?? null,
    };

    console.info('[o3s-ensure-profile] before profiles.insert', { userId: user.id });
    let data: ProfileRow | null = null;
    let error: { message?: string; code?: string } | null = null;
    try {
      const insertResult = await withProfileQueryTimeout(
        'profiles.insert',
        supabase.from('profiles').insert(row).select('*').single()
      );
      data = (insertResult.data as ProfileRow | null) ?? null;
      error = insertResult.error;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('timed out')) {
        console.error('[o3s-ensure-profile] profiles.insert timed out', { userId: user.id });
        return {
          profile: null,
          error: 'Profile setup timed out. Refresh the page and try signing in again.',
        };
      }
      throw e;
    }
    console.info('[o3s-ensure-profile] after profiles.insert', {
      userId: user.id,
      hasData: Boolean(data),
      error: error?.message ?? null,
      code: error?.code ?? null,
    });

    if (!error && data) return { profile: data as ProfileRow };

    const code = String(error?.code ?? '');
    const msg = (error?.message ?? '').toLowerCase();
    if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
      console.info('[o3s-ensure-profile] duplicate insert — before fetchProfile (retry)');
      const againResult = await fetchProfileQuery(user.id);
      console.info('[o3s-ensure-profile] duplicate insert — after fetchProfile (retry)', {
        hasProfile: Boolean(againResult.profile),
        timedOut: againResult.timedOut,
      });
      if (againResult.timedOut) {
        return {
          profile: null,
          error: 'Profile lookup timed out after create. Refresh and try again.',
        };
      }
      if (againResult.profile) return { profile: againResult.profile };
    }

    console.error('[o3s-ensure-profile] ensureUserProfile failed', error);
    return { profile: null, error: error?.message ?? 'Failed to ensure profile' };
  };

  ensureUserProfileInflightUserId = user.id;
  ensureUserProfileInflight = run().finally(() => {
    ensureUserProfileInflight = null;
    ensureUserProfileInflightUserId = null;
    console.info('[o3s-ensure-profile] in-flight complete', { userId: user.id });
  });
  return ensureUserProfileInflight;
}

/** Drop coalesced ensureUserProfile so role commit is not blocked by a hung post-auth fetch. */
export function resetEnsureUserProfileInflight(): void {
  ensureUserProfileInflight = null;
  ensureUserProfileInflightUserId = null;
}

/** Local profile shape when DB read/write is blocked by auth lock (role commit optimistic path). */
export function profileRowFromAuthUser(user: User, role: 'worker' | 'firm'): ProfileRow {
  return {
    id: user.id,
    email: user.email ?? null,
    full_name: profileFullNameFromUser(user),
    role,
    created_at: new Date().toISOString(),
  };
}

/**
 * Role selection: upsert/update role without a prior profiles SELECT.
 * Falls back to update-only, then optimistic local profile on timeout.
 */
export async function commitProfileRoleForUser(
  user: User,
  role: 'worker' | 'firm'
): Promise<{ profile: ProfileRow | null; error?: string; timedOut?: boolean }> {
  resetEnsureUserProfileInflight();
  console.info('[o3s-role-commit] commitProfileRoleForUser: start', { userId: user.id, role });

  const row = {
    id: user.id,
    email: user.email ?? null,
    full_name: profileFullNameFromUser(user),
    role,
  };

  try {
    const { data, error } = await withProfileQueryTimeout(
      'commitProfileRole.upsert',
      supabase.from('profiles').upsert(row, { onConflict: 'id' }).select('*').single()
    );
    console.info('[o3s-role-commit] commitProfileRoleForUser: after upsert', {
      userId: user.id,
      hasData: Boolean(data),
      error: error?.message ?? null,
    });
    if (!error && data) {
      return { profile: data as ProfileRow };
    }
    if (error) {
      console.info('[o3s-role-commit] upsert failed — trying update-only', { code: error.code });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('timed out')) {
      return { profile: null, error: msg };
    }
    console.warn('[o3s-role-commit] upsert timed out — trying update-only', { userId: user.id });
  }

  try {
    const { error: updateError } = await withProfileQueryTimeout(
      'commitProfileRole.update',
      supabase.from('profiles').update({ role }).eq('id', user.id)
    );
    console.info('[o3s-role-commit] commitProfileRoleForUser: after update-only', {
      userId: user.id,
      error: updateError?.message ?? null,
    });
    if (!updateError) {
      return { profile: profileRowFromAuthUser(user, role) };
    }
    return { profile: null, error: updateError.message };
  } catch (e2) {
    const msg2 = e2 instanceof Error ? e2.message : String(e2);
    if (msg2.includes('timed out')) {
      console.error('[o3s-role-commit] commitProfileRoleForUser: update timed out — optimistic continue', {
        userId: user.id,
      });
      return { profile: profileRowFromAuthUser(user, role), timedOut: true };
    }
    return { profile: null, error: msg2 };
  }
}

export async function fetchFirmProfileForUserWithTimeout(userId: string): Promise<FirmProfileRow | null> {
  try {
    const { data, error } = await withProfileQueryTimeout(
      'fetchFirmProfile',
      supabase.from('firm_profiles').select('*').eq('profile_id', userId).maybeSingle()
    );
    if (error) {
      console.error('[o3s-role-commit] fetchFirmProfile error', error);
      return null;
    }
    return (data as FirmProfileRow | null) ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timed out')) {
      console.warn('[o3s-role-commit] fetchFirmProfile timed out', { userId });
    }
    return null;
  }
}

export async function updateProfileName(userId: string, full_name: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('profiles').update({ full_name }).eq('id', userId);
  return error ? { error: error.message } : {};
}

export type WorkerContactPayload = {
  middle_initial?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
};

/** Persist worker contact details to the profiles table (RLS: own row only). */
export async function saveWorkerContactDetails(
  userId: string,
  contact: WorkerContactPayload,
): Promise<{ error?: string }> {
  const patch: Record<string, string | null> = {
    middle_initial: contact.middle_initial?.trim() || null,
    phone: contact.phone?.trim() || null,
    address_line1: contact.address_line1?.trim() || null,
    address_line2: contact.address_line2?.trim() || null,
    city: contact.city?.trim() || null,
    state: contact.state?.trim() || null,
    zip: contact.zip?.trim() || null,
  };
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  return error ? { error: error.message } : {};
}

/** Returns the existing firm profile only; does not create placeholder rows. */
export async function ensureFirmProfile(userId: string, _email: string | null): Promise<FirmProfileRow | null> {
  return fetchFirmProfileForUserWithTimeout(userId);
}

async function ensureProfileRoleForFirmSave(
  userId: string,
  email: string | null,
  fullName?: string | null
): Promise<{ error?: string }> {
  console.info('[o3s-firm-save] ensureProfileRole: start', { userId });
  const row = { id: userId, email, role: 'firm' as const, full_name: fullName ?? null };
  try {
    const { error } = await withProfileQueryTimeout(
      'firmSave.profileRole.upsert',
      supabase.from('profiles').upsert(row, { onConflict: 'id' })
    );
    if (!error) {
      console.info('[o3s-firm-save] ensureProfileRole: upsert ok', { userId });
      return {};
    }
    console.info('[o3s-firm-save] ensureProfileRole: upsert failed — update-only', {
      userId,
      message: error.message,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('timed out')) return { error: msg };
    console.warn('[o3s-firm-save] ensureProfileRole: upsert timed out — update-only', { userId });
  }

  try {
    const { error } = await withProfileQueryTimeout(
      'firmSave.profileRole.update',
      supabase.from('profiles').update({ role: 'firm' }).eq('id', userId)
    );
    if (error) return { error: error.message };
    console.info('[o3s-firm-save] ensureProfileRole: update ok', { userId });
    return {};
  } catch (e2) {
    const msg2 = e2 instanceof Error ? e2.message : String(e2);
    if (msg2.includes('timed out')) {
      return { error: 'Profile role save timed out. Try again in a moment.' };
    }
    return { error: msg2 };
  }
}

async function updateFirmProfileRowTimed(
  label: string,
  filter: { column: 'id' | 'profile_id'; value: string },
  patch: Record<string, unknown>
): Promise<{ profile: FirmProfileRow | null; error?: string; timedOut?: boolean }> {
  console.info(`[o3s-firm-save] ${label}: before update`, { filter: filter.column, value: filter.value });
  try {
    const { data, error } = await withProfileQueryTimeout(
      label,
      supabase.from('firm_profiles').update(patch).eq(filter.column, filter.value).select('*').maybeSingle()
    );
    console.info(`[o3s-firm-save] ${label}: after update`, {
      hasData: Boolean(data),
      error: error?.message ?? null,
    });
    if (error) return { profile: null, error: error.message };
    return { profile: (data as FirmProfileRow | null) ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timed out')) {
      console.error(`[o3s-firm-save] ${label}: timed out`, { PROFILE_QUERY_TIMEOUT_MS });
      return { profile: null, timedOut: true, error: 'Firm profile save timed out. Try again in a moment.' };
    }
    return { profile: null, error: msg };
  }
}

async function insertFirmProfileWithUniqueCode(
  userId: string,
  email: string | null,
  row: {
    firm_name: string;
    practice_areas: string[];
    geographic_filters: string[];
    contact_email: string | null;
  }
): Promise<{ profile: FirmProfileRow | null; error?: string; timedOut?: boolean }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const firm_code = generateFirmCode(email);
    const label = `firmSave.insert.${attempt}`;
    console.info(`[o3s-firm-save] ${label}: before insert`, { userId, firm_code });
    try {
      const { data, error } = await withProfileQueryTimeout(
        label,
        supabase
          .from('firm_profiles')
          .insert({
            profile_id: userId,
            firm_name: row.firm_name,
            firm_code,
            contact_email: row.contact_email,
            practice_areas: row.practice_areas,
            geographic_filters: row.geographic_filters,
          })
          .select()
          .single()
      );
      console.info(`[o3s-firm-save] ${label}: after insert`, {
        hasData: Boolean(data),
        error: error?.message ?? null,
      });
      if (!error && data) return { profile: data as FirmProfileRow };
      if (error?.code !== '23505') {
        console.error('[o3s-firm-save] insert failed', error);
        return { profile: null, error: error?.message ?? 'Could not create firm profile.' };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('timed out')) {
        console.error(`[o3s-firm-save] ${label}: timed out`, { PROFILE_QUERY_TIMEOUT_MS });
        return {
          profile: null,
          timedOut: true,
          error: 'Firm profile save timed out. Try again in a moment.',
        };
      }
      return { profile: null, error: msg };
    }
  }
  return { profile: null, error: 'Could not assign a unique firm code. Try again.' };
}

/**
 * Saves firm profile basics; assigns `firm_code` on first real save when missing.
 * Update-first by id or profile_id (no SELECT-before-write). Times out hung auth-lock queries.
 */
export async function saveFirmProfileBasics(opts: {
  firmId?: string;
  userId: string;
  email: string | null;
  full_name?: string | null;
  existingFirmCode?: string | null;
  firm_name: string;
  practice_areas: string[];
  geographic_filters: string[];
  bar_number?: string | null;
  bar_state?: string | null;
  accepting_cases?: boolean;
}): Promise<{ profile: FirmProfileRow | null; error?: string }> {
  try {
    return await withProfileQueryTimeout(
      'firmSave.overall',
      saveFirmProfileBasicsInner(opts),
      FIRM_SAVE_OVERALL_TIMEOUT_MS
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timed out')) {
      console.error('[o3s-firm-save] overall save timed out', { FIRM_SAVE_OVERALL_TIMEOUT_MS });
      return {
        profile: null,
        error: 'Firm profile save timed out. Try again in a moment.',
      };
    }
    return { profile: null, error: msg };
  }
}

async function saveFirmProfileBasicsInner(opts: {
  firmId?: string;
  userId: string;
  email: string | null;
  full_name?: string | null;
  existingFirmCode?: string | null;
  firm_name: string;
  practice_areas: string[];
  geographic_filters: string[];
  bar_number?: string | null;
  bar_state?: string | null;
  accepting_cases?: boolean;
}): Promise<{ profile: FirmProfileRow | null; error?: string }> {
  console.info('[o3s-firm-save] start', {
    userId: opts.userId,
    firmId: opts.firmId ?? null,
    hasExistingFirmCode: Boolean(opts.existingFirmCode?.trim()),
  });
  resetEnsureUserProfileInflight();

  const roleResult = await ensureProfileRoleForFirmSave(opts.userId, opts.email, opts.full_name);
  if (roleResult.error) {
    console.error('[o3s-firm-save] ensureProfileRole failed', { error: roleResult.error });
    return { profile: null, error: roleResult.error };
  }

  const firm_name = opts.firm_name.trim();
  if (!firm_name || isPlaceholderFirmName(firm_name)) {
    return { profile: null, error: 'Enter a firm name before saving.' };
  }

  const filter: { column: 'id' | 'profile_id'; value: string } = opts.firmId
    ? { column: 'id', value: opts.firmId }
    : { column: 'profile_id', value: opts.userId };

  const basePatch: Record<string, unknown> = {
    firm_name,
    practice_areas: opts.practice_areas,
    geographic_filters: opts.geographic_filters,
    contact_email: opts.email,
  };
  if (opts.bar_number !== undefined) basePatch.bar_number = opts.bar_number?.trim() || null;
  if (opts.bar_state !== undefined) basePatch.bar_state = opts.bar_state?.trim() || null;
  if (opts.accepting_cases !== undefined) basePatch.accepting_cases = opts.accepting_cases;

  const hasFirmCode = Boolean((opts.existingFirmCode ?? '').trim());

  if (!hasFirmCode) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const firm_code = generateFirmCode(opts.email);
      const updated = await updateFirmProfileRowTimed(`firmSave.updateWithCode.${attempt}`, filter, {
        ...basePatch,
        firm_code,
      });
      if (updated.timedOut) return { profile: null, error: updated.error };
      if (updated.profile) return { profile: updated.profile };
      if (updated.error) {
        const lower = updated.error.toLowerCase();
        if (lower.includes('unique') || lower.includes('duplicate')) continue;
        return { profile: null, error: updated.error };
      }
      break;
    }
  } else {
    const updated = await updateFirmProfileRowTimed('firmSave.updateBasics', filter, basePatch);
    if (updated.profile) return { profile: updated.profile };
    if (updated.error) return { profile: null, error: updated.error };
  }

  console.info('[o3s-firm-save] no row updated — before insert', { userId: opts.userId });
  const created = await insertFirmProfileWithUniqueCode(opts.userId, opts.email, {
    firm_name,
    practice_areas: opts.practice_areas,
    geographic_filters: opts.geographic_filters,
    contact_email: opts.email,
  });
  if (created.profile) return { profile: created.profile };
  return {
    profile: null,
    error: created.error ?? 'Could not save firm profile. Try again in a moment.',
  };
}
