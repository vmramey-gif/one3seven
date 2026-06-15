import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  WORKER_DOC_REQUEST_ALERT_COPY,
  WORKER_DOC_REQUEST_STATUS_COPY,
} from '../constants/workerIntakePresentation';
import type { WorkerDocumentRequestStatus } from '../utils/workerDocumentRequest';

type WorkerDocumentRequestAlertProps = {
  firmName: string | null;
  status: WorkerDocumentRequestStatus;
  onReviewRequest: () => void;
};

export function WorkerDocumentRequestAlert({
  firmName,
  status,
  onReviewRequest,
}: WorkerDocumentRequestAlertProps) {
  const firm = (firmName ?? '').trim();

  if (status === 'submitted') {
    return (
      <div
        className="mb-3 rounded-[14px] border border-emerald-200 bg-emerald-50 p-4"
        role="status"
        data-testid="worker-doc-request-alert-complete"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-950">
              {WORKER_DOC_REQUEST_STATUS_COPY.submittedTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-900/90">
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
        className="mb-3 rounded-[14px] border border-emerald-200 bg-emerald-50 p-4"
        role="status"
        data-testid="worker-doc-request-alert-uploaded"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-950">
              {WORKER_DOC_REQUEST_STATUS_COPY.uploadedTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-900/90">
              {WORKER_DOC_REQUEST_STATUS_COPY.uploadedBody}
            </p>
            <button
              type="button"
              onClick={onReviewRequest}
              className="mt-3 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-100/60"
            >
              {WORKER_DOC_REQUEST_ALERT_COPY.confirmCta}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="worker-doc-request-alert"
      className="mb-3 rounded-[14px] border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-amber-50/40 p-4 shadow-sm"
      role="alert"
      data-testid="worker-doc-request-alert-pending"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950">{WORKER_DOC_REQUEST_ALERT_COPY.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/95">
            {firm
              ? WORKER_DOC_REQUEST_ALERT_COPY.bodyWithFirm(firm)
              : WORKER_DOC_REQUEST_ALERT_COPY.bodyGeneric}
          </p>
          <button
            type="button"
            onClick={onReviewRequest}
            className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            {WORKER_DOC_REQUEST_ALERT_COPY.primaryCta}
          </button>
        </div>
      </div>
    </div>
  );
}
