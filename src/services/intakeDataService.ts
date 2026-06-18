import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { buildPlaceholderOrganization } from './aiOrganizationService';
import { buildDocumentGroundedOrganization } from './documentGroundedOrganizationService';
import {
  encodeTimelineWorkerContext,
  mergeFirmReviewSummaryIntoOverview,
  mergeRecordStoryIntoOverview,
} from './timelineSourceTraceCodec';
import { extractOrgEngineFromOverview, mergeOrgEngineIntoOverview, stripOrgEngineBlock } from './intakeOrgEngineCodec';
import { polishFirmFacingProse, stripFirmFacingArtifacts } from './firmIntakeDisplay';
import {
  extractStoryFollowUpFromOverview,
  formatStoryFollowUpForDisplay,
} from './storyFollowUpPersistence';
import { extractWorkerContactFromOverview } from './workerContactPersistence';
import {
  buildCommunicationFactDigest,
  buildPayRecordFactDigest,
  extractCommunicationFacts,
  extractPayRecordFacts,
  type PayRecordExtractionInput,
} from './documentFactExtractionService';
import * as notifications from './notificationService';
import {
  normalizePersistedSubmissionChannel,
  resolveFirmSubmissionTypeDisplay,
  resolveIsFirmCodeRoutedIntake,
  isInterruptedOrganizationWorkflowStatus,
  type FirmSubmissionTypeDisplay,
} from '../app/constants/one3sevenProduct';
import { inferInventoryCategory } from './packetChronologyIntelligence';
import { attorneyCategoryLabel } from './packetStoryPresentation';
import type { IntakeOrganizationSections, PlaceholderOrganizationResult } from './intakeOrganizationTypes';
import { refreshSectionsReviewNotes } from './intakeOrganizationSectionsService';
import { extractEmploymentMatterTagsFromOverview } from '../app/utils/employmentMatterPersistence';
import { logSummarySave, logSummarySaveError, logGeneratedSummaryPreview, logSupabaseWriteResult, measurePayload, safeTrim, trimAssemblyValue } from './summarySaveDiagnostics';
import { logOrgAudit, logOrgAuditBoundary, logOrgAuditError } from './organizationAudit';
import {
  buildCoreSummaryPayload,
  buildFallbackSummaryPayload,
  payloadsEquivalent,
  sanitizeStringArray,
  type SummaryRowPayload,
} from './organizationCoreSave';
import { parseWorkerIntakeMetadata } from './workerIntakeMetadata';

const INTAKE_FILES_BUCKET = 'intake-files';

/** PostgREST / Postgres when optional tables are not deployed (public beta schema). */
export function isSchemaRelationUnavailable(
  err: { message?: string; code?: string } | null | undefined
): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  const code = String(err.code ?? '');
  if (code === 'PGRST205' || code === '42P01') return true;
  if (msg.includes('schema cache') || msg.includes('could not find the table')) return true;
  if (msg.includes('does not exist') && (msg.includes('relation') || msg.includes('table'))) return true;
  return false;
}

function betaPlaceholderBundleFromFiles(
  intakeId: string,
  files: Array<{ file_name: string; category: string | null; id?: string }>
) {
  const org = buildPlaceholderOrganization(
    files.map((f) => ({
      fileName: f.file_name,
      category: f.category ?? inferCategoryFromFileName(f.file_name),
      uploadedFileId: f.id ? String(f.id) : undefined,
    }))
  );
  const created_at = new Date().toISOString();
  let overview = mergeRecordStoryIntoOverview(
    mergeFirmReviewSummaryIntoOverview(org.overview, org.firmReviewSummary),
    org.recordStory
  );
  overview = mergeOrgEngineIntoOverview(overview, {
    version: 1,
    file_records: org.fileRecords,
    people_index: org.peopleIndex,
    generated_at: created_at,
    timeline_events: org.evidenceTimeline,
    sections: org.sections,
  });
  return {
    summary: {
      overview,
      timeline_summary: org.timelineSummary,
      readiness_indicators: org.readinessIndicators,
      missing_document_alerts: org.missingDocumentSuggestions,
    },
    events: org.timelineEvents.map((e, i) => ({
      id: `beta-${intakeId}-${i}`,
      event_date: e.eventDate,
      title: e.title,
      category: e.category,
      ai_summary: e.aiSummary,
      worker_context: encodeTimelineWorkerContext('', e.source),
      created_at,
    })),
  };
}

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'worker' | 'firm' | null;
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

export type UploadedFilePersistMetaRow = {
  uploadedFileId: string;
  filePath: string;
  category?: string | null;
};

/** Worker UI: prefer stored upload category; infer from filename only when not persisted yet. */
export function resolveUploadedFileDisplayCategory(
  file: File,
  opts?: { persistedCategory?: string | null }
): string {
  const stored = (opts?.persistedCategory ?? '').trim();
  if (stored) return stored;
  return inferCategoryFromFileName(file.name);
}

/** Attorney-facing category label for worker dashboard file lists (presentation only). */
export function resolveAttorneyFacingUploadCategory(
  fileName: string,
  persistedCategory?: string | null
): string {
  const stored = (persistedCategory ?? '').trim();
  const internal = stored || inferCategoryFromFileName(fileName);
  const inferred = inferInventoryCategory(fileName, internal);
  return attorneyCategoryLabel(inferred, fileName);
}

export function inferCategoryFromFileName(fileName: string): string {
  const name = fileName.toLowerCase();
  const w2ish =
    /\bw[-\s]?2\b/i.test(fileName) ||
    /(^|[^a-z0-9])w2([^a-z0-9]|$)/i.test(name) ||
    name.includes('w-2');

  // Separation / termination — check before pay to avoid "final pay" grabbing termination letters
  if (
    name.includes('termination') ||
    name.includes('separation') ||
    name.includes('final_paystub') ||
    name.includes('final paystub') ||
    name.includes('final_pay') ||
    name.includes('final pay') ||
    name.includes('last_day') ||
    name.includes('last day') ||
    name.includes('letter_of_separation') ||
    name.includes('end_of_employment')
  ) {
    return 'Separation Records';
  }

  // Discipline / warnings
  if (
    name.includes('warning') ||
    name.includes('written_warning') ||
    name.includes('write_up') ||
    name.includes('write-up') ||
    name.includes('writeup') ||
    name.includes('corrective') ||
    name.includes('disciplin') ||
    name.includes('pip') ||
    name.includes('performance_improvement')
  ) {
    return 'Performance / discipline records';
  }

  // Witness / coworker statements
  if (
    name.includes('statement') ||
    name.includes('witness') ||
    name.includes('declaration') ||
    name.includes('affidavit') ||
    name.includes('coworker') ||
    name.includes('co_worker') ||
    name.includes('colleague')
  ) {
    return 'Witness Statement';
  }

  // Meal & rest period records
  if (
    name.includes('meal') ||
    name.includes('break_log') ||
    name.includes('break log') ||
    name.includes('rest_period') ||
    name.includes('rest period') ||
    name.includes('lunch')
  ) {
    return 'Meal & Rest Period Records';
  }

  // Schedule / shift changes
  if (
    name.includes('schedule') ||
    name.includes('shift') ||
    name.includes('roster') ||
    name.includes('assignment')
  ) {
    return 'Schedules';
  }

  // HR complaints / grievances
  if (
    name.includes('complaint') ||
    name.includes('grievance') ||
    name.includes('report_to_hr') ||
    name.includes('hr_complaint') ||
    name.includes('text_message') ||
    name.includes('text_messages')
  ) {
    return 'Workplace Communications';
  }

  // Pay records
  if (
    w2ish ||
    name.includes('wage') ||
    name.includes('payroll') ||
    name.includes('paystub') ||
    name.includes('pay stub') ||
    name.includes('earnings') ||
    /\btax\b/.test(name) ||
    name.includes('pay') ||
    name.includes('stub') ||
    name.includes('salary')
  ) {
    return 'Pay Records / Payroll';
  }

  if (name.includes('time') || name.includes('timecard') || name.includes('hours')) return 'Time Records';
  if (name.includes('email') || name.includes('slack') || name.includes('message')) return 'Workplace Communications';
  if (name.includes('offer')) return 'Offer Letters';
  if (name.includes('pto') || name.includes('vacation')) return 'PTO Records';
  if (name.includes('policy') || name.includes('handbook') || name.includes('hr')) return 'HR Documents';
  if (name.includes('expense') || name.includes('reimburse')) return 'Reimbursement Records';
  if (name.includes('review') || name.includes('performance')) return 'Performance Reviews';
  return 'Uncategorized';
}

/** Strong title cues — used only when deciding whether a rename may change stored category. */
function fileNameHasStrongCategorySignal(fileName: string, category: string): boolean {
  const n = fileName.toLowerCase();
  switch (category) {
    case 'Pay Records / Payroll':
      return /\b(pay\s*stub|paystub|payroll|paycheck|pay\s*record|final\s*pay|w[-\s]?2|wage\s+statement)\b/i.test(
        n
      );
    case 'Time Records':
      return /\b(timecard|time\s*card|timesheet|time\s*sheet)\b/i.test(n);
    case 'Workplace Communications':
      return /\b(hr\s+email|workplace\s+email|email|slack|message)\b/i.test(n);
    case 'Offer Letters':
      return /\b(offer\s+letter|offer\s+of\s+employment)\b/i.test(n);
    case 'PTO Records':
      return /\b(pto|paid\s+time\s+off|vacation\s+request)\b/i.test(n);
    case 'HR Documents':
      return /\b(handbook|hr\s+document|policy|human\s+resources)\b/i.test(n);
    case 'Reimbursement Records':
      return /\b(reimbursement|expense\s+report)\b/i.test(n);
    case 'Performance Reviews':
      return /\b(performance\s+review|discipline|write[\s-]?up)\b/i.test(n);
    default:
      return false;
  }
}

/**
 * Keep stored category stable on custom renames; allow upgrades from Uncategorized
 * and explicit attorney-friendly title patterns (e.g. accepted suggestions).
 */
export function resolveCategoryAfterFileRename(
  previousCategory: string | null | undefined,
  nextFileName: string
): string {
  const prior = (previousCategory ?? '').trim() || 'Uncategorized';
  const inferred = inferCategoryFromFileName(nextFileName);
  if (prior === 'Uncategorized') return inferred;
  if (inferred === 'Uncategorized') return prior;
  if (inferred === prior) return prior;
  if (fileNameHasStrongCategorySignal(nextFileName, inferred)) return inferred;
  return prior;
}

export function generateIntakeNumber(): string {
  return `O3S-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function generateFirmCode(seed?: string | null): string {
  const prefixSource = (seed ?? '')
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
  const prefix = (prefixSource || 'O3S').padEnd(3, 'X').slice(0, 3);
  const number = 10100 + Math.floor(Math.random() * 89900);
  return `${prefix}${number}`;
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
  promise: Promise<T>,
  timeoutMs: number = PROFILE_QUERY_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
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

export async function updateProfileRole(userId: string, role: 'worker' | 'firm'): Promise<{ error?: string }> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  return error ? { error: error.message } : {};
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

export async function fetchFirmProfileForUser(userId: string): Promise<FirmProfileRow | null> {
  const { data, error } = await supabase.from('firm_profiles').select('*').eq('profile_id', userId).maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data as FirmProfileRow | null;
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

export async function updateFirmProfile(
  firmId: string,
  patch: Partial<
    Pick<
      FirmProfileRow,
      'firm_name' | 'contact_email' | 'practice_areas' | 'geographic_filters' | 'subscription_status' | 'plan_id'
    >
  >
): Promise<{ error?: string }> {
  const { error } = await supabase.from('firm_profiles').update(patch).eq('id', firmId);
  return error ? { error: error.message } : {};
}

export async function createDraftIntake(
  workerId: string,
  opts?: {
    linked_firm_id?: string | null;
    submission_channel?: 'firm_code' | null;
    /** When set, used instead of the default O3S-* generated number. */
    intake_number?: string | null;
  }
): Promise<{ id?: string; intake_number?: string; error?: string }> {
  const custom = opts?.intake_number?.trim();
  const intake_number = custom || generateIntakeNumber();
  const insert: Record<string, unknown> = {
    worker_id: workerId,
    intake_number,
    status: 'draft',
    workflow_status: 'Upload Complete',
  };
  if (opts?.linked_firm_id) {
    insert.linked_firm_id = opts.linked_firm_id;
    insert.submission_channel = opts.submission_channel ?? 'firm_code';
  }
  const { data, error } = await supabase.from('intakes').insert(insert).select('id, intake_number').single();
  if (error) return { error: error.message };
  return { id: data.id, intake_number: data.intake_number };
}

export async function uploadIntakeFile(
  workerId: string,
  intakeId: string,
  file: File
): Promise<{
  error?: string;
  path?: string;
  uploadedFileId?: string;
  duplicate?: boolean;
  contentHash?: string;
}> {
  console.info('[o3s-upload] upload start', {
    workerId,
    intakeId,
    fileName: file.name,
    fileSize: file.size,
  });

  const { computeFileContentHash, buildFileFingerprint } = await import('./fileUploadIntegrity');
  let contentHash: string;
  try {
    contentHash = await computeFileContentHash(file);
  } catch (hashErr) {
    console.warn('[o3s-upload] content hash failed', { fileName: file.name, hashErr });
    return { error: 'Could not fingerprint this file for upload. Try again.' };
  }
  const fingerprint = buildFileFingerprint(file.name, file.size, contentHash);
  console.info('[o3s-upload] record fingerprint', { fileName: file.name, fingerprint });

  const { data: existingRows, error: existingErr } = await supabase
    .from('uploaded_files')
    .select('id, file_path, file_name, file_size, content_hash')
    .eq('intake_id', intakeId)
    .eq('content_hash', contentHash)
    .limit(1);
  if (existingErr && !existingErr.message.includes('content_hash')) {
    console.warn('[o3s-upload] duplicate lookup failed', { message: existingErr.message });
    return { error: existingErr.message };
  }
  const existing = existingRows?.[0];
  if (existing?.id && existing.file_path) {
    console.info('[o3s-upload] record duplication detected', {
      fileName: file.name,
      existingUploadedFileId: existing.id,
      existingPath: existing.file_path,
      fingerprint,
    });
    return {
      path: String(existing.file_path),
      uploadedFileId: String(existing.id),
      duplicate: true,
      contentHash,
    };
  }

  const safe = `${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
  const path = `${workerId}/${intakeId}/${safe}`;
  console.info('[o3s-upload] storage upload (before)', {
    workerId,
    intakeId,
    fileName: file.name,
    path,
    contentHash,
  });
  const { error: upErr } = await supabase.storage.from('intake-files').upload(path, file, { upsert: false });
  if (upErr) {
    console.warn('[o3s-upload] upload failure (storage)', { fileName: file.name, message: upErr.message });
    return { error: upErr.message, contentHash };
  }
  console.info('[o3s-upload] storage upload succeeded', { path, contentHash });

  const category = inferCategoryFromFileName(file.name);
  const insertPayload: Record<string, unknown> = {
    intake_id: intakeId,
    worker_id: workerId,
    file_name: file.name,
    file_path: path,
    file_type: file.type || null,
    file_size: file.size,
    category,
    content_hash: contentHash,
  };
  console.info('[o3s-upload] record creation (before)', {
    fileName: file.name,
    path,
    contentHash,
  });
  const { data: inserted, error: dbErr } = await supabase
    .from('uploaded_files')
    .insert(insertPayload)
    .select('id')
    .single();
  let dbInsertError = dbErr;
  let insertedRow = inserted;
  if (dbInsertError?.message.includes('content_hash')) {
    console.warn('[o3s-upload] content_hash column unavailable; inserting without hash dedupe');
    delete insertPayload.content_hash;
    const retry = await supabase.from('uploaded_files').insert(insertPayload).select('id').single();
    dbInsertError = retry.error;
    insertedRow = retry.data;
  }
  if (dbInsertError) {
    console.warn('[o3s-upload] upload failure (record creation)', {
      fileName: file.name,
      message: dbInsertError.message,
    });
    const { error: rollbackErr } = await supabase.storage.from('intake-files').remove([path]);
    if (rollbackErr) {
      console.error('[o3s-upload] storage rollback failed after record insert error', {
        path,
        message: rollbackErr.message,
      });
    } else {
      console.info('[o3s-upload] storage rollback succeeded after record insert error', { path });
    }
    if (dbInsertError.code === '23505') {
      const { data: raced } = await supabase
        .from('uploaded_files')
        .select('id, file_path')
        .eq('intake_id', intakeId)
        .eq('content_hash', contentHash)
        .maybeSingle();
      if (raced?.id && raced.file_path) {
        console.info('[o3s-upload] record duplication detected (insert race)', {
          fileName: file.name,
          existingUploadedFileId: raced.id,
          fingerprint,
        });
        return {
          path: String(raced.file_path),
          uploadedFileId: String(raced.id),
          duplicate: true,
          contentHash,
        };
      }
    }
    return { error: dbInsertError.message, contentHash };
  }
  const uploadedFileId = insertedRow?.id as string;
  console.info('[o3s-upload] upload success', {
    fileName: file.name,
    uploadedFileId: uploadedFileId ?? null,
    path,
    contentHash,
  });
  console.info('[o3s-upload] record creation succeeded', { uploadedFileId: uploadedFileId ?? null, path });
  if (uploadedFileId) {
    void import('./fileTextExtractionService')
      .then(({ runPhase2AFileTextExtraction }) =>
        runPhase2AFileTextExtraction({
          uploadedFileId,
          intakeId,
          workerId,
          fileName: file.name,
          fileType: file.type || null,
          filePath: path,
          fileSizeBytes: file.size,
        })
      )
      .catch((e) => console.error('Phase 2A file text extraction', e));
  }
  return { path, uploadedFileId, contentHash };
}

export async function listUploadedFiles(intakeId: string) {
  const { data, error } = await supabase
    .from('uploaded_files')
    .select('id, file_name, file_path, category, file_size, created_at')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function updateUploadedFileName(
  uploadedFileId: string,
  fileName: string
): Promise<{ error?: string; category?: string }> {
  const nextName = fileName.trim();
  if (!nextName) return { error: 'File name cannot be empty.' };

  const { data: existing, error: readErr } = await supabase
    .from('uploaded_files')
    .select('category')
    .eq('id', uploadedFileId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };

  const category = resolveCategoryAfterFileRename(
    (existing?.category as string | null) ?? null,
    nextName
  );

  const { error } = await supabase
    .from('uploaded_files')
    .update({
      file_name: nextName,
      category,
    })
    .eq('id', uploadedFileId);

  return error ? { error: error.message } : { category };
}

/** Rebuild summary/timeline/readiness when labels change after organization already ran. */
export async function refreshDerivedIntakeLabelsAfterFileRename(
  intakeId: string
): Promise<{ error?: string }> {
  const id = intakeId.trim();
  if (!id) return {};
  const { data: summary, error } = await supabase
    .from('intake_summaries')
    .select('id')
    .eq('intake_id', id)
    .limit(1)
    .maybeSingle();
  if (error && !isSchemaRelationUnavailable(error)) return { error: error.message };
  if (!summary) return {};
  return persistPlaceholderOrganizationForIntake(id);
}

export async function deleteUploadedFileAndStorage(
  uploadedFileId: string,
  filePath: string
): Promise<{ error?: string }> {
  const path = filePath.trim();
  if (!path) return { error: 'Missing storage path for uploaded file.' };

  const { error: storageError } = await supabase.storage.from('intake-files').remove([path]);
  if (storageError) return { error: storageError.message };

  const { error: rowError } = await supabase.from('uploaded_files').delete().eq('id', uploadedFileId);
  return rowError ? { error: rowError.message } : {};
}

/** When the DB has no timeline rows yet but files exist, insert one card per upload (no schema change). */
export type CompletedFileExtractionRow = {
  uploaded_file_id: string;
  intake_id: string;
  worker_id: string;
  extracted_text: string;
  extraction_status: string;
  quality_flags: Record<string, unknown> | null;
  uploaded_files: {
    id: string;
    file_name: string;
    category: string | null;
  } | null;
};

export async function listCompletedExtractionsForIntake(
  intakeId: string
): Promise<{ rows: CompletedFileExtractionRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('file_text_extractions')
    .select(
      'uploaded_file_id, intake_id, worker_id, extracted_text, extraction_status, quality_flags, uploaded_files!inner(id, file_name, category)'
    )
    .eq('intake_id', intakeId)
    .eq('extraction_status', 'completed');

  if (error) {
    if (isSchemaRelationUnavailable(error)) return { rows: [] };
    return { rows: [], error: error.message };
  }

  const rows = (data ?? [])
    .map((row: any) => {
      const file = Array.isArray(row.uploaded_files) ? row.uploaded_files[0] : row.uploaded_files;
      return {
        uploaded_file_id: String(row.uploaded_file_id ?? file?.id ?? ''),
        intake_id: String(row.intake_id ?? intakeId),
        worker_id: String(row.worker_id ?? ''),
        extracted_text: String(row.extracted_text ?? ''),
        extraction_status: String(row.extraction_status ?? ''),
        quality_flags: (row.quality_flags ?? null) as Record<string, unknown> | null,
        uploaded_files: file
          ? {
              id: String(file.id ?? row.uploaded_file_id ?? ''),
              file_name: String(file.file_name ?? 'Uploaded file'),
              category: (file.category as string | null) ?? null,
            }
          : null,
      } satisfies CompletedFileExtractionRow;
    })
    .filter((row: CompletedFileExtractionRow) => row.uploaded_file_id && safeTrim(row.extracted_text, 'file_text_extractions.extracted_text').length > 0);

  return { rows };
}

export async function getExtractionStatusForIntake(intakeId: string): Promise<{
  total: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
  missing: number;
  error?: string;
}> {
  const files = await listUploadedFiles(intakeId);
  if (!files.length) {
    return { total: 0, completed: 0, pending: 0, processing: 0, failed: 0, missing: 0 };
  }

  const { data, error } = await supabase
    .from('file_text_extractions')
    .select('uploaded_file_id, extraction_status')
    .eq('intake_id', intakeId);

  if (error) {
    if (isSchemaRelationUnavailable(error)) {
      return { total: files.length, completed: 0, pending: 0, processing: 0, failed: 0, missing: files.length };
    }
    return { total: files.length, completed: 0, pending: 0, processing: 0, failed: 0, missing: files.length, error: error.message };
  }

  const statusByFile = new Map<string, string>();
  for (const row of data ?? []) {
    statusByFile.set(String((row as any).uploaded_file_id), String((row as any).extraction_status ?? ''));
  }

  let completed = 0;
  let pending = 0;
  let processing = 0;
  let failed = 0;
  let missing = 0;
  for (const file of files) {
    const status = statusByFile.get(String(file.id));
    if (status === 'completed') completed += 1;
    else if (status === 'pending') pending += 1;
    else if (status === 'processing') processing += 1;
    else if (status === 'failed') failed += 1;
    else missing += 1;
  }

  return { total: files.length, completed, pending, processing, failed, missing };
}
export async function ensureTimelineEventsFromUploadedFiles(intakeId: string): Promise<{ error?: string }> {
  const files = await listUploadedFiles(intakeId);
  if (!files.length) return {};
  const { data: existing, error: exErr } = await supabase
    .from('timeline_events')
    .select('id')
    .eq('intake_id', intakeId)
    .limit(1);
  if (exErr && !isSchemaRelationUnavailable(exErr)) return { error: exErr.message };
  if (existing && existing.length > 0) return {};

  const { data: summaryRow, error: summaryErr } = await supabase
    .from('intake_summaries')
    .select('id')
    .eq('intake_id', intakeId)
    .limit(1)
    .maybeSingle();
  if (summaryErr && !isSchemaRelationUnavailable(summaryErr)) return { error: summaryErr.message };

  if (!summaryRow) {
    // Organization has not persisted yet; avoid timeline rows without O3S_ORG_ENGINE.
    return {};
  }

  return persistPlaceholderOrganizationForIntake(intakeId);
}

/** Embedded worker intake notes inside `intake_summaries.overview` (no new rows). */
const WORKER_INTAKE_NOTES_PATTERN =
  /\n--- O3S_WORKER_INTAKE_NOTES ---\n([\s\S]*?)\n--- O3S_WORKER_INTAKE_NOTES_END ---\n/;

const GUIDED_INTAKE_BLOCK_PATTERN =
  /--- O3S_GUIDED_INTAKE ---\n([\s\S]*?)\n--- O3S_GUIDED_INTAKE_END ---/;

const WORKER_STORY_BLOCK_PATTERN =
  /--- O3S_WORKER_STORY ---\n([\s\S]*?)\n--- O3S_WORKER_STORY_END ---/;

const STORY_FOLLOWUP_BLOCK_PATTERN =
  /--- O3S_STORY_FOLLOWUP ---\n([\s\S]*?)\n--- O3S_STORY_FOLLOWUP_END ---/;

const FIRM_INTERNAL_MARKERS_PATTERN =
  /---\s*O3S_WORKER_INTAKE_NOTES\s*---[\s\S]*?---\s*O3S_WORKER_INTAKE_NOTES_END\s*---/gi;

const FIRM_DOCUMENT_REQUEST_PATTERN =
  /\n--- O3S_FIRM_DOCUMENT_REQUEST ---\n([\s\S]*?)\n--- O3S_FIRM_DOCUMENT_REQUEST_END ---\n/;

const WORKER_DOCUMENT_RESPONSE_PATTERN =
  /\n--- O3S_WORKER_DOCUMENT_RESPONSE ---\n([\s\S]*?)\n--- O3S_WORKER_DOCUMENT_RESPONSE_END ---\n/;

/**
 * Worker contact (name/phone) copied into the firm-readable summary at share time.
 * Surfaced to the firm via the extracted `workerContact`, never as raw prose — so it
 * is stripped from all firm- and worker-facing display text by sanitizeFirmFacingText.
 */
const WORKER_CONTACT_PATTERN =
  /\n?---\s*O3S_WORKER_CONTACT\s*---[\s\S]*?---\s*O3S_WORKER_CONTACT_END\s*---\n?/gi;

/** MVP firm → worker document request categories (checkbox labels). */
export const FIRM_ADDITIONAL_DOCUMENT_CATEGORIES = [
  'Pay records / paystubs',
  'Time records / timecards',
  'Schedules',
  'Offer letter / contract',
  'Handbook / policies',
  'HR or workplace messages',
  'Termination / final pay records',
  'Reimbursement records',
  'Performance / discipline records',
  'Other',
] as const;

export type FirmDocumentRequestPayload = {
  categories: string[];
  note: string;
};

export type WorkerDocumentResponsePayload = {
  fulfilled: string[];
  note: string;
};

export function extractFirmDocumentRequestFromOverview(
  overview: string | null | undefined
): FirmDocumentRequestPayload | null {
  const m = (overview ?? '').match(FIRM_DOCUMENT_REQUEST_PATTERN);
  if (!m?.[1]) return null;
  const body = m[1];
  const catLine = body.match(/^categories:(.*)$/m)?.[1]?.trim() ?? '';
  const note = body.match(/^note:(.*)$/m)?.[1]?.trim() ?? '';
  const categories = catLine
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (!categories.length && !note) return null;
  return { categories, note };
}

export function stripFirmDocumentRequestBlock(overview: string): string {
  return overview.replace(FIRM_DOCUMENT_REQUEST_PATTERN, '');
}

export function stripWorkerDocumentResponseBlock(overview: string): string {
  return overview.replace(WORKER_DOCUMENT_RESPONSE_PATTERN, '');
}

export function extractWorkerDocumentResponseFromOverview(
  overview: string | null | undefined
): WorkerDocumentResponsePayload | null {
  const m = (overview ?? '').match(WORKER_DOCUMENT_RESPONSE_PATTERN);
  if (!m?.[1]) return null;
  const body = m[1];
  const fulfilledLine = body.match(/^fulfilled:(.*)$/m)?.[1]?.trim() ?? '';
  const note = body.match(/^note:(.*)$/m)?.[1]?.trim() ?? '';
  const fulfilled = fulfilledLine
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (!fulfilled.length && !note) return null;
  return { fulfilled, note };
}

export function resolveWorkerDocumentResponse(
  overview: string | undefined,
  missing: string[] | undefined
): WorkerDocumentResponsePayload | null {
  const fromOverview = extractWorkerDocumentResponseFromOverview(overview);
  if (fromOverview && (fromOverview.fulfilled.length > 0 || fromOverview.note)) {
    return fromOverview;
  }

  const fulfilled: string[] = [];
  let note = '';
  for (const line of missing ?? []) {
    const t = line.trim();
    if (t.startsWith('Worker fulfilled:')) {
      fulfilled.push(t.slice('Worker fulfilled:'.length).trim());
    } else if (t.startsWith('Worker note to firm:')) {
      note = t.slice('Worker note to firm:'.length).trim();
    }
  }
  if (fulfilled.length > 0 || note) {
    return { fulfilled, note };
  }
  return null;
}

function buildWorkerDocumentResponseBlock(fulfilled: string[], note: string): string {
  const cats = fulfilled.map((c) => c.trim()).filter(Boolean);
  if (!cats.length && !note.trim()) return '';
  const noteLine = note.trim().replace(/\n/g, ' ');
  return (
    `\n--- O3S_WORKER_DOCUMENT_RESPONSE ---\n` +
    `fulfilled:${cats.join('|')}\n` +
    `note:${noteLine}\n` +
    `--- O3S_WORKER_DOCUMENT_RESPONSE_END ---\n`
  );
}

/** Remove internal worker-note markers and stray O3S blocks from attorney-facing copy. */
export function sanitizeFirmFacingText(text: string | null | undefined): string {
  return polishFirmFacingProse(
    stripOrgEngineBlock(
      stripFirmFacingArtifacts(
        (text ?? '')
          .replace(FIRM_INTERNAL_MARKERS_PATTERN, '')
          .replace(FIRM_DOCUMENT_REQUEST_PATTERN, '')
          .replace(WORKER_DOCUMENT_RESPONSE_PATTERN, '')
          .replace(WORKER_CONTACT_PATTERN, '')
      )
    )
  );
}

export function stripWorkerIntakeNotesBlock(overview: string): string {
  return sanitizeFirmFacingText(
    stripWorkerDocumentResponseBlock(stripFirmDocumentRequestBlock(overview.replace(WORKER_INTAKE_NOTES_PATTERN, '')))
  );
}

export function extractWorkerIntakeNotesFromOverview(overview: string | null | undefined): string {
  const m = (overview ?? '').match(WORKER_INTAKE_NOTES_PATTERN);
  return m?.[1]?.trim() ?? '';
}

export type ParsedWorkerIntakeNotes = {
  guidedSummary: string | null;
  workerStory: string | null;
  additionalNotes: string | null;
};

function stripEmbeddedWorkerNoteBlocks(notesBody: string): string {
  return notesBody
    .replace(GUIDED_INTAKE_BLOCK_PATTERN, '')
    .replace(WORKER_STORY_BLOCK_PATTERN, '')
    .replace(STORY_FOLLOWUP_BLOCK_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse worker notes embedded in overview (guided metadata, story, free-form notes). */
export function parseWorkerIntakeNotesContent(notesBody: string | null | undefined): ParsedWorkerIntakeNotes {
  const raw = (notesBody ?? '').trim();
  if (!raw) {
    return { guidedSummary: null, workerStory: null, additionalNotes: null };
  }

  const guidedMatch = raw.match(GUIDED_INTAKE_BLOCK_PATTERN);
  const guidedSummary = guidedMatch?.[1]?.trim() || null;

  const storyMatch = raw.match(WORKER_STORY_BLOCK_PATTERN);
  let workerStory = storyMatch?.[1]?.trim() || null;

  if (!workerStory && guidedMatch) {
    const afterGuided = raw.slice(guidedMatch.index! + guidedMatch[0].length).trim();
    const legacyStory = afterGuided.replace(WORKER_STORY_BLOCK_PATTERN, '').trim();
    if (legacyStory && !legacyStory.startsWith('--- O3S_')) {
      workerStory = legacyStory;
    }
  }

  let additionalNotes = stripEmbeddedWorkerNoteBlocks(raw);
  if (workerStory && additionalNotes === workerStory) {
    additionalNotes = '';
  }
  if (guidedSummary && additionalNotes.includes(guidedSummary)) {
    additionalNotes = additionalNotes.replace(guidedSummary, '').trim();
  }

  return {
    guidedSummary,
    workerStory,
    additionalNotes: additionalNotes || null,
  };
}

export function parseWorkerIntakeNotesFromOverview(
  overview: string | null | undefined
): ParsedWorkerIntakeNotes {
  return parseWorkerIntakeNotesContent(extractWorkerIntakeNotesFromOverview(overview));
}

export function extractWorkerStoryFromOverview(overview: string | null | undefined): string | null {
  return parseWorkerIntakeNotesFromOverview(overview).workerStory;
}

export function extractWorkerAdditionalNotesFromOverview(
  overview: string | null | undefined
): string | null {
  return parseWorkerIntakeNotesFromOverview(overview).additionalNotes;
}

/** Rebuild embedded worker-notes body while preserving guided + story blocks. */
export function rebuildWorkerIntakeNotesBody(parsed: ParsedWorkerIntakeNotes): string {
  const parts: string[] = [];
  if (parsed.guidedSummary) {
    parts.push('--- O3S_GUIDED_INTAKE ---', parsed.guidedSummary, '--- O3S_GUIDED_INTAKE_END ---');
  }
  if (parsed.workerStory) {
    parts.push('--- O3S_WORKER_STORY ---', parsed.workerStory, '--- O3S_WORKER_STORY_END ---');
  }
  if (parsed.additionalNotes?.trim()) {
    parts.push(parsed.additionalNotes.trim());
  }
  return parts.join('\n\n');
}

function formatWorkerProvidedContextForFirmView(parsed: ParsedWorkerIntakeNotes): string | undefined {
  const parts: string[] = [];
  if (parsed.workerStory) parts.push(parsed.workerStory);
  if (parsed.additionalNotes) parts.push(parsed.additionalNotes);
  if (parsed.guidedSummary) parts.push(parsed.guidedSummary);
  const combined = parts.join('\n\n').trim();
  return combined || undefined;
}

/** Worker free-form notes + optional per-timeline context for firm review (not legal analysis). */
export function resolveWorkerProvidedContextForFirmView(
  overviewRaw: string | null | undefined,
  timelineWorkerContexts: string[],
  options?: { includeTimelineContext?: boolean }
): string | undefined {
  const parsed = parseWorkerIntakeNotesFromOverview(overviewRaw);
  const structured = formatWorkerProvidedContextForFirmView(parsed);
  const followUp = extractStoryFollowUpFromOverview(overviewRaw);
  const followUpText = followUp ? formatStoryFollowUpForDisplay(followUp) : '';
  const includeTimeline = options?.includeTimelineContext !== false;
  const timeline = includeTimeline
    ? timelineWorkerContexts
        .map((c) => c.trim())
        .filter(Boolean)
        .join('\n\n')
    : '';
  const parts = [structured, followUpText, timeline].filter(Boolean);
  if (!parts.length) return undefined;
  const combined = parts.join('\n\n');
  return polishFirmFacingProse(combined) || undefined;
}

export function mergeWorkerIntakeNotesIntoOverview(
  overview: string | null | undefined,
  notes: string
): string {
  const base = stripWorkerIntakeNotesBlock(overview ?? '').replace(/\s+$/u, '');
  const t = safeTrim(notes, 'mergeWorkerIntakeNotesIntoOverview.notes');
  if (!t) return base;
  return `${base}\n--- O3S_WORKER_INTAKE_NOTES ---\n${t}\n--- O3S_WORKER_INTAKE_NOTES_END ---\n`;
}

function extractFirmDocumentRequestBlockFromOverview(overview: string | null | undefined): string {
  const m = (overview ?? '').match(FIRM_DOCUMENT_REQUEST_PATTERN);
  return m?.[0] ?? '';
}

function extractFirmDocumentRequestAlertLines(alerts: string[] | null | undefined): string[] {
  return (alerts ?? []).filter((line, index) => {
    const t = safeTrim(line, `extractFirmDocumentRequestAlertLines[${index}]`);
    return t.startsWith('Firm requested:') || t.startsWith('Firm note:');
  });
}

function extractWorkerDocumentResponseBlockFromOverview(overview: string | null | undefined): string {
  const m = (overview ?? '').match(WORKER_DOCUMENT_RESPONSE_PATTERN);
  return m?.[0] ?? '';
}

function extractWorkerDocumentResponseAlertLines(alerts: string[] | null | undefined): string[] {
  return (alerts ?? []).filter((line, index) => {
    const t = safeTrim(line, `extractWorkerDocumentResponseAlertLines[${index}]`);
    return t.startsWith('Worker fulfilled:') || t.startsWith('Worker note to firm:');
  });
}

function mergeFirmDocumentRequestBlockIntoOverview(overview: string, block: string): string {
  if (
    !trimAssemblyValue(block, {
      file: 'intakeDataService.ts',
      line: 1485,
      variable: 'mergeFirmDocumentRequestBlockIntoOverview.block',
    })
  ) {
    return overview;
  }
  const base = overview.replace(FIRM_DOCUMENT_REQUEST_PATTERN, '').replace(/\s+$/u, '');
  return `${base}${block}`;
}

function mergeMissingDocumentAlertsPreservingRequestContext(
  rebuilt: string[],
  firmLines: string[],
  workerResponseLines: string[]
): string[] {
  const rebuiltFiltered = rebuilt.filter((line, index) => {
    const t = safeTrim(line, `missingDocumentAlerts.rebuilt[${index}]`);
    return (
      !t.startsWith('Firm requested:') &&
      !t.startsWith('Firm note:') &&
      !t.startsWith('Worker fulfilled:') &&
      !t.startsWith('Worker note to firm:')
    );
  });
  const seen = new Set<string>();
  const out: string[] = [];
  const merged = [...firmLines, ...workerResponseLines, ...rebuiltFiltered];
  for (let index = 0; index < merged.length; index += 1) {
    const line = merged[index];
    const key = safeTrim(line, `missingDocumentAlerts.merged[${index}]`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(typeof line === 'string' ? line : key);
  }
  return out;
}

function resolveWorkflowStatusAfterReorganization(
  priorWorkflow: string | null | undefined,
  hasFirmDocRequest: boolean
): string {
  const prior = trimAssemblyValue(priorWorkflow, {
    file: 'intakeDataService.ts',
    line: 1529,
    variable: 'resolveWorkflowStatusAfterReorganization.priorWorkflow',
  });
  if (prior === 'Additional Documents Requested') return 'Additional Documents Requested';
  if (
    prior === 'Worker Uploaded Additional Documents' ||
    prior === 'Worker Uploaded Requested Documents'
  ) {
    return prior;
  }
  if (hasFirmDocRequest && prior) return prior;
  return 'Intake Summary Generated';
}

/** Read persisted worker document-request response + workflow (no local/optimistic state). */
export async function getPersistedWorkerDocumentRequestState(intakeId: string): Promise<{
  workflowStatus: string;
  response: WorkerDocumentResponsePayload | null;
}> {
  const bundle = await fetchIntakeSummaryBundle(intakeId);
  const workflowStatus =
    ((bundle.intake as { workflow_status?: string } | null)?.workflow_status ?? '').trim();
  const summary = bundle.summary as {
    overview?: string;
    missing_document_alerts?: string[];
  } | null;
  const response = resolveWorkerDocumentResponse(
    summary?.overview,
    summary?.missing_document_alerts ?? []
  );
  return { workflowStatus, response };
}

export function isWorkerDocumentRequestResponseComplete(
  workflowStatus: string,
  response: WorkerDocumentResponsePayload | null
): boolean {
  const status = workflowStatus.trim();
  const uploadedAdditional =
    status === 'Worker Uploaded Additional Documents' ||
    status === 'Worker Uploaded Requested Documents';
  return uploadedAdditional && Boolean(response && response.fulfilled.length > 0);
}

async function notifyFirmWorkerDocumentsSubmitted(
  intakeId: string,
  routeId?: string | null
): Promise<{ notified: boolean; warning?: string }> {
  const { data, error } = await supabase.rpc('worker_notify_firm_documents_submitted', {
    p_intake_id: intakeId,
    p_route_id: routeId ?? null,
  });
  if (error) {
    if (isMissingRpcError(error)) {
      return {
        notified: false,
        warning:
          'Firm notification RPC is not deployed yet (worker_notify_firm_documents_submitted migration).',
      };
    }
    return { notified: false, warning: error.message };
  }
  const notified = data === true;
  return {
    notified,
    warning: notified ? undefined : 'No firm route or firm user found for this intake.',
  };
}

/** Worker confirms which requested categories new uploads satisfy; advances workflow for firm review. */
export async function confirmWorkerDocumentRequestResponse(
  intakeId: string,
  payload: { fulfilledCategories: string[]; noteToFirm: string }
): Promise<{ error?: string }> {
  const fulfilled = payload.fulfilledCategories.map((c) => c.trim()).filter(Boolean);
  if (!fulfilled.length) {
    return { error: 'Select at least one category you are sending back to the firm.' };
  }

  const { data: row, error } = await supabase
    .from('intake_summaries')
    .select('id, overview, missing_document_alerts')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: 'No intake summary exists yet for this intake.' };

  const overview = (row.overview as string | null) ?? '';
  const alerts = (row.missing_document_alerts as string[] | null) ?? [];
  const originalOverview = overview;
  const originalAlerts = [...alerts];
  const firmBlock = extractFirmDocumentRequestBlockFromOverview(overview);
  const firmAlerts = extractFirmDocumentRequestAlertLines(alerts);
  const otherAlerts = alerts.filter((line) => {
    const t = line.trim();
    return (
      !t.startsWith('Firm requested:') &&
      !t.startsWith('Firm note:') &&
      !t.startsWith('Worker fulfilled:') &&
      !t.startsWith('Worker note to firm:')
    );
  });

  const workerBlock = buildWorkerDocumentResponseBlock(fulfilled, payload.noteToFirm);
  const baseOverview = stripWorkerDocumentResponseBlock(stripFirmDocumentRequestBlock(overview)).replace(/\s+$/u, '');
  let nextOverview = baseOverview;
  if (firmBlock) nextOverview = mergeFirmDocumentRequestBlockIntoOverview(nextOverview, firmBlock);
  if (workerBlock) nextOverview = `${nextOverview.replace(/\s+$/u, '')}${workerBlock}`;

  const workerAlerts: string[] = fulfilled.map((c) => `Worker fulfilled: ${c}`);
  const noteTrimmed = payload.noteToFirm.trim();
  if (noteTrimmed) workerAlerts.push(`Worker note to firm: ${noteTrimmed}`);

  const nextAlerts = [...firmAlerts, ...workerAlerts, ...otherAlerts];

  const rollbackSummary = async () => {
    await supabase
      .from('intake_summaries')
      .update({
        overview: originalOverview,
        missing_document_alerts: originalAlerts,
      })
      .eq('id', row.id as string);
  };

  const { error: se } = await supabase
    .from('intake_summaries')
    .update({
      overview: nextOverview,
      missing_document_alerts: nextAlerts,
    })
    .eq('id', row.id as string);
  if (se) return { error: se.message };

  const wf = await updateIntakeWorkflowStatus(intakeId, 'Worker Uploaded Requested Documents');
  if (wf.error) {
    await rollbackSummary();
    return { error: wf.error };
  }

  const persisted = await getPersistedWorkerDocumentRequestState(intakeId);
  if (!isWorkerDocumentRequestResponseComplete(persisted.workflowStatus, persisted.response)) {
    await updateIntakeWorkflowStatus(intakeId, 'Additional Documents Requested');
    await rollbackSummary();
    return {
      error:
        'Your response did not save completely. Check your connection and confirm again.',
    };
  }

  const notifyResult = await notifyFirmWorkerDocumentsSubmitted(intakeId);
  if (!notifyResult.notified) {
    console.warn('[o3s-notifications] firm not notified after worker document response', {
      intakeId,
      warning: notifyResult.warning,
    });
  }

  return {};
}

/** Replace worker intake notes on the latest summary row for this intake (updates same row only). */
export async function setWorkerIntakeNotesInLatestIntakeSummary(
  intakeId: string,
  notes: string
): Promise<{ error?: string }> {
  const { data: row, error } = await supabase
    .from('intake_summaries')
    .select('id, overview')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: 'No intake summary exists yet for this intake.' };
  const overview = (row.overview as string | null) ?? '';
  const parsed = parseWorkerIntakeNotesFromOverview(overview);
  const body = rebuildWorkerIntakeNotesBody({
    ...parsed,
    additionalNotes: notes.trim() || null,
  });
  const next = mergeWorkerIntakeNotesIntoOverview(stripWorkerIntakeNotesBlock(overview), body);
  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}

/**
 * Merges upload-step free-form context into the latest summary's worker-notes block
 * (same markers as intake notes), prepending so upload context stays ahead of existing notes.
 */
export async function mergeUploadContextIntoLatestIntakeSummary(
  intakeId: string,
  uploadContext: string
): Promise<{ error?: string }> {
  const trimmed = uploadContext.trim();
  if (!trimmed) return {};

  const { data: row, error } = await supabase
    .from('intake_summaries')
    .select('id, overview')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: 'No intake summary exists yet for this intake.' };

  const overview = (row.overview as string | null) ?? '';
  const parsed = parseWorkerIntakeNotesFromOverview(overview);
  const priorAdditional = parsed.additionalNotes?.trim() ?? '';
  const combinedAdditional = priorAdditional ? `${trimmed}\n\n${priorAdditional}` : trimmed;
  const base = stripWorkerIntakeNotesBlock(overview).replace(/\s+$/u, '');
  const body = rebuildWorkerIntakeNotesBody({ ...parsed, additionalNotes: combinedAdditional });
  const next = mergeWorkerIntakeNotesIntoOverview(base, body);

  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}

type IntakeSummaryRowPayload = SummaryRowPayload;

/**
 * Save intake summary without deleting existing rows first.
 * Schema has no unique on intake_id, so this uses update-latest-or-insert (upsert-equivalent).
 */
async function upsertIntakeSummaryRow(
  intakeId: string,
  payload: IntakeSummaryRowPayload
): Promise<{ error?: string; stage?: string; summaryId?: string | null; operation?: 'insert' | 'update' }> {
  const { data: existingRow, error: existingErr } = await supabase
    .from('intake_summaries')
    .select('id')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingErr && !isSchemaRelationUnavailable(existingErr)) {
    logSummarySaveError('intake_summaries preload for save', existingErr, {
      intakeId,
      code: existingErr.code,
      message: existingErr.message,
      details: existingErr.details,
      hint: existingErr.hint,
    });
    return { error: existingErr.message, stage: 'intake_summaries_preload_for_save' };
  }

  if (isSchemaRelationUnavailable(existingErr)) {
    return { error: 'intake_summaries table unavailable', stage: 'intake_summaries_schema_unavailable' };
  }

  if (existingRow?.id) {
    const summaryId = String(existingRow.id);
    const { data: updated, error: updateErr } = await supabase
      .from('intake_summaries')
      .update(payload)
      .eq('id', summaryId)
      .select('id')
      .single();

    logSupabaseWriteResult('intake_summaries', 'update', {
      intakeId,
      summaryId: updated?.id ?? summaryId,
      operation: 'update',
      error: updateErr
        ? {
            message: updateErr.message,
            code: updateErr.code,
            details: updateErr.details,
            hint: updateErr.hint,
          }
        : null,
      ...measurePayload('overview', payload.overview),
      readinessIndicatorCount: payload.readiness_indicators.length,
      missingAlertCount: payload.missing_document_alerts.length,
    });

    if (updateErr && !isSchemaRelationUnavailable(updateErr)) {
      logSummarySaveError('intake_summaries save', updateErr, {
        intakeId,
        operation: 'update',
        summaryId,
        code: updateErr.code,
        message: updateErr.message,
        details: updateErr.details,
        hint: updateErr.hint,
        ...measurePayload('overview', payload.overview),
      });
      return { error: updateErr.message, stage: 'intake_summaries_update' };
    }

    return { summaryId: String(updated?.id ?? summaryId), operation: 'update' };
  }

  const insertPayload = { intake_id: intakeId, ...payload };
  const { data: inserted, error: insertErr } = await supabase
    .from('intake_summaries')
    .insert(insertPayload)
    .select('id')
    .single();

  logSupabaseWriteResult('intake_summaries', 'insert', {
    intakeId,
    summaryId: inserted?.id ?? null,
    operation: 'insert',
    error: insertErr
      ? {
          message: insertErr.message,
          code: insertErr.code,
          details: insertErr.details,
          hint: insertErr.hint,
        }
      : null,
    ...measurePayload('overview', payload.overview),
    readinessIndicatorCount: payload.readiness_indicators.length,
    missingAlertCount: payload.missing_document_alerts.length,
  });

  if (insertErr && !isSchemaRelationUnavailable(insertErr)) {
    logSummarySaveError('intake_summaries save', insertErr, {
      intakeId,
      operation: 'insert',
      code: insertErr.code,
      message: insertErr.message,
      details: insertErr.details,
      hint: insertErr.hint,
      ...measurePayload('overview', payload.overview),
    });
    return { error: insertErr.message, stage: 'intake_summaries_insert' };
  }

  return { summaryId: inserted?.id ? String(inserted.id) : null, operation: 'insert' };
}

function completedExtractionRowToFactInput(row: CompletedFileExtractionRow): PayRecordExtractionInput {
  return {
    uploaded_file_id: row.uploaded_file_id,
    file_name: row.uploaded_files?.file_name ?? 'Uploaded file',
    category: row.uploaded_files?.category ?? null,
    extracted_text: row.extracted_text,
  };
}

function runAssemblyStep<T>(step: string, intakeId: string, fn: () => T): T {
  logSummarySave(`assembly step: ${step} start`, { intakeId });
  logOrgAudit(`assembly step start: ${step}`, { intakeId, activeStep: step });
  try {
    const result = fn();
    logSummarySave(`assembly step: ${step} done`, { intakeId });
    logOrgAuditBoundary(intakeId, { step: `assembly:${step}`, success: true });
    return result;
  } catch (error) {
    logSummarySaveError(`assembly step: ${step}`, error, { intakeId });
    logOrgAuditError(`assembly step failed: ${step}`, error, { intakeId, activeStep: step });
    throw error;
  }
}

type EnrichedAssemblyResult = {
  payload: SummaryRowPayload;
  workflowStatus: string;
};

function assembleEnrichedSummaryPayload(input: {
  intakeId: string;
  org: PlaceholderOrganizationResult;
  extractionRows: CompletedFileExtractionRow[];
  preservedWorkerNotes: string;
  preservedFirmRequestBlock: string;
  preservedFirmRequestAlerts: string[];
  preservedWorkerResponseBlock: string;
  preservedWorkerResponseAlerts: string[];
  priorWorkflow: string | null | undefined;
  hasFirmDocRequest: boolean;
}): EnrichedAssemblyResult {
  const {
    intakeId,
    org,
    extractionRows,
    preservedWorkerNotes,
    preservedFirmRequestBlock,
    preservedFirmRequestAlerts,
    preservedWorkerResponseBlock,
    preservedWorkerResponseAlerts,
    priorWorkflow,
    hasFirmDocRequest,
  } = input;

  const payFacts = runAssemblyStep('extract pay/comm facts', intakeId, () =>
    extractionRows
      .map((row) => extractPayRecordFacts(completedExtractionRowToFactInput(row)))
      .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact))
  );
  const commFacts = runAssemblyStep('extract communication facts', intakeId, () =>
    extractionRows
      .map((row) => extractCommunicationFacts(completedExtractionRowToFactInput(row)))
      .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact))
  );

  const payDigest = runAssemblyStep('buildPayRecordFactDigest', intakeId, () =>
    buildPayRecordFactDigest(payFacts)
  );
  const commDigest = runAssemblyStep('buildCommunicationFactDigest', intakeId, () =>
    buildCommunicationFactDigest(commFacts)
  );

  const readinessIndicators = runAssemblyStep('readinessIndicators merge', intakeId, () =>
    Array.from(
      new Set(
        [
          ...payDigest,
          ...commDigest,
          ...sanitizeStringArray(org.readinessIndicators, 'org.readinessIndicators'),
        ].filter((line, index) => safeTrim(line, `readinessIndicators[${index}]`).length > 0)
      )
    )
  );

  const sectionsToStore = runAssemblyStep('refreshSectionsReviewNotes', intakeId, () =>
    refreshSectionsReviewNotes(org.sections, readinessIndicators, org.reviewItems)
  );

  let overviewToStore = runAssemblyStep('record/firm review merge', intakeId, () =>
    mergeRecordStoryIntoOverview(
      mergeFirmReviewSummaryIntoOverview(org.overview, org.firmReviewSummary),
      org.recordStory
    )
  );

  overviewToStore = runAssemblyStep('org engine merge', intakeId, () =>
    mergeOrgEngineIntoOverview(overviewToStore, {
      version: 1,
      file_records: org.fileRecords,
      people_index: org.peopleIndex,
      generated_at: new Date().toISOString(),
      timeline_events: org.evidenceTimeline,
      sections: sectionsToStore,
    })
  );

  if (preservedWorkerNotes) {
    overviewToStore = runAssemblyStep('worker notes merge', intakeId, () =>
      mergeWorkerIntakeNotesIntoOverview(
        overviewToStore,
        safeTrim(preservedWorkerNotes, 'preservedWorkerNotes')
      )
    );
  }

  if (preservedFirmRequestBlock) {
    overviewToStore = runAssemblyStep('firm request block merge', intakeId, () =>
      mergeFirmDocumentRequestBlockIntoOverview(overviewToStore, preservedFirmRequestBlock)
    );
  }

  if (preservedWorkerResponseBlock) {
    overviewToStore = runAssemblyStep('worker response block merge', intakeId, () =>
      `${overviewToStore.replace(/\s+$/u, '')}${preservedWorkerResponseBlock}`
    );
  }

  const missingAlertsToStore = runAssemblyStep('missing alerts merge', intakeId, () =>
    mergeMissingDocumentAlertsPreservingRequestContext(
      sanitizeStringArray(org.missingDocumentSuggestions, 'org.missingDocumentSuggestions'),
      preservedFirmRequestAlerts,
      preservedWorkerResponseAlerts
    )
  );

  const workflowStatusToStore = runAssemblyStep('workflow status resolve', intakeId, () =>
    resolveWorkflowStatusAfterReorganization(priorWorkflow, hasFirmDocRequest)
  );

  return {
    payload: {
      overview: safeTrim(overviewToStore, 'enriched.overview') || buildCoreSummaryPayload(org).overview,
      timeline_summary:
        safeTrim(org.timelineSummary, 'enriched.timelineSummary') ||
        buildCoreSummaryPayload(org).timeline_summary,
      readiness_indicators: readinessIndicators,
      missing_document_alerts: missingAlertsToStore,
    },
    workflowStatus: workflowStatusToStore,
  };
}

async function saveTimelineEventsForIntake(
  intakeId: string,
  timelineEvents: PlaceholderOrganizationResult['timelineEvents']
): Promise<{ error?: string; stage?: string }> {
  const delTe = await supabase.from('timeline_events').delete().eq('intake_id', intakeId);
  logSupabaseWriteResult('timeline_events', 'delete', {
    intakeId,
    error: delTe.error ? { message: delTe.error.message, code: delTe.error.code } : null,
    schemaUnavailable: isSchemaRelationUnavailable(delTe.error),
  });
  if (isSchemaRelationUnavailable(delTe.error)) {
    return { stage: 'timeline_events_schema_unavailable' };
  }
  if (delTe.error) {
    logSummarySaveError('timeline_events delete', delTe.error, { intakeId, code: delTe.error.code });
    return { error: delTe.error.message, stage: 'timeline_events_delete' };
  }

  if (!timelineEvents.length) {
    return {};
  }

  const { error: te } = await supabase.from('timeline_events').insert(
    timelineEvents.map((e) => ({
      intake_id: intakeId,
      event_date: safeTrim(e.eventDate, 'timeline.eventDate') || null,
      title: safeTrim(e.title, 'timeline.title') || 'Timeline event',
      category: safeTrim(e.category, 'timeline.category') || 'Uncategorized',
      ai_summary: safeTrim(e.aiSummary, 'timeline.aiSummary') || '',
      worker_context: encodeTimelineWorkerContext('', e.source ?? {
        sourceFileIds: [],
        sourceFileNames: [],
        sourceDocumentTypes: [],
        sourceDates: [],
        sourceStrength: 'needs_review',
      }),
    }))
  );
  logSupabaseWriteResult('timeline_events', 'insert', {
    intakeId,
    rowCount: timelineEvents.length,
    error: te ? { message: te.message, code: te.code, details: te.details, hint: te.hint } : null,
  });
  if (te && !isSchemaRelationUnavailable(te)) {
    logSummarySaveError('timeline_events insert', te, {
      intakeId,
      code: te.code,
      rowCount: timelineEvents.length,
    });
    return { error: te.message, stage: 'timeline_events_insert' };
  }
  return {};
}

function appendUniqueWorkerContextChunk(chunks: string[], next: string): void {
  const text = next.trim();
  if (!text) return;
  const hay = chunks.join('\n\n').toLowerCase();
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const novelLines = lines.filter((line) => !hay.includes(line.toLowerCase()));
  if (!novelLines.length) return;
  if (novelLines.length === lines.length) {
    chunks.push(text);
    return;
  }
  chunks.push(novelLines.join('\n'));
}

/** Worker narrative + Story Details for document-grounded mining (never throws). */
export function buildWorkerContextForMining(
  preservedWorkerNotes: string | null | undefined,
  workerMetadataRaw: unknown
): string {
  try {
    const chunks: string[] = [];
    const notes = (preservedWorkerNotes ?? '').trim();
    if (notes) chunks.push(notes);

    const metadata = parseWorkerIntakeMetadata(workerMetadataRaw);
    appendUniqueWorkerContextChunk(chunks, metadata.workerStory?.trim() ?? '');

    if (metadata.storyFollowUp) {
      try {
        appendUniqueWorkerContextChunk(
          chunks,
          formatStoryFollowUpForDisplay(metadata.storyFollowUp)
        );
      } catch {
        /* non-fatal: continue without formatted Story Details */
      }
    }

    return chunks.join('\n\n').trim();
  } catch {
    return (preservedWorkerNotes ?? '').trim();
  }
}

export async function persistPlaceholderOrganizationForIntake(
  intakeId: string,
  opts?: { employmentMatterTags?: EmploymentMatterTagId[] }
): Promise<{ error?: string; stage?: string }> {
  const startedAt = Date.now();
  logSummarySave('organization persist start', { intakeId });

  let files: Awaited<ReturnType<typeof listUploadedFiles>>;
  try {
    files = await listUploadedFiles(intakeId);
  } catch (filesError) {
    logSummarySaveError('uploaded_files list', filesError, { intakeId });
    return { error: 'Could not load uploaded files for this intake.', stage: 'uploaded_files_list' };
  }
  logSummarySave('uploaded_files loaded', { intakeId, fileCount: files.length });

  logOrgAudit('persist start', {
    intakeId,
    activeStep: 'persist_start',
    uploadedFileCount: files.length,
  });

  const safeMeta = files.map((f) => ({
    uploadedFileId: String(f.id),
    fileName: String(f.file_name ?? 'Uploaded file'),
    category: f.category ?? 'Uncategorized',
  }));

  const [{ data: previousSummary, error: previousSummaryError }, { data: priorIntake, error: priorIntakeError }] =
    await Promise.all([
      supabase
        .from('intake_summaries')
        .select('overview, missing_document_alerts')
        .eq('intake_id', intakeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('intakes').select('workflow_status, worker_metadata').eq('id', intakeId).maybeSingle(),
    ]);

  if (previousSummaryError && !isSchemaRelationUnavailable(previousSummaryError)) {
    logSummarySaveError('intake_summaries preload', previousSummaryError, { intakeId, code: previousSummaryError.code });
    return { error: previousSummaryError.message, stage: 'intake_summaries_preload' };
  }
  if (priorIntakeError) {
    logSummarySaveError('intakes preload', priorIntakeError, { intakeId, code: priorIntakeError.code });
    if (priorIntakeError.message.includes('worker_metadata')) {
      logSummarySave('worker_metadata column unavailable (non-fatal)', { intakeId });
    } else {
      return { error: priorIntakeError.message, stage: 'intakes_preload' };
    }
  } else {
    logSummarySave('intakes preload ok', {
      intakeId,
      workflowStatus: priorIntake?.workflow_status ?? null,
      hasWorkerMetadata: priorIntake?.worker_metadata != null,
    });
  }

  const previousOverview = (previousSummary?.overview as string | null) ?? '';
  const previousAlerts = (previousSummary?.missing_document_alerts as string[] | null) ?? [];
  const preservedWorkerNotes = extractWorkerIntakeNotesFromOverview(previousOverview);
  const workerContextForMining = buildWorkerContextForMining(
    preservedWorkerNotes,
    priorIntake?.worker_metadata
  );
  const preservedFirmRequestBlock = extractFirmDocumentRequestBlockFromOverview(previousOverview);
  const preservedFirmRequestAlerts = extractFirmDocumentRequestAlertLines(previousAlerts);
  const preservedWorkerResponseBlock = extractWorkerDocumentResponseBlockFromOverview(previousOverview);
  const preservedWorkerResponseAlerts = extractWorkerDocumentResponseAlertLines(previousAlerts);
  const hasFirmDocRequest =
    preservedFirmRequestBlock.length > 0 || preservedFirmRequestAlerts.length > 0;

  const employmentMatterTags =
    opts?.employmentMatterTags?.length
      ? opts.employmentMatterTags
      : extractEmploymentMatterTagsFromOverview(previousOverview);

  const extractionRes = await listCompletedExtractionsForIntake(intakeId);
  if (extractionRes.error) {
    logSummarySaveError('file_text_extractions list', extractionRes.error, { intakeId });
  }
  logSummarySave('extractions loaded', {
    intakeId,
    completedExtractionCount: extractionRes.rows.length,
    extractionError: extractionRes.error ?? null,
  });

  logOrgAudit('extractions loaded', {
    intakeId,
    activeStep: 'extractions_loaded',
    uploadedFileCount: files.length,
    extractionCount: extractionRes.rows.length,
    extractionError: extractionRes.error ?? null,
  });

  const completedExtractions = extractionRes.rows.map((row) => ({
    uploadedFileId: row.uploaded_file_id,
    fileName: row.uploaded_files?.file_name ?? 'Uploaded file',
    category: row.uploaded_files?.category ?? null,
    extractedText: String(row.extracted_text ?? ''),
    qualityFlags: row.quality_flags,
  }));

  let org: PlaceholderOrganizationResult;
  let generationUsedFallback = false;
  const generationStartedAt = Date.now();
  logOrgAudit('summary generation start', {
    intakeId,
    activeStep: 'summary_generation',
    uploadedFileCount: files.length,
    extractionCount: completedExtractions.length,
  });
  try {
    org =
      buildDocumentGroundedOrganization(safeMeta, completedExtractions, workerContextForMining, {
        employmentMatterTags,
      }) ??
      buildPlaceholderOrganization(safeMeta, { employmentMatterTags });
  } catch (generationError) {
    generationUsedFallback = true;
    logOrgAuditError('summary generation failed — placeholder fallback', generationError, {
      intakeId,
      activeStep: 'summary_generation',
      uploadedFileCount: files.length,
      extractionCount: completedExtractions.length,
    });
    try {
      org = buildPlaceholderOrganization(safeMeta, { employmentMatterTags });
    } catch (placeholderError) {
      logOrgAuditError('summary generation placeholder failed — minimal fallback', placeholderError, {
        intakeId,
        activeStep: 'summary_generation',
      });
      org = {
        recordStory: buildFallbackSummaryPayload(files.length).overview,
        firmReviewSummary: '',
        timelineSummary: buildFallbackSummaryPayload(files.length).timeline_summary,
        timelineEvents: [],
        documentCategories: [],
        readinessIndicators: [],
        missingDocumentSuggestions: [],
        overview: buildFallbackSummaryPayload(files.length).overview,
        reviewItems: [],
        fileRecords: [],
        peopleIndex: [],
        evidenceTimeline: [],
        sections: {
          executive_summary: buildFallbackSummaryPayload(files.length).overview,
          chronology: [],
          people_and_entities: [],
          supporting_records: [],
          potential_gaps: [],
          clarification_items: [],
          review_notes: [],
          disclaimer: '',
        },
      };
    }
  }
  logOrgAuditBoundary(intakeId, {
    step: 'summary_generation',
    success: true,
    fallbackUsed: generationUsedFallback,
  });
  logSummarySave('summary generation complete', {
    intakeId,
    ms: Date.now() - generationStartedAt,
    timelineEventCount: org.timelineEvents.length,
    evidenceTimelineCount: org.evidenceTimeline.length,
    fileRecordCount: org.fileRecords.length,
    sectionCount: org.sections.length,
    readinessIndicatorCount: org.readinessIndicators.length,
    generationUsedFallback,
  });
  logGeneratedSummaryPreview(intakeId, {
    overview: org.overview,
    timelineSummary: org.timelineSummary,
    readinessCount: org.readinessIndicators.length,
    missingCount: org.missingDocumentSuggestions.length,
    timelineEventCount: org.timelineEvents.length,
  });

  const corePayload = buildCoreSummaryPayload(org, { fileCount: files.length });
  logOrgAudit('core save start', {
    intakeId,
    activeStep: 'core_summary_save',
    uploadedFileCount: files.length,
    extractionCount: extractionRes.rows.length,
    summaryAssemblyStatus: 'core_pending',
  });
  logSummarySave('intake_summaries core save start', { intakeId });
  const coreSaveResult = await upsertIntakeSummaryRow(intakeId, corePayload);
  if (coreSaveResult.error) {
    logOrgAudit('core save failed', {
      intakeId,
      activeStep: 'core_summary_save',
      summarySaveStatus: 'failed',
      errorMessage: coreSaveResult.error,
      stage: coreSaveResult.stage ?? null,
    });
    return coreSaveResult;
  }
  logOrgAudit('core summary saved', {
    intakeId,
    activeStep: 'core_summary_save',
    summarySaveStatus: 'core_saved',
    summaryId: coreSaveResult.summaryId ?? null,
    operation: coreSaveResult.operation ?? null,
  });
  logSummarySave('intake_summaries core save complete', {
    intakeId,
    summaryId: coreSaveResult.summaryId ?? null,
    operation: coreSaveResult.operation,
  });

  let finalPayload = corePayload;
  let workflowStatusToStore = resolveWorkflowStatusAfterReorganization(
    priorIntake?.workflow_status as string | null | undefined,
    hasFirmDocRequest
  );
  let enrichmentUsedFallback = false;

  logOrgAudit('summary assembly start', {
    intakeId,
    activeStep: 'summary_assembly',
    summaryAssemblyStatus: 'in_progress',
  });
  try {
    const enriched = assembleEnrichedSummaryPayload({
      intakeId,
      org,
      extractionRows: extractionRes.rows,
      preservedWorkerNotes,
      preservedFirmRequestBlock,
      preservedFirmRequestAlerts,
      preservedWorkerResponseBlock,
      preservedWorkerResponseAlerts,
      priorWorkflow: priorIntake?.workflow_status as string | null | undefined,
      hasFirmDocRequest,
    });
    finalPayload = enriched.payload;
    workflowStatusToStore = enriched.workflowStatus;
    logOrgAuditBoundary(intakeId, { step: 'summary_assembly', success: true });
    logSummarySave('summary payload prepared', {
      intakeId,
      ...measurePayload('overview', finalPayload.overview),
      ...measurePayload('timelineSummary', finalPayload.timeline_summary),
      ...measurePayload('readinessIndicators', finalPayload.readiness_indicators),
      ...measurePayload('missingDocumentAlerts', finalPayload.missing_document_alerts),
      timelineDbRowCount: org.timelineEvents.length,
      workflowStatusToStore,
    });

    if (!payloadsEquivalent(corePayload, finalPayload)) {
      logOrgAudit('enriched save start', {
        intakeId,
        activeStep: 'enriched_summary_save',
        summaryAssemblyStatus: 'complete',
      });
      const enrichedSaveResult = await upsertIntakeSummaryRow(intakeId, finalPayload);
      if (enrichedSaveResult.error) {
        enrichmentUsedFallback = true;
        logOrgAuditBoundary(intakeId, {
          step: 'enriched_summary_save',
          success: false,
          fallbackUsed: true,
          errorMessage: enrichedSaveResult.error,
        });
        logSummarySaveError('intake_summaries enriched save', enrichedSaveResult.error, {
          intakeId,
          stage: enrichedSaveResult.stage,
        });
      } else {
        logOrgAudit('enriched summary saved', {
          intakeId,
          activeStep: 'enriched_summary_save',
          summarySaveStatus: 'enriched_saved',
          summaryId: enrichedSaveResult.summaryId ?? null,
        });
      }
    }
  } catch (assemblyError) {
    enrichmentUsedFallback = true;
    const message = assemblyError instanceof Error ? assemblyError.message : String(assemblyError);
    logOrgAuditBoundary(intakeId, {
      step: 'summary_assembly',
      success: false,
      fallbackUsed: true,
      errorMessage: message,
    });
    logSummarySaveError('summary assembly — core preserved', assemblyError, { intakeId });
  }

  logOrgAudit('timeline save start', {
    intakeId,
    activeStep: 'timeline_events_save',
    timelineEventCount: org.timelineEvents.length,
  });
  const timelineResult = await saveTimelineEventsForIntake(intakeId, org.timelineEvents);
  if (timelineResult.error) {
    logOrgAuditBoundary(intakeId, {
      step: 'timeline_events_save',
      success: false,
      fallbackUsed: true,
      errorMessage: timelineResult.error,
    });
  } else {
    logOrgAuditBoundary(intakeId, { step: 'timeline_events_save', success: true });
  }

  logSummarySave('intakes update start', { intakeId, workflowStatusToStore });
  logOrgAudit('intakes update start', { intakeId, activeStep: 'intakes_update', workflowStatusToStore });
  const { error: up } = await supabase
    .from('intakes')
    .update({ workflow_status: workflowStatusToStore, status: 'draft' })
    .eq('id', intakeId);
  logSupabaseWriteResult('intakes', 'update', {
    intakeId,
    workflowStatusToStore,
    error: up ? { message: up.message, code: up.code } : null,
  });
  if (up) {
    logOrgAuditError('intakes update failed — core summary preserved', up, {
      intakeId,
      activeStep: 'intakes_update',
    });
    logSummarySaveError('intakes update', up, { intakeId, code: up.code, workflowStatusToStore });
    // Non-blocking: core summary already saved.
  } else {
    logOrgAuditBoundary(intakeId, { step: 'intakes_update', success: true });
  }

  const verified = await waitForWorkerSummaryRow(intakeId, { attempts: 5, delayMs: 350 });
  logOrgAudit(verified ? 'post-save verification passed' : 'post-save verification failed', {
    intakeId,
    activeStep: 'post_save_verification',
    rowVerificationStatus: verified ? 'passed' : 'failed',
    enrichmentUsedFallback,
    timelineSaveStatus: timelineResult.error ? 'failed' : 'success',
    ms: Date.now() - startedAt,
  });
  if (!verified) {
    return { error: 'Summary row not found immediately after save.', stage: 'post_save_verification' };
  }

  logSummarySave('organization persist complete', {
    intakeId,
    ms: Date.now() - startedAt,
    enrichmentUsedFallback,
    coreSummarySaved: true,
  });
  return {};
}

export async function ensureLinkedFirmPreviewRoute(intakeId: string): Promise<{ error?: string }> {
  const { data: intake, error } = await supabase
    .from('intakes')
    .select('id, linked_firm_id, submission_channel')
    .eq('id', intakeId)
    .maybeSingle();
  if (error || !intake?.linked_firm_id) return {};
  if (intake.submission_channel !== 'firm_code') return {};
  const firmId = intake.linked_firm_id as string;
  const { data: existing } = await supabase
    .from('firm_intake_routes')
    .select('id')
    .eq('intake_id', intakeId)
    .eq('firm_id', firmId)
    .maybeSingle();
  if (existing) return {};
  const { data: inserted, error: ins } = await supabase
    .from('firm_intake_routes')
    .insert({
      intake_id: intakeId,
      firm_id: firmId,
      route_status: 'full_access',
      preview_sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (ins) {
    if (ins.code === '23505') return {};
    return { error: ins.message };
  }
  if (inserted?.id) {
    await notifications.notifyFirmOfPreview({ firmId, intakeId, routeId: inserted.id });
  }
  return {};
}

export async function fetchFirmByCodeForWorker(code: string): Promise<{ id: string; firm_name: string; firm_code?: string } | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;

  const fromRpc = await workerLookupFirmDisplayByCodeRpc(trimmed);
  if (fromRpc) {
    return {
      id: fromRpc.firmId,
      firm_name: fromRpc.firmName || trimmed,
      firm_code: fromRpc.firmCode || trimmed,
    };
  }

  const firmId = await lookupFirmIdByCode(trimmed);
  if (!firmId) return null;

  const { data, error } = await supabase.from('firm_profiles').select('id, firm_name, firm_code').eq('id', firmId).maybeSingle();
  if (!error && data?.firm_name) {
    return {
      id: data.id as string,
      firm_name: String(data.firm_name),
      firm_code: String(data.firm_code ?? trimmed).trim().toUpperCase(),
    };
  }
  return { id: firmId, firm_name: trimmed, firm_code: trimmed };
}

export async function updateTimelineEventWorkerContext(
  timelineEventId: string,
  workerContext: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('timeline_events')
    .update({ worker_context: workerContext })
    .eq('id', timelineEventId);
  return error ? { error: error.message } : {};
}

export async function updateIntakeWorkflowStatus(
  intakeId: string,
  workflow_status: string
): Promise<{ error?: string }> {
  const { error } = await supabase.from('intakes').update({ workflow_status }).eq('id', intakeId);
  return error ? { error: error.message } : {};
}

export async function linkFirmCodeToIntake(intakeId: string, firmId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('intakes')
    .update({ linked_firm_id: firmId, submission_channel: 'firm_code' })
    .eq('id', intakeId);
  return error ? { error: error.message } : {};
}

export async function fetchIntakeSummaryBundle(intakeId: string) {
  const [intakeRes, filesRes, eventsRes, summariesRes] = await Promise.all([
    supabase.from('intakes').select('*').eq('id', intakeId).maybeSingle(),
    supabase.from('uploaded_files').select('*').eq('intake_id', intakeId),
    supabase.from('timeline_events').select('*').eq('intake_id', intakeId).order('created_at', { ascending: true }),
    supabase.from('intake_summaries').select('*').eq('intake_id', intakeId).order('created_at', { ascending: false }).limit(1),
  ]);

  const intake = intakeRes.data;
  const fileRows = (filesRes.data ?? []) as Array<{ file_name: string; category: string | null }>;

  if (filesRes.error) {
    console.error(filesRes.error);
  }

  let events = (eventsRes.data ?? []) as Record<string, unknown>[];
  if (eventsRes.error) {
    if (!isSchemaRelationUnavailable(eventsRes.error)) console.error(eventsRes.error);
    events = [];
  }

  let summary = (summariesRes.data?.[0] ?? null) as Record<string, unknown> | null;
  if (summariesRes.error) {
    if (!isSchemaRelationUnavailable(summariesRes.error)) console.error(summariesRes.error);
    summary = null;
  }

  const summaryMissing = !summary;
  const timelineMissing = events.length === 0;
  if (fileRows.length && (summaryMissing || timelineMissing)) {
    const ph = betaPlaceholderBundleFromFiles(intakeId, fileRows);
    if (summaryMissing) summary = ph.summary as Record<string, unknown>;
    if (timelineMissing) events = ph.events as Record<string, unknown>[];
  }

  return { intake, files: fileRows, events, summary };
}

export async function markIntakeSubmitted(
  intakeId: string,
  opts?: { workflow_status?: string }
): Promise<{ error?: string }> {
  const workflow_status = opts?.workflow_status ?? 'Under Review';
  const { error } = await supabase
    .from('intakes')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), workflow_status })
    .eq('id', intakeId);
  return error ? { error: error.message } : {};
}

export async function lookupFirmIdByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('lookup_firm_id_by_code', { p_code: code });
  if (error) {
    console.error(error);
    return null;
  }
  return (data as string | null) ?? null;
}

function isMissingRpcError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return error.code === 'PGRST202' || msg.includes('could not find the function') || msg.includes('schema cache');
}

type WorkerFirmDisplayRow = { firm_id?: string; firm_name?: string | null; firm_code?: string | null };

function parseWorkerFirmDisplayRpcRow(data: unknown): { firmId: string; firmName: string; firmCode: string } | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const o = row as WorkerFirmDisplayRow;
  const firmId = String(o.firm_id ?? '').trim();
  const firmName = String(o.firm_name ?? '').trim();
  const firmCode = String(o.firm_code ?? '').trim().toUpperCase();
  if (!firmId) return null;
  return { firmId, firmName, firmCode };
}

async function workerLookupFirmDisplayByCodeRpc(
  code: string
): Promise<{ firmId: string; firmName: string; firmCode: string } | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const { data, error } = await supabase.rpc('worker_lookup_firm_display_by_code', { p_code: trimmed });
  if (error) {
    if (!isMissingRpcError(error)) console.error('[o3s-worker-firm-display] lookup by code', error);
    return null;
  }
  return parseWorkerFirmDisplayRpcRow(data);
}

async function workerLinkedFirmDisplayForIntakeRpc(
  intakeId: string
): Promise<{ firmId: string; firmName: string; firmCode: string } | null> {
  const { data, error } = await supabase.rpc('worker_linked_firm_display_for_intake', {
    p_intake_id: intakeId,
  });
  if (error) {
    if (!isMissingRpcError(error)) console.error('[o3s-worker-firm-display] linked firm', error);
    return null;
  }
  return parseWorkerFirmDisplayRpcRow(data);
}

function parseRouteIntakeToFirmCodeRpcRow(data: unknown): {
  routeId?: string;
  firmId?: string;
  firmName?: string;
} {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return {};
  const o = row as Record<string, unknown>;
  return {
    routeId: (o.route_id ?? o.routeId) as string | undefined,
    firmId: (o.firm_id ?? o.firmId) as string | undefined,
    firmName: (o.firm_name ?? o.firmName) as string | undefined,
  };
}

type IntakeRoutingEmbed = {
  intake_number: string;
  created_at: string;
  id: string;
  submission_channel: string | null;
  linked_firm_id: string | null;
  workflow_status: string;
};

function normalizeIntakeRoutingEmbed(raw: unknown): IntakeRoutingEmbed | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === 'object' ? (first as IntakeRoutingEmbed) : null;
  }
  return typeof raw === 'object' ? (raw as IntakeRoutingEmbed) : null;
}

async function fetchIntakeRowForRouting(intakeId: string): Promise<{
  submission_channel: string | null;
  workflow_status: string | null;
  linked_firm_id: string | null;
  submitted_at: string | null;
} | null> {
  const { data, error } = await supabase
    .from('intakes')
    .select('submission_channel, workflow_status, linked_firm_id, submitted_at')
    .eq('id', intakeId)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    submission_channel: string | null;
    workflow_status: string | null;
    linked_firm_id: string | null;
    submitted_at: string | null;
  };
}

async function resolveFirmCodeRouteAfterIntakeLink(
  intakeId: string,
  code: string,
  firmHint?: { id: string; firm_name: string } | null
): Promise<{ routeId?: string; firmId?: string; firmName?: string; error?: string }> {
  const intake = await fetchIntakeRowForRouting(intakeId);
  if (intake?.submission_channel !== 'firm_code' || !intake.linked_firm_id) {
    return { error: 'Firm route was not created.' };
  }

  const firmId = intake.linked_firm_id;
  let routeId: string | undefined;
  const { data: existingRoute, error: routeErr } = await supabase
    .from('firm_intake_routes')
    .select('id')
    .eq('intake_id', intakeId)
    .eq('firm_id', firmId)
    .maybeSingle();
  if (routeErr) return { error: routeErr.message };
  if (existingRoute?.id) routeId = existingRoute.id as string;

  if (!routeId) {
    const ensured = await ensureLinkedFirmPreviewRoute(intakeId);
    if (ensured.error) return { error: ensured.error };
    const { data: routeAfter } = await supabase
      .from('firm_intake_routes')
      .select('id')
      .eq('intake_id', intakeId)
      .eq('firm_id', firmId)
      .maybeSingle();
    routeId = routeAfter?.id as string | undefined;
  }

  if (!routeId) return { error: 'Firm route was not created.' };

  let firmName = firmHint?.id === firmId ? (firmHint.firm_name ?? '').trim() : '';
  if (!firmName) {
    const linked = await workerLinkedFirmDisplayForIntakeRpc(intakeId);
    if (linked?.firmId === firmId) firmName = linked.firmName;
  }
  if (!firmName) {
    const byCode = await fetchFirmByCodeForWorker(code);
    if (byCode?.id === firmId) firmName = byCode.firm_name;
  }

  return { routeId, firmId, firmName: firmName || code };
}

export type WorkerIntakeFirmRoutingCard = {
  intakeId: string;
  intakeNumber: string;
  caseCategory?: string | null;
  employmentMatterTags?: EmploymentMatterTagId[];
  workflowStatus: string;
  hasSummary: boolean;
  updatedAt: string | null;
  submissionChannel: string | null;
  linkedFirmId: string | null;
  linkedFirmName: string | null;
  linkedFirmCode: string | null;
  routeStatus: string | null;
};

const CASE_CATEGORY_BLOCK_RE = /\n?--- O3S_CASE_CATEGORY ---\n([\s\S]*?)\n--- O3S_CASE_CATEGORY_END ---\n?/;

function extractCaseCategoryFromOverviewText(overview: string | null | undefined): string | null {
  const m = (overview ?? '').match(CASE_CATEGORY_BLOCK_RE);
  const t = m?.[1]?.trim() ?? '';
  return t || null;
}

/** Worker hub: read persisted routing fields from `intakes` after firm-code routing. */
export async function fetchWorkerIntakeRoutingDisplay(intakeId: string): Promise<{
  submissionChannel: string | null;
  workflowStatus: string | null;
  linkedFirmId: string | null;
  linkedFirmName: string | null;
  linkedFirmCode: string | null;
  routeStatus: string | null;
  /** When the linked firm last received this intake (route preview_sent_at or intake submitted_at). */
  routeSharedAt: string | null;
}> {
  const intake = await fetchIntakeRowForRouting(intakeId);
  const linkedFirmId = intake?.linked_firm_id ?? null;
  let linkedFirmName: string | null = null;
  let linkedFirmCode: string | null = null;
  let routeStatus: string | null = null;
  let routeSharedAt: string | null = null;
  if (linkedFirmId) {
    const [linkedDisplay, { data: route, error: routeErr }] = await Promise.all([
      workerLinkedFirmDisplayForIntakeRpc(intakeId),
      supabase
        .from('firm_intake_routes')
        .select('route_status, preview_sent_at')
        .eq('intake_id', intakeId)
        .eq('firm_id', linkedFirmId)
        .maybeSingle(),
    ]);
    if (linkedDisplay) {
      const name = linkedDisplay.firmName.trim();
      const code = linkedDisplay.firmCode.trim();
      if (name) linkedFirmName = name;
      if (code) linkedFirmCode = code;
    } else {
      const { data: firm, error: firmErr } = await supabase
        .from('firm_profiles')
        .select('firm_name, firm_code')
        .eq('id', linkedFirmId)
        .maybeSingle();
      if (!firmErr && firm) {
        const name = (firm.firm_name as string | null)?.trim();
        const code = (firm.firm_code as string | null)?.trim();
        if (name) linkedFirmName = name;
        if (code) linkedFirmCode = code.toUpperCase();
      }
    }
    if (!routeErr && route?.route_status) {
      routeStatus = String(route.route_status);
    }
    const previewSentAt = (route?.preview_sent_at as string | null | undefined)?.trim();
    if (previewSentAt) routeSharedAt = previewSentAt;
  }
  const submissionChannel = normalizePersistedSubmissionChannel(intake?.submission_channel ?? null);
  if (!routeSharedAt && intake?.submitted_at) {
    routeSharedAt = String(intake.submitted_at);
  }
  return {
    submissionChannel,
    workflowStatus: intake?.workflow_status ?? null,
    linkedFirmId,
    linkedFirmName,
    linkedFirmCode,
    routeStatus,
    routeSharedAt,
  };
}

async function intakeIdsWithSummaryRows(intakeIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!intakeIds.length) return out;
  const { data: summaryRows, error: sumErr } = await supabase
    .from('intake_summaries')
    .select('intake_id')
    .in('intake_id', intakeIds);
  if (sumErr && !isSchemaRelationUnavailable(sumErr)) {
    console.error('[o3s-worker-routing] summary lookup', sumErr);
    return out;
  }
  for (const s of summaryRows ?? []) {
    if (s.intake_id) out.add(String(s.intake_id));
  }
  return out;
}

export async function listWorkerIntakeFirmRoutingCards(
  workerId: string
): Promise<WorkerIntakeFirmRoutingCard[]> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc('worker_intake_firm_routing_displays', {
    p_worker_id: workerId,
  });

  if (!rpcError && rpcRows?.length) {
    const typed = rpcRows as Array<Record<string, unknown>>;
    const intakeIds = typed.map((row) => String(row.intake_id ?? '')).filter(Boolean);
    const categoryByIntake = new Map<string, string>();
    const matterByIntake = new Map<string, EmploymentMatterTagId[]>();
    if (intakeIds.length) {
      const { data: summaryRows } = await supabase
        .from('intake_summaries')
        .select('intake_id, overview')
        .in('intake_id', intakeIds);
      for (const row of summaryRows ?? []) {
        const ov = String(row.overview ?? '');
        const cat = extractCaseCategoryFromOverviewText(ov);
        if (cat && row.intake_id) categoryByIntake.set(String(row.intake_id), cat);
        const tags = extractEmploymentMatterTagsFromOverview(ov);
        if (tags.length && row.intake_id) matterByIntake.set(String(row.intake_id), tags);
      }
    }
    const summaryIds = await intakeIdsWithSummaryRows(
      intakeIds
    );
    return typed.map((row) => {
      const intakeId = row.intake_id as string;
      const wf = String(row.workflow_status ?? '');
      const linkedFirmId = (row.linked_firm_id as string | null) ?? null;
      const firmName = String(row.firm_name ?? '').trim() || null;
      const firmCode = String(row.firm_code ?? '').trim().toUpperCase() || null;
      const submissionChannel = normalizePersistedSubmissionChannel(
        row.submission_channel as string | null | undefined
      );
      const updatedAtRaw = row.updated_at;
      return {
        intakeId,
        intakeNumber: String(row.intake_number ?? 'Intake'),
        caseCategory: categoryByIntake.get(intakeId) ?? null,
        employmentMatterTags: matterByIntake.get(intakeId),
        workflowStatus: wf,
        hasSummary: summaryIds.has(intakeId),
        updatedAt:
          typeof updatedAtRaw === 'string' && updatedAtRaw.trim()
            ? updatedAtRaw.trim()
            : null,
        submissionChannel,
        linkedFirmId,
        linkedFirmName: firmName,
        linkedFirmCode: firmCode,
        routeStatus: row.route_status ? String(row.route_status) : null,
      };
    });
  }

  if (rpcError && !isMissingRpcError(rpcError)) {
    console.error('[o3s-worker-routing] firm routing displays RPC', rpcError);
  }

  const { data: intakes, error } = await supabase
    .from('intakes')
    .select('id, intake_number, workflow_status, updated_at, linked_firm_id, submission_channel')
    .eq('worker_id', workerId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[o3s-worker-routing] list intakes', error);
    return [];
  }
  const rows = intakes ?? [];
  const firmIds = [
    ...new Set(
      rows.map((i) => i.linked_firm_id as string | null).filter((id): id is string => Boolean(id))
    ),
  ];
  const firmById = new Map<string, { firm_name: string; firm_code: string }>();
  if (firmIds.length) {
    const { data: firms } = await supabase
      .from('firm_profiles')
      .select('id, firm_name, firm_code')
      .in('id', firmIds);
    for (const f of firms ?? []) {
      firmById.set(f.id as string, {
        firm_name: String(f.firm_name ?? ''),
        firm_code: String(f.firm_code ?? ''),
      });
    }
  }
  const intakeIds = rows.map((i) => i.id as string);
  const categoryByIntake = new Map<string, string>();
  const matterByIntake = new Map<string, EmploymentMatterTagId[]>();
  if (intakeIds.length) {
    const { data: summaryRows } = await supabase
      .from('intake_summaries')
      .select('intake_id, overview')
      .in('intake_id', intakeIds);
    for (const row of summaryRows ?? []) {
      const ov = String(row.overview ?? '');
      const cat = extractCaseCategoryFromOverviewText(ov);
      if (cat && row.intake_id) categoryByIntake.set(String(row.intake_id), cat);
      const tags = extractEmploymentMatterTagsFromOverview(ov);
      if (tags.length && row.intake_id) matterByIntake.set(String(row.intake_id), tags);
    }
  }
  const summaryIds = await intakeIdsWithSummaryRows(intakeIds);
  const routeByIntake = new Map<string, string>();
  if (intakeIds.length) {
    const { data: routes } = await supabase
      .from('firm_intake_routes')
      .select('intake_id, route_status, firm_id')
      .in('intake_id', intakeIds);
    for (const r of routes ?? []) {
      const iid = r.intake_id as string;
      const fid = r.firm_id as string;
      const intake = rows.find((x) => x.id === iid);
      if (intake?.linked_firm_id === fid) {
        routeByIntake.set(iid, String(r.route_status ?? ''));
      }
    }
  }
  return rows.map((i) => {
    const wf = String(i.workflow_status ?? '');
    const linkedFirmId = (i.linked_firm_id as string | null) ?? null;
    const fp = linkedFirmId ? firmById.get(linkedFirmId) : undefined;
    const firmName = (fp?.firm_name ?? '').trim() || null;
    const firmCode = (fp?.firm_code ?? '').trim().toUpperCase() || null;
    const submissionChannel = normalizePersistedSubmissionChannel(
      i.submission_channel as string | null | undefined
    );
    const updatedAtRaw = i.updated_at as string | null | undefined;
    return {
      intakeId: i.id as string,
      intakeNumber: String(i.intake_number ?? 'Intake'),
      caseCategory: categoryByIntake.get(i.id as string) ?? null,
      employmentMatterTags: matterByIntake.get(i.id as string),
      workflowStatus: wf,
      hasSummary: summaryIds.has(i.id as string),
      updatedAt:
        typeof updatedAtRaw === 'string' && updatedAtRaw.trim() ? updatedAtRaw.trim() : null,
      submissionChannel,
      linkedFirmId,
      linkedFirmName: firmName,
      linkedFirmCode: firmCode,
      routeStatus: routeByIntake.get(i.id as string) ?? null,
    };
  });
}

export async function removeFirmCodeFromIntake(intakeId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('worker_remove_firm_code_from_intake', {
    p_intake_id: intakeId,
  });
  if (error) {
    if (isMissingRpcError(error)) {
      return {
        error:
          'Remove firm code is unavailable until migration 20260525120000_worker_remove_firm_code is applied in Supabase.',
      };
    }
    return { error: error.message };
  }
  const routing = await fetchWorkerIntakeRoutingDisplay(intakeId);
  if (routing.linkedFirmId) {
    return { error: 'Firm code could not be removed. Try again.' };
  }
  return {};
}

/** Paths under `{workerId}/{intakeId}/` for Storage API remove (collected before RPC deletes DB rows). */
async function collectIntakeStoragePathsForDelete(
  workerId: string,
  intakeId: string
): Promise<string[]> {
  const prefix = `${workerId}/${intakeId}`;
  const paths = new Set<string>();

  for (const row of await listUploadedFiles(intakeId)) {
    const p = String(row.file_path ?? '').trim();
    if (p && p.startsWith(`${prefix}/`)) paths.add(p);
  }

  const { data: listed, error: listError } = await supabase.storage
    .from(INTAKE_FILES_BUCKET)
    .list(prefix, { limit: 1000 });
  if (listError) {
    console.warn('[o3s-delete-intake] storage list failed', {
      intakeId,
      prefix,
      message: listError.message,
    });
  } else {
    for (const item of listed ?? []) {
      const name = item.name?.trim();
      if (name) paths.add(`${prefix}/${name}`);
    }
  }

  return [...paths];
}

/** Deletes a worker-owned intake and related rows via security-definer RPC (do not use client multi-table delete). */
export async function deleteWorkerOwnedIntake(intakeId: string): Promise<{ error?: string }> {
  const { data: intakeRow, error: intakeSelectError } = await supabase
    .from('intakes')
    .select('worker_id')
    .eq('id', intakeId)
    .maybeSingle();
  if (intakeSelectError) return { error: intakeSelectError.message };

  const workerId =
    typeof intakeRow?.worker_id === 'string' ? intakeRow.worker_id : null;
  const storagePaths =
    workerId != null ? await collectIntakeStoragePathsForDelete(workerId, intakeId) : [];

  const { data, error } = await supabase.rpc('worker_delete_intake', { p_intake_id: intakeId });
  if (error) {
    if (isMissingRpcError(error)) {
      return {
        error:
          'Delete intake is unavailable until migration 20260526120000_worker_delete_intake is applied in Supabase.',
      };
    }
    return { error: error.message };
  }
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) {
    return { error: payload?.error ?? 'Could not delete intake.' };
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(INTAKE_FILES_BUCKET)
      .remove(storagePaths);
    if (storageError) {
      console.error('[o3s-delete-intake] storage cleanup failed', {
        intakeId,
        workerId,
        pathCount: storagePaths.length,
        message: storageError.message,
      });
    }
  }

  return {};
}

export async function routeIntakeToFirmCode(
  intakeId: string,
  code: string
): Promise<{ error?: string; routeId?: string; firmId?: string; firmName?: string }> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { error: 'Enter a firm code.' };

  const { data, error } = await supabase.rpc('route_intake_to_firm_code', {
    p_intake_id: intakeId,
    p_code: trimmed,
  });

  console.info('[o3s-firm-routing] route_intake_to_firm_code RPC', {
    intakeId,
    code: trimmed,
    rpcError: error?.message ?? null,
    rpcData: data ?? null,
  });

  if (!error) {
    let { routeId, firmId, firmName } = parseRouteIntakeToFirmCodeRpcRow(data);
    if (!routeId || !firmId) {
      const recovered = await resolveFirmCodeRouteAfterIntakeLink(intakeId, trimmed);
      console.info('[o3s-firm-routing] route RPC recovery', recovered);
      if (recovered.error) return { error: recovered.error };
      routeId = recovered.routeId;
      firmId = recovered.firmId;
      firmName = recovered.firmName;
    }
    if (!routeId || !firmId) return { error: 'Firm route was not created.' };
    const resolvedName = (firmName ?? '').trim() || trimmed;
    await notifications.notifyFirmOfPreview({ firmId, intakeId, routeId });
    return { routeId, firmId, firmName: resolvedName };
  }

  if (!isMissingRpcError(error)) return { error: error.message };

  // Live projects that have not applied the route_intake_to_firm_code RPC yet
  // can still use the older client path. The RPC is the durable path.
  const firm = await fetchFirmByCodeForWorker(trimmed);
  if (!firm) return { error: 'Firm code not found.' };
  const routed = await shareIntakeWithFirmByCode(intakeId, firm.id);
  console.info('[o3s-firm-routing] route_intake_to_firm_code fallback shareIntakeWithFirmByCode', {
    intakeId,
    firmId: firm.id,
    routed,
  });
  if (routed.error) return routed;
  await markIntakeSubmitted(intakeId, { workflow_status: 'Under Firm Review' });
  return { routeId: routed.routeId, firmId: firm.id, firmName: firm.firm_name };
}

/** Worker explicitly sends an organized intake to a firm already linked via firm code (creates firm route). */
export async function sendOrganizedIntakeToLinkedFirm(
  intakeId: string
): Promise<{ error?: string; routeId?: string; firmId?: string; firmName?: string }> {
  const { data: intake, error: intakeErr } = await supabase
    .from('intakes')
    .select('linked_firm_id, submission_channel')
    .eq('id', intakeId)
    .maybeSingle();
  if (intakeErr) return { error: intakeErr.message };
  const firmId = intake?.linked_firm_id as string | null;
  if (!firmId || intake?.submission_channel !== 'firm_code') {
    return { error: 'Link a firm code to this intake before sending.' };
  }

  const { data: summaryRow, error: sumErr } = await supabase
    .from('intake_summaries')
    .select('id')
    .eq('intake_id', intakeId)
    .limit(1)
    .maybeSingle();
  if (sumErr) return { error: sumErr.message };
  if (!summaryRow?.id) {
    return { error: 'Organize your intake first, then send it to your linked firm.' };
  }

  const routed = await shareIntakeWithFirmByCode(intakeId, firmId);
  if (routed.error) return routed;

  const submit = await markIntakeSubmitted(intakeId, { workflow_status: 'Under Firm Review' });
  if (submit.error) return submit;

  const display = await workerLinkedFirmDisplayForIntakeRpc(intakeId);
  return {
    routeId: routed.routeId,
    firmId,
    firmName: display?.firmName,
  };
}

export async function shareIntakeWithFirmByCode(intakeId: string, firmId: string): Promise<{ error?: string; routeId?: string }> {
  const link = await linkFirmCodeToIntake(intakeId, firmId);
  if (link.error) return link;

  const { data, error } = await supabase
    .from('firm_intake_routes')
    .insert({
      intake_id: intakeId,
      firm_id: firmId,
      route_status: 'full_access',
      preview_sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: existingError } = await supabase
        .from('firm_intake_routes')
        .select('id, route_status')
        .eq('intake_id', intakeId)
        .eq('firm_id', firmId)
        .maybeSingle();

      if (existingError) return { error: existingError.message };
      if (existing?.id) {
        await supabase
          .from('firm_intake_routes')
          .update({ route_status: 'full_access', preview_sent_at: new Date().toISOString() })
          .eq('id', existing.id);
        return { routeId: existing.id };
      }
    }
    return { error: error.message };
  }
  await notifications.notifyFirmOfPreview({ firmId, intakeId, routeId: data.id });
  return { routeId: data.id };
}

export async function routePreviewToParticipatingFirms(intakeId: string, excludeFirmId?: string): Promise<{ error?: string; count?: number }> {
  const { data, error } = await supabase.rpc('worker_route_preview_to_participating_firms', {
    p_intake_id: intakeId,
    p_exclude_firm_id: excludeFirmId ?? null,
  });

  if (error) {
    console.warn('[o3s-firm-routing] participating route RPC failed', error.message);
    return { error: error.message, count: 0 };
  }

  const payload = (data ?? {}) as { count?: number; error?: string | null };
  if (payload.error) {
    return { error: String(payload.error), count: payload.count ?? 0 };
  }

  const count = payload.count ?? 0;
  if (count > 0) {
    const { data: routes } = await supabase
      .from('firm_intake_routes')
      .select('id, firm_id')
      .eq('intake_id', intakeId);
    for (const r of routes ?? []) {
      if (r.firm_id && r.id) {
        await notifications.notifyFirmOfPreview({
          firmId: String(r.firm_id),
          intakeId,
          routeId: String(r.id),
        });
      }
    }
  }

  return { count };
}

export type FirmDashboardRow = {
  routeId: string;
  intakeId: string;
  intakeNumber: string;
  routeStatus: string;
  overview: string;
  timelineSummary: string;
  readiness: string[];
  missing: string[];
  categories: string[];
  documentCount: number;
  createdAt: string;
  submissionType: FirmSubmissionTypeDisplay;
  workflowStatus: string;
  employmentMatterTags?: EmploymentMatterTagId[];
  /** Concatenated non-empty worker timeline notes for firm card preview */
  workerAddedContextSummary?: string;
  /** Placeholder: firm requested docs (local/demo until routes table supports it) */
  requestedDocumentsStatus?: string | null;
  /** Worker confirmation after additional-documents request */
  workerDocumentResponse?: WorkerDocumentResponsePayload | null;
};

/** True when `intake_summaries` has at least one row for this intake (post-organization gate). */
export async function workerIntakeHasSummaryRow(intakeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('intake_summaries')
    .select('id')
    .eq('intake_id', intakeId)
    .limit(1)
    .maybeSingle();
  if (error) {
    logSummarySaveError('summary row check', error, {
      intakeId,
      code: error.code,
      schemaUnavailable: isSchemaRelationUnavailable(error),
    });
    logOrgAudit('row verification query failed', {
      intakeId,
      activeStep: 'post_save_verification',
      rowVerificationStatus: 'query_error',
      errorMessage: error.message,
    });
    return false;
  }
  const hasRow = Boolean(data?.id);
  logSummarySave('summary row check', { intakeId, hasRow, summaryId: data?.id ?? null });
  return hasRow;
}

/** Poll until summary row exists (handles post-write read lag). */
export async function waitForWorkerSummaryRow(
  intakeId: string,
  opts?: { attempts?: number; delayMs?: number }
): Promise<boolean> {
  const attempts = opts?.attempts ?? 5;
  const delayMs = opts?.delayMs ?? 400;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await workerIntakeHasSummaryRow(intakeId)) {
      logOrgAudit('row verification succeeded', {
        intakeId,
        activeStep: 'post_save_verification',
        rowVerificationStatus: 'passed',
        attempt: attempt + 1,
      });
      return true;
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }
  logOrgAudit('row verification exhausted retries', {
    intakeId,
    activeStep: 'post_save_verification',
    rowVerificationStatus: 'failed',
    attempts,
  });
  return false;
}

export async function listWorkerIntakes(workerId: string): Promise<
  Array<{
    id: string;
    intake_number: string;
    workflow_status: string;
    updated_at: string;
    has_summary: boolean;
    submission_channel?: string | null;
    case_category?: string | null;
  }>
> {
  const { data: intakes, error } = await supabase
    .from('intakes')
    .select('id, intake_number, workflow_status, updated_at, submission_channel')
    .eq('worker_id', workerId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  const rows = intakes ?? [];
  const intakeIds = rows.map((i) => i.id as string);
  const summaryIntakeIds = new Set<string>();
  const categoryByIntake = new Map<string, string>();
  if (intakeIds.length) {
    const { data: summaryRows, error: sumErr } = await supabase
      .from('intake_summaries')
      .select('intake_id, overview')
      .in('intake_id', intakeIds);
    if (sumErr && !isSchemaRelationUnavailable(sumErr)) {
      console.error('[o3s-worker-intakes] summary lookup', sumErr);
    } else {
      for (const s of summaryRows ?? []) {
        if (s.intake_id) summaryIntakeIds.add(String(s.intake_id));
        const cat = extractCaseCategoryFromOverviewText(String(s.overview ?? ''));
        if (cat && s.intake_id) categoryByIntake.set(String(s.intake_id), cat);
      }
    }
  }
  return rows
    .map((i) => ({
      id: i.id,
      intake_number: i.intake_number,
      workflow_status: i.workflow_status,
      updated_at: i.updated_at,
      has_summary: summaryIntakeIds.has(i.id as string),
      submission_channel: (i.submission_channel as string | null | undefined) ?? null,
      case_category: categoryByIntake.get(i.id as string) ?? null,
    }))
    .filter((row, idx, arr) => arr.findIndex((x) => x.id === row.id) === idx);
}

export type OrganizationRecoveryResult = {
  recoveredCount: number;
  resetCount: number;
  affectedIntakeIds: string[];
  message: string | null;
};

/** Recover intakes stuck in an in-progress organization state after refresh or tab close. */
export async function recoverInterruptedOrganizationIntakes(
  workerId: string
): Promise<OrganizationRecoveryResult> {
  const rows = await listWorkerIntakes(workerId);
  let recoveredCount = 0;
  let resetCount = 0;
  const affectedIntakeIds: string[] = [];

  for (const row of rows) {
    if (!isInterruptedOrganizationWorkflowStatus(row.workflow_status)) continue;

    let targetStatus: string;
    if (!row.has_summary) {
      targetStatus = 'Upload Complete';
      resetCount += 1;
    } else {
      recoveredCount += 1;
      const bundle = await fetchIntakeSummaryBundle(row.id);
      const overview = String((bundle.summary as { overview?: string } | null)?.overview ?? '');
      const alerts =
        ((bundle.summary as { missing_document_alerts?: string[] } | null)?.missing_document_alerts ??
          []);
      const firmBlock = extractFirmDocumentRequestBlockFromOverview(overview);
      const response = resolveWorkerDocumentResponse(overview, alerts);

      if (response && response.fulfilled.length > 0) {
        targetStatus = 'Worker Uploaded Requested Documents';
      } else if (firmBlock) {
        targetStatus = 'Additional Documents Requested';
      } else {
        targetStatus = 'Intake Summary Generated';
      }
    }

    const upd = await updateIntakeWorkflowStatus(row.id, targetStatus);
    if (upd.error) {
      console.error('[o3s-org-recovery] workflow update failed', {
        intakeId: row.id,
        from: row.workflow_status,
        to: targetStatus,
        error: upd.error,
      });
      continue;
    }

    affectedIntakeIds.push(row.id);
    console.info('[o3s-org-recovery] recovered intake workflow', {
      intakeId: row.id,
      from: row.workflow_status,
      to: targetStatus,
    });
  }

  const message =
    resetCount > 0
      ? 'Organization was interrupted. Please run Begin Organizing again.'
      : null;

  return { recoveredCount, resetCount, affectedIntakeIds, message };
}

export async function loadFirmDashboardRows(firmTableId: string): Promise<FirmDashboardRow[]> {
  try {
    return await loadFirmDashboardRowsInner(firmTableId);
  } catch (e) {
    console.error('[o3s-firm-dashboard] loadFirmDashboardRows failed', e);
    return [];
  }
}

async function loadFirmDashboardRowsInner(firmTableId: string): Promise<FirmDashboardRow[]> {
  const { data: routes, error } = await supabase
    .from('firm_intake_routes')
    .select(
      'id, intake_id, route_status, preview_sent_at, created_at, intakes(intake_number, created_at, id, submission_channel, linked_firm_id, workflow_status)'
    )
    .eq('firm_id', firmTableId);
  if (error) {
    console.error(error);
    console.info('[o3s-firm-dashboard] routes query error', { firmTableId, message: error.message });
    return [];
  }
  const rawRouteCount = routes?.length ?? 0;
  console.info('[o3s-firm-dashboard] raw route count', { firmTableId, rawRouteCount });

  const rows: FirmDashboardRow[] = [];
  for (const r of routes ?? []) {
    const intakeId = (r.intake_id as string | undefined) ?? undefined;
    if (!intakeId) continue;

    let intake = normalizeIntakeRoutingEmbed(r.intakes);
    if (!intake) {
      const { data: intakeRow, error: intakeErr } = await supabase
        .from('intakes')
        .select('intake_number, created_at, id, submission_channel, linked_firm_id, workflow_status')
        .eq('id', intakeId)
        .maybeSingle();
      if (intakeErr) console.error(intakeErr);
      intake = intakeRow as IntakeRoutingEmbed | null;
    }

    const submissionType = resolveFirmSubmissionTypeDisplay({
      submissionChannel: intake?.submission_channel,
      linkedFirmId: intake?.linked_firm_id ?? null,
      routeFirmId: firmTableId,
      hasFirmIntakeRoute: true,
    });

    const isFirmCodeRoute = resolveIsFirmCodeRoutedIntake({
      submissionChannel: intake?.submission_channel,
      linkedFirmId: intake?.linked_firm_id ?? null,
      routeFirmId: firmTableId,
    });
    const routeStatus = String(r.route_status ?? '');
    const previewFallbackOnly =
      !isFirmCodeRoute &&
      (routeStatus === 'preview_sent' || routeStatus === 'access_requested');
    const inventory = await listFirmAccessibleUploadInventory(intakeId, { previewFallbackOnly });
    const { data: sum, error: sumErr } = await supabase
      .from('intake_summaries')
      .select('overview, timeline_summary, readiness_indicators, missing_document_alerts')
      .eq('intake_id', intakeId)
      .limit(1)
      .maybeSingle();
    if (sumErr && !isSchemaRelationUnavailable(sumErr)) {
      console.error(sumErr);
    }
    const fileRows = inventory.map((f) => ({ file_name: f.file_name, category: f.category }));
    const cats = [...new Set(inventory.map((f) => f.category).filter(Boolean))];
    const synthetic = !sum && fileRows.length ? betaPlaceholderBundleFromFiles(intakeId, fileRows).summary : null;
    const s = (sum as {
      overview?: string;
      timeline_summary?: string;
      readiness_indicators?: string[];
      missing_document_alerts?: string[];
    } | null) ?? synthetic;
    const overviewRaw = (s?.overview as string) ?? '';
    const documentResponse = resolveWorkerDocumentResponse(
      overviewRaw,
      (s?.missing_document_alerts ?? []) as string[]
    );
    const { data: evs } = await supabase
      .from('timeline_events')
      .select('worker_context')
      .eq('intake_id', intakeId);
    const timelineWorkerContexts = (evs ?? []).map((e: { worker_context?: string | null }) =>
      (e.worker_context ?? '').trim()
    );
    const workerAddedContextSummary = resolveWorkerProvidedContextForFirmView(
      overviewRaw,
      timelineWorkerContexts,
      { includeTimelineContext: true }
    );

    const routeCreatedAt =
      (r.preview_sent_at as string | undefined) ??
      (r.created_at as string | undefined) ??
      new Date().toISOString();

    const employmentMatterTags = extractEmploymentMatterTagsFromOverview(overviewRaw);

    rows.push({
      routeId: r.id as string,
      intakeId,
      intakeNumber: intake?.intake_number ?? 'Routed intake',
      routeStatus: String(r.route_status ?? 'preview_sent'),
      overview: sanitizeFirmFacingText(
        stripWorkerIntakeNotesBlock(overviewRaw || 'Summary not generated yet.')
      ),
      employmentMatterTags: employmentMatterTags.length ? employmentMatterTags : undefined,
      timelineSummary: sanitizeFirmFacingText((s?.timeline_summary as string) ?? ''),
      readiness: (s?.readiness_indicators ?? []).map((line) => sanitizeFirmFacingText(String(line))),
      missing: (s?.missing_document_alerts ?? []).map((line) => sanitizeFirmFacingText(String(line))),
      categories: cats.length ? cats : ['Uncategorized'],
      documentCount: inventory.length,
      createdAt: intake?.created_at ?? routeCreatedAt,
      submissionType,
      workflowStatus: intake?.workflow_status ?? 'Under Firm Review',
      workerAddedContextSummary: workerAddedContextSummary || undefined,
      requestedDocumentsStatus:
        intake?.workflow_status === 'Additional Documents Requested'
          ? 'Additional documents requested'
          : isWorkerDocumentRequestResponseComplete(
                intake?.workflow_status ?? '',
                documentResponse
              )
            ? 'Worker uploaded requested documents'
            : null,
      workerDocumentResponse: documentResponse,
    });
  }
  const sorted = rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  console.info('[o3s-firm-dashboard] mapped dashboard rows', {
    firmTableId,
    mappedRowCount: sorted.length,
    routeStatuses: sorted.map((row) => row.routeStatus),
  });
  return sorted;
}

async function firmSetIntakeWorkflowForRoute(
  routeId: string,
  workflowStatus: string
): Promise<{ error?: string }> {
  const status = workflowStatus.trim();
  if (!status) return { error: 'Workflow status is required.' };
  const { error } = await supabase.rpc('firm_set_intake_workflow_for_route', {
    p_route_id: routeId,
    p_workflow_status: status,
  });
  if (!error) return {};
  if (isMissingRpcError(error)) {
    return {
      error:
        'Workflow update is unavailable until the firm_set_intake_workflow_for_route migration is applied in Supabase.',
    };
  }
  return { error: error.message };
}

export async function firmRequestAdditionalDocuments(
  routeId: string,
  categories: string[],
  note: string
): Promise<{ error?: string }> {
  const trimmed = categories.map((c) => c.trim()).filter(Boolean);
  if (!trimmed.length) return { error: 'Select at least one document category.' };
  const { error } = await supabase.rpc('firm_request_additional_documents', {
    p_route_id: routeId,
    p_categories: trimmed,
    p_note: note.trim(),
  });
  if (!error) return {};
  if (isMissingRpcError(error)) {
    return {
      error:
        'Document requests are unavailable until the firm_request_additional_documents RPC is applied in Supabase (migration 20260522120000 or 20260524120000).',
    };
  }
  return { error: error.message };
}

export async function firmRequestFullAccess(routeId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('firm_request_full_access', { p_route_id: routeId });
  if (error) return { error: error.message };
  return {};
}

export async function firmAcceptIntake(routeId: string): Promise<{ error?: string }> {
  const { data: row, error: f0 } = await supabase
    .from('firm_intake_routes')
    .select('intake_id, route_status')
    .eq('id', routeId)
    .single();
  if (f0 || !row) return { error: f0?.message ?? 'Route not found' };
  if (String(row.route_status ?? '') !== 'full_access') {
    return { error: 'Full access is required before accepting this intake.' };
  }
  return firmSetIntakeWorkflowForRoute(routeId, 'Accepted by Firm');
}

/**
 * Firm declines an intake — sets workflow_status to 'Not Pursuing'.
 * Can be called at any route_status; does not require full_access.
 */
export async function firmDeclineIntake(routeId: string): Promise<{ error?: string }> {
  const { data: row, error: f0 } = await supabase
    .from('firm_intake_routes')
    .select('intake_id, route_status')
    .eq('id', routeId)
    .single();
  if (f0 || !row) return { error: f0?.message ?? 'Route not found' };
  return firmSetIntakeWorkflowForRoute(routeId, 'Not Pursuing');
}

export async function workerApproveFullAccess(routeId: string, workerId: string): Promise<{ error?: string }> {
  const { data: route, error: r0 } = await supabase.from('firm_intake_routes').select('id, intake_id').eq('id', routeId).single();
  if (r0 || !route) return { error: r0?.message ?? 'Route not found' };
  const { data: intake, error: r1 } = await supabase.from('intakes').select('worker_id').eq('id', route.intake_id).single();
  if (r1 || !intake || intake.worker_id !== workerId) return { error: 'Not allowed' };
  const { error } = await supabase.rpc('worker_approve_full_access', { p_route_id: routeId });
  if (error) return { error: error.message };
  return {};
}

export type FirmAccessibleUploadFile = {
  file_name: string;
  category: string;
  uploaded_file_id?: string;
  file_path?: string;
  document_facts?: import('./documentFactsService').DocumentFacts | null;
};

export type FirmLiveIntakeView = {
  previewOnly: boolean;
  routeId: string;
  routeStatus: string;
  intakeNumber: string;
  employmentMatterTags?: EmploymentMatterTagId[];
  overview: string;
  timelineSummary: string;
  events: Array<{
    id: string;
    event_date: string;
    title: string;
    category: string;
    ai_summary: string;
    worker_context: string;
  }>;
  files: FirmAccessibleUploadFile[];
  readiness: string[];
  missing: string[];
  documentRequest: FirmDocumentRequestPayload | null;
  documentResponse: WorkerDocumentResponsePayload | null;
  intakeWorkflowStatus: string;
  submissionChannel: string | null;
  /** Firm-code intakes skip participating preview / full-access approval. */
  isFirmCodeIntake: boolean;
  /** Free-form worker notes (overview block) and timeline context when access allows. */
  workerProvidedContext?: string;
  /** Structured org sections from O3S_ORG_ENGINE (packet export). */
  orgSections?: IntakeOrganizationSections;
  /** Structured worker follow-up answers extracted before sanitization (employment status, arbitration, agency filing). */
  workerFollowUp?: import('../app/constants/workerStoryIntake').StoryFollowUpAnswers | null;
  /** Worker name/phone, present only once the worker shared this intake with the firm (consent-gated). */
  workerContact?: import('./workerContactPersistence').WorkerContact | null;
  /** Phase 2B: synthesized intelligence from Claude-extracted document facts. Null until extraction runs. */
  intelligence?: import('./documentFactsService').IntakeIntelligence | null;
};

/** Signed URL for firm users when route has full_access (storage RLS). */
export async function createFirmIntakeFileSignedUrl(
  filePath: string
): Promise<{ url?: string; error?: string }> {
  const path = filePath.trim();
  if (!path) return { error: 'File path is missing.' };
  const { data, error } = await supabase.storage.from(INTAKE_FILES_BUCKET).createSignedUrl(path, 300);
  if (error) return { error: error.message };
  if (!data?.signedUrl) return { error: 'Could not create download link.' };
  return { url: data.signedUrl };
}

function splitReferenceLabels(fragment: string): string[] {
  return fragment
    .split(/,\s*/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s.length > 0 && !/^manage full names/i.test(s));
}

function inferUploadInventoryFromTimelineEvents(
  events: Array<{ category?: string | null; ai_summary?: string | null; title?: string | null }>
): FirmAccessibleUploadFile[] {
  const out: FirmAccessibleUploadFile[] = [];
  for (const e of events) {
    const category = (e.category ?? '').trim() || 'Uncategorized';
    const summary = (e.ai_summary ?? '').trim();
    const filesListMatch = summary.match(/\b\d+\s+file\(s\):\s*(.+?)\./i);
    if (filesListMatch?.[1]) {
      for (const label of splitReferenceLabels(filesListMatch[1])) {
        out.push({ file_name: label, category });
      }
      continue;
    }
    const refMatch = summary.match(/\bReferences?:\s*(.+?)(?:\.|$)/i);
    if (refMatch?.[1]) {
      for (const label of splitReferenceLabels(refMatch[1])) {
        out.push({ file_name: label, category });
      }
      continue;
    }
    const countMatch = (e.title ?? '').match(/\((\d+)\s+files?\)/i);
    const n = countMatch ? Math.max(1, parseInt(countMatch[1], 10)) : 1;
    for (let i = 0; i < n; i++) {
      out.push({
        file_name: n === 1 ? `${category} record` : `${category} record ${i + 1}`,
        category,
      });
    }
  }
  return out;
}

function inferUploadInventoryFromOverview(overview: string): FirmAccessibleUploadFile[] {
  const idx = overview.match(/Indexed references:\s*([^.]+)\./i);
  if (!idx?.[1]) return [];
  return splitReferenceLabels(idx[1]).map((file_name) => ({
    file_name,
    category: inferCategoryFromFileName(file_name),
  }));
}

export type FirmUploadInventoryOptions = {
  /** Preview routes: use summary/timeline only (no uploaded_files query). */
  previewFallbackOnly?: boolean;
};

/**
 * Firm preview can read timeline/summary under RLS but not `uploaded_files` until full_access.
 * Prefer direct file rows when available; otherwise reconstruct inventory from timeline + overview index.
 */
export async function listFirmAccessibleUploadInventory(
  intakeId: string,
  opts?: FirmUploadInventoryOptions
): Promise<FirmAccessibleUploadFile[]> {
  if (!opts?.previewFallbackOnly) {
    const { data: files, error } = await supabase
      .from('uploaded_files')
      .select(`
        id, file_name, category, file_path,
        file_text_extractions (
          document_facts,
          fact_extraction_status
        )
      `)
      .eq('intake_id', intakeId);
    if (!error && files?.length) {
      return files.map((f: any) => {
        const fileName = String(f.file_name ?? 'Uploaded file');
        const stored = (f.category as string | null)?.trim() ?? '';
        const category =
          stored && stored !== 'Uncategorized'
            ? stored
            : inferCategoryFromFileName(fileName);
        // file_text_extractions is a 1:1 relation returned as array
        const extractionRow = Array.isArray(f.file_text_extractions)
          ? f.file_text_extractions[0]
          : f.file_text_extractions;
        const document_facts =
          extractionRow?.fact_extraction_status === 'completed' && extractionRow?.document_facts
            ? (extractionRow.document_facts as import('./documentFactsService').DocumentFacts)
            : null;
        return {
          file_name: fileName,
          category,
          uploaded_file_id: typeof f.id === 'string' ? f.id : undefined,
          file_path: typeof f.file_path === 'string' && f.file_path.trim() ? f.file_path : undefined,
          document_facts,
        };
      });
    }
  }

  const { data: events } = await supabase
    .from('timeline_events')
    .select('category, ai_summary, title')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: true });

  const { data: summaryRow } = await supabase
    .from('intake_summaries')
    .select('overview')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const overview = sanitizeFirmFacingText(stripWorkerIntakeNotesBlock((summaryRow?.overview as string) ?? ''));
  const fromOverview = inferUploadInventoryFromOverview(overview);
  const fromTimeline = inferUploadInventoryFromTimelineEvents(
    (events ?? []) as Array<{ category?: string | null; ai_summary?: string | null; title?: string | null }>
  );

  const merged = [...fromOverview, ...fromTimeline];
  const seen = new Set<string>();
  const out: FirmAccessibleUploadFile[] = [];
  for (const row of merged) {
    const key = `${row.category}::${row.file_name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export async function loadFirmLiveIntakeView(
  intakeId: string,
  routeId: string,
  routeStatus: string,
  intakeNumber: string
): Promise<FirmLiveIntakeView | null> {
  let liveRouteStatus = routeStatus;
  let routeFirmId: string | null = null;
  const { data: routeRow, error: routeErr } = await supabase
    .from('firm_intake_routes')
    .select('route_status, firm_id')
    .eq('id', routeId)
    .maybeSingle();
  if (!routeErr && routeRow) {
    if (routeRow.route_status) liveRouteStatus = String(routeRow.route_status);
    routeFirmId = (routeRow.firm_id as string | null) ?? null;
  }

  const bundle = await fetchIntakeSummaryBundle(intakeId);
  const intakeRow = bundle.intake as {
    submission_channel?: string | null;
    linked_firm_id?: string | null;
  } | null;
  const submissionChannel = normalizePersistedSubmissionChannel(intakeRow?.submission_channel ?? null);
  const linkedFirmId = (intakeRow?.linked_firm_id as string | null) ?? null;
  const isFirmCodeIntake = resolveIsFirmCodeRoutedIntake({
    submissionChannel,
    linkedFirmId,
    routeFirmId,
  });
  const previewOnly =
    !isFirmCodeIntake &&
    (liveRouteStatus === 'preview_sent' || liveRouteStatus === 'access_requested');
  const s = bundle.summary as {
    overview?: string;
    timeline_summary?: string;
    readiness_indicators?: string[];
    missing_document_alerts?: string[];
  } | null;
  const overviewRaw = (s?.overview as string) ?? '';
  const documentRequest = extractFirmDocumentRequestFromOverview(overviewRaw);
  const documentResponse = resolveWorkerDocumentResponse(
    overviewRaw,
    (s?.missing_document_alerts ?? []) as string[]
  );
  const overviewForFirm = stripWorkerIntakeNotesBlock(overviewRaw);
  const intakeWorkflowStatus =
    ((bundle.intake as { workflow_status?: string } | null)?.workflow_status as string) ?? '';
  const files = await listFirmAccessibleUploadInventory(intakeId, { previewFallbackOnly: previewOnly });
  const eventsRaw = (bundle.events ?? []) as FirmLiveIntakeView['events'];
  const events = eventsRaw.map((e) => ({
    ...e,
    ai_summary: sanitizeFirmFacingText(e.ai_summary),
    worker_context: previewOnly ? '' : sanitizeFirmFacingText(e.worker_context),
  }));
  const workerProvidedContext = resolveWorkerProvidedContextForFirmView(
    overviewRaw,
    eventsRaw.map((e) => String(e.worker_context ?? '')),
    { includeTimelineContext: !previewOnly }
  );

  const employmentMatterTags = extractEmploymentMatterTagsFromOverview(overviewRaw);
  const orgSections = extractOrgEngineFromOverview(overviewRaw)?.sections;
  const workerFollowUp = extractStoryFollowUpFromOverview(overviewRaw);
  // Worker contact is only present in the overview once the worker shared with a firm.
  // For preview-only routes (no full access yet) we withhold it, mirroring the privacy gate.
  const workerContact = previewOnly ? null : extractWorkerContactFromOverview(overviewRaw);

  // Phase 2B: fetch synthesized intelligence from edge function (service role reads facts, bypasses RLS)
  let intelligence: import('./documentFactsService').IntakeIntelligence | null = null;
  if (!previewOnly) {
    try {
      const { data: intelData } = await supabase.functions.invoke('get-intake-intelligence', {
        body: { intake_id: intakeId },
      });
      if (intelData?.intelligence) {
        intelligence = intelData.intelligence as import('./documentFactsService').IntakeIntelligence;
      }
    } catch {
      // Intelligence is non-blocking — never fail the view load
    }
  }

  return {
    previewOnly,
    routeId,
    routeStatus: liveRouteStatus,
    intakeNumber,
    employmentMatterTags: employmentMatterTags.length ? employmentMatterTags : undefined,
    overview: sanitizeFirmFacingText(overviewForFirm),
    timelineSummary: sanitizeFirmFacingText((s?.timeline_summary as string) ?? ''),
    events,
    files,
    readiness: (s?.readiness_indicators ?? []).map((line) => sanitizeFirmFacingText(String(line))),
    missing: (s?.missing_document_alerts ?? []).map((line) => sanitizeFirmFacingText(String(line))),
    documentRequest,
    documentResponse,
    intakeWorkflowStatus,
    submissionChannel,
    isFirmCodeIntake,
    workerProvidedContext: workerProvidedContext
      ? sanitizeFirmFacingText(workerProvidedContext)
      : undefined,
    orgSections,
    workerFollowUp: workerFollowUp ?? null,
    workerContact,
    intelligence,
  };
}

export type AccessRequestRow = {
  routeId: string;
  firmName: string;
  intakeNumber: string;
  intakeId: string;
  barNumber: string | null;
  barState: string | null;
};

export async function listWorkerAccessRequests(workerId: string): Promise<AccessRequestRow[]> {
  const { data: intakes } = await supabase.from('intakes').select('id, intake_number').eq('worker_id', workerId);
  const ids = (intakes ?? []).map((i) => i.id);
  if (!ids.length) return [];
  const { data: routes } = await supabase
    .from('firm_intake_routes')
    .select('id, intake_id, route_status, firm_id')
    .in('intake_id', ids)
    .eq('route_status', 'access_requested');
  const out: AccessRequestRow[] = [];
  for (const r of routes ?? []) {
    const { data: firm } = await supabase
      .from('firm_profiles')
      .select('firm_name, bar_number, bar_state')
      .eq('id', r.firm_id)
      .single();
    const intake = intakes?.find((i) => i.id === r.intake_id);
    if (intake) {
      out.push({
        routeId: r.id,
        intakeId: r.intake_id,
        intakeNumber: intake.intake_number,
        firmName: firm?.firm_name ?? 'Firm',
        barNumber: (firm?.bar_number as string | null) ?? null,
        barState: (firm?.bar_state as string | null) ?? null,
      });
    }
  }
  return out;
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
