import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

type WorkerIntakeCompactRowProps = {
  intakeNumber: string;
  /** Worker-facing title for this case. Defaults to a warm, plain label. */
  title?: string;
  statusLabel: string | null;
  lastActivity: string | null;
  highlighted?: boolean;
  actionNeeded?: boolean;
  onOpenWorkspace?: () => void;
  children?: ReactNode;
};

export function WorkerIntakeCompactRow({
  intakeNumber,
  title = 'Your employment records',
  statusLabel,
  lastActivity,
  highlighted = false,
  actionNeeded = false,
  onOpenWorkspace,
  children,
}: WorkerIntakeCompactRowProps) {
  const HeaderElement = onOpenWorkspace ? 'button' : 'div';

  return (
    <div
      className={`relative rounded-[18px] border bg-white/95 p-3 shadow-[0_14px_34px_rgba(67,56,202,0.07)] transition-colors ${
        actionNeeded
          ? 'border-[#95AB9B] bg-[#FBFBFA] shadow-[0_18px_42px_rgba(66,87,78,0.14)] ring-1 ring-[#CBD6CF]'
          : highlighted
          ? 'border-[#C6D0C8] bg-[#FBFBFA] ring-1 ring-[#CBD6CF]'
          : 'border-[#D3DED6]'
      }`}
    >
      {actionNeeded ? (
        <span
          className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#42574E] shadow-[0_0_0_4px_rgba(66,87,78,0.14)]"
          aria-hidden
        />
      ) : null}
      <HeaderElement
        type={onOpenWorkspace ? 'button' : undefined}
        onClick={onOpenWorkspace}
        className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-1 py-1.5 text-left ${
          onOpenWorkspace ? 'cursor-pointer hover:bg-[#F7F9F5] focus:outline-none focus:ring-2 focus:ring-[#CBD6CF]' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-[#1B2623]">{title}</p>
          {statusLabel ? (
            <p className="mt-0.5 truncate text-xs text-[#1B2623]/70">{statusLabel}</p>
          ) : null}
          {lastActivity ? (
            <p className="mt-0.5 text-[11px] text-[#1B2623]/50">{lastActivity}</p>
          ) : null}
          <p className="mt-1 truncate text-[10px] text-[#1B2623]/38">{intakeNumber}</p>
        </div>
        {onOpenWorkspace ? (
          <ChevronRight className="h-4 w-4 flex-none text-[#9AA39B]" aria-hidden />
        ) : null}
      </HeaderElement>
      {children ? (
        <div className="mt-3 space-y-2 border-t border-[#E7EDE8] pt-3">{children}</div>
      ) : null}
    </div>
  );
}
