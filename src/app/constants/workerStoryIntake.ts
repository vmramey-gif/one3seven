/** Story-first intake copy — worker experience (Steps 1–3). */
import { ONE3SEVEN_UNIVERSAL_DISCLAIMER } from './one3sevenProduct';

export const STORY_FIRST_STEP_LABELS = {
  story: 'Step 1 of 3',
  upload: 'Step 2 of 3',
  followUp: 'Step 3 of 3',
} as const;

export const WORKER_STORY_HEADING = 'Tell your story';

export const WORKER_STORY_INTRO =
  "Don't worry about legal terms or perfect wording. Simply explain what happened in your own words. one3seven will help organize the records and build a timeline from there.";

export const WORKER_STORY_PLACEHOLDER =
  'Explain what happened in your own words — a few sentences is enough.';

/** Helper examples shown on the story intake step. */
export const WORKER_STORY_EXAMPLES = [
  'I think I was not paid correctly.',
  'I was fired after raising concerns.',
  'I worked remotely and paid for my own phone or internet.',
  'My schedule or hours changed.',
  'I received discipline or a review that felt connected to something else.',
  'I am not sure what matters yet.',
] as const;

export const STORY_FIRST_UPLOAD_HEADING = 'Add records';

export const STORY_FIRST_UPLOAD_INTRO =
  'Drag and drop files here or browse from your device. You do not need to sort or label them — one3seven infers document types automatically.';

export const STORY_FIRST_UPLOAD_NOTICE =
  'By uploading documents, you confirm that you are choosing to share these records with one3seven for organization and intake-preparation purposes. Upload only records you feel comfortable sharing. Sensitive information such as Social Security numbers, banking information, account numbers, medical record numbers, or unrelated personal information may be removed or redacted before upload at your discretion.';

export const STORY_FIRST_UPLOAD_EXAMPLES = [
  'Emails',
  'Text messages',
  'Screenshots',
  'Pay records',
  'Reviews',
  'Policies',
  'Notes',
  'PDFs',
  'Photos',
] as const;

export const STORY_FIRST_FOLLOWUP_HEADING = 'Helpful details if you know them';

export const STORY_FIRST_FOLLOWUP_SUBLINE = 'Optional — skip anything you are not sure about.';

export const STORY_FIRST_REMOTE_EXPENSES_QUESTION =
  'Did you use your own phone, internet, vehicle, equipment, tools, or supplies for work?';

/** Intake packet section titles (story-first review packet). */
export const ATTORNEY_PACKET_SECTIONS = {
  currentUnderstanding: 'Intake Overview',
  caseSnapshot: 'Case Snapshot',
  workerStory: 'Worker Account',
  chronology: 'Chronology of Events',
  evidenceMapping: 'Supporting Records',
  missingInformation: 'Additional Records That May Help',
  questionsForReview: 'Topics Present In Uploaded Records',
  disclaimer: 'Disclaimer',
} as const;

export const ATTORNEY_PACKET_DISCLAIMER = ONE3SEVEN_UNIVERSAL_DISCLAIMER;

export type ReimbursementFollowUpAnswer = 'yes' | 'no' | 'sometimes' | 'not_sure' | '';

export type RemoteWorkFollowUpAnswer = 'yes' | 'no' | 'not_sure' | '';

export type EmploymentStatusAnswer = 'still_employed' | 'employment_ended' | 'not_sure' | '';
export type ArbitrationAnswer = 'yes' | 'no' | 'not_sure' | '';
export type AgencyFilingAnswer = 'yes' | 'no' | 'not_sure' | '';

export type StoryFollowUpAnswers = {
  employmentName?: string;
  employer?: string;
  employmentDates?: string;
  keyPeople?: string;
  workedRemotely?: RemoteWorkFollowUpAnswer;
  remoteExpenses?: string;
  reimbursed?: ReimbursementFollowUpAnswer;
  complainedOrReported?: string;
  changedAfterward?: string;
  /** Employment-specific fields — only shown when case category is Employment */
  employmentStatus?: EmploymentStatusAnswer;
  arbitrationAgreement?: ArbitrationAnswer;
  priorAgencyFiling?: AgencyFilingAnswer;
  priorAgencyFilingDetails?: string;
};

export const STORY_FOLLOWUP_REIMBURSEMENT_OPTIONS: { value: ReimbursementFollowUpAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'not_sure', label: 'Not sure' },
];

export const STORY_FOLLOWUP_REMOTE_OPTIONS: { value: RemoteWorkFollowUpAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

export const EMPLOYMENT_STATUS_OPTIONS: { value: EmploymentStatusAnswer; label: string }[] = [
  { value: 'still_employed', label: 'Still employed there' },
  { value: 'employment_ended', label: 'Employment ended' },
  { value: 'not_sure', label: 'Not sure' },
];

export const ARBITRATION_OPTIONS: { value: ArbitrationAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

export const AGENCY_FILING_OPTIONS: { value: AgencyFilingAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

export const EMPTY_STORY_FOLLOWUP: StoryFollowUpAnswers = {
  employmentName: '',
  employer: '',
  employmentDates: '',
  keyPeople: '',
  workedRemotely: '',
  remoteExpenses: '',
  reimbursed: '',
  complainedOrReported: '',
  changedAfterward: '',
  employmentStatus: '',
  arbitrationAgreement: '',
  priorAgencyFiling: '',
  priorAgencyFilingDetails: '',
};

export function hasStoryFollowUpContent(answers: StoryFollowUpAnswers | null | undefined): boolean {
  if (!answers) return false;
  return Object.values(answers).some((v) => Boolean(String(v ?? '').trim()));
}
