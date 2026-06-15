import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { WORKER_DOC_REQUEST_DASHBOARD_COPY, WORKER_DOC_REQUEST_STATUS_COPY } from '../constants/workerIntakePresentation';
import type { WorkerDocumentRequestStatus } from '../utils/workerDocumentRequest';
import { O3S_BTN_GHOST, O3S_BTN_PRIMARY } from '../constants/visualTheme';

export type WorkerDocumentRequestDashboardCardProps = {
  firmName: string | null;
  categories: string[];
  note: string;
  status: WorkerDocumentRequestStatus;
  onUploadRequested: () => void;
  onViewTimeline?: () => void;
  onDismiss?: () => void;
};

export function WorkerDocumentRequestDashboardCard({
  firmName,
  categories,
  note,
  status,
  onUploadRequested,
  onViewTimeline,
  onDismiss,
}: WorkerDocumentRequestDashboardCardProps) {
  const firm = (firmName ?? '').trim() || 'Your firm';

  if (status === 'submitted') {
    return (
      <div
        className="mb-8 rounded-xl border border-[var(--o3s-border)] bg-white/[0.03] px-4 py-3.5"
        role="status"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--o3s-gold)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--o3s-fg)]">
              {WORKER_DOC_REQUEST_STATUS_COPY.submittedTitle}
            </p>
            <p className="mt-1 text-xs text-[var(--o3s-muted)] leading-relaxed">
              {WORKER_DOC_REQUEST_STATUS_COPY.submittedBody}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'uploaded') {
    return (
      <div
        className="mb-8 rounded-xl border border-[var(--o3s-border)] bg-white/[0.03] px-4 py-3.5"
        role="status"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--o3s-cyan)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--o3s-fg)]">
              {WORKER_DOC_REQUEST_STATUS_COPY.uploadedTitle}
            </p>
            <p className="mt-1 text-xs text-[var(--o3s-muted)] leading-relaxed">
              {WORKER_DOC_REQUEST_STATUS_COPY.uploadedBody}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {onViewTimeline ? (
                <button type="button" onClick={onViewTimeline} className={`text-xs px-3 py-2 ${O3S_BTN_PRIMARY}`}>
                  {WORKER_DOC_REQUEST_DASHBOARD_COPY.viewTimeline}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-8 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4"
      role="alert"
      aria-labelledby="worker-doc-request-dashboard-title"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90" aria-hidden />
          <div className="min-w-0">
            <p id="worker-doc-request-dashboard-title" className="text-sm font-medium text-[var(--o3s-fg)]">
              {WORKER_DOC_REQUEST_DASHBOARD_COPY.headline}
            </p>
            <p className="mt-1 text-xs text-[var(--o3s-muted)] leading-relaxed">
              {WORKER_DOC_REQUEST_DASHBOARD_COPY.subline(firm)}
            </p>
          </div>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1.5 text-[var(--o3s-subtle)] hover:text-[var(--o3s-muted)] hover:bg-white/[0.04]"
            aria-label="Dismiss for now"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--o3s-subtle)] mb-1">
        {WORKER_DOC_REQUEST_DASHBOARD_COPY.firmLabel}
      </p>
      <p className="text-sm font-medium text-[var(--o3s-fg)] mb-3">{firm}</p>

      {categories.length > 0 ? (
        <div className="mb-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--o3s-subtle)] mb-1.5">
            {WORKER_DOC_REQUEST_DASHBOARD_COPY.requestedRecordsLabel}
          </p>
          <ul className="text-sm text-[var(--o3s-muted)] space-y-0.5 list-none">
            {categories.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-[var(--o3s-subtle)]" aria-hidden>
                  •
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {note ? (
        <div className="mb-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--o3s-subtle)] mb-1">
            {WORKER_DOC_REQUEST_DASHBOARD_COPY.firmMessageLabel}
          </p>
          <p className="text-sm text-[var(--o3s-fg)] leading-relaxed whitespace-pre-wrap">{note}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onUploadRequested} className={`text-sm px-4 py-2.5 ${O3S_BTN_PRIMARY}`}>
          {WORKER_DOC_REQUEST_DASHBOARD_COPY.uploadCta}
        </button>
        {onViewTimeline ? (
          <button type="button" onClick={onViewTimeline} className={`text-sm px-4 py-2.5 ${O3S_BTN_GHOST}`}>
            {WORKER_DOC_REQUEST_DASHBOARD_COPY.viewTimeline}
          </button>
        ) : null}
      </div>
    </div>
  );
}
