import type { IntakeCaseCategory } from '../constants/caseCategories';

const SEQUENCE_BASE = 300;

const DISPLAY_PREFIX_BY_CATEGORY: Record<IntakeCaseCategory, string> = {
  Employment: 'EMP',
  'Personal Injury': 'PI',
  'Family Law': 'FAMILY',
  'Landlord-Tenant / Housing': 'HOUSING',
  'Criminal Defense': 'CRIMINAL',
  Immigration: 'IMM',
  'Estate Planning / Probate': 'ESTATE',
  'Business / Contract Disputes': 'BUSINESS',
  'Consumer Protection': 'CONSUMER',
  'Disability / Benefits': 'BENEFITS',
};

const CLEAN_DISPLAY_RE = /^[A-Z][A-Z0-9]*-\d{3,}$/;

export function workerIntakeDisplayPrefix(category: string | null | undefined): string {
  const raw = (category ?? '').trim();
  if (raw.toLowerCase() === 'employment') return 'EMP';
  const key = raw as IntakeCaseCategory;
  if (key && key in DISPLAY_PREFIX_BY_CATEGORY) {
    return DISPLAY_PREFIX_BY_CATEGORY[key as IntakeCaseCategory];
  }
  return 'INTAKE';
}

export function formatWorkerIntakeDisplayNumber(
  category: string | null | undefined,
  sequence: number
): string {
  return `${workerIntakeDisplayPrefix(category)}-${sequence}`;
}

export function isCleanWorkerIntakeDisplayNumber(value: string | null | undefined): boolean {
  return CLEAN_DISPLAY_RE.test(String(value ?? '').trim());
}

/** Next chronological label suffix (300, 301, …) from existing worker intakes. */
export function nextWorkerIntakeDisplaySequence(
  rows: Array<{ intake_number?: string | null }>
): number {
  let max = SEQUENCE_BASE - 1;
  for (const row of rows) {
    const raw = String(row.intake_number ?? '').trim();
    const m = raw.match(/-(\d+)$/);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return max + 1;
}

export function resolveWorkerIntakeDisplayNumber(
  storedIntakeNumber: string | null | undefined,
  category: string | null | undefined,
  chronologicalSequence: number | undefined
): string {
  const stored = String(storedIntakeNumber ?? '').trim();
  if (stored && isCleanWorkerIntakeDisplayNumber(stored)) return stored;
  if (chronologicalSequence != null && chronologicalSequence >= SEQUENCE_BASE) {
    return formatWorkerIntakeDisplayNumber(category, chronologicalSequence);
  }
  if (stored && !/^O3S-/i.test(stored)) return stored;
  return formatWorkerIntakeDisplayNumber(category, SEQUENCE_BASE);
}
