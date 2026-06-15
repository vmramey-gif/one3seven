import { supabase } from '../lib/supabaseClient';
import {
  extractWorkerIntakeNotesFromOverview,
  extractWorkerStoryFromOverview,
  mergeWorkerIntakeNotesIntoOverview,
  stripWorkerIntakeNotesBlock,
} from './intakeDataService';
import type { IntakeCaseCategory } from '../app/constants/caseCategories';
import { BETA_WORKER_CASE_CATEGORY, isBetaEmploymentCategory } from '../app/constants/employmentMatter';
import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import { normalizeEmploymentMatterTags } from '../app/constants/employmentMatter';
import type { StoryFollowUpAnswers } from '../app/constants/workerStoryIntake';
import { hasStoryFollowUpContent } from '../app/constants/workerStoryIntake';
import {
  formatEmploymentMatterForGuidedNotes,
  mergeEmploymentMatterBlock,
} from '../app/utils/employmentMatterPersistence';
import { extractOrgEngineFromOverview, mergeOrgEngineIntoOverview } from './intakeOrgEngineCodec';
import { appendMatterAwareGuidanceToSections } from './matterAwareOrganizationService';

export type GuidedIntakeAnswers = {
  topics: string[];
  context: string;
  availableRecords: string[];
  caseCategory?: IntakeCaseCategory | typeof BETA_WORKER_CASE_CATEGORY;
  employmentMatterTags?: EmploymentMatterTagId[];
  scaffoldResponses?: Array<{ question: string; answer: string }>;
  skipped?: boolean;
};

const SESSION_COMPLETED_PREFIX = 'o3s_guided_intake_completed_v1_';
const SESSION_ANSWERS_PREFIX = 'o3s_guided_intake_answers_v1_';
const LOCAL_CASE_CATEGORY_PREFIX = 'o3s_case_category_v1_';
const CASE_CATEGORY_BLOCK_RE = /\n?--- O3S_CASE_CATEGORY ---\n([\s\S]*?)\n--- O3S_CASE_CATEGORY_END ---\n?/;

export function hasGuidedIntakeContent(answers: GuidedIntakeAnswers): boolean {
  if (answers.skipped) return false;
  return (
    Boolean((answers.caseCategory ?? '').trim()) ||
    answers.topics.length > 0 ||
    answers.availableRecords.length > 0 ||
    Boolean(answers.context.trim()) ||
    Boolean(answers.scaffoldResponses?.some((x) => x.answer.trim().length > 0)) ||
    Boolean(answers.employmentMatterTags?.length)
  );
}

export function formatGuidedIntakeForWorkerNotes(answers: GuidedIntakeAnswers): string {
  const guidedLines: string[] = [];
  const matterLine = formatEmploymentMatterForGuidedNotes(answers.employmentMatterTags ?? []);
  if (matterLine) guidedLines.push(matterLine);
  if (answers.caseCategory?.trim()) {
    const cat = answers.caseCategory.trim();
    const display =
      cat.toLowerCase() === BETA_WORKER_CASE_CATEGORY ? 'Employment (beta)' : `${cat} (California beta)`;
    guidedLines.push(`Intake category: ${display}`);
  }
  if (answers.topics.length) {
    guidedLines.push(`Topics: ${answers.topics.join('; ')}`);
  }
  if (answers.availableRecords.length) {
    guidedLines.push(`Available records: ${answers.availableRecords.join('; ')}`);
  }

  const parts: string[] = [];
  if (guidedLines.length) {
    parts.push('--- O3S_GUIDED_INTAKE ---', ...guidedLines, '--- O3S_GUIDED_INTAKE_END ---');
  }
  const narrative = answers.context.trim();
  if (narrative) {
    parts.push('--- O3S_WORKER_STORY ---', narrative, '--- O3S_WORKER_STORY_END ---');
  }
  const scaffoldLines = (answers.scaffoldResponses ?? [])
    .map((row) => ({ question: row.question.trim(), answer: row.answer.trim() }))
    .filter((row) => row.question && row.answer);
  if (scaffoldLines.length) {
    parts.push(
      '--- O3S_CATEGORY_SCAFFOLD ---',
      ...scaffoldLines.map((row) => `${row.question}: ${row.answer}`),
      '--- O3S_CATEGORY_SCAFFOLD_END ---'
    );
  }
  return parts.join('\n\n');
}

export function isGuidedIntakeCompletedInSession(intakeId: string): boolean {
  try {
    return sessionStorage.getItem(`${SESSION_COMPLETED_PREFIX}${intakeId}`) === '1';
  } catch {
    return false;
  }
}

export function markGuidedIntakeCompletedInSession(intakeId: string): void {
  try {
    sessionStorage.setItem(`${SESSION_COMPLETED_PREFIX}${intakeId}`, '1');
  } catch {
    /* ignore */
  }
}

export function saveCaseCategoryLocal(
  intakeId: string,
  category: IntakeCaseCategory | typeof BETA_WORKER_CASE_CATEGORY
): void {
  try {
    localStorage.setItem(`${LOCAL_CASE_CATEGORY_PREFIX}${intakeId}`, category);
  } catch {
    /* ignore */
  }
}

export function loadCaseCategoryLocal(intakeId: string): IntakeCaseCategory | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_CASE_CATEGORY_PREFIX}${intakeId}`)?.trim();
    return raw ? (raw as IntakeCaseCategory) : null;
  } catch {
    return null;
  }
}

export function saveGuidedIntakeToSession(intakeId: string, answers: GuidedIntakeAnswers): void {
  try {
    sessionStorage.setItem(`${SESSION_ANSWERS_PREFIX}${intakeId}`, JSON.stringify(answers));
  } catch {
    /* ignore */
  }
}

export function loadGuidedIntakeFromSession(intakeId: string): GuidedIntakeAnswers | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_ANSWERS_PREFIX}${intakeId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuidedIntakeAnswers;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
      context: typeof parsed.context === 'string' ? parsed.context : '',
      availableRecords: Array.isArray(parsed.availableRecords)
        ? parsed.availableRecords.map(String)
        : [],
      caseCategory: typeof parsed.caseCategory === 'string' ? (parsed.caseCategory as IntakeCaseCategory) : undefined,
      employmentMatterTags: Array.isArray(parsed.employmentMatterTags)
        ? normalizeEmploymentMatterTags(parsed.employmentMatterTags)
        : undefined,
      scaffoldResponses: Array.isArray(parsed.scaffoldResponses)
        ? parsed.scaffoldResponses
            .map((row) => ({
              question: String((row as { question?: string }).question ?? ''),
              answer: String((row as { answer?: string }).answer ?? ''),
            }))
            .filter((row) => row.question.trim().length > 0)
        : [],
      skipped: Boolean(parsed.skipped),
    };
  } catch {
    return null;
  }
}

export function extractCaseCategoryFromOverview(overview: string | null | undefined): IntakeCaseCategory | null {
  const m = (overview ?? '').match(CASE_CATEGORY_BLOCK_RE);
  const raw = m?.[1]?.trim() ?? '';
  if (!raw) return null;
  return raw as IntakeCaseCategory;
}

function mergeCaseCategoryBlock(
  overview: string,
  category: IntakeCaseCategory | typeof BETA_WORKER_CASE_CATEGORY
): string {
  const base = (overview ?? '').replace(CASE_CATEGORY_BLOCK_RE, '').replace(/\s+$/u, '');
  const block = `--- O3S_CASE_CATEGORY ---\n${category}\n--- O3S_CASE_CATEGORY_END ---`;
  return base ? `${base}\n${block}` : block;
}

export async function mergeCaseCategoryIntoLatestIntakeSummary(
  intakeId: string,
  category: IntakeCaseCategory | typeof BETA_WORKER_CASE_CATEGORY
): Promise<{ error?: string }> {
  const cat = category.trim();
  if (!cat) return {};
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
  const next = mergeCaseCategoryBlock(overview, category as IntakeCaseCategory);
  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}

export async function mergeEmploymentMatterIntoLatestIntakeSummary(
  intakeId: string,
  tags: EmploymentMatterTagId[]
): Promise<{ error?: string }> {
  if (!tags.length) return {};
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
  let next = mergeEmploymentMatterBlock(overview, tags);
  const orgPayload = extractOrgEngineFromOverview(next);
  if (orgPayload?.sections && orgPayload.file_records.length) {
    const enrichedSections = appendMatterAwareGuidanceToSections(orgPayload.sections, {
      matterTags: tags,
      fileRecords: orgPayload.file_records,
      evidenceTimeline: orgPayload.timeline_events ?? [],
    });
    next = mergeOrgEngineIntoOverview(next, {
      ...orgPayload,
      sections: enrichedSections,
    });
  }
  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}

/** Merge guided intake into latest summary worker-notes block (after first summary row exists). */
export async function mergeGuidedIntakeIntoLatestIntakeSummary(
  intakeId: string,
  answers: GuidedIntakeAnswers
): Promise<{ error?: string }> {
  if (!hasGuidedIntakeContent(answers)) return {};

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
  const savedStory = extractWorkerStoryFromOverview(overview)?.trim() ?? '';
  const answersForMerge =
    savedStory && answers.context.trim()
      ? { ...answers, context: savedStory }
      : answers;
  const guidedText = formatGuidedIntakeForWorkerNotes(answersForMerge).trim();
  if (!guidedText) return {};

  const existing = extractWorkerIntakeNotesFromOverview(overview).trim();
  const base = stripWorkerIntakeNotesBlock(overview).replace(/\s+$/u, '');
  const combined = existing ? `${guidedText}\n\n${existing}` : guidedText;
  const next = mergeWorkerIntakeNotesIntoOverview(base, combined);

  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}

/** Session-only onboarding before a Supabase intake row exists. */
export type PendingWorkerOnboarding = {
  caseCategory?: IntakeCaseCategory | typeof BETA_WORKER_CASE_CATEGORY;
  employmentMatterTags?: EmploymentMatterTagId[];
  guidedAnswers?: GuidedIntakeAnswers;
  questionnaireAnswers?: Array<{ question: string; answer: string }>;
  /** Set when worker finishes guided/questionnaire and reaches upload (not yet persisted). */
  guidedFlowCompleted?: boolean;
  workerStory?: string;
  storyFollowUp?: StoryFollowUpAnswers;
};

const PENDING_ONBOARDING_SESSION_KEY = 'o3s_pending_worker_onboarding_v1';

export function savePendingOnboardingSession(data: PendingWorkerOnboarding | null): void {
  try {
    if (!data || !hasPendingOnboardingContent(data)) {
      sessionStorage.removeItem(PENDING_ONBOARDING_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(PENDING_ONBOARDING_SESSION_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function loadPendingOnboardingSession(): PendingWorkerOnboarding | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ONBOARDING_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingWorkerOnboarding;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      caseCategory:
        typeof parsed.caseCategory === 'string' ? (parsed.caseCategory as IntakeCaseCategory) : undefined,
      employmentMatterTags: Array.isArray(parsed.employmentMatterTags)
        ? normalizeEmploymentMatterTags(parsed.employmentMatterTags)
        : undefined,
      guidedAnswers: parsed.guidedAnswers ?? undefined,
      questionnaireAnswers: Array.isArray(parsed.questionnaireAnswers)
        ? parsed.questionnaireAnswers
            .map((row) => ({
              question: String((row as { question?: string }).question ?? ''),
              answer: String((row as { answer?: string }).answer ?? ''),
            }))
            .filter((row) => row.question.trim().length > 0)
        : undefined,
      guidedFlowCompleted: Boolean(parsed.guidedFlowCompleted),
      workerStory:
        typeof parsed.workerStory === 'string' && parsed.workerStory.trim()
          ? parsed.workerStory.trim()
          : undefined,
      storyFollowUp:
        parsed.storyFollowUp && typeof parsed.storyFollowUp === 'object' && !Array.isArray(parsed.storyFollowUp)
          ? (parsed.storyFollowUp as StoryFollowUpAnswers)
          : undefined,
    };
  } catch {
    return null;
  }
}

export function clearPendingOnboardingSession(): void {
  try {
    sessionStorage.removeItem(PENDING_ONBOARDING_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPendingOnboardingContent(pending: PendingWorkerOnboarding): boolean {
  if (pending.caseCategory) return true;
  if (pending.guidedFlowCompleted) return true;
  if (pending.workerStory?.trim()) return true;
  if (hasStoryFollowUpContent(pending.storyFollowUp)) return true;
  if (pending.guidedAnswers && hasGuidedIntakeContent(pending.guidedAnswers)) return true;
  if (pending.questionnaireAnswers?.some((row) => row.answer.trim().length > 0)) return true;
  return false;
}

/** Enough progress to offer “Save this intake draft” before persistence. */
export function hasMeaningfulPendingOnboardingForDraft(pending: PendingWorkerOnboarding): boolean {
  return (
    pending.guidedFlowCompleted === true ||
    Boolean(pending.workerStory?.trim()) ||
    hasStoryFollowUpContent(pending.storyFollowUp) ||
    Boolean(pending.guidedAnswers && hasGuidedIntakeContent(pending.guidedAnswers)) ||
    Boolean(pending.questionnaireAnswers?.some((row) => row.answer.trim().length > 0))
  );
}

/** Local onboarding is finished enough to create a Supabase intake row. */
export function isPendingOnboardingReadyToPersist(pending: PendingWorkerOnboarding | null): boolean {
  if (!pending?.caseCategory) return false;
  return pending.guidedFlowCompleted === true;
}
