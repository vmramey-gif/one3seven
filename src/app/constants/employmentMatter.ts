/** Beta worker intake: single top-level category stored as `employment`. */
export const BETA_WORKER_CASE_CATEGORY = 'employment' as const;

export type EmploymentMatterTagId =
  | 'wrongful_termination'
  | 'discrimination'
  | 'harassment'
  | 'retaliation'
  | 'wage_hour'
  | 'workplace_safety'
  | 'workplace_violence'
  | 'whistleblower'
  | 'fmla_cfra'
  | 'benefits_erisa'
  | 'disability_accommodation'
  | 'labor_union'
  | 'independent_contractor'
  | 'other_not_sure';

export type EmploymentMatterChip = {
  id: EmploymentMatterTagId;
  label: string;
  /** Default visible before “More employment topics”. */
  defaultVisible: boolean;
  /** Reserved for future AI-suggested tags (worker confirms). */
  aiSuggestable?: boolean;
};

export const EMPLOYMENT_MATTER_TOPIC_HELPER =
  'These topics help organize records and are not legal classifications.';

export const EMPLOYMENT_MATTER_CHIPS: readonly EmploymentMatterChip[] = [
  { id: 'wrongful_termination', label: 'Employment Separation', defaultVisible: true, aiSuggestable: true },
  { id: 'discrimination', label: 'Workplace Treatment Concerns', defaultVisible: true, aiSuggestable: true },
  { id: 'harassment', label: 'Workplace Interactions', defaultVisible: true, aiSuggestable: true },
  { id: 'retaliation', label: 'After Raising a Concern', defaultVisible: true, aiSuggestable: true },
  { id: 'wage_hour', label: 'Wage & Hour', defaultVisible: true, aiSuggestable: true },
  { id: 'workplace_safety', label: 'Workplace Safety', defaultVisible: false, aiSuggestable: true },
  { id: 'workplace_violence', label: 'Workplace Violence', defaultVisible: false, aiSuggestable: true },
  { id: 'whistleblower', label: 'Reporting a Workplace Concern', defaultVisible: false, aiSuggestable: true },
  { id: 'fmla_cfra', label: 'FMLA / CFRA Leave', defaultVisible: false, aiSuggestable: true },
  { id: 'benefits_erisa', label: 'Benefits & Leave', defaultVisible: false, aiSuggestable: true },
  { id: 'disability_accommodation', label: 'Disability Accommodation', defaultVisible: false, aiSuggestable: true },
  { id: 'labor_union', label: 'Labor Union Issues', defaultVisible: false, aiSuggestable: true },
  { id: 'independent_contractor', label: 'Independent Contractor Issues', defaultVisible: false, aiSuggestable: true },
  { id: 'other_not_sure', label: 'Other / Not Sure', defaultVisible: true, aiSuggestable: true },
] as const;

export const EMPLOYMENT_MATTER_DEFAULT_CHIPS = EMPLOYMENT_MATTER_CHIPS.filter((c) => c.defaultVisible);
export const EMPLOYMENT_MATTER_EXPANDED_CHIPS = EMPLOYMENT_MATTER_CHIPS.filter((c) => !c.defaultVisible);

const CHIP_BY_ID = new Map(EMPLOYMENT_MATTER_CHIPS.map((c) => [c.id, c]));

export function isEmploymentMatterTagId(value: string): value is EmploymentMatterTagId {
  return CHIP_BY_ID.has(value as EmploymentMatterTagId);
}

export function employmentMatterLabel(id: EmploymentMatterTagId): string {
  return CHIP_BY_ID.get(id)?.label ?? id.replace(/_/g, ' ');
}

export function normalizeEmploymentMatterTags(raw: unknown): EmploymentMatterTagId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<EmploymentMatterTagId>();
  const out: EmploymentMatterTagId[] = [];
  for (const item of raw) {
    const id = String(item).trim();
    if (!isEmploymentMatterTagId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Display title for employment beta category (historical `Employment` included). */
export function isBetaEmploymentCategory(category: string | null | undefined): boolean {
  const c = (category ?? '').trim().toLowerCase();
  return c === BETA_WORKER_CASE_CATEGORY || c === 'employment';
}

/** Top-level label on dashboard / summary. */
export function displayCaseCategoryLabel(category: string | null | undefined): string | null {
  const raw = (category ?? '').trim();
  if (!raw) return null;
  if (isBetaEmploymentCategory(raw)) return 'Employment';
  return raw;
}
