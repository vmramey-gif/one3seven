import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  WORKER_DOC_REQUEST_PANEL_COPY,
  WORKER_DOC_REQUEST_STATUS_COPY,
} from '../constants/workerIntakePresentation';
import type { WorkerDocumentRequestStatus, WorkerDocumentRequestView } from '../utils/workerDocumentRequest';

type WorkerDocumentRequestPanelProps = {
  request: WorkerDocumentRequestView;
  status: WorkerDocumentRequestStatus | null;
  requestDateLabel?: string | null;
  /** When true, shows compact success state instead of the active request card. */
  showCompletedState?: boolean;
};

export function WorkerDocumentRequestPanel({
  request,
  status,
  requestDateLabel,
  showCompletedState,
}: WorkerDocumentRequestPanelProps) {
  const firm = (request.firmName ?? '').trim() || 'Your firm';

  if (showCompletedState && status === 'submitted') {
    return (
      <section
        className="mb-4 rounded-xl border border-[var(--o3s-border)] bg-white/[0.03] px-4 py-3.5"
        aria-labelledby="worker-doc-request-complete-heading"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--o3s-gold)]" aria-hidden />
          <div>
            <h2 id="worker-doc-request-complete-heading" className="text-sm font-medium text-[var(--o3s-fg)]">
              {WORKER_DOC_REQUEST_STATUS_COPY.submittedTitle}
            </h2>
            <p className="mt-1 text-xs text-[var(--o3s-muted)]">{WORKER_DOC_REQUEST_STATUS_COPY.submittedBody}</p>
          </div>
        </div>
      </section>
    );
  }

  if (showCompletedState && status === 'uploaded') {
    return (
      <section
        className="mb-4 rounded-xl border border-[var(--o3s-border)] bg-white/[0.03] px-4 py-3.5"
        aria-labelledby="worker-doc-request-uploaded-heading"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--o3s-cyan)]" aria-hidden />
          <div>
            <h2 id="worker-doc-request-uploaded-heading" className="text-sm font-medium text-[var(--o3s-fg)]">
              {WORKER_DOC_REQUEST_STATUS_COPY.uploadedTitle}
            </h2>
            <p className="mt-1 text-xs text-[var(--o3s-muted)]">{WORKER_DOC_REQUEST_STATUS_COPY.uploadedBody}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="worker-doc-request-section"
      className="mb-4 scroll-mt-20 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3.5"
      aria-labelledby="worker-doc-request-heading"
    >
      <div className="flex items-start gap-2.5 mb-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90" aria-hidden />
        <div className="min-w-0">
          <h2 id="worker-doc-request-heading" className="text-sm font-medium text-[var(--o3s-fg)]">
            {WORKER_DOC_REQUEST_PANEL_COPY.sectionTitle}
          </h2>
          {requestDateLabel ? (
            <p className="mt-0.5 text-[11px] text-[var(--o3s-subtle)]">Requested {requestDateLabel}</p>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--o3s-subtle)] mb-1">
        Firm name
      </p>
      <p className="text-sm font-medium text-[var(--o3s-fg)] mb-3">{firm}</p>

      {request.categories.length > 0 ? (
        <div className="mb-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--o3s-subtle)] mb-1.5">
            {WORKER_DOC_REQUEST_PANEL_COPY.categoriesLabel}
          </p>
          <ul className="text-sm text-[var(--o3s-muted)] space-y-0.5 list-none">
            {request.categories.map((c) => (
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

      {request.note ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--o3s-subtle)] mb-1">
            {WORKER_DOC_REQUEST_PANEL_COPY.firmMessageLabel}
          </p>
          <p className="text-sm text-[var(--o3s-fg)] whitespace-pre-wrap leading-relaxed">{request.note}</p>
        </div>
      ) : null}

      {request.categories.length === 0 && !request.note ? (
        <p className="text-xs text-[var(--o3s-muted)]">{WORKER_DOC_REQUEST_PANEL_COPY.detailsLoading}</p>
      ) : null}
    </section>
  );
}
