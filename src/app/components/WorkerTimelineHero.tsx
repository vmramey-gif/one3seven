import type { WorkerTimelineItem } from '../types/workerTimeline';
import {
  isWorkerTimelineKeyStoryMoment,
  presentWorkerTimelineRow,
} from '../utils/workerTimelineNarrative';

function isRecordConnectedEvent(event: WorkerTimelineItem): boolean {
  const cat = (event.category ?? '').toLowerCase();
  return (
    (event.sourceFileNames?.length ?? 0) > 0 ||
    event.sourceStrength === 'strong' ||
    event.sourceStrength === 'partial' ||
    cat.includes('medical') ||
    cat.includes('record') ||
    cat.includes('pay') ||
    cat.includes('time')
  );
}

function isKeyTimelineEvent(event: WorkerTimelineItem, index: number, storyTitle: string): boolean {
  return isWorkerTimelineKeyStoryMoment(storyTitle, index);
}

export type WorkerTimelineHeroProps = {
  events: WorkerTimelineItem[];
  /** Compact mode for dashboard preview (fewer events, tighter spacing). */
  variant?: 'hero' | 'preview';
  className?: string;
  onOpenFullTimeline?: () => void;
};

export function WorkerTimelineHero({
  events,
  variant = 'hero',
  className = '',
  onOpenFullTimeline,
}: WorkerTimelineHeroProps) {
  if (!events.length) return null;

  const previewLimit = variant === 'preview' ? 4 : events.length;
  const visible = events.slice(0, previewLimit);
  const spacing = variant === 'hero' ? 'space-y-10' : 'space-y-6';
  const labelClass = 'text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--o3s-text-muted)]';
  const sublineClass = 'text-sm text-[var(--o3s-text-muted)] leading-relaxed';
  const connectedMarkerClass = 'bg-[var(--o3s-text-soft)]';
  const keyMarkerClass = 'ring-4 ring-[var(--o3s-primary-soft)] bg-[var(--o3s-primary)]';

  return (
    <section className={className} aria-label="Timeline">
      {variant === 'hero' ? (
        <div className="mb-8">
          <p className={labelClass}>Timeline</p>
          <p className="mt-2 text-sm text-[var(--o3s-text-muted)] max-w-md leading-relaxed">
            The records tell the story. Dates and summaries are assembled for review - confirm details in
            source files.
          </p>
        </div>
      ) : null}

      <ol className={`relative ${spacing}`}>
        <span
          className="pointer-events-none absolute left-[5px] top-2 bottom-2 w-px bg-[var(--o3s-border)]"
          aria-hidden
        />
        {visible.map((event, index) => {
          const key = event.timelineEventId ?? `${event.date}-${event.event}-${index}`;
          const { title, summary, sourceCount } = presentWorkerTimelineRow(event);
          const keyEvent = isKeyTimelineEvent(event, index, title);
          const connected = isRecordConnectedEvent(event);
          const markerClass = keyEvent
            ? keyMarkerClass
            : connected
              ? connectedMarkerClass
              : 'bg-[var(--o3s-border-strong)]';

          return (
            <li key={key} className="relative pl-8">
              <span
                className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${markerClass}`}
                aria-hidden
              />
              {keyEvent ? (
                <span className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--o3s-primary)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--o3s-primary)] shrink-0" />
                  Key event
                </span>
              ) : connected ? (
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--o3s-text-soft)]">
                  Record-connected
                </span>
              ) : null}
              <time className="block text-[11px] text-[var(--o3s-text-muted)] mb-1">
                {(event.date ?? '').trim() || 'Date being confirmed'}
              </time>
              <h3 className="text-base font-medium text-[var(--o3s-text)] leading-snug tracking-tight">
                {title}
              </h3>
              {summary ? (
                <p className={`mt-2 max-w-prose ${sublineClass} ${variant === 'preview' ? 'line-clamp-1' : 'line-clamp-2'}`}>
                  {summary}
                </p>
              ) : null}
              {sourceCount > 0 ? (
                <p className="mt-2 text-[11px] text-[var(--o3s-text-muted)]">
                  {sourceCount} supporting record{sourceCount === 1 ? '' : 's'}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {variant === 'preview' && events.length > previewLimit && onOpenFullTimeline ? (
        <button
          type="button"
          onClick={onOpenFullTimeline}
          className="mt-5 text-sm font-medium text-[var(--o3s-primary)] hover:opacity-90 transition-opacity"
        >
          View full timeline
        </button>
      ) : null}
    </section>
  );
}
