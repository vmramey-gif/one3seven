import type { EmploymentMatterTagId } from '../constants/employmentMatter';
import {
  employmentMatterLabel,
  normalizeEmploymentMatterTags,
} from '../constants/employmentMatter';

const LOCAL_TAGS_PREFIX = 'o3s_employment_matter_v1_';
const MATTER_BLOCK_RE =
  /\n?--- O3S_EMPLOYMENT_MATTER ---\n([\s\S]*?)\n--- O3S_EMPLOYMENT_MATTER_END ---\n?/;

export function saveEmploymentMatterTagsLocal(intakeId: string, tags: EmploymentMatterTagId[]): void {
  try {
    localStorage.setItem(`${LOCAL_TAGS_PREFIX}${intakeId}`, JSON.stringify(tags));
  } catch {
    /* ignore */
  }
}

export function loadEmploymentMatterTagsLocal(intakeId: string): EmploymentMatterTagId[] | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_TAGS_PREFIX}${intakeId}`);
    if (!raw) return null;
    return normalizeEmploymentMatterTags(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function extractEmploymentMatterTagsFromOverview(
  overview: string | null | undefined
): EmploymentMatterTagId[] {
  const m = (overview ?? '').match(MATTER_BLOCK_RE);
  if (!m?.[1]) return [];
  return normalizeEmploymentMatterTags(
    m[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

export function mergeEmploymentMatterBlock(overview: string, tags: EmploymentMatterTagId[]): string {
  const base = (overview ?? '').replace(MATTER_BLOCK_RE, '').replace(/\s+$/u, '');
  if (!tags.length) return base;
  const block = `--- O3S_EMPLOYMENT_MATTER ---\n${tags.join('\n')}\n--- O3S_EMPLOYMENT_MATTER_END ---`;
  return base ? `${base}\n${block}` : block;
}

export function formatEmploymentMatterForGuidedNotes(tags: EmploymentMatterTagId[]): string {
  if (!tags.length) return '';
  const labels = tags.map(employmentMatterLabel);
  return `Employment matter: ${labels.join('; ')}`;
}
