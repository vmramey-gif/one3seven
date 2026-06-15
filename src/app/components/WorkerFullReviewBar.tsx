import { Download, X } from 'lucide-react';
import { WORKER_INTAKE_ACTIONS } from '../constants/workerIntakePresentation';

export type WorkerFullReviewBarProps = {
  onExit: () => void;
  onDownload: () => void;
  downloadBusy?: boolean;
};

export function WorkerFullReviewBar({ onExit, onDownload, downloadBusy = false }: WorkerFullReviewBarProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 safe-area-pb">
      <div className="flex gap-2 max-w-lg mx-auto">
        <button
          type="button"
          onClick={onExit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[12px] border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <X className="w-4 h-4" aria-hidden />
          {WORKER_INTAKE_ACTIONS.exitFullReview}
        </button>
        <button
          type="button"
          disabled={downloadBusy}
          onClick={onDownload}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[12px] bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Download className="w-4 h-4" aria-hidden />
          {WORKER_INTAKE_ACTIONS.downloadPacket}
        </button>
      </div>
    </div>
  );
}
