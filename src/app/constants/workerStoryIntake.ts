/** Story-first intake copy — worker experience (Steps 1–3). */
import { ONE3SEVEN_UNIVERSAL_DISCLAIMER } from './one3sevenProduct';

export const STORY_FIRST_STEP_LABELS = {
  story: 'Step 1 of 3',
  upload: 'Step 2 of 3',
  followUp: 'Step 3 of 3',
} as const;

export const STORY_FIRST_UPLOAD_HEADING = 'Add records';

export const STORY_FIRST_UPLOAD_INTRO =
  'You don’t need to sort or label anything — one3seven figures out the document types for you.';

export const STORY_FIRST_UPLOAD_NOTICE =
  'By uploading documents, you confirm that you are choosing to share these records with one3seven for organization and intake-preparation purposes. Upload only records you feel comfortable sharing. Sensitive information such as Social Security numbers, banking information, account numbers, medical record numbers, or unrelated personal information may be removed or redacted before upload at your discretion.';

// These describe the *kinds of records* that are useful, not file formats. Uploads were PDF-only
// when this list was first written, so entries implying image upload ("Screenshots", "Photos")
// were removed; the picker now also accepts photos directly (JPG/PNG/HEIC/WEBP — see
// UploadScreen.tsx's file input `accept`, and the image-vision extraction shipped 2026-08-17),
// so "Text messages" no longer needs the "(saved as PDF)" qualifier and photos are back on the
// list. Corrected 2026-08-20 — this comment and the list had drifted out of sync with the picker.
export const STORY_FIRST_UPLOAD_EXAMPLES = [
  'Pay stubs',
  'Schedules or time records',
  'Emails',
  'Text messages',
  'Photos or screenshots',
  'HR or termination letters',
  'Reviews or write-ups',
  'Policies or handbooks',
  'Notes you wrote',
] as const;

/**
 * Practical "what can I upload / where do I find it" helper for workers who lost access to
 * physical records (e.g. displaced workers). The picker accepts PDFs, text files, and photos
 * (JPG/PNG/HEIC/WEBP) directly — a screenshot or phone photo of a document works as-is; PDF
 * conversion is offered below only as one option among several, not a requirement. No banned
 * vocabulary, no legal conclusions, no deadlines.
 */
export const WORKER_UPLOAD_SOURCING_GUIDANCE = {
  heading: "Don't have your records handy?",
  intro: 'Many work records can still be found even if you lost the originals:',
  items: [
    'Pay stubs and W-2s — often in your employer’s HR or payroll portal, or with past tax records (irs.gov/individuals/get-transcript).',
    'Wage and work history — available through your EDD online account (edd.ca.gov).',
    'Emails and termination letters — check your email inbox and saved messages.',
    'Text messages — take a screenshot, or save/print the conversation as a PDF, whichever is easier.',
  ],
  pdfNote: 'You can upload PDFs or photos (JPG, PNG, HEIC) — snap a picture of a document, or add a file from your phone or computer. No need to convert anything.',
} as const;

/**
 * Crisis-aware, low-pressure reassurance shown on the story step. Deliberately disaster-neutral
 * (no mention of any specific event, displacement, or health impact) so it reads correctly for
 * every worker. No banned vocabulary, no legal conclusions.
 */
export const WORKER_STORY_REASSURANCE =
  "You don't have to do this all at once. Share what you have now — you can come back and add more anytime.";

/**
 * Personal Injury handoff shown on the completion/summary screen. Names the attorney *type*,
 * never the claim; makes no legal conclusion ("may be reviewed", not "should" or "is"). Lines are
 * shown conditionally: employmentLine for employment intakes, injuryLine for Personal Injury
 * intakes, and bothNote only when both apply. No banned vocabulary.
 */
export const WORKER_RECORD_HANDOFF = {
  heading: 'Where these records can go',
  intro:
    "one3seven organizes your records — it doesn't give legal advice or decide what your situation means.",
  employmentLine:
    'Records about your job, pay, hours, or treatment at work may be reviewed by an employment attorney.',
  injuryLine:
    'Records about a physical injury or an exposure may be reviewed by a personal injury or toxic tort attorney.',
  bothNote:
    'If your situation involves more than one of these, you can share your organized records with more than one attorney.',
} as const;

export const STORY_FIRST_FOLLOWUP_HEADING = 'Helpful details if you know them';

export const STORY_FIRST_FOLLOWUP_SUBLINE = 'Optional — skip anything you are not sure about.';

/** Intake packet section titles (story-first review packet). */
export const ATTORNEY_PACKET_SECTIONS = {
  currentUnderstanding: 'Intake Overview',
  caseSnapshot: 'Case Snapshot',
  workerStory: 'Worker Account',
  chronology: 'Chronology of Events',
  peopleAndEntities: 'People Named in Records',
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
  /**
   * State where the work was primarily performed (2-letter postal code). Determines which
   * jurisdiction's wage rules apply. Jurisdiction-gated features (e.g. wage exposure) never
   * activate unless this is set, and only for jurisdictions that have a wage-rules layer.
   */
  workState?: string;
  /**
   * State where the employer is based (2-letter postal code). Recorded alongside workState so the
   * file notes when work-state differs from employer-state — a FACT an attorney weighs. one3seven
   * records both; it never concludes which state's law applies. See project_ca_remote_worker_nexus.
   */
  employerState?: string;
};

/** US states + DC for the "where did you primarily work?" selector. */
export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

export const EMPLOYMENT_STATUS_OPTIONS: { value: EmploymentStatusAnswer; label: string }[] = [
  { value: 'still_employed', label: 'Still employed there' },
  { value: 'employment_ended', label: 'Employment ended' },
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
  workState: '',
  employerState: '',
};

export function hasStoryFollowUpContent(answers: StoryFollowUpAnswers | null | undefined): boolean {
  if (!answers) return false;
  return Object.values(answers).some((v) => Boolean(String(v ?? '').trim()));
}
