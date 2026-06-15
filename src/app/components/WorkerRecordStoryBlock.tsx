import { WORKER_DISCLAIMER_SHORT } from '../constants/workerIntakePresentation';
import { O3S_HEADLINE_HERO, O3S_SUBLINE } from '../constants/visualTheme';

export type WorkerRecordStoryBlockProps = {
  excerpt: string;
  docCount: number;
  eventCount: number;
  className?: string;
  /** @deprecated Story details are woven into the executive summary excerpt. */
  storyDetails?: {
    workerName?: string | null;
    employer?: string | null;
    employmentDates?: string | null;
    majorEvents?: string[];
    workerReportedConcerns?: string | null;
    changedAfterward?: string | null;
  };
  /** Dashboard mode: editorial headline only */
  variant?: 'summary' | 'hub';
};

export function WorkerRecordStoryBlock({
  excerpt,
  docCount,
  eventCount,
  className = '',
  variant = 'summary',
}: WorkerRecordStoryBlockProps) {
  if (variant === 'hub') {
    return (
      <header className={className} aria-label="Record organization status">
        <p className={O3S_HEADLINE_HERO}>Your timeline is taking shape.</p>
        <p className={`mt-2 ${O3S_SUBLINE}`}>
          {docCount > 0 || eventCount > 0
            ? `${docCount} record${docCount === 1 ? '' : 's'} connected across ${eventCount} key event${eventCount === 1 ? '' : 's'}.`
            : 'Add records to build a clear chronology for review.'}
        </p>
      </header>
    );
  }

  return (
    <section className={`py-4 border-b border-[var(--o3s-border)] ${className}`} aria-label="Organized summary">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--o3s-subtle)]">
        Organized Summary
      </p>
      {excerpt ? (
        <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-[var(--o3s-muted)]">{excerpt}</p>
      ) : (
        <p className={`text-sm ${O3S_SUBLINE}`}>
          Your story and records are being organized into a calm, review-ready structure.
        </p>
      )}
      <p className="mt-3 text-[11px] text-[var(--o3s-subtle)]">
        {docCount} record{docCount === 1 ? '' : 's'} connected / {eventCount} timeline entr{eventCount === 1 ? 'y' : 'ies'} assembled
      </p>
      <p className="mt-3 text-[10px] leading-relaxed text-[var(--o3s-subtle)]">{WORKER_DISCLAIMER_SHORT}</p>
    </section>
  );
}
