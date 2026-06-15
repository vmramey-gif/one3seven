import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { FIRM_INTAKE_ACTIONS } from '../constants/firmIntakePresentation';

export type FirmExpandableSectionProps = {
  title: string;
  meta?: string;
  preview?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  className?: string;
  tone?: 'default' | 'quiet';
};

export function FirmExpandableSection({
  title,
  meta,
  preview,
  children,
  defaultOpen = false,
  forceOpen = false,
  className = '',
  tone = 'default',
}: FirmExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  const expanded = forceOpen || open;

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const shell =
    tone === 'quiet'
      ? 'rounded-[12px] border border-slate-100 bg-slate-50/60'
      : 'rounded-[12px] border border-slate-200 bg-white';

  return (
    <div className={`${shell} overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => !forceOpen && setOpen((v) => !v)}
        aria-expanded={expanded}
        disabled={forceOpen}
        className={`w-full flex items-center justify-between gap-3 text-left px-4 py-3 transition-colors ${
          forceOpen ? 'cursor-default' : 'hover:bg-slate-50/80'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">{title}</span>
          {!expanded && preview ? (
            <span className="block text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{preview}</span>
          ) : null}
          {!expanded && meta ? (
            <span className="block text-[11px] text-slate-500 mt-0.5 truncate">{meta}</span>
          ) : null}
        </span>
        {!forceOpen ? (
          <span className="flex items-center gap-1.5 shrink-0 text-[11px] text-slate-500">
            {expanded ? FIRM_INTAKE_ACTIONS.showLess : FIRM_INTAKE_ACTIONS.showMore}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </span>
        ) : null}
      </button>
      {expanded ? <div className="border-t border-slate-100 px-4 pb-4 pt-0">{children}</div> : null}
    </div>
  );
}
