/**
 * Worker-side "share my organized intake" overlay modals for IntakeSummaryScreen: routing to a
 * firm (participating network / firm code / an already-linked firm) and emailing a PDF copy
 * directly to any firm's inbox. Extracted 2026-08-21 (architecture stabilization sprint, screen
 * decomposition). Pure move: all state, routing decisions, and submission handlers stay owned by
 * the screen and are passed down as props.
 *
 * Fixed a real bug while moving EmailToFirmModal's backdrop: `bg-[#1B2623]\50` used a literal
 * backslash instead of Tailwind's `/50` opacity syntax, so the class never matched any generated
 * utility -- the backdrop rendered with no dim/tint at all, unlike every other modal in the app
 * (including SendOrganizedIntakeModal right above it, which has the correct `/50`).
 */
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Share2, Mail } from 'lucide-react';
import {
  PARTICIPATING_NETWORK_COPY,
  FIRM_ROUTING_COPY,
  linkedFirmShareModalButtonLabel,
} from '../constants/one3sevenProduct';

export function SendOrganizedIntakeModal({
  open,
  isSharing,
  routingSubpanel,
  hasLinkedFirm,
  canRouteParticipating,
  canRouteFirmCode,
  canRouteToLinkedFirm,
  canRouteToAnyFirm,
  shareApiError,
  firmCodeInput,
  onFirmCodeInputChange,
  connectedFirmName,
  linkedFirmAlreadyShared,
  onClose,
  onBackToMenu,
  onOpenFirmCodePanel,
  onParticipatingShare,
  onSendToLinkedFirm,
  onShareSubmit,
  onFirmCodeShare,
}: {
  open: boolean;
  isSharing: boolean;
  routingSubpanel: 'menu' | 'firm_code';
  hasLinkedFirm: boolean;
  canRouteParticipating: boolean;
  canRouteFirmCode: boolean;
  /** Whether an onShareFirmCode handler + a linked firm are both available. */
  canRouteToLinkedFirm: boolean;
  /** Whether an onShareFirmCode handler exists at all (drives the generic fallback button). */
  canRouteToAnyFirm: boolean;
  shareApiError: string;
  firmCodeInput: string;
  onFirmCodeInputChange: (value: string) => void;
  connectedFirmName?: string | null;
  linkedFirmAlreadyShared: boolean;
  onClose: () => void;
  onBackToMenu: () => void;
  onOpenFirmCodePanel: () => void;
  onParticipatingShare: () => void;
  onSendToLinkedFirm: () => void;
  onShareSubmit: () => void;
  onFirmCodeShare: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => !isSharing && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-white rounded-t-[24px] sm:rounded-[24px] w-full max-w-md mx-4 mb-0 sm:mb-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-[#1B2623]">Send organized intake</h3>
                <button
                  type="button"
                  onClick={() => !isSharing && onClose()}
                  className="text-[#9AA39B] hover:text-[#6A6D66] transition-colors"
                  disabled={isSharing}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {routingSubpanel === 'menu' ? (
                <>
                  {hasLinkedFirm ? (
                    <>
                      <p className="text-sm text-[#384039] leading-relaxed mb-4">
                        {FIRM_ROUTING_COPY.sendOrganizedIntro}
                      </p>
                      <p className="text-xs text-[#40433F] leading-relaxed mb-6">
                        {FIRM_ROUTING_COPY.firmCodeFieldHelp}
                      </p>
                    </>
                  ) : canRouteParticipating || canRouteFirmCode ? (
                    <>
                      <p className="text-sm text-[#384039] leading-relaxed mb-3">
                        Choose how to share your organized intake.
                        {canRouteParticipating
                          ? ' You do not need a firm code to use the participating review network.'
                          : ''}
                      </p>
                      {canRouteParticipating ? (
                        <>
                          <p className="text-xs text-[#6A6D66] leading-relaxed mb-3">
                            {PARTICIPATING_NETWORK_COPY.shareModalBody}
                          </p>
                          <p className="text-xs text-[#40433F] leading-relaxed mb-6">
                            {PARTICIPATING_NETWORK_COPY.firmsSeeNow} {PARTICIPATING_NETWORK_COPY.firmsDoNotSee}
                          </p>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-[#384039] leading-relaxed mb-6">
                      Connecting directly to a firm is coming soon. For now, download your organized file to
                      bring to any attorney consultation, or check back here once this opens up.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="text-xs text-[#6A6D66] mb-4 hover:text-[#1B2623]"
                    disabled={isSharing}
                    onClick={onBackToMenu}
                  >
                    ← Back
                  </button>
                  <p className="text-sm text-[#6A6D66] mb-3">{FIRM_ROUTING_COPY.firmCodeFieldHelp}</p>
                  <input
                    value={firmCodeInput}
                    onChange={(e) => onFirmCodeInputChange(e.target.value)}
                    placeholder="e.g. ABC12XYZ"
                    className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#E4E5DE] rounded-[14px] text-sm mb-3"
                    disabled={isSharing}
                  />
                </>
              )}

              {shareApiError ? (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-[14px] px-4 py-3">{shareApiError}</div>
              ) : null}

              <div className="space-y-3">
                {routingSubpanel === 'menu' ? (
                  <>
                    {canRouteParticipating && !hasLinkedFirm ? (
                      <button
                        type="button"
                        onClick={onParticipatingShare}
                        disabled={isSharing}
                        className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium flex items-center justify-center gap-2 ${
                          isSharing
                            ? 'bg-[#9AA39B] text-white cursor-not-allowed'
                            : 'bg-[#42574E] text-white hover:bg-[#42574E] shadow-sm hover:shadow-md'
                        }`}
                      >
                        {isSharing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Share2 className="w-5 h-5" />
                            {PARTICIPATING_NETWORK_COPY.shareModalTitle}
                          </>
                        )}
                      </button>
                    ) : null}
                    {canRouteFirmCode && !hasLinkedFirm ? (
                      <button
                        type="button"
                        onClick={onOpenFirmCodePanel}
                        disabled={isSharing}
                        className={`w-full py-4 px-6 rounded-[14px] border text-[#1B2623] font-medium transition-colors flex items-center justify-center gap-2 ${
                          isSharing
                            ? 'border-[#E4E5DE] text-[#9AA39B] cursor-not-allowed'
                            : 'border-[#CBD6CF] hover:bg-[#F2F4EC]'
                        }`}
                      >
                        Enter Firm Code
                      </button>
                    ) : null}
                    {hasLinkedFirm && canRouteToLinkedFirm ? (
                      <button
                        type="button"
                        onClick={onSendToLinkedFirm}
                        disabled={isSharing}
                        className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium flex items-center justify-center gap-2 ${
                          isSharing
                            ? 'bg-[#9AA39B] text-white cursor-not-allowed'
                            : 'bg-[#42574E] text-white hover:bg-[#42574E] shadow-sm hover:shadow-md'
                        }`}
                      >
                        {isSharing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Share2 className="w-5 h-5" />
                            {linkedFirmShareModalButtonLabel(connectedFirmName, linkedFirmAlreadyShared)}
                          </>
                        )}
                      </button>
                    ) : !hasLinkedFirm && !canRouteParticipating && !canRouteFirmCode ? (
                      <span
                        className="w-full py-4 px-6 rounded-[14px] border border-[#E4E5DE] bg-[#F5F5F0] text-[#9AA39B] font-medium flex items-center justify-center gap-2 cursor-not-allowed select-none"
                        title="Connecting directly to a firm is coming soon. For now, download your organized file to bring to any attorney consultation."
                        aria-disabled="true"
                      >
                        <Share2 className="w-5 h-5" />
                        Coming soon
                      </span>
                    ) : !canRouteParticipating && !canRouteToAnyFirm ? (
                      <button
                        type="button"
                        onClick={onShareSubmit}
                        disabled={isSharing}
                        className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium flex items-center justify-center gap-2 ${
                          isSharing
                            ? 'bg-[#9AA39B] text-white cursor-not-allowed'
                            : 'bg-[#42574E] text-white hover:bg-[#42574E] shadow-sm hover:shadow-md'
                        }`}
                      >
                        {isSharing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Share2 className="w-5 h-5" />
                            Send organized intake
                          </>
                        )}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    {canRouteToAnyFirm ? (
                      <button
                        type="button"
                        disabled={isSharing || !firmCodeInput.trim()}
                        onClick={onFirmCodeShare}
                        className="w-full bg-[#42574E] text-white py-4 rounded-[14px] font-medium disabled:opacity-50"
                      >
                        {isSharing ? 'Routing…' : 'Route with Firm Code'}
                      </button>
                    ) : null}
                  </>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSharing}
                  className={`w-full py-4 px-6 rounded-[14px] transition-colors font-medium ${
                    isSharing
                      ? 'bg-[#F2F4EC] text-[#9AA39B] cursor-not-allowed'
                      : 'bg-[#F2F4EC] text-[#1B2623] hover:bg-[#E4E5DE]'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EmailToFirmModal({
  open,
  busy,
  recipient,
  onRecipientChange,
  name,
  onNameChange,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  recipient: string;
  onRecipientChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => !busy && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-white rounded-t-[24px] sm:rounded-[24px] w-full max-w-md mx-4 mb-0 sm:mb-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-[#1B2623]">Email to a firm</h3>
                <button
                  type="button"
                  onClick={() => !busy && onClose()}
                  className="text-[#9AA39B] hover:text-[#6A6D66] transition-colors"
                  disabled={busy}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-[#384039] leading-relaxed mb-4">
                Send your organized intake as a PDF directly to any email address — no firm
                account needed. Use this to reach an attorney or intake team you're already in
                touch with.
              </p>

              <label className="block text-xs font-medium text-[#40433F] mb-1.5" htmlFor="email-firm-recipient">
                Firm or attorney email
              </label>
              <input
                id="email-firm-recipient"
                type="email"
                value={recipient}
                onChange={(e) => onRecipientChange(e.target.value)}
                placeholder="intake@lawfirm.com"
                className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#E4E5DE] rounded-[14px] text-sm mb-3"
                disabled={busy}
              />

              <label className="block text-xs font-medium text-[#40433F] mb-1.5" htmlFor="email-firm-name">
                Firm name (optional)
              </label>
              <input
                id="email-firm-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. Smith & Associates"
                className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#E4E5DE] rounded-[14px] text-sm mb-4"
                disabled={busy}
              />

              {error ? (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-[14px] px-4 py-3">
                  {error}
                </div>
              ) : null}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={busy || !recipient.trim()}
                  className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium flex items-center justify-center gap-2 ${
                    busy || !recipient.trim()
                      ? 'bg-[#9AA39B] text-white cursor-not-allowed'
                      : 'bg-[#42574E] text-white hover:bg-[#42574E] shadow-sm hover:shadow-md'
                  }`}
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      Send email
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className={`w-full py-4 px-6 rounded-[14px] transition-colors font-medium ${
                    busy
                      ? 'bg-[#F2F4EC] text-[#9AA39B] cursor-not-allowed'
                      : 'bg-[#F2F4EC] text-[#1B2623] hover:bg-[#E4E5DE]'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
