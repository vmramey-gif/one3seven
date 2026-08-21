import type { User } from '@supabase/supabase-js';
import pRetry from 'p-retry';
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
  mergeStoryFollowUpIntoWorkerNotesBody,
} from './storyFollowUpPersistence';
import { hasStoryFollowUpContent } from '../app/constants/workerStoryIntake';
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
  type FirmSubmissionTypeDisplay,
} from '../app/constants/one3sevenProduct';
import { inferInventoryCategory } from './packetChronologyIntelligence';
import { normalizeFilenameForMatching } from './filenameMatching';
import { attorneyCategoryLabel } from './packetStoryPresentation';
import type { IntakeOrganizationSections, PlaceholderOrganizationResult } from './intakeOrganizationTypes';
import { refreshSectionsReviewNotes } from './intakeOrganizationSectionsService';
import { extractEmploymentMatterTagsFromOverview } from '../app/utils/employmentMatterPersistence';
import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
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
import { waitForWorkerSummaryRow, fetchIntakeSummaryBundle, updateIntakeWorkflowStatus, isMissingRpcError } from './firmRoutingService';

export const INTAKE_FILES_BUCKET = 'intake-files';

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

export function betaPlaceholderBundleFromFiles(
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
  /** Founder-only internal tooling (CRM) access. Set operator-side; never via the app. */
  is_founder?: boolean | null;
  /** Sales-rep CRM access marker. */
  crm_role?: string | null;
  /** Access gate: false until an operator approves the account (worker/firm hold during beta). */
  approved?: boolean | null;
  created_at: string;
  // Worker contact details (persisted in DB â€” see migration 20260609_worker_contact_details)
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
  const rawLower = fileName.toLowerCase();
  // Normalize CamelCase + separators to a SPACE-delimited canonical form so tokens like
  // "final_pay" / "written_warning" also match "FinalPay.pdf" / "WrittenWarning.pdf"
  // (which previously fell through to a weaker/wrong category). Keep a raw lowercase copy
  // for the W-2 checks, whose patterns depend on the literal hyphen.
  const name = normalizeFilenameForMatching(fileName);
  const w2ish =
    /\bw[-\s]?2\b/i.test(fileName) ||
    /(^|[^a-z0-9])w2([^a-z0-9]|$)/i.test(rawLower) ||
    rawLower.includes('w-2') ||
    name.includes('w 2');

  // Separation / termination â€” check before pay to avoid "final pay" grabbing termination letters
  if (
    name.includes('termination') ||
    name.includes('separation') ||
    name.includes('final paystub') ||
    name.includes('final pay') ||
    name.includes('last day') ||
    name.includes('letter of separation') ||
    name.includes('end of employment')
  ) {
    return 'Separation Records';
  }

  // Discipline / warnings
  if (
    name.includes('warning') ||
    name.includes('written warning') ||
    name.includes('write up') ||
    name.includes('writeup') ||
    name.includes('corrective') ||
    name.includes('disciplin') ||
    name.includes('pip') ||
    name.includes('performance improvement')
  ) {
    return 'Performance / discipline records';
  }

  // Witness / coworker statements. Guard against financial "statements" (wage/earnings/pay/bank/
  // income statements) â€” those are pay records, not witness statements, and the bare "statement"
  // check used to swallow "EarningsStatement.pdf" before the pay branch below could catch it.
  const financialStatement = /\b(wage|earnings|pay|bank|income|financial|account)\b/.test(name);
  if (
    (name.includes('statement') && !financialStatement) ||
    name.includes('witness') ||
    name.includes('declaration') ||
    name.includes('affidavit') ||
    name.includes('coworker') ||
    name.includes('co worker') ||
    name.includes('colleague')
  ) {
    return 'Witness Statement';
  }

  // Meal & rest period records
  if (
    name.includes('meal') ||
    name.includes('break log') ||
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
    name.includes('report to hr') ||
    name.includes('hr complaint') ||
    name.includes('text message')
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

/** Strong title cues â€” used only when deciding whether a rename may change stored category. */
function fileNameHasStrongCategorySignal(fileName: string, category: string): boolean {
  // Space-normalized (CamelCase split, separators collapsed) so the \s-based patterns below
  // match "OfferLetter.pdf" / "PerformanceReview.pdf" as well as "offer_letter" / "offer letter".
  const n = normalizeFilenameForMatching(fileName);
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
  // PromiseLike, not Promise: Supabase query builders are thenable but not real Promise
  // instances, so a Promise<T> parameter type fails structural inference and T collapses to
  // {} at every call site â€” that was the single root cause behind ~25 of the tsc baseline errors.
  promise: PromiseLike<T>,
  timeoutMs: number = PROFILE_QUERY_TIMEOUT_MS
): Promise<T> {
  // number, not ReturnType<typeof setTimeout>: @types/node's ambient setTimeout declaration
  // pollutes the merged global scope (even Window's), so any ReturnType-derived type here
  // resolves to NodeJS.Timeout â€” this is always browser code (window.setTimeout), which truly
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
      console.info('[o3s-ensure-profile] duplicate insert â€” before fetchProfile (retry)');
      const againResult = await fetchProfileQuery(user.id);
      console.info('[o3s-ensure-profile] duplicate insert â€” after fetchProfile (retry)', {
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
      console.info('[o3s-role-commit] upsert failed â€” trying update-only', { code: error.code });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('timed out')) {
      return { profile: null, error: msg };
    }
    console.warn('[o3s-role-commit] upsert timed out â€” trying update-only', { userId: user.id });
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
      console.error('[o3s-role-commit] commitProfileRoleForUser: update timed out â€” optimistic continue', {
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
    console.info('[o3s-firm-save] ensureProfileRole: upsert failed â€” update-only', {
      userId,
      message: error.message,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('timed out')) return { error: msg };
    console.warn('[o3s-firm-save] ensureProfileRole: upsert timed out â€” update-only', { userId });
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

  console.info('[o3s-firm-save] no row updated â€” before insert', { userId: opts.userId });
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
  let { data, error } = await supabase.from('intakes').insert(insert).select('id, intake_number').single();
  // Safety net: if the chosen intake_number collides (e.g. a stale display sequence), retry
  // once with a uniquified number rather than hard-failing the worker mid-intake.
  if (error && (error as { code?: string }).code === '23505') {
    insert.intake_number = `${intake_number}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    ({ data, error } = await supabase.from('intakes').insert(insert).select('id, intake_number').single());
  }
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
    // Fire-and-forget so the upload returns fast. runPhase2AFileTextExtraction records its own
    // failures in-band (extraction_status='failed' via its outer catch), so a normal extraction
    // error is NOT silent â€” it is persisted per file. This catch only fires if the dynamic import
    // itself fails; log with enough context to trace which file/intake was affected.
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
      .catch((e) =>
        console.error('[o3s-upload] Phase 2A extraction failed to start', {
          uploadedFileId,
          intakeId,
          fileName: file.name,
          error: e instanceof Error ? e.message : String(e),
        })
      );
  }
  return { path, uploadedFileId, contentHash };
}

async function queryUploadedFiles(intakeId: string) {
  const { data, error } = await supabase
    .from('uploaded_files')
    .select('id, file_name, file_type, file_path, category, file_size, created_at')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    return { rows: [] as NonNullable<typeof data>, error: error.message };
  }
  return { rows: data ?? [], error: undefined as string | undefined };
}

export async function listUploadedFiles(intakeId: string) {
  const { rows } = await queryUploadedFiles(intakeId);
  return rows;
}

/**
 * Same query as listUploadedFiles, but distinguishes "zero files" from "the read failed" --
 * listUploadedFiles collapses both to an empty array, which is fine for callers that only care
 * about a count/best-effort loop, but is exactly the bug behind H2 (worker audit, 2026-08) when a
 * caller hard-replaces visible UI state with the result: a transient read error made a worker's
 * entire file list appear to vanish, even though nothing was actually deleted server-side.
 */
export async function listUploadedFilesResult(intakeId: string) {
  return queryUploadedFiles(intakeId);
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

  const { data: removed, error: storageError } = await supabase.storage.from('intake-files').remove([path]);
  if (storageError) return { error: storageError.message };
  // Verify the blob is actually gone before deleting its DB row. If we can't confirm removal,
  // keep the row (the pointer) so the file is never orphaned/invisible â€” and report honestly.
  const confirmed = (removed ?? []).some((o) => (o?.name ?? '').trim() === path);
  if (!confirmed) {
    console.error('[o3s-delete-file] storage removal not confirmed', { uploadedFileId, path });
    return { error: 'We could not confirm this file was removed from storage. Please try again, or contact support.' };
  }

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
  document_facts: Record<string, unknown> | null;
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
      'uploaded_file_id, intake_id, worker_id, extracted_text, extraction_status, quality_flags, document_facts, uploaded_files!inner(id, file_name, category)'
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
        document_facts: (row.document_facts ?? null) as Record<string, unknown> | null,
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

/** Per-file facts + text snippet for the CA record-coverage rail (content-based presence signals). */
export type CoverageExtractionFactsRow = {
  fileName: string;
  documentFacts: Record<string, unknown> | null;
  textSnippet: string;
};

/**
 * Facts + head-of-text snippets for coverage assessment. Unlike
 * `listCompletedExtractionsForIntake`, rows with an EMPTY text layer are kept â€” a scanned
 * employment agreement or personnel-file production often has no text but rich stored facts,
 * and those facts are exactly what the coverage rail's content signals need.
 */
export async function listExtractionFactsForCoverage(
  intakeId: string
): Promise<{ rows: CoverageExtractionFactsRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('file_text_extractions')
    .select('extracted_text, document_facts, uploaded_files!inner(file_name)')
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
        fileName: String(file?.file_name ?? ''),
        documentFacts: (row.document_facts ?? null) as Record<string, unknown> | null,
        textSnippet: String(row.extracted_text ?? '').slice(0, 2000),
      } satisfies CoverageExtractionFactsRow;
    })
    .filter((row: CoverageExtractionFactsRow) => row.fileName.length > 0);

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

/**
 * Embedded worker intake notes inside `intake_summaries.overview` (no new rows).
 * Newline-tolerant on both edges (`\n?`) â€” the stored overview is trimmed by safeTrim on
 * save, so a strict leading/trailing `\n` requirement made the block unreadable after a
 * rebuild and the notes were silently dropped on the next one.
 */
const WORKER_INTAKE_NOTES_PATTERN =
  /\n?---\s*O3S_WORKER_INTAKE_NOTES\s*---\n([\s\S]*?)\n---\s*O3S_WORKER_INTAKE_NOTES_END\s*---\n?/;

const GUIDED_INTAKE_BLOCK_PATTERN =
  /--- O3S_GUIDED_INTAKE ---\n([\s\S]*?)\n--- O3S_GUIDED_INTAKE_END ---/;

const WORKER_STORY_BLOCK_PATTERN =
  /--- O3S_WORKER_STORY ---\n([\s\S]*?)\n--- O3S_WORKER_STORY_END ---/;

const STORY_FOLLOWUP_BLOCK_PATTERN =
  /--- O3S_STORY_FOLLOWUP ---\n([\s\S]*?)\n--- O3S_STORY_FOLLOWUP_END ---/;

const CATEGORY_SCAFFOLD_BLOCK_PATTERN =
  /--- O3S_CATEGORY_SCAFFOLD ---\n([\s\S]*?)\n--- O3S_CATEGORY_SCAFFOLD_END ---/;

const FIRM_INTERNAL_MARKERS_PATTERN =
  /---\s*O3S_WORKER_INTAKE_NOTES\s*---[\s\S]*?---\s*O3S_WORKER_INTAKE_NOTES_END\s*---/gi;

const FIRM_DOCUMENT_REQUEST_PATTERN =
  /\n--- O3S_FIRM_DOCUMENT_REQUEST ---\n([\s\S]*?)\n--- O3S_FIRM_DOCUMENT_REQUEST_END ---\n/;

const WORKER_DOCUMENT_RESPONSE_PATTERN =
  /\n--- O3S_WORKER_DOCUMENT_RESPONSE ---\n([\s\S]*?)\n--- O3S_WORKER_DOCUMENT_RESPONSE_END ---\n/;

/**
 * Worker contact (name/phone) copied into the firm-readable summary at share time.
 * Surfaced to the firm via the extracted `workerContact`, never as raw prose â€” so it
 * is stripped from all firm- and worker-facing display text by sanitizeFirmFacingText.
 */
const WORKER_CONTACT_PATTERN =
  /\n?---\s*O3S_WORKER_CONTACT\s*---[\s\S]*?---\s*O3S_WORKER_CONTACT_END\s*---\n?/gi;

/** MVP firm â†’ worker document request categories (checkbox labels). */
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

/**
 * Storage-path strip: removes ONLY the worker-notes block. Never use the sanitizing
 * `stripWorkerIntakeNotesBlock` on text that is written back to `intake_summaries.overview` â€”
 * sanitizeFirmFacingText is a display polish that deletes every embedded O3S_ sidecar block
 * (worker contact, org engine, mitigation log, â€¦) from whatever it touches.
 */
export function stripWorkerIntakeNotesBlockForStorage(overview: string): string {
  return overview.replace(WORKER_INTAKE_NOTES_PATTERN, '\n');
}

export function extractWorkerIntakeNotesFromOverview(overview: string | null | undefined): string {
  const m = (overview ?? '').match(WORKER_INTAKE_NOTES_PATTERN);
  return m?.[1]?.trim() ?? '';
}

export type ParsedWorkerIntakeNotes = {
  guidedSummary: string | null;
  workerStory: string | null;
  additionalNotes: string | null;
  /** Raw body of the O3S_STORY_FOLLOWUP block, carried through rebuilds so notes edits never drop it. */
  storyFollowUp?: string | null;
  /** Raw body of the O3S_CATEGORY_SCAFFOLD block, carried through rebuilds. */
  categoryScaffold?: string | null;
};

function stripEmbeddedWorkerNoteBlocks(notesBody: string): string {
  return notesBody
    .replace(GUIDED_INTAKE_BLOCK_PATTERN, '')
    .replace(WORKER_STORY_BLOCK_PATTERN, '')
    .replace(STORY_FOLLOWUP_BLOCK_PATTERN, '')
    .replace(CATEGORY_SCAFFOLD_BLOCK_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse worker notes embedded in overview (guided metadata, story, free-form notes). */
export function parseWorkerIntakeNotesContent(notesBody: string | null | undefined): ParsedWorkerIntakeNotes {
  const raw = (notesBody ?? '').trim();
  if (!raw) {
    return {
      guidedSummary: null,
      workerStory: null,
      additionalNotes: null,
      storyFollowUp: null,
      categoryScaffold: null,
    };
  }

  const guidedMatch = raw.match(GUIDED_INTAKE_BLOCK_PATTERN);
  const guidedSummary = guidedMatch?.[1]?.trim() || null;

  const storyFollowUp = raw.match(STORY_FOLLOWUP_BLOCK_PATTERN)?.[1]?.trim() || null;
  const categoryScaffold = raw.match(CATEGORY_SCAFFOLD_BLOCK_PATTERN)?.[1]?.trim() || null;

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
    storyFollowUp,
    categoryScaffold,
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

/** Rebuild embedded worker-notes body while preserving guided + story + follow-up + scaffold blocks. */
export function rebuildWorkerIntakeNotesBody(parsed: ParsedWorkerIntakeNotes): string {
  const parts: string[] = [];
  if (parsed.guidedSummary) {
    parts.push('--- O3S_GUIDED_INTAKE ---', parsed.guidedSummary, '--- O3S_GUIDED_INTAKE_END ---');
  }
  if (parsed.workerStory) {
    parts.push('--- O3S_WORKER_STORY ---', parsed.workerStory, '--- O3S_WORKER_STORY_END ---');
  }
  if (parsed.categoryScaffold?.trim()) {
    parts.push(
      `--- O3S_CATEGORY_SCAFFOLD ---\n${parsed.categoryScaffold.trim()}\n--- O3S_CATEGORY_SCAFFOLD_END ---`
    );
  }
  if (parsed.additionalNotes?.trim()) {
    parts.push(parsed.additionalNotes.trim());
  }
  if (parsed.storyFollowUp?.trim()) {
    parts.push(
      `--- O3S_STORY_FOLLOWUP ---\n${parsed.storyFollowUp.trim()}\n--- O3S_STORY_FOLLOWUP_END ---`
    );
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
  options?: { includeTimelineContext?: boolean; previewOnly?: boolean }
): string | undefined {
  // PRIVACY GATE (worker dashboard promise, one3sevenProduct.ts: "Firms do not see yet: your full
  // file contents, personal narrative, or private notesâ€”unless you approve expanded review
  // access"): a preview-only (pre-approval) firm receives NO worker-provided narrative at all â€”
  // no story, no additional notes, no guided summary, no follow-up narrative, no timeline
  // context. Gated here, at the source, so every consumer of the firm view model is protected.
  if (options?.previewOnly) return undefined;
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

/**
 * Preview-only strip for the structured worker follow-up: the free-text NARRATIVE answers
 * (what happened when they complained, what changed afterward, remote-expense description,
 * prior-filing details, and any named individuals â€” a treating physician, a manager, anyone the
 * worker named) are part of the worker's personal narrative and are withheld until the worker
 * approves expanded access. The identity/scheduling facts the preview surface already shows
 * (employment name, employer, dates, status, arbitration/agency flags, work state) are kept so
 * the preview card and preview PDF cover keep working.
 */
export function stripWorkerFollowUpNarrativeForPreview(
  followUp: import('../app/constants/workerStoryIntake').StoryFollowUpAnswers | null
): import('../app/constants/workerStoryIntake').StoryFollowUpAnswers | null {
  if (!followUp) return followUp;
  return {
    ...followUp,
    complainedOrReported: '',
    changedAfterward: '',
    remoteExpenses: '',
    priorAgencyFilingDetails: '',
    keyPeople: '',
  };
}

export function mergeWorkerIntakeNotesIntoOverview(
  overview: string | null | undefined,
  notes: string
): string {
  const base = stripWorkerIntakeNotesBlockForStorage(overview ?? '').replace(/\s+$/u, '');
  const t = safeTrim(notes, 'mergeWorkerIntakeNotesIntoOverview.notes');
  if (!t) return base;
  return `${base}\n--- O3S_WORKER_INTAKE_NOTES ---\n${t}\n--- O3S_WORKER_INTAKE_NOTES_END ---\n`;
}

/**
 * Sidecar O3S blocks stored in `intake_summaries.overview` but owned by other feature
 * codecs (contact share, category, employment matter, mitigation log, reminders, records
 * requests). A rebuild regenerates the narrative from scratch, so any sidecar block the
 * rebuilt overview lost is copied forward verbatim from the previous stored overview.
 */
const OVERVIEW_SIDECAR_BLOCK_NAMES = [
  'O3S_WORKER_CONTACT',
  'O3S_CASE_CATEGORY',
  'O3S_EMPLOYMENT_MATTER',
  'O3S_MITIGATION_LOG',
  'O3S_WORKER_REMINDERS',
  'O3S_RECORDS_REQUEST_LOG',
] as const;

function overviewSidecarBlockPattern(name: string): RegExp {
  return new RegExp(`\\n?---\\s*${name}\\s*---\\n[\\s\\S]*?\\n---\\s*${name}_END\\s*---\\n?`);
}

export function preserveOverviewSidecarBlocks(
  previousOverview: string | null | undefined,
  nextOverview: string
): string {
  const previous = previousOverview ?? '';
  if (!previous) return nextOverview;
  let out = nextOverview;
  for (const name of OVERVIEW_SIDECAR_BLOCK_NAMES) {
    const pattern = overviewSidecarBlockPattern(name);
    if (pattern.test(out)) continue;
    const match = previous.match(pattern);
    if (!match) continue;
    const block = match[0].replace(/^\n+/u, '').replace(/\n+$/u, '');
    out = `${out.replace(/\s+$/u, '')}\n${block}\n`;
  }
  return out;
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
  const next = mergeWorkerIntakeNotesIntoOverview(stripWorkerIntakeNotesBlockForStorage(overview), body);
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
  const base = stripWorkerIntakeNotesBlockForStorage(overview).replace(/\s+$/u, '');
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
  previousOverview: string;
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
    previousOverview,
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

  overviewToStore = runAssemblyStep('sidecar block preservation', intakeId, () =>
    preserveOverviewSidecarBlocks(previousOverview, overviewToStore)
  );

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

  // listUploadedFiles collapses a real read error to [] -- this function goes on to rebuild and
  // PERSIST an organization/summary from `files`, so trusting a wrongly-empty result here doesn't
  // just flicker the UI, it writes a wiped-out organization to the database (H2, worker audit
  // 2026-08, more severe instance than the original UI-only finding). Use the error-preserving
  // variant and fail the whole persist rather than silently proceeding on a transient failure.
  const filesResult = await listUploadedFilesResult(intakeId);
  if (filesResult.error) {
    logSummarySaveError('uploaded_files list', filesResult.error, { intakeId });
    return { error: 'Could not load uploaded files for this intake.', stage: 'uploaded_files_list' };
  }
  const files = filesResult.rows;
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
  let preservedWorkerNotes = extractWorkerIntakeNotesFromOverview(previousOverview);
  // Recovery: earlier rebuilds could drop the story / follow-up blocks from the stored
  // overview. `intakes.worker_metadata` keeps the worker-owned originals â€” reconstruct.
  try {
    const recoveryMetadata = parseWorkerIntakeMetadata(priorIntake?.worker_metadata);
    const recoverStory =
      !WORKER_STORY_BLOCK_PATTERN.test(preservedWorkerNotes) &&
      Boolean(recoveryMetadata.workerStory?.trim());
    const recoverFollowUp =
      !STORY_FOLLOWUP_BLOCK_PATTERN.test(preservedWorkerNotes) &&
      hasStoryFollowUpContent(recoveryMetadata.storyFollowUp);
    if (recoverStory || recoverFollowUp) {
      const parsedNotes = parseWorkerIntakeNotesContent(preservedWorkerNotes);
      let recoveredNotes = rebuildWorkerIntakeNotesBody({
        ...parsedNotes,
        workerStory: recoverStory ? recoveryMetadata.workerStory ?? null : parsedNotes.workerStory,
      });
      if (recoverFollowUp && recoveryMetadata.storyFollowUp) {
        recoveredNotes = mergeStoryFollowUpIntoWorkerNotesBody(
          recoveredNotes,
          recoveryMetadata.storyFollowUp
        );
      }
      if (recoveredNotes.trim()) {
        preservedWorkerNotes = recoveredNotes;
        logOrgAudit('worker notes recovered from worker_metadata', {
          intakeId,
          activeStep: 'worker_notes_recovery',
          recoveredStory: recoverStory,
          recoveredFollowUp: recoverFollowUp,
        });
      }
    }
  } catch (recoveryError) {
    logOrgAuditError('worker notes recovery failed (non-fatal)', recoveryError, {
      intakeId,
      activeStep: 'worker_notes_recovery',
    });
  }
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
    documentFacts: row.document_facts ?? null,
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
    logOrgAuditError('summary generation failed â€” placeholder fallback', generationError, {
      intakeId,
      activeStep: 'summary_generation',
      uploadedFileCount: files.length,
      extractionCount: completedExtractions.length,
    });
    try {
      org = buildPlaceholderOrganization(safeMeta, { employmentMatterTags });
    } catch (placeholderError) {
      logOrgAuditError('summary generation placeholder failed â€” minimal fallback', placeholderError, {
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
    // org.sections is a fixed-shape object (IntakeOrganizationSections), not an array â€” this
    // used to call .length on it, which is always undefined. Count populated sections instead.
    sectionCount: Object.values(org.sections).filter((v) =>
      Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : Boolean(v)
    ).length,
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
      previousOverview,
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
    logSummarySaveError('summary assembly â€” core preserved', assemblyError, { intakeId });
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
    logOrgAuditError('intakes update failed â€” core summary preserved', up, {
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

