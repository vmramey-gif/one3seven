import { Check } from 'lucide-react';
import {
  WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED,
  WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS,
  isFirmCodeSubmissionChannel,
  isParticipatingSubmissionChannel,
  workerParticipatingPreviewSent,
} from '../constants/one3sevenProduct';

export type WorkerStatusJourneyCardProps = {
  workflow?: string | null;
  channel?: string | null;
  routeStatus?: string | null;
  className?: string;
  variant?: 'default' | 'compact' | 'rail';
  showSubtitle?: boolean;
};

const FALLBACK_MESSAGE =
  'Your intake progress will appear here as you organize and share records.';

const PRE_SHARE_STEPS = [
  'Intake created',
  'Records organized',
  'Ready to share',
] as const;

const PARTICIPATING_STEPS = [
  'Intake created',
  'Records organized',
  'Intake sent to participating firms',
  'Intake opened by a participating firm',
  'Full access requested',
  'Full access approved',
  'Additional documents requested',
  'Additional documents received',
  'Participating firm reviewing additional documents',
  'Meeting requested',
  'Review completed',
] as const;

/** Steps with no backend signal yet — shown muted, never completed or current. */
const PARTICIPATING_FUTURE_ONLY_FROM = 9;

const FIRM_CODE_STEPS = [
  'Intake created',
  'Records organized',
  'Sent to your firm',
  'Firm reviewing',
  'Additional documents requested',
  'Additional documents under review',
] as const;

type JourneyMode = 'pre-share' | 'participating' | 'firm-code';

export type WorkerStatusJourneyPresentation = {
  mode: JourneyMode;
  steps: readonly string[];
  activeIndex: number;
  subtitle: string;
  currentLabel: string;
  futureOnlyFrom: number | null;
};

function resolveJourneyMode(
  workflow: string,
  channel: string | null | undefined
): JourneyMode {
  if (isParticipatingSubmissionChannel(channel) || workerParticipatingPreviewSent(channel, workflow)) {
    return 'participating';
  }

  const w = workflow.trim();
  if (
    w === 'Matching Participating Firms' ||
    w === 'Under Review' ||
    w === 'Firm Interest Received' ||
    w === 'Awaiting Worker Approval' ||
    w === 'Shared with Participating Firm'
  ) {
    return 'participating';
  }

  if (isFirmCodeSubmissionChannel(channel)) {
    if (
      w === 'Routed to Firm' ||
      w === 'Under Firm Review' ||
      w === 'Shared with Firm' ||
      w === 'Firm Interest Received' ||
      w === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED ||
      w === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS
    ) {
      return 'firm-code';
    }
  }

  if (
    w === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED ||
    w === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS
  ) {
    return isParticipatingSubmissionChannel(channel) ? 'participating' : 'firm-code';
  }

  return 'pre-share';
}

function getStepsForMode(mode: JourneyMode): readonly string[] {
  switch (mode) {
    case 'participating':
      return PARTICIPATING_STEPS;
    case 'firm-code':
      return FIRM_CODE_STEPS;
    default:
      return PRE_SHARE_STEPS;
  }
}

function getFutureOnlyFrom(mode: JourneyMode): number | null {
  return mode === 'participating' ? PARTICIPATING_FUTURE_ONLY_FROM : null;
}

function getActiveStepIndex(
  mode: JourneyMode,
  workflow: string,
  routeStatus: string | null | undefined
): number {
  const w = workflow.trim();
  const route = (routeStatus ?? '').trim();

  if (mode === 'pre-share') {
    if (!w || w === 'Upload Complete') return 0;
    if (w === 'Organizing Records') return 1;
    if (w === 'Intake Summary Generated') return 2;
    return 0;
  }

  if (mode === 'participating') {
    if (!w || w === 'Upload Complete') return 0;
    if (w === 'Organizing Records') return 1;
    if (w === 'Intake Summary Generated') return 1;
    if (w === 'Matching Participating Firms') return 2;
    if (w === 'Under Review' || w === 'Firm Interest Received') return 3;
    if (w === 'Awaiting Worker Approval' || route === 'access_requested') return 4;
    if (w === 'Shared with Participating Firm' || route === 'full_access') return 5;
    if (w === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED) return 6;
    if (w === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS) return 8;
    return 0;
  }

  if (w === 'Upload Complete' || w === 'Organizing Records') return 0;
  if (w === 'Intake Summary Generated') return 1;
  if (w === 'Routed to Firm' || route === 'preview_sent') return 2;
  if (w === 'Under Firm Review' || w === 'Under Review' || route === 'accepted') return 3;
  if (w === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED) return 4;
  if (w === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS) return 5;
  return 1;
}

function resolveJourneySubtitle(
  mode: JourneyMode,
  workflow: string,
  activeIndex: number
): string {
  const w = workflow.trim();

  if (w === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED) {
    return 'Additional records have been requested. We\'ll guide you through the next steps.';
  }
  if (w === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS) {
    return 'Your additional records are under review. We\'ll keep you informed here.';
  }

  if (mode === 'pre-share') {
    if (activeIndex <= 0) return 'Your intake is taking shape.';
    if (activeIndex >= 2) return 'Your intake is ready when you choose to share it.';
    return "Your records are organized. We'll update you here.";
  }

  if (mode === 'participating') {
    if (activeIndex >= 8) {
      return 'A participating firm is reviewing your additional records.';
    }
    return "A participating firm is reviewing your intake. We'll keep you informed here.";
  }

  return "Your firm is reviewing your intake. We'll keep you informed here.";
}

function hasTrackerData(workflow: string | null | undefined): boolean {
  return Boolean((workflow ?? '').trim());
}

export function resolveWorkerStatusJourney(
  workflow?: string | null,
  channel?: string | null,
  routeStatus?: string | null
): WorkerStatusJourneyPresentation {
  const workflowTrimmed = (workflow ?? '').trim();
  const showTracker = hasTrackerData(workflow);
  const mode = showTracker ? resolveJourneyMode(workflowTrimmed, channel) : 'pre-share';
  const steps = showTracker ? getStepsForMode(mode) : PRE_SHARE_STEPS;
  const activeIndex = showTracker ? getActiveStepIndex(mode, workflowTrimmed, routeStatus) : 0;
  const futureOnlyFrom = getFutureOnlyFrom(mode);
  const subtitle = showTracker
    ? resolveJourneySubtitle(mode, workflowTrimmed, activeIndex)
    : 'Your intake is taking shape.';
  const currentLabel = steps[Math.min(Math.max(activeIndex, 0), steps.length - 1)] ?? 'Intake created';

  return { mode, steps, activeIndex, subtitle, currentLabel, futureOnlyFrom };
}

function stepState(
  index: number,
  activeIndex: number,
  futureOnlyFrom: number | null
): 'completed' | 'current' | 'future' {
  if (futureOnlyFrom !== null && index >= futureOnlyFrom) return 'future';
  if (index < activeIndex) return 'completed';
  if (index === activeIndex) return 'current';
  return 'future';
}

export function WorkerStatusJourneyCard({
  workflow,
  channel,
  routeStatus,
  className = '',
  variant = 'default',
  showSubtitle = true,
}: WorkerStatusJourneyCardProps) {
  const { steps, activeIndex, subtitle, currentLabel, futureOnlyFrom } = resolveWorkerStatusJourney(
    workflow,
    channel,
    routeStatus
  );

  const isRail = variant === 'rail';
  const isCompact = variant === 'compact';

  if (isCompact) {
    const previewSteps = steps.slice(0, Math.min(steps.length, futureOnlyFrom ?? steps.length));

    return (
      <div
        className={`rounded-xl border border-[#E9E0FF]/90 bg-gradient-to-br from-white to-[#FAF8FF] px-4 py-4 shadow-[0_4px_16px_rgba(107,78,255,0.06)] ${className}`}
        aria-label="Current status preview"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
          Current status
        </p>
        <p className="mt-2 text-base font-medium leading-snug text-[#1B2623]">{currentLabel}</p>
        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {previewSteps.map((_, index) => {
            const state = stepState(index, activeIndex, futureOnlyFrom);
            return (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  state === 'completed'
                    ? 'bg-[#6B4EFF]'
                    : state === 'current'
                      ? 'bg-[#6B4EFF]/45 ring-1 ring-[#6B4EFF]/30'
                      : 'bg-[#E2E8F0]'
                }`}
              />
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
          Open <span className="font-medium text-[#475569]">Status Journey</span> for the full progress path.
        </p>
      </div>
    );
  }

  const nodeSize = isRail ? 'h-6 w-6' : 'h-5 w-5';
  const checkSize = isRail ? 'h-3.5 w-3.5' : 'h-3 w-3';
  const dotSize = isRail ? 'h-1.5 w-1.5' : 'h-1 w-1';
  const connectorMin = isRail ? 'min-h-[2rem]' : 'min-h-[1.25rem]';
  const connectorWidth = 'w-px';
  const rowGap = isRail ? 'gap-3.5' : 'gap-2.5';
  const rowPadding = isRail ? 'pb-4' : 'pb-3';
  const labelSize = isRail ? 'text-[15px]' : 'text-[13px]';

  return (
    <div
      className={`rounded-xl border border-[#E9E0FF] bg-white shadow-[0_8px_24px_rgba(107,78,255,0.08)] ${
        isRail ? 'p-6 sm:p-7' : 'p-4'
      } ${className}`}
      aria-label="Status journey"
    >
      <div className={`${showSubtitle ? 'border-b border-[#F1EBFF] pb-4 mb-5' : 'mb-4'}`}>
        <h2
          className={`font-semibold text-[#1B2623] tracking-tight ${
            isRail ? 'text-lg' : 'text-sm'
          }`}
        >
          Status Journey
        </h2>
        {showSubtitle ? (
          <p className={`mt-2 leading-relaxed text-[#64748B] ${isRail ? 'text-sm' : 'text-xs'}`}>
            {subtitle}
          </p>
        ) : null}
      </div>

      {steps.length > 0 ? (
        <ol className="space-y-0" aria-label="Review progress steps">
          {steps.map((label, index) => {
            const state = stepState(index, activeIndex, futureOnlyFrom);
            const isCompleted = state === 'completed';
            const isCurrent = state === 'current';
            const isFuture = state === 'future';
            const isLast = index === steps.length - 1;

            return (
              <li key={`${label}-${index}`} className={`flex ${rowGap}`}>
                <div className="flex flex-col items-center shrink-0">
                  <span
                    className={`flex ${nodeSize} items-center justify-center rounded-full border transition-colors ${
                      isCompleted
                        ? 'border-[#7C8B6F] bg-[#EDE9FE] text-[#6B4EFF]'
                        : isCurrent
                          ? 'border-[#6B4EFF] bg-[#EDE9FE] ring-2 ring-[#6B4EFF]/15'
                          : 'border-[#CBD5E1] bg-white'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {isCompleted ? (
                      <Check className={checkSize} strokeWidth={2.5} aria-hidden />
                    ) : isCurrent ? (
                      <span className={`${dotSize} rounded-full bg-[#6B4EFF]`} aria-hidden />
                    ) : null}
                  </span>
                  {!isLast ? (
                    <span
                      className={`my-1 ${connectorWidth} flex-1 ${connectorMin} rounded-full ${
                        isCompleted ? 'bg-[#7C8B6F]' : 'bg-[#E2E8F0]'
                      }`}
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className={`min-w-0 flex-1 ${isLast ? '' : rowPadding}`}>
                  <p
                    className={`${labelSize} leading-snug ${
                      isCompleted
                        ? 'font-medium text-[#1B2623]'
                        : isCurrent
                          ? 'font-semibold text-[#1B2623]'
                          : 'font-normal text-[#64748B]'
                    }`}
                  >
                    {label}
                  </p>
                  {isCurrent && isRail ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">You are here</p>
                  ) : null}
                  {isFuture && futureOnlyFrom !== null && index >= futureOnlyFrom && isRail ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                      Possible next step
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm leading-relaxed text-[#64748B]">{FALLBACK_MESSAGE}</p>
      )}

      {isRail && futureOnlyFrom !== null ? (
        <p className="mt-6 border-t border-[#F1EBFF] pt-4 text-xs leading-relaxed text-[#64748B]">
          When a review concludes, your organized records remain available in Intakes.
        </p>
      ) : null}
    </div>
  );
}
