import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { WORKER_INTAKE_ACTIONS } from '../constants/workerIntakePresentation';

export type WorkerExpandableSectionProps = {
  title: string;
  /** Shown when collapsed under the title. */
  meta?: string;
  /** Optional 1–2 line preview visible when collapsed. */
  preview?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Full review mode: keep section expanded. */
  forceOpen?: boolean;
  className?: string;
  size?: 'default' | 'compact';
  /** Low-visual-weight: divider only, no card box */
  variant?: 'card' | 'quiet';
  titleClassName?: string;
};

export function WorkerExpandableSection({
  title,
  meta,
  preview,
  children,
  defaultOpen = false,
  forceOpen = false,
  className = '',
  size = 'default',
  variant = 'quiet',
  titleClassName = '',
}: WorkerExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  const triggerPad = size === 'compact' ? 'py-2.5' : 'py-3';
  const contentPad = size === 'compact' ? 'pb-3 pt-1' : 'pb-4 pt-1';

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const expanded = forceOpen || open;
  const shell =
    variant === 'card'
      ? 'rounded-xl border border-[var(--o3s-border)] bg-white/[0.02] overflow-hidden'
      : 'border-b border-[var(--o3s-border)] last:border-b-0';

  return (
    <div className={`${shell} ${className}`}>
      <button
        type="button"
        onClick={() => !forceOpen && setOpen((v) => !v)}
        aria-expanded={expanded}
        disabled={forceOpen}
        className={`w-full flex items-center justify-between gap-3 text-left transition-colors ${triggerPad} ${
          forceOpen ? 'cursor-default' : 'hover:opacity-90'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span
            className={`block font-medium text-[var(--o3s-fg)] tracking-tight ${
              size === 'compact' ? 'text-xs' : 'text-sm'
            } ${titleClassName}`}
          >
            {title}
          </span>
          {!expanded && preview ? (
            <span className="block text-xs text-[var(--o3s-muted)] mt-1 line-clamp-2 leading-relaxed">
              {preview}
            </span>
          ) : null}
          {!expanded && meta ? (
            <span className="block text-[11px] text-[var(--o3s-subtle)] mt-0.5 truncate">{meta}</span>
          ) : null}
        </span>
        {!forceOpen ? (
          <span className="flex items-center gap-1.5 shrink-0 text-[11px] text-[var(--o3s-subtle)]">
            {expanded ? WORKER_INTAKE_ACTIONS.showLess : WORKER_INTAKE_ACTIONS.showMore}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </span>
        ) : null}
      </button>
      {expanded ? <div className={contentPad}>{children}</div> : null}
    </div>
  );
}
