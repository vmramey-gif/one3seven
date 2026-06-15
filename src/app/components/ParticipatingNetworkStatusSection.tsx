import {
  PARTICIPATING_NETWORK_COPY,
  PARTICIPATING_NETWORK_IDLE,
  formatWorkerWorkflowStatusForDisplay,
  isParticipatingSubmissionChannel,
  workerParticipatingPreviewSent,
} from '../constants/one3sevenProduct';

export type ParticipatingNetworkStatusSectionProps = {
  workflowStatus?: string | null;
  submissionChannel?: string | null;
  /** Session or persisted flag that preview routing occurred. */
  previewSent?: boolean;
  accessRequestCount?: number;
  className?: string;
  compact?: boolean;
  /** One-line status for dashboard cards; full copy renders only when not peeking. */
  dashboardPeek?: boolean;
};

export function ParticipatingNetworkStatusSection({
  workflowStatus,
  submissionChannel,
  previewSent = false,
  accessRequestCount = 0,
  className = '',
  compact = false,
  dashboardPeek = false,
}: ParticipatingNetworkStatusSectionProps) {
  const participating =
    isParticipatingSubmissionChannel(submissionChannel) ||
    previewSent ||
    workerParticipatingPreviewSent(submissionChannel, workflowStatus);

  if (!participating && !previewSent) return null;

  const sent =
    previewSent || workerParticipatingPreviewSent(submissionChannel, workflowStatus);
  const hasAccessRequests = accessRequestCount > 0;
  const statusLine = formatWorkerWorkflowStatusForDisplay(workflowStatus, 'participating');

  if (dashboardPeek) {
    const peekParts = [
      PARTICIPATING_NETWORK_COPY.channelLabel,
      statusLine,
      sent ? PARTICIPATING_NETWORK_COPY.postSendTitle : PARTICIPATING_NETWORK_COPY.beforeSendTitle,
      hasAccessRequests ? 'Access request pending' : null,
    ].filter(Boolean);
    return (
      <p className={`text-[11px] text-slate-600 leading-relaxed ${className}`}>{peekParts.join(' · ')}</p>
    );
  }

  return (
    <div
      className={`rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 ${className}`}
    >
      <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-2">
        {PARTICIPATING_NETWORK_COPY.channelLabel}
      </p>
      {!compact ? (
        <p className="text-xs text-slate-600 mb-3 leading-relaxed">{PARTICIPATING_NETWORK_COPY.channelShort}</p>
      ) : null}

      {statusLine ? (
        <p className="text-sm text-slate-800 mb-2">
          Status: <span className="font-medium">{statusLine}</span>
        </p>
      ) : null}

      {!sent ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">{PARTICIPATING_NETWORK_COPY.beforeSendTitle}</p>
          <p className="text-xs text-slate-600 leading-relaxed">{PARTICIPATING_NETWORK_COPY.beforeSendBody}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-900 mb-1">{PARTICIPATING_NETWORK_COPY.postSendTitle}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{PARTICIPATING_NETWORK_COPY.postSendBody}</p>
          </div>
          <ul className="text-xs text-slate-600 space-y-1.5 list-none pl-0">
            <li>
              <span className="font-medium text-slate-800">Visible to firms:</span>{' '}
              {PARTICIPATING_NETWORK_COPY.firmsSeeNow}
            </li>
            <li>
              <span className="font-medium text-slate-800">Still private:</span>{' '}
              {PARTICIPATING_NETWORK_COPY.firmsDoNotSee}
            </li>
          </ul>
          {hasAccessRequests ? (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
              {PARTICIPATING_NETWORK_COPY.accessRequestPending}
            </p>
          ) : (
            <div className="text-xs text-slate-600 space-y-1 leading-relaxed border-t border-slate-200/80 pt-2">
              <p>{PARTICIPATING_NETWORK_IDLE.noRequestsYet}</p>
              <p>{PARTICIPATING_NETWORK_IDLE.expanding}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
