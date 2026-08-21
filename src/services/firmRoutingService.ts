/**
 * Firm-routing and access-request domain: firm-code linking, participating-network preview
 * routing, firm dashboard reads, full-access approve/decline, and the firm-facing live intake
 * view (loadFirmLiveIntakeView). Extracted 2026-08-21 from intakeDataService.ts (PR4, seam 1 --
 * the file was 4,707 lines doing auth/profile, file-upload, overview-text-parsing, and firm-
 * routing all in one module; this is the first domain pulled out, since it's also where the
 * Founder CRM RLS gap lives). Pure move, no behavior change -- verified via tsc/tests/build and a
 * live browser check of the firm dashboard + intake review screens (the gauntlet exercises the
 * extraction/synthesis edge functions, not this client-side data layer, so it doesn't cover this
 * seam).
 *
 * Depends back on intakeDataService.ts for a handful of overview-parsing/category helpers
 * (sanitizeFirmFacingText, resolveWorkerDocumentResponse, etc.) that legitimately belong to that
 * file's remaining "overview sidecar parsing" domain -- this is a real, acknowledged two-way
 * dependency between the two files, not hidden. intakeDataService.ts in turn imports
 * waitForWorkerSummaryRow back from here (persistPlaceholderOrganizationForIntake calls it).
 */
import { supabase } from '../lib/supabaseClient';
import pRetry from 'p-retry';
import { extractOrgEngineFromOverview } from './intakeOrgEngineCodec';
import { extractStoryFollowUpFromOverview } from './storyFollowUpPersistence';
import { extractWorkerContactFromOverview } from './workerContactPersistence';
import * as notifications from './notificationService';
import {
  normalizePersistedSubmissionChannel,
  resolveFirmSubmissionTypeDisplay,
  resolveIsFirmCodeRoutedIntake,
  type FirmSubmissionTypeDisplay,
} from '../app/constants/one3sevenProduct';
import type { IntakeOrganizationSections } from './intakeOrganizationTypes';
import { extractEmploymentMatterTagsFromOverview } from '../app/utils/employmentMatterPersistence';
import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import { logSummarySave, logSummarySaveError } from './summarySaveDiagnostics';
import { logOrgAudit } from './organizationAudit';
import {
  isSchemaRelationUnavailable,
  sanitizeFirmFacingText,
  resolveWorkerDocumentResponse,
  stripWorkerIntakeNotesBlock,
  resolveWorkerProvidedContextForFirmView,
  extractFirmDocumentRequestFromOverview,
  inferCategoryFromFileName,
  INTAKE_FILES_BUCKET,
  betaPlaceholderBundleFromFiles,
  listUploadedFiles,
  isWorkerDocumentRequestResponseComplete,
  stripWorkerFollowUpNarrativeForPreview,
  type FirmDocumentRequestPayload,
  type WorkerDocumentResponsePayload,
} from './intakeDataService';

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

/**
 * Fetches the four tables that make up an intake's summary bundle. A missing/unavailable table
 * (`isSchemaRelationUnavailable` — public-beta schema hasn't deployed an optional table yet) is
 * treated as legitimately empty, same as before. A genuine query error (RLS denial, network
 * failure, timeout, etc.) is NOT — it is recorded in `fetchErrors` so callers can tell "nothing
 * here" apart from "we couldn't check." This distinction matters because `intake_summaries`
 * coming back empty due to a real error used to be indistinguishable from a legitimately new
 * intake, and the beta-placeholder fallback below would synthesize a fake-looking summary from
 * filenames alone in either case — see `loadFirmLiveIntakeView`, which now refuses to build a
 * view (returns null) when `fetchErrors` is non-empty.
 */
export async function fetchIntakeSummaryBundle(intakeId: string) {
  const [intakeRes, filesRes, eventsRes, summariesRes] = await Promise.all([
    supabase.from('intakes').select('*').eq('id', intakeId).maybeSingle(),
    supabase.from('uploaded_files').select('*').eq('intake_id', intakeId),
    supabase.from('timeline_events').select('*').eq('intake_id', intakeId).order('created_at', { ascending: true }),
    supabase.from('intake_summaries').select('*').eq('intake_id', intakeId).order('created_at', { ascending: false }).limit(1),
  ]);

  const fetchErrors: string[] = [];

  const intake = intakeRes.data;
  if (intakeRes.error && !isSchemaRelationUnavailable(intakeRes.error)) {
    console.error(intakeRes.error);
    fetchErrors.push(`intakes: ${intakeRes.error.message}`);
  }

  const fileRows = (filesRes.data ?? []) as Array<{ file_name: string; category: string | null }>;
  if (filesRes.error) {
    console.error(filesRes.error);
    if (!isSchemaRelationUnavailable(filesRes.error)) {
      fetchErrors.push(`uploaded_files: ${filesRes.error.message}`);
    }
  }

  let events = (eventsRes.data ?? []) as Record<string, unknown>[];
  if (eventsRes.error) {
    if (!isSchemaRelationUnavailable(eventsRes.error)) {
      console.error(eventsRes.error);
      fetchErrors.push(`timeline_events: ${eventsRes.error.message}`);
    }
    events = [];
  }

  let summary = (summariesRes.data?.[0] ?? null) as Record<string, unknown> | null;
  let summaryFetchFailed = false;
  if (summariesRes.error) {
    if (!isSchemaRelationUnavailable(summariesRes.error)) {
      console.error(summariesRes.error);
      fetchErrors.push(`intake_summaries: ${summariesRes.error.message}`);
      summaryFetchFailed = true;
    }
    summary = null;
  }

  // The beta placeholder is a convenience for genuinely-new intakes that have files but no
  // organized summary/timeline yet. It must never fire when the emptiness is actually a fetch
  // failure — that would render a synthesized, real-looking summary in place of a "we couldn't
  // load this" signal, indistinguishable to an attorney from genuine output.
  const summaryMissing = !summary && !summaryFetchFailed;
  const timelineMissing = events.length === 0 && !fetchErrors.some((e) => e.startsWith('timeline_events:'));
  if (fileRows.length && (summaryMissing || timelineMissing)) {
    const ph = betaPlaceholderBundleFromFiles(intakeId, fileRows);
    if (summaryMissing) summary = ph.summary as Record<string, unknown>;
    if (timelineMissing) events = ph.events as Record<string, unknown>[];
  }

  return { intake, files: fileRows, events, summary, fetchErrors };
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

export function isMissingRpcError(error: { code?: string; message?: string } | null | undefined): boolean {
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

/**
 * Deletes a worker-owned intake and related rows via security-definer RPC (do not use client
 * multi-table delete). Returns `error` for a hard failure (nothing deleted), or `storageWarning`
 * when the database rows were deleted but the file blobs in Storage could not be confirmed gone
 * (orphan risk) — callers must surface this rather than report unqualified success.
 */
export async function deleteWorkerOwnedIntake(
  intakeId: string
): Promise<{ error?: string; storageWarning?: string }> {
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
    // The DB rows are already deleted (RPC above). Now remove the file blobs and VERIFY:
    // Supabase remove() returns `data` = the list of objects it actually removed, so a path
    // missing from that list (or a request error) means we could not confirm deletion.
    // We never treat "the call didn't throw" as proof.
    const { data: removed, error: storageError } = await supabase.storage
      .from(INTAKE_FILES_BUCKET)
      .remove(storagePaths);
    const removedNames = new Set((removed ?? []).map((o) => (o?.name ?? '').trim()).filter(Boolean));
    const unconfirmed = storagePaths.filter((p) => !removedNames.has(p));
    if (storageError || unconfirmed.length > 0) {
      const count = unconfirmed.length || storagePaths.length;
      console.error('[o3s-delete-intake] storage cleanup incomplete', {
        intakeId,
        workerId,
        requested: storagePaths.length,
        confirmedRemoved: removedNames.size,
        unconfirmed,
        message: storageError?.message ?? null,
      });
      return {
        storageWarning:
          `Your intake records were removed, but we could not confirm ${count} file${count === 1 ? '' : 's'} ` +
          `${count === 1 ? 'was' : 'were'} cleared from storage. We're working on a way for you to verify this yourself.`,
      };
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

/**
 * Poll until summary row exists (handles post-write read lag). Was a hand-rolled fixed-interval
 * loop (2026-08-19 hard-challenge finding: a magic-number retry loop is less honest about backoff
 * than a real retry utility) -- now p-retry, but deliberately kept at `factor: 1` (fixed interval,
 * not exponential) to preserve the exact original cadence/behavior; only the mechanism changed,
 * not the timing, since this call site's callers don't expect a longer worst-case wait.
 */
export async function waitForWorkerSummaryRow(
  intakeId: string,
  opts?: { attempts?: number; delayMs?: number }
): Promise<boolean> {
  const attempts = opts?.attempts ?? 5;
  const delayMs = opts?.delayMs ?? 400;
  try {
    const attemptNumber = await pRetry(
      async (attemptNumber) => {
        if (!(await workerIntakeHasSummaryRow(intakeId))) {
          throw new Error('Summary row not found yet');
        }
        return attemptNumber;
      },
      { retries: attempts - 1, minTimeout: delayMs, factor: 1 }
    );
    logOrgAudit('row verification succeeded', {
      intakeId,
      activeStep: 'post_save_verification',
      rowVerificationStatus: 'passed',
      attempt: attemptNumber,
    });
    return true;
  } catch {
    logOrgAudit('row verification exhausted retries', {
      intakeId,
      activeStep: 'post_save_verification',
      rowVerificationStatus: 'failed',
      attempts,
    });
    return false;
  }
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

/**
 * Load a firm's routed intakes. Returns a result so the caller can tell a genuine empty
 * queue apart from a load FAILURE — previously a network/RLS error returned [] and rendered
 * identically to "no intakes", which is a firm-trust hazard (their queue appears to vanish).
 */
export async function loadFirmDashboardRows(
  firmTableId: string
): Promise<{ rows: FirmDashboardRow[]; error: string | null }> {
  try {
    return { rows: await loadFirmDashboardRowsInner(firmTableId), error: null };
  } catch (e) {
    console.error('[o3s-firm-dashboard] loadFirmDashboardRows failed', e);
    return {
      rows: [],
      error: 'We could not load your intake list just now. This is a connection or access error, not an empty queue — please retry.',
    };
  }
}

async function loadFirmDashboardRowsInner(firmTableId: string): Promise<FirmDashboardRow[]> {
  const { data: routes, error } = await supabase
    .from('firm_intake_routes')
    .select('id, intake_id, route_status, preview_sent_at, created_at')
    .eq('firm_id', firmTableId);
  if (error) {
    console.error(error);
    console.info('[o3s-firm-dashboard] routes query error', { firmTableId, message: error.message });
    return [];
  }
  const rawRouteCount = routes?.length ?? 0;
  console.info('[o3s-firm-dashboard] raw route count', { firmTableId, rawRouteCount });

  // Firms no longer read `intakes` directly (that table can hold worker_metadata, which must
  // never be firm-visible at any route stage — see 20260809120000). `firm_intake_preview` is a
  // narrow view exposing only the columns the dashboard list actually needs, at any route status.
  const intakeIds = [...new Set((routes ?? []).map((r) => r.intake_id).filter(Boolean))] as string[];
  const intakeById = new Map<string, IntakeRoutingEmbed>();
  if (intakeIds.length) {
    const { data: previews, error: previewErr } = await supabase
      .from('firm_intake_preview')
      .select('intake_number, created_at, id, submission_channel, linked_firm_id, workflow_status')
      .in('id', intakeIds);
    if (previewErr) console.error(previewErr);
    for (const p of previews ?? []) intakeById.set((p as { id: string }).id, p as IntakeRoutingEmbed);
  }

  const rows: FirmDashboardRow[] = [];
  for (const r of routes ?? []) {
    const intakeId = (r.intake_id as string | undefined) ?? undefined;
    if (!intakeId) continue;

    const intake = intakeById.get(intakeId) ?? null;

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

/** Firm adds a reminder/date for the worker — same block format as workerReminders.ts, written
    server-side via a security-definer RPC since intake_summaries has no firm UPDATE policy. */
export async function firmAddWorkerReminder(
  routeId: string,
  text: string,
  dueDate: string | null
): Promise<{ error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Reminder text is required.' };
  const { error } = await supabase.rpc('firm_add_worker_reminder', {
    p_route_id: routeId,
    p_text: trimmed,
    p_due_date: dueDate?.trim() || null,
  });
  if (!error) return {};
  if (isMissingRpcError(error)) {
    return {
      error: 'Adding reminders is unavailable until the firm_add_worker_reminder RPC is applied in Supabase (migration 20260811160000).',
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

export async function workerDeclineFullAccess(routeId: string, workerId: string): Promise<{ error?: string }> {
  const { data: route, error: r0 } = await supabase.from('firm_intake_routes').select('id, intake_id').eq('id', routeId).single();
  if (r0 || !route) return { error: r0?.message ?? 'Route not found' };
  const { data: intake, error: r1 } = await supabase.from('intakes').select('worker_id').eq('id', route.intake_id).single();
  if (r1 || !intake || intake.worker_id !== workerId) return { error: 'Not allowed' };
  const { error } = await supabase.rpc('worker_decline_full_access', { p_route_id: routeId });
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
  /** Caller firm's subscription tier (firm_profiles.plan_id). Drives the wage-exposure tier gate. */
  firmPlanId?: string | null;
  /** Phase 2B: synthesized intelligence from Claude-extracted document facts. Null until extraction runs. */
  intelligence?: import('./documentFactsService').IntakeIntelligence | null;
};

/** Signed URL for firm users when route has full_access (storage RLS). */
export async function createFirmIntakeFileSignedUrl(
  filePath: string,
  expirySeconds = 300
): Promise<{ url?: string; error?: string }> {
  const path = filePath.trim();
  if (!path) return { error: 'File path is missing.' };
  const { data, error } = await supabase.storage.from(INTAKE_FILES_BUCKET).createSignedUrl(path, expirySeconds);
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
  // A real backend fetch failure (not a legitimately-empty table) must not silently produce a
  // fabricated-looking view — return null so the caller can show a genuine "couldn't load this"
  // state instead of a summary that's indistinguishable from real output. See
  // fetchIntakeSummaryBundle for what counts as a genuine fetch error vs. legitimate emptiness.
  if (bundle.fetchErrors.length) {
    console.error('[o3s-firm-live-view] fetch error(s), refusing to build a view', bundle.fetchErrors);
    return null;
  }
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
  // ────────────────────────────────────────────────────────────────────────────
  // PRIVACY GATE (centralized here, at the loader, so every present AND future render site is
  // protected): when `previewOnly` (pre-approval routes), the returned view model carries NONE of
  // the worker's personal narrative — no worker story, no intake notes, no guided summary, no
  // follow-up narrative answers, no per-event worker context. This is the product promise on the
  // worker dashboard (one3sevenProduct.ts: "Firms do not see yet: your full file contents,
  // personal narrative, or private notes—unless you approve expanded review access"). Reminder
  // and mitigation-log sidecar blocks never reach the firm view either — sanitizeFirmFacingText /
  // stripWorkerIntakeNotesBlock delete every embedded O3S_ sidecar block from firm-facing text.
  //
  // ⚠️ NOTE — the DURABLE fix is SERVER-SIDE. This strip is a presentation gate, not a security
  // boundary: a preview-route firm client can still SELECT intake_summaries.overview via RLS
  // (it must, to show the preview at all), and that row embeds the worker-note sidecar blocks.
  // Until the narrative blocks are stripped server-side (an RLS view or edge function that
  // removes worker-note blocks before the row reaches a preview-only firm), a hostile client
  // can read them directly. Do not treat this client-side strip as sufficient.
  // ────────────────────────────────────────────────────────────────────────────
  const workerProvidedContext = resolveWorkerProvidedContextForFirmView(
    overviewRaw,
    eventsRaw.map((e) => String(e.worker_context ?? '')),
    { includeTimelineContext: !previewOnly, previewOnly }
  );

  const employmentMatterTags = extractEmploymentMatterTagsFromOverview(overviewRaw);
  const orgSections = extractOrgEngineFromOverview(overviewRaw)?.sections;
  // Preview routes get the follow-up with its free-text narrative answers withheld (the
  // structured identity fields the preview surface already shows are kept).
  const workerFollowUp = previewOnly
    ? stripWorkerFollowUpNarrativeForPreview(extractStoryFollowUpFromOverview(overviewRaw))
    : extractStoryFollowUpFromOverview(overviewRaw);
  // Worker contact is only present in the overview once the worker shared with a firm.
  // For preview-only routes (no full access yet) we withhold it, mirroring the privacy gate.
  const workerContact = previewOnly ? null : extractWorkerContactFromOverview(overviewRaw);

  // Caller firm's subscription tier — fetched server-side (RLS: own firm row only) so the
  // wage-exposure tier gate cannot be bypassed by a spoofed client value. Null when the
  // row can't be read; the gate treats null as "no entitlement".
  let firmPlanId: string | null = null;
  if (routeFirmId) {
    const { data: fp } = await supabase
      .from('firm_profiles')
      .select('plan_id')
      .eq('id', routeFirmId)
      .maybeSingle();
    firmPlanId = (fp?.plan_id as string | null) ?? null;
  }

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
    firmPlanId,
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

