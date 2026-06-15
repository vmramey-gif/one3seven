import type { EmploymentMatterTagId } from '../constants/employmentMatter';
import { employmentMatterLabel } from '../constants/employmentMatter';

/**
 * Compact dashboard line:
 * - ≤3 tags: all labels joined with •
 * - >3 tags: first 2 labels + “+X more”
 */
export function formatEmploymentMatterTagsCompact(tags: EmploymentMatterTagId[]): string {
  if (!tags.length) return '';
  const labels = tags.map(employmentMatterLabel);
  if (labels.length <= 3) return labels.join(' • ');
  const shown = labels.slice(0, 2).join(' • ');
  const more = labels.length - 2;
  return `${shown} · +${more} more`;
}
