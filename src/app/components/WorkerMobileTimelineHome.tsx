import { useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import { WORKER_HUB_COPY } from '../constants/workerIntakePresentation';
import {
  buildWorkerLiveTimelineMoments,
  formatLiveTimelineFileLabel,
  type LiveTimelineMarkerKind,
  type LiveTimelineMoment,
} from '../utils/workerLiveTimelineWorkspace';
import { isWorkerTimelineGapMoment, presentWorkerTimelineRow } from '../utils/workerTimelineNarrative';
import { One3SevenDisclaimer } from './One3SevenDisclaimer';
import { polishHumanReadableDisplayText } from '../../services/firmIntakeDisplay';

type WorkerMobileTimelineHomeProps = {
  recordCount: number;
  eventCount: number;
  gapCount?: number;
  events: WorkerTimelineItem[];
  workflow?: string | null;
  channel?: string | null;
  firmName?: string | null;
  firmCode?: string | null;
  routeStatus?: string | null;
  routeSharedAt?: string | null;
  docRequestPending?: boolean;
  onOpenFullTimeline?: () => void;
  onAddRecords?: () => void;
};

const TIMELINE_GRID = 'grid-cols-[4.1rem_0.75rem_minmax(0,1fr)] gap-x-2';
const RAIL_LEFT = 'left-[calc(4.1rem+0.375rem)]';
const TIMELINE_CONTENT_OFFSET = 'ml-[calc(4.1rem+0.75rem+0.5rem)]';

const O3S_MOBILE_EDITORIAL_HERO =
  'font-display text-[clamp(2.35rem,7vw,2.85rem)] leading-[1.05] tracking-[-0.012em] text-[var(--o3s-text)] font-medium';
const O3S_MOBILE_EDITORIAL_DECK =
  'font-editorial text-[13px] leading-[1.5] text-[var(--o3s-text-soft)]';
const O3S_MOBILE_EDITORIAL_EVENT_TITLE =
  'font-display text-[0.9375rem] font-medium leading-[1.32] text-[var(--o3s-text)] tracking-[0.008em]';
const O3S_MOBILE_EDITORIAL_BODY =
  'text-[11px] leading-[1.45] text-[var(--o3s-text-muted)]';
const O3S_MOBILE_EDITORIAL_CAPTION =
  'text-[10px] leading-[1.35] text-[var(--o3s-text-muted)]';
const O3S_MOBILE_EDITORIAL_META =
  'text-[10px] leading-[1.3] text-[var(--o3s-text-muted)] tabular-nums';

function markerClasses(kind: LiveTimelineMarkerKind): string {
  switch (kind) {
    case 'significant':
      return 'bg-[var(--o3s-primary)] ring-4 ring-[var(--o3s-primary-soft)]';
    case 'connected':
      return 'bg-[var(--o3s-text-soft)]';
    case 'gap':
      return 'border border-dashed border-[var(--o3s-primary)]/45 bg-[var(--o3s-surface)]';
    case 'action':
      return 'bg-[var(--o3s-primary-soft)] ring-1 ring-[var(--o3s-primary)]/25';
    default:
      return 'bg-[var(--o3s-border-strong)]';
  }
}

function InlineStatusIndicators({
  recordCount,
  eventCount,
  gapCount,
}: {
  recordCount: number;
  eventCount: number;
  gapCount: number;
}) {
  const gapsLabel =
    gapCount > 0 ? `${gapCount} Gap${gapCount === 1 ? '' : 's'} To Review` : 'No Gaps Noted';
  const items = [`${recordCount} Records Connected`, `${eventCount} Key Events`, gapsLabel];

  return (
    <div className="mt-4 flex flex-col items-start" aria-label="Timeline status">
      {items.map((label, index) => (
        <div key={label} className="flex flex-col items-start">
          {index > 0 ? (
            <span
              className="py-1 text-[11px] leading-none text-[var(--o3s-border-strong)] select-none"
              aria-hidden
            >
              │
            </span>
          ) : null}
          <span
            className={`${O3S_MOBILE_EDITORIAL_CAPTION} tracking-[0.045em] ${
              label.includes('Gap') && gapCount > 0
                ? 'text-[var(--o3s-primary)]'
                : 'text-[var(--o3s-text-muted)]'
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function TimelineMomentRow({
  moment,
  index,
  expanded,
  onToggle,
}: {
  moment: LiveTimelineMoment;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasFiles = (moment.sourceFiles?.length ?? 0) > 0;
  const expandable = hasFiles || Boolean(moment.timelineEvent?.workerAddedContext);
  const displayDatePrimary = polishHumanReadableDisplayText(moment.datePrimary) || moment.datePrimary;
  const displayDateSecondary = polishHumanReadableDisplayText(moment.dateSecondary ?? '');
  const displayTitle = polishHumanReadableDisplayText(moment.title) || moment.title;
  const displaySummary = polishHumanReadableDisplayText(moment.summary) || moment.summary;

  return (
    <li className={`relative ${index > 0 ? 'mt-0.5' : ''}`}>
      <div className={`relative grid ${TIMELINE_GRID} py-2.5`}>
        <div className="min-w-0 text-right pt-[0.2rem] leading-none">
          <p className="break-words text-[10px] font-medium text-[var(--o3s-text-muted)] tabular-nums leading-[1.12]">
            {displayDatePrimary}
          </p>
          {displayDateSecondary ? (
            <p className="break-words text-[9px] text-[var(--o3s-text-muted)]/75 mt-0.5 leading-[1.12]">
              {displayDateSecondary}
            </p>
          ) : null}
        </div>

        <div className="relative flex justify-center pt-[0.28rem]">
          <span
            className={`relative z-[1] h-[6px] w-[6px] rounded-full shrink-0 ${markerClasses(moment.markerKind)}`}
            aria-hidden
          />
        </div>

        <button
          type="button"
          onClick={expandable ? onToggle : undefined}
          disabled={!expandable}
          aria-expanded={expandable ? expanded : undefined}
          className={`group min-w-0 flex items-start gap-1.5 text-left ${expandable ? '' : 'cursor-default'}`}
        >
          <span className="min-w-0 flex-1">
            <h3 className={`${O3S_MOBILE_EDITORIAL_EVENT_TITLE} text-[0.9rem] leading-[1.28] line-clamp-1`}>
              {displayTitle}
            </h3>
            {displaySummary ? (
              <p className={`${O3S_MOBILE_EDITORIAL_BODY} mt-0.5 line-clamp-2 leading-snug whitespace-pre-wrap`}>{displaySummary}</p>
            ) : null}
            {moment.sourceCount ? (
              <p className={`${O3S_MOBILE_EDITORIAL_META} mt-1 leading-none`}>
                {moment.sourceCount} supporting record{moment.sourceCount === 1 ? '' : 's'}
              </p>
            ) : null}
          </span>
          {expandable ? (
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--o3s-text-muted)]/55 transition-transform duration-200 ${
                expanded ? 'rotate-180 text-[var(--o3s-primary)]' : 'group-hover:text-[var(--o3s-primary)]'
              }`}
              strokeWidth={1.5}
              aria-hidden
            />
          ) : null}
        </button>
      </div>

      {expanded && hasFiles ? (
        <ul className={`${TIMELINE_CONTENT_OFFSET} pl-3 pb-2 space-y-1.5 border-l border-[var(--o3s-border)]`}>
          {moment.sourceFiles!.map((file) => (
            <li
              key={file}
              className="text-[11px] text-[var(--o3s-text-muted)] leading-snug before:content-[''] before:inline-block before:h-1 before:w-1 before:rounded-full before:bg-[var(--o3s-primary)]/70 before:mr-2 before:align-middle"
            >
              {formatLiveTimelineFileLabel(file)}
            </li>
          ))}
        </ul>
      ) : null}

      {expanded && moment.timelineEvent?.workerAddedContext ? (
        <div className={`${TIMELINE_CONTENT_OFFSET} pb-2 pr-1`}>
          <p className={`${O3S_MOBILE_EDITORIAL_META} mb-1`}>Your note</p>
          <p className={`${O3S_MOBILE_EDITORIAL_BODY} text-[var(--o3s-text-muted)]`}>
            {polishHumanReadableDisplayText(moment.timelineEvent.workerAddedContext) ||
              moment.timelineEvent.workerAddedContext}
          </p>
        </div>
      ) : null}
    </li>
  );
}

export function WorkerMobileTimelineHome({
  recordCount,
  eventCount,
  gapCount = 0,
  events,
  workflow,
  channel,
  firmName,
  firmCode,
  routeStatus,
  routeSharedAt,
  docRequestPending = false,
  onOpenFullTimeline,
  onAddRecords,
}: WorkerMobileTimelineHomeProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const gaps =
    gapCount > 0
      ? gapCount
      : events.filter((event) => {
          const { title } = presentWorkerTimelineRow(event);
          return isWorkerTimelineGapMoment(event, title);
        }).length;

  const accessApprovalPending = (workflow ?? '').trim() === 'Awaiting Worker Approval';

  const moments = useMemo(
    () =>
      buildWorkerLiveTimelineMoments({
        events,
        recordCount,
        eventCount,
        gapCount: gaps,
        workflow,
        channel,
        firmName,
        firmCode,
        routeStatus,
        routeSharedAt,
        docRequestPending,
        accessApprovalPending,
      }),
    [
      events,
      recordCount,
      eventCount,
      gaps,
      workflow,
      channel,
      firmName,
      firmCode,
      routeStatus,
      routeSharedAt,
      docRequestPending,
      accessApprovalPending,
    ]
  );

  const toggleExpanded = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div className="relative isolate flex flex-col overflow-hidden px-4 pt-5 pb-28 min-h-[calc(100dvh-7.5rem)] bg-[var(--o3s-bg)]">
      <div className="pointer-events-none absolute -right-16 top-8 h-44 w-44 rounded-full border border-[var(--o3s-orbit)]/45 bg-[var(--o3s-orbit-soft)] blur-[1px]" aria-hidden />
      <div className="pointer-events-none absolute right-8 top-20 h-20 w-20 rounded-full border border-[var(--o3s-orbit)]/35" aria-hidden />
      <header className="relative shrink-0">
        <h1 className={O3S_MOBILE_EDITORIAL_HERO}>{WORKER_HUB_COPY.hubHeadline}</h1>
        <p className={`mt-3 ${O3S_MOBILE_EDITORIAL_DECK}`}>
          {WORKER_HUB_COPY.hubSubline(recordCount, eventCount)}
        </p>
        <InlineStatusIndicators recordCount={recordCount} eventCount={eventCount} gapCount={gaps} />
      </header>

      <section aria-label="Live timeline" className="relative flex flex-col flex-1 min-h-0 mt-6">
        <div
          className={`pointer-events-none absolute ${RAIL_LEFT} top-2 bottom-6 w-[9.5rem] -translate-x-1/2 rounded-full bg-[var(--o3s-orbit-soft)] blur-[80px]`}
          aria-hidden
        />
        {moments.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-2">
            <p className={`${O3S_MOBILE_EDITORIAL_BODY} text-center max-w-[18rem] text-[var(--o3s-text-muted)]`}>
              Add records to begin reconstructing your story. Moments will appear here as your chronology takes shape.
            </p>
          </div>
        ) : (
          <>
            {onOpenFullTimeline && events.length > 0 ? (
              <div className="shrink-0 flex justify-end mb-2">
                <button
                  type="button"
                  onClick={onOpenFullTimeline}
                  className={`${O3S_MOBILE_EDITORIAL_CAPTION} text-[var(--o3s-primary)] hover:text-[var(--o3s-primary-hover)] transition-colors`}
                >
                  Review Timeline
                </button>
              </div>
            ) : null}
            <ol className="relative z-[1] flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5 max-h-[calc(100dvh-16rem)]">
              <span
                className={`pointer-events-none absolute ${RAIL_LEFT} top-[0.45rem] bottom-[0.45rem] w-px -translate-x-1/2 bg-[var(--o3s-border)]`}
                aria-hidden
              />
              {moments.map((moment, index) => (
                <TimelineMomentRow
                  key={moment.id}
                  moment={moment}
                  index={index}
                  expanded={expandedId === moment.id}
                  onToggle={() => toggleExpanded(moment.id)}
                />
              ))}
            </ol>
          </>
        )}
      </section>

      {onAddRecords ? (
        <footer className="shrink-0 mt-auto pt-5 border-t border-[var(--o3s-border)]">
          <button
            type="button"
            onClick={onAddRecords}
            className="w-full flex items-center gap-2.5 py-2 text-left text-[var(--o3s-text-muted)] hover:text-[var(--o3s-primary)] transition-colors group"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--o3s-surface)] ring-1 ring-[var(--o3s-border)] shadow-[var(--o3s-shadow-card)] group-hover:ring-[var(--o3s-primary)]/25">
              <Plus className="h-3.5 w-3.5 text-[var(--o3s-primary)]" strokeWidth={1.75} aria-hidden />
            </span>
              <span className="min-w-0">
              <span className={`block ${O3S_MOBILE_EDITORIAL_CAPTION} text-[var(--o3s-text)]`}>New intake</span>
              <span className={`block mt-0.5 ${O3S_MOBILE_EDITORIAL_META}`}>
                Story questions, then upload and organize
              </span>
            </span>
          </button>
        </footer>
      ) : null}

      <One3SevenDisclaimer
        variant="compact"
        className="shrink-0 px-0 pt-3 pb-1"
        summaryClassName="text-[10px] text-[var(--o3s-text-muted)]"
        bodyClassName="text-[10px] leading-relaxed text-[var(--o3s-text-muted)]"
        summary="About one3Seven"
      />
    </div>
  );
}
