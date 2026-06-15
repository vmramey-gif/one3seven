import { AlertTriangle, ChevronRight } from 'lucide-react';
import { WORKER_DOC_REQUEST_DASHBOARD_COPY } from '../constants/workerIntakePresentation';

type WorkerMobileDocRequestCardProps = {
  firmName: string | null;
  categories: string[];
  onUploadRequested: () => void;
};

export function WorkerMobileDocRequestCard({
  firmName,
  categories,
  onUploadRequested,
}: WorkerMobileDocRequestCardProps) {
  const firm = (firmName ?? '').trim() || 'Your firm';

  return (
    <div
      className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3.5"
      role="alert"
    >
      <div className="flex items-start gap-2.5 mb-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400/90 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--o3s-fg)]">
            {WORKER_DOC_REQUEST_DASHBOARD_COPY.headline}
          </p>
          <p className="text-xs text-[var(--o3s-muted)] mt-0.5">
            {WORKER_DOC_REQUEST_DASHBOARD_COPY.subline(firm)}
          </p>
        </div>
      </div>
      {categories.length > 0 ? (
        <p className="text-xs text-[var(--o3s-muted)] mb-3 line-clamp-2">
          {categories.slice(0, 3).join(' · ')}
          {categories.length > 3 ? ' · …' : ''}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onUploadRequested}
        className="w-full flex items-center justify-between gap-2 rounded-lg bg-[var(--o3s-gold)]/90 px-3 py-2.5 text-sm font-medium text-[var(--o3s-obsidian)]"
      >
        {WORKER_DOC_REQUEST_DASHBOARD_COPY.uploadCta}
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
      </button>
    </div>
  );
}
