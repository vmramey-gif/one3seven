import type { EmploymentMatterTagId } from '../constants/employmentMatter';
import { employmentMatterLabel } from '../constants/employmentMatter';
import { formatEmploymentMatterTagsCompact } from '../utils/employmentMatterDisplay';

export type EmploymentMatterTagsLineProps = {
  tags: EmploymentMatterTagId[];
  /** Show “Employment” heading line (dashboard / summary). */
  showCategoryHeading?: boolean;
  className?: string;
};

export function EmploymentMatterTagsLine({
  tags,
  showCategoryHeading = true,
  className = '',
}: EmploymentMatterTagsLineProps) {
  const compact = formatEmploymentMatterTagsCompact(tags);
  if (!showCategoryHeading && !compact) return null;

  return (
    <div className={`text-[11px] text-slate-600 leading-relaxed ${className}`.trim()}>
      {showCategoryHeading ? (
        <p className="font-medium text-slate-800">Employment</p>
      ) : null}
      {compact ? (
        <p className={showCategoryHeading ? 'mt-0.5' : ''}>{compact}</p>
      ) : showCategoryHeading ? (
        <p className="mt-0.5 text-slate-500">No topics selected yet</p>
      ) : null}
    </div>
  );
}

/** Full chip row for intake summary / firm review (not compact). */
export function EmploymentMatterChipList({
  tags,
  className = '',
}: {
  tags: EmploymentMatterTagId[];
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {tags.map((id) => (
        <span
          key={id}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
        >
          {employmentMatterLabel(id)}
        </span>
      ))}
    </div>
  );
}
