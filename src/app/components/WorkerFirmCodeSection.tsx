import {
  formatLinkedFirmLastSharedAt,
  formatRouteStatusForWorker,
  linkedFirmIntakeAlreadyShared,
} from '../constants/one3sevenProduct';

const REMOVE_FIRM_CODE_WARNING =
  'Removing this firm code will remove your intake from the firm you were working with. They will no longer have access to this intake.';

export type WorkerFirmCodeSectionProps = {
  firmName: string | null | undefined;
  firmCode: string | null | undefined;
  routeStatus?: string | null;
  /** firm_intake_routes.preview_sent_at or intakes.submitted_at after share */
  routeSharedAt?: string | null;
  /** When participating, this section should not render (use ParticipatingNetworkStatusSection). */
  submissionChannel?: string | null;
  busy?: boolean;
  error?: string | null;
  onAddFirmCode?: () => void;
  onRemoveFirmCode?: () => Promise<{ error?: string } | void>;
  className?: string;
  /** One-line firm routing status for compact dashboard cards. */
  dashboardPeek?: boolean;
};

export function WorkerFirmCodeSection({
  firmName,
  firmCode,
  routeStatus,
  routeSharedAt,
  submissionChannel = null,
  busy = false,
  error,
  onAddFirmCode,
  onRemoveFirmCode,
  className = '',
  dashboardPeek = false,
}: WorkerFirmCodeSectionProps) {
  if (submissionChannel === 'participating') return null;

  const connected = Boolean((firmName ?? '').trim() || (firmCode ?? '').trim());
  const alreadyShared = linkedFirmIntakeAlreadyShared(routeStatus);
  const lastSharedLabel = formatLinkedFirmLastSharedAt(routeSharedAt);
  const routeLabel = formatRouteStatusForWorker(routeStatus, submissionChannel);
  const displayFirmName = (firmName ?? '').trim() || 'your firm';

  if (dashboardPeek) {
    const peek = connected
      ? alreadyShared
        ? `Shared with ${displayFirmName}${routeLabel ? ` · ${routeLabel}` : ''}`
        : `Connected to ${displayFirmName} · not shared yet`
      : 'No firm connected';
    return <p className={`text-[11px] text-slate-600 leading-relaxed ${className}`}>{peek}</p>;
  }

  return (
    <div
      className={`rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 ${className}`}
    >
      <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-2">Firm code / connected firm</p>
      {connected ? (
        <div className="space-y-1 mb-3">
          <p className="text-sm text-slate-800">
            {alreadyShared ? (
              <>
                Previously shared with <span className="font-medium text-slate-900">{displayFirmName}</span>
              </>
            ) : (
              <>
                Connected to <span className="font-medium text-slate-900">{displayFirmName}</span>
              </>
            )}
          </p>
          {firmCode ? (
            <p className="text-xs text-slate-600">
              Firm code: <span className="font-mono font-medium text-slate-800">{firmCode}</span>
            </p>
          ) : null}
          {alreadyShared ? (
            <>
              {lastSharedLabel ? (
                <p className="text-xs text-slate-600">Last updated {lastSharedLabel}</p>
              ) : null}
              {routeLabel ? (
                <p className="text-xs text-slate-500">
                  Route status: <span className="font-medium text-slate-700">{routeLabel}</span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-slate-600">This intake has not been shared yet.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-600 mb-3">No firm connected</p>
      )}
      {error ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {connected ? (
          onRemoveFirmCode ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(REMOVE_FIRM_CODE_WARNING)) return;
                void onRemoveFirmCode();
              }}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? 'Removing…' : 'Remove firm code'}
            </button>
          ) : null
        ) : onAddFirmCode ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAddFirmCode}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Add firm code
          </button>
        ) : null}
      </div>
    </div>
  );
}
