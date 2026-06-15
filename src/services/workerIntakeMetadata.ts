import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import { normalizeEmploymentMatterTags } from '../app/constants/employmentMatter';
import type { StoryFollowUpAnswers } from '../app/constants/workerStoryIntake';
import { supabase } from '../lib/supabaseClient';

export type WorkerDocumentResponseDraft = {
  fulfilled: string[];
  note: string;
  updatedAt?: string;
};

export type WorkerIntakeMetadata = {
  employmentMatterTags?: EmploymentMatterTagId[];
  documentResponseDraft?: WorkerDocumentResponseDraft | null;
  workerStory?: string | null;
  storyFollowUp?: StoryFollowUpAnswers | null;
};

export function parseWorkerIntakeMetadata(raw: unknown): WorkerIntakeMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const draftRaw = row.documentResponseDraft;
  let documentResponseDraft: WorkerDocumentResponseDraft | null = null;
  if (draftRaw && typeof draftRaw === 'object' && !Array.isArray(draftRaw)) {
    const draft = draftRaw as Record<string, unknown>;
    const fulfilled = Array.isArray(draft.fulfilled)
      ? draft.fulfilled.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const note = typeof draft.note === 'string' ? draft.note : '';
    const updatedAt = typeof draft.updatedAt === 'string' ? draft.updatedAt : undefined;
    if (fulfilled.length || note.trim()) {
      documentResponseDraft = { fulfilled, note, updatedAt };
    }
  }
  const employmentMatterTags = Array.isArray(row.employmentMatterTags)
    ? normalizeEmploymentMatterTags(row.employmentMatterTags)
    : undefined;
  const workerStory =
    typeof row.workerStory === 'string' && row.workerStory.trim() ? row.workerStory.trim() : undefined;
  let storyFollowUp: StoryFollowUpAnswers | null = null;
  const followRaw = row.storyFollowUp;
  if (followRaw && typeof followRaw === 'object' && !Array.isArray(followRaw)) {
    const f = followRaw as Record<string, unknown>;
    storyFollowUp = {
      employmentName: typeof f.employmentName === 'string' ? f.employmentName : '',
      employer: typeof f.employer === 'string' ? f.employer : '',
      employmentDates: typeof f.employmentDates === 'string' ? f.employmentDates : '',
      keyPeople: typeof f.keyPeople === 'string' ? f.keyPeople : '',
      workedRemotely: typeof f.workedRemotely === 'string' ? (f.workedRemotely as StoryFollowUpAnswers['workedRemotely']) : '',
      remoteExpenses: typeof f.remoteExpenses === 'string' ? f.remoteExpenses : '',
      reimbursed: typeof f.reimbursed === 'string' ? (f.reimbursed as StoryFollowUpAnswers['reimbursed']) : '',
      complainedOrReported: typeof f.complainedOrReported === 'string' ? f.complainedOrReported : '',
      changedAfterward: typeof f.changedAfterward === 'string' ? f.changedAfterward : '',
    };
  }
  return {
    ...(employmentMatterTags?.length ? { employmentMatterTags } : {}),
    ...(documentResponseDraft ? { documentResponseDraft } : {}),
    ...(workerStory ? { workerStory } : {}),
    ...(storyFollowUp ? { storyFollowUp } : {}),
  };
}

export async function getWorkerIntakeMetadata(intakeId: string): Promise<{
  metadata: WorkerIntakeMetadata;
  error?: string;
}> {
  const { data, error } = await supabase
    .from('intakes')
    .select('worker_metadata')
    .eq('id', intakeId)
    .maybeSingle();
  if (error) {
    if (error.message.includes('worker_metadata')) {
      return { metadata: {} };
    }
    return { metadata: {}, error: error.message };
  }
  return { metadata: parseWorkerIntakeMetadata(data?.worker_metadata) };
}

export async function patchWorkerIntakeMetadata(
  intakeId: string,
  patch: Partial<WorkerIntakeMetadata>
): Promise<{ metadata?: WorkerIntakeMetadata; error?: string }> {
  const current = await getWorkerIntakeMetadata(intakeId);
  if (current.error && !current.error.includes('worker_metadata')) {
    return { error: current.error };
  }
  const next: WorkerIntakeMetadata = {
    ...current.metadata,
    ...patch,
  };
  if (patch.documentResponseDraft === null) {
    delete next.documentResponseDraft;
  }
  if (patch.storyFollowUp === null) {
    delete next.storyFollowUp;
  }
  const { data, error } = await supabase
    .from('intakes')
    .update({ worker_metadata: next, updated_at: new Date().toISOString() })
    .eq('id', intakeId)
    .select('worker_metadata')
    .maybeSingle();
  if (error) {
    if (error.message.includes('worker_metadata')) {
      return { error: 'Worker metadata is not available yet. Apply the latest database migration.' };
    }
    return { error: error.message };
  }
  return { metadata: parseWorkerIntakeMetadata(data?.worker_metadata) };
}
