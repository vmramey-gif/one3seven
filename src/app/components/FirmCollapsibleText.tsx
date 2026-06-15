import { useMemo, useState } from 'react';
import { FIRM_INTAKE_ACTIONS } from '../constants/firmIntakePresentation';

export type FirmCollapsibleTextProps = {
  text: string;
  /** Tailwind line-clamp class when collapsed. */
  clampClass?: string;
  className?: string;
  preserveWhitespace?: boolean;
};

export function FirmCollapsibleText({
  text,
  clampClass = 'line-clamp-4',
  className = 'text-sm text-slate-700 leading-relaxed',
  preserveWhitespace = false,
}: FirmCollapsibleTextProps) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = text.trim();
  const needsToggle = useMemo(() => trimmed.length > 220 || trimmed.split('\n').length > 4, [trimmed]);

  if (!trimmed) return null;

  return (
    <div>
      <p
        className={`${className} ${!expanded && needsToggle ? clampClass : ''} ${
          preserveWhitespace ? 'whitespace-pre-wrap' : ''
        }`}
      >
        {trimmed}
      </p>
      {needsToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          {expanded ? FIRM_INTAKE_ACTIONS.showLess : FIRM_INTAKE_ACTIONS.showMore}
        </button>
      ) : null}
    </div>
  );
}
