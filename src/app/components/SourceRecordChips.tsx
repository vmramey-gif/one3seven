import { FileText } from 'lucide-react';
import { WORKER_INTAKE_ACTIONS } from '../constants/workerIntakePresentation';
import { formatSourceFileChipLabel } from '../utils/workerIntakePresentationUtils';

export type SourceRecordChipsProps = {
  fileNames: string[];
  className?: string;
  /** When true, only show count until expanded. */
  collapsed?: boolean;
  onToggle?: () => void;
};

export function SourceRecordChips({
  fileNames,
  className = '',
  collapsed = false,
  onToggle,
}: SourceRecordChipsProps) {
  const names = fileNames.filter((n) => (n ?? '').trim());
  if (!names.length) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`text-[11px] text-[var(--o3s-cyan)] hover:opacity-90 underline underline-offset-2 ${className}`}
      >
        {WORKER_INTAKE_ACTIONS.viewSupportingRecords} ({names.length})
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {names.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 max-w-full rounded-md border border-[var(--o3s-border)] bg-white/[0.03] px-2 py-0.5 text-[10px] text-[var(--o3s-muted)]"
          title={name}
        >
          <FileText className="w-3 h-3 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">{formatSourceFileChipLabel(name)}</span>
        </span>
      ))}
    </div>
  );
}
