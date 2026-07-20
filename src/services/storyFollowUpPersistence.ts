import { supabase } from '../lib/supabaseClient';
import type { StoryFollowUpAnswers } from '../app/constants/workerStoryIntake';
import {
  extractWorkerIntakeNotesFromOverview,
  parseWorkerIntakeNotesContent,
  mergeWorkerIntakeNotesIntoOverview,
  stripWorkerIntakeNotesBlock,
} from './intakeDataService';

const STORY_FOLLOWUP_BLOCK_RE =
  /\n?--- O3S_STORY_FOLLOWUP ---\n([\s\S]*?)\n--- O3S_STORY_FOLLOWUP_END ---\n?/;

function parseFollowUpLine(body: string, key: string): string {
  const re = new RegExp(`^${key}:(.*)$`, 'm');
  return body.match(re)?.[1]?.trim() ?? '';
}

export function extractStoryFollowUpFromOverview(
  overview: string | null | undefined
): StoryFollowUpAnswers | null {
  const m = (overview ?? '').match(STORY_FOLLOWUP_BLOCK_RE);
  if (!m?.[1]) return null;
  const body = m[1];
  const employmentName = parseFollowUpLine(body, 'employment_name');
  const employer = parseFollowUpLine(body, 'employer');
  const employmentDates = parseFollowUpLine(body, 'employment_dates');
  const keyPeople = parseFollowUpLine(body, 'key_people');
  const workedRemotely = parseFollowUpLine(body, 'worked_remotely') as StoryFollowUpAnswers['workedRemotely'];
  const remoteExpenses = parseFollowUpLine(body, 'remote_expenses');
  const reimbursed = parseFollowUpLine(body, 'reimbursed') as StoryFollowUpAnswers['reimbursed'];
  const complainedOrReported = parseFollowUpLine(body, 'complained_or_reported');
  const changedAfterward = parseFollowUpLine(body, 'changed_afterward');
  const employmentStatus = parseFollowUpLine(body, 'employment_status') as StoryFollowUpAnswers['employmentStatus'];
  const arbitrationAgreement = parseFollowUpLine(body, 'arbitration_agreement') as StoryFollowUpAnswers['arbitrationAgreement'];
  const priorAgencyFiling = parseFollowUpLine(body, 'prior_agency_filing') as StoryFollowUpAnswers['priorAgencyFiling'];
  const priorAgencyFilingDetails = parseFollowUpLine(body, 'prior_agency_filing_details');
  const workState = parseFollowUpLine(body, 'work_state');
  const hasContent = [
    employmentName,
    employer,
    employmentDates,
    keyPeople,
    workedRemotely,
    remoteExpenses,
    reimbursed,
    complainedOrReported,
    changedAfterward,
    employmentStatus,
    arbitrationAgreement,
    priorAgencyFiling,
    workState,
  ].some((v) => Boolean(String(v ?? '').trim()));
  if (!hasContent) return null;
  return {
    employmentName,
    employer,
    employmentDates,
    keyPeople,
    workedRemotely,
    remoteExpenses,
    reimbursed,
    complainedOrReported,
    changedAfterward,
    employmentStatus,
    arbitrationAgreement,
    priorAgencyFiling,
    priorAgencyFilingDetails,
    workState,
  };
}

export function stripStoryFollowUpBlock(overview: string): string {
  return overview.replace(STORY_FOLLOWUP_BLOCK_RE, '');
}

function buildStoryFollowUpBlock(answers: StoryFollowUpAnswers): string {
  const lines: string[] = [];
  if (answers.employmentName?.trim()) lines.push(`employment_name:${answers.employmentName.trim()}`);
  if (answers.employer?.trim()) lines.push(`employer:${answers.employer.trim()}`);
  if (answers.employmentDates?.trim()) lines.push(`employment_dates:${answers.employmentDates.trim()}`);
  if (answers.keyPeople?.trim()) lines.push(`key_people:${answers.keyPeople.trim()}`);
  if (answers.workedRemotely) lines.push(`worked_remotely:${answers.workedRemotely}`);
  if (answers.remoteExpenses?.trim()) lines.push(`remote_expenses:${answers.remoteExpenses.trim()}`);
  if (answers.reimbursed) lines.push(`reimbursed:${answers.reimbursed}`);
  if (answers.complainedOrReported?.trim()) lines.push(`complained_or_reported:${answers.complainedOrReported.trim()}`);
  if (answers.changedAfterward?.trim()) lines.push(`changed_afterward:${answers.changedAfterward.trim()}`);
  if (answers.employmentStatus) lines.push(`employment_status:${answers.employmentStatus}`);
  if (answers.arbitrationAgreement) lines.push(`arbitration_agreement:${answers.arbitrationAgreement}`);
  if (answers.priorAgencyFiling) lines.push(`prior_agency_filing:${answers.priorAgencyFiling}`);
  if (answers.priorAgencyFilingDetails?.trim()) lines.push(`prior_agency_filing_details:${answers.priorAgencyFilingDetails.trim()}`);
  if (answers.workState?.trim()) lines.push(`work_state:${answers.workState.trim()}`);
  if (!lines.length) return '';
  return `--- O3S_STORY_FOLLOWUP ---\n${lines.join('\n')}\n--- O3S_STORY_FOLLOWUP_END ---`;
}

export function formatStoryFollowUpForDisplay(answers: StoryFollowUpAnswers): string {
  const rows: string[] = [];
  if (answers.employmentName?.trim()) rows.push(`Full name used during employment: ${answers.employmentName.trim()}`);
  if (answers.employer?.trim()) rows.push(`Employer/organization: ${answers.employer.trim()}`);
  if (answers.employmentDates?.trim()) rows.push(`Approximate employment dates: ${answers.employmentDates.trim()}`);
  if (answers.keyPeople?.trim()) rows.push(`Key people involved: ${answers.keyPeople.trim()}`);
  if (answers.workedRemotely) rows.push(`Worked remotely: ${answers.workedRemotely.replace('_', ' ')}`);
  if (answers.remoteExpenses?.trim()) rows.push(`Remote work expenses: ${answers.remoteExpenses.trim()}`);
  if (answers.reimbursed) rows.push(`Reimbursed: ${answers.reimbursed.replace('_', ' ')}`);
  if (answers.complainedOrReported?.trim()) rows.push(`Complaints/reports: ${answers.complainedOrReported.trim()}`);
  if (answers.changedAfterward?.trim()) rows.push(`Changes afterward: ${answers.changedAfterward.trim()}`);
  if (answers.employmentStatus) {
    const label = answers.employmentStatus === 'still_employed' ? 'Still employed there' : answers.employmentStatus === 'employment_ended' ? 'Employment ended' : 'Not sure';
    rows.push(`Employment status: ${label}`);
  }
  if (answers.arbitrationAgreement) {
    const label = answers.arbitrationAgreement === 'yes' ? 'Yes' : answers.arbitrationAgreement === 'no' ? 'No' : 'Not sure';
    rows.push(`Arbitration agreement: ${label}`);
  }
  if (answers.priorAgencyFiling) {
    const label = answers.priorAgencyFiling === 'yes' ? 'Yes' : answers.priorAgencyFiling === 'no' ? 'No' : 'Not sure';
    const details = answers.priorAgencyFilingDetails?.trim();
    rows.push(`Prior agency filing: ${label}${details ? ` — ${details}` : ''}`);
  }
  if (answers.workState?.trim()) rows.push(`State where work was performed: ${answers.workState.trim()}`);
  return rows.join('\n');
}

export function mergeStoryFollowUpIntoWorkerNotesBody(
  notesBody: string,
  answers: StoryFollowUpAnswers
): string {
  const block = buildStoryFollowUpBlock(answers);
  const without = notesBody.replace(STORY_FOLLOWUP_BLOCK_RE, '').trim();
  if (!block) return without;
  return without ? `${without}\n\n${block}` : block;
}

/** Merge story follow-up into latest intake summary worker-notes block. */
export async function mergeStoryFollowUpIntoLatestIntakeSummary(
  intakeId: string,
  answers: StoryFollowUpAnswers
): Promise<{ error?: string }> {
  const block = buildStoryFollowUpBlock(answers);
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
  const parsed = parseWorkerIntakeNotesContent(extractWorkerIntakeNotesFromOverview(overview));
  const combinedNotes = mergeStoryFollowUpIntoWorkerNotesBody(
    [
      parsed.guidedSummary,
      parsed.workerStory,
      parsed.additionalNotes,
    ]
      .filter(Boolean)
      .join('\n\n'),
    answers
  );
  const base = stripStoryFollowUpBlock(stripWorkerIntakeNotesBlock(overview)).replace(/\s+$/u, '');
  const next = mergeWorkerIntakeNotesIntoOverview(base, combinedNotes);

  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}
