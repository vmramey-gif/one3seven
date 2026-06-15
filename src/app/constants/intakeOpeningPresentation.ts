import type { IntakeCaseCategory } from './caseCategories';

/** Narrow column aligned with worker shell (presentation only). */
export const INTAKE_OPENING_SHELL = 'mx-auto w-full max-w-[390px]';

export const INTAKE_OPENING_MICROCOPY = {
  briefOk: 'You can keep this brief.',
  shareWhatRelevant: 'Only share what feels relevant.',
  editLater: 'You can edit this later.',
  organizesTimeline: 'This helps organize the timeline, not judge the situation.',
  optionalField: 'Optional',
  beforeUpload: 'A few short prompts before upload',
} as const;

/** Visual scan order only — does not change stored category values or array source order. */
export const INTAKE_CATEGORY_DISPLAY_ORDER: IntakeCaseCategory[] = [
  'Employment',
  'Landlord-Tenant / Housing',
  'Personal Injury',
];

export const INTAKE_CATEGORY_PRIORITY_HINT: Partial<Record<IntakeCaseCategory, string>> = {
  Employment: 'Common starting point',
  'Landlord-Tenant / Housing': 'Often selected for housing issues',
  'Personal Injury': 'Often selected after an incident',
};
