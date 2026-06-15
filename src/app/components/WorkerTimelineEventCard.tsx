import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import { WORKER_SOURCE_STRENGTH_LABELS } from '../constants/workerIntakePresentation';
import {
  presentWorkerTimelineDetailSummary,
  presentWorkerTimelineRow,
} from '../utils/workerTimelineNarrative';
import { SourceRecordChips } from './SourceRecordChips';
import { O3S_CYAN_TEXT, O3S_GOLD_DOT } from '../constants/visualTheme';
import { polishHumanReadableDisplayText } from '../../services/firmIntakeDisplay';

export type WorkerTimelineEventCardProps = {
  event: WorkerTimelineItem;
  defaultOpen?: boolean;
  forceExpanded?: boolean;
  /** First row or high-salience titles get a gold marker */
  isKeyEvent?: boolean;
};

export function WorkerTimelineEventCard({
  event,
  defaultOpen = false,
  forceExpanded = false,
  isKeyEvent = false,
}: WorkerTimelineEventCardProps) {
  const [open, setOpen] = useState(defaultOpen || forceExpanded);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const expanded = forceExpanded || open;

  const dateLabel = polishHumanReadableDisplayText(event.date ?? '') || 'Date being confirmed';
  const sources = event.sourceFileNames ?? [];
  const { title: rawTitle, summary: rawSummary, sourceCount } = presentWorkerTimelineRow(event);
  const title = polishHumanReadableDisplayText(rawTitle) || rawTitle;
  const summary = polishHumanReadableDisplayText(rawSummary) || rawSummary;
  const detailSummary = polishHumanReadableDisplayText(presentWorkerTimelineDetailSummary(event, rawTitle));
  const strengthNote = event.sourceStrength
    ? WORKER_SOURCE_STRENGTH_LABELS[event.sourceStrength]
    : null;
  const recordConnected =
    sourceCount > 0 ||
    event.sourceStrength === 'strong' ||
    event.sourceStrength === 'partial';

  return (
    <article className="py-3 border-b border-[var(--o3s-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => !forceExpanded && setOpen((v) => !v)}
        aria-expanded={expanded}
        className="w-full text-left transition-opacity hover:opacity-90"
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              isKeyEvent
                ? 'bg-[var(--o3s-gold)] ring-2 ring-[var(--o3s-gold-muted)]'
                : recordConnected
                  ? 'bg-[var(--o3s-cyan)]/80'
                  : 'bg-[var(--o3s-subtle)]/40'
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            {isKeyEvent ? (
              <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--o3s-gold)]">
                <span className={O3S_GOLD_DOT} />
                Key event
              </span>
            ) : recordConnected ? (
              <span className={`mb-1 block text-[10px] font-medium uppercase tracking-wide ${O3S_CYAN_TEXT}`}>
                Record-connected
              </span>
            ) : null}
            <p className="text-[11px] text-[var(--o3s-subtle)]">{dateLabel}</p>
            <p className="text-sm font-medium text-[var(--o3s-fg)] leading-snug mt-0.5">{title}</p>
            {!expanded && summary ? (
              <p className="text-xs text-[var(--o3s-muted)] mt-2 line-clamp-1 leading-relaxed">{summary}</p>
            ) : null}
            {!expanded && sourceCount > 0 ? (
              <p className="text-[10px] text-[var(--o3s-subtle)] mt-1.5">
                {sourceCount} supporting record{sourceCount === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>
          {!forceExpanded ? (
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-[var(--o3s-subtle)] mt-1 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          ) : null}
        </div>
      </button>

      {expanded ? (
        <div className="pl-5 mt-2 space-y-2 border-l border-[var(--o3s-border)] ml-1">
          {detailSummary ? (
            <p className="text-sm text-[var(--o3s-muted)] leading-relaxed">{detailSummary}</p>
          ) : null}
          {strengthNote ? <p className="text-[11px] text-[var(--o3s-subtle)]">{strengthNote}</p> : null}
          {event.workerAddedContext ? (
            <p className="text-xs text-[var(--o3s-muted)] leading-relaxed border-l border-[var(--o3s-border)] pl-2">
              <span className="font-medium text-[var(--o3s-fg)]">Your note: </span>
              {polishHumanReadableDisplayText(event.workerAddedContext) || event.workerAddedContext}
            </p>
          ) : null}
          {sources.length > 0 ? (
            <div>
              <p className="text-[10px] font-medium text-[var(--o3s-subtle)] uppercase tracking-wide mb-1.5">
                Supporting records
              </p>
              {sourcesOpen || forceExpanded || sources.length <= 3 ? (
                <SourceRecordChips fileNames={sources} />
              ) : (
                <SourceRecordChips
                  fileNames={sources}
                  collapsed
                  onToggle={() => setSourcesOpen(true)}
                />
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
