import { X } from 'lucide-react';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import {
  presentWorkerTimelineDetailSummary,
  presentWorkerTimelineStoryTitle,
  presentWorkerTimelineSourceCount,
} from '../utils/workerTimelineNarrative';
import { SourceRecordChips } from './SourceRecordChips';
import { O3S_BTN_GHOST } from '../constants/visualTheme';

type WorkerMobileTimelineEventSheetProps = {
  event: WorkerTimelineItem | null;
  onClose: () => void;
  onOpenFullTimeline?: () => void;
};

export function WorkerMobileTimelineEventSheet({
  event,
  onClose,
  onOpenFullTimeline,
}: WorkerMobileTimelineEventSheetProps) {
  if (!event) return null;

  const dateLabel = (event.date ?? '').trim() || 'Date being confirmed';
  const storyTitle = presentWorkerTimelineStoryTitle(event);
  const summary = presentWorkerTimelineDetailSummary(event, storyTitle);
  const sources = event.sourceFileNames ?? [];
  const sourceCount = presentWorkerTimelineSourceCount(event);

  return (
    <div className="fixed inset-0 z-[60] sm:hidden" role="dialog" aria-modal="true" aria-label="Event details">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close event details"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--o3s-border)] bg-[var(--o3s-obsidian)] pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[var(--o3s-border)]/60 bg-[var(--o3s-obsidian)] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--o3s-subtle)]">
            Event detail
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--o3s-subtle)] hover:bg-white/[0.04]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-4 py-5 space-y-4">
          <div>
            <p className="text-xs text-[var(--o3s-subtle)]">{dateLabel}</p>
            <h2 className="mt-1 text-lg font-medium text-[var(--o3s-fg)] leading-snug">{storyTitle}</h2>
          </div>

          {summary ? (
            <p className="text-sm text-[var(--o3s-muted)] leading-relaxed">{summary}</p>
          ) : null}

          {sourceCount > 0 ? (
            <p className="text-xs text-[var(--o3s-subtle)]">
              {sourceCount} supporting record{sourceCount === 1 ? '' : 's'}
            </p>
          ) : null}

          {sources.length > 0 ? (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--o3s-subtle)] mb-2">
                Supporting records
              </p>
              <SourceRecordChips fileNames={sources} />
            </div>
          ) : null}

          {event.workerAddedContext ? (
            <div className="rounded-lg bg-white/[0.03] border border-[var(--o3s-border)]/60 px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--o3s-subtle)] mb-1">
                Your note
              </p>
              <p className="text-sm text-[var(--o3s-muted)] leading-relaxed">{event.workerAddedContext}</p>
            </div>
          ) : null}

          {onOpenFullTimeline ? (
            <button type="button" onClick={onOpenFullTimeline} className={`w-full py-2.5 text-sm ${O3S_BTN_GHOST}`}>
              View full timeline
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
