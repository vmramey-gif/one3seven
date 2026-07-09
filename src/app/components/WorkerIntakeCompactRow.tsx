import type { ReactNode } from 'react';

type WorkerIntakeCompactRowProps = {
  intakeNumber: string;
  statusLabel: string | null;
  lastActivity: string | null;
  highlighted?: boolean;
  actionNeeded?: boolean;
  onOpenWorkspace?: () => void;
  children?: ReactNode;
};

export function WorkerIntakeCompactRow({
  intakeNumber,
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
          ? 'border-[#BFAEFF] bg-[#FBFAFF] shadow-[0_18px_42px_rgba(109,74,255,0.14)] ring-1 ring-[#CBD6CF]'
          : highlighted
          ? 'border-[#CFC3FF] bg-[#FBFAFF] ring-1 ring-[#CBD6CF]'
          : 'border-[#D3DED6]'
      }`}
    >
      {actionNeeded ? (
        <span
          className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#42574E] shadow-[0_0_0_4px_rgba(109,74,255,0.14)]"
          aria-hidden
        />
      ) : null}
      <HeaderElement
        type={onOpenWorkspace ? 'button' : undefined}
        onClick={onOpenWorkspace}
        className={`flex w-full items-start justify-between gap-3 rounded-[14px] px-1 py-1.5 text-left ${
          onOpenWorkspace ? 'cursor-pointer hover:bg-[#F7F9F5] focus:outline-none focus:ring-2 focus:ring-[#CBD6CF]' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-tight text-[#1B2623]">
            Employment Records Intake
          </p>
          <p className="mt-0.5 truncate text-[10px] text-[#1B2623]/48">Reference: {intakeNumber}</p>
          {statusLabel ? (
            <p className="mt-0.5 truncate text-xs text-[#1B2623]/64">{statusLabel}</p>
          ) : null}
          {lastActivity ? (
            <p className="mt-0.5 text-[10px] text-[#1B2623]/48">{lastActivity}</p>
          ) : null}
        </div>
      </HeaderElement>
      {children ? (
        <div className="mt-3 space-y-2 border-t border-[#EEE9FF] pt-3">{children}</div>
      ) : null}
    </div>
  );
}
