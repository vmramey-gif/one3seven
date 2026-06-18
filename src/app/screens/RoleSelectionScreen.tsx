import { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Briefcase, ArrowRight, ArrowLeft } from 'lucide-react';
import { Screen } from '../App';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';
import { WordMark } from '../components/WordMark';

interface RoleSelectionScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectRole: (role: 'worker' | 'firm') => void;
  /** Persist role to Supabase profiles (optional). */
  onCommitRole?: (role: 'worker' | 'firm') => Promise<{ error?: string }>;
  /**
   * Firm signup is invite-only. The firm workspace tile only renders when the account
   * arrived with firm intent. Public workers (entering via onWorkerStart) never see it.
   */
  allowFirmRole?: boolean;
}

export function RoleSelectionScreen({ onNavigate, onSelectRole, onCommitRole, allowFirmRole = false }: RoleSelectionScreenProps) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleRoleSelection = async (role: 'worker' | 'firm') => {
    setError('');
    console.info('[o3s-role-select] CTA clicked', { role, hasOnCommitRole: Boolean(onCommitRole) });
    if (onCommitRole) {
      setBusy(true);
      try {
        const res = await onCommitRole(role);
        if (res.error) {
          setError(res.error);
          return;
        }
        onSelectRole(role);
        if (role === 'worker') {
          console.info('[o3s-role-select] navigating to landing');
          onNavigate('landing');
        } else {
          // Firm onboarding: App may already have navigated to firmSettings; avoid firmDashboard bounce.
          console.info('[o3s-role-select] firm commit done (navigation handled in App if Supabase)');
        }
      } catch (err) {
        console.error('[o3s-role-select] onCommitRole failed', err);
        setError('Something went wrong while saving your role. Please try again in a moment.');
      } finally {
        setBusy(false);
      }
      return;
    }

    onSelectRole(role);
    if (role === 'worker') {
      onNavigate('landing');
    } else {
      onNavigate('firmSettings');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F2FF] px-6 text-[#1E1B4B]">
      <div className="w-full max-w-[520px]">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => onNavigate('authWelcome')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-wide text-[#1E1B4B]/60 hover:bg-[#F7F3FF] hover:text-[#1E1B4B]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="mb-2 text-xl font-semibold text-[#1E1B4B]"><WordMark /></h1>
            <h2 className="mb-3 text-2xl font-semibold tracking-tight text-[#1E1B4B]">
              How will you use <WordMark />?
            </h2>
            <p className="text-sm text-[#1E1B4B]/64">
              Choose the workspace for this account.
            </p>
            {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
          </div>

          {/* Role Options */}
          <div className="mb-8 space-y-4">
            {/* Worker Option */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => void handleRoleSelection('worker')}
              disabled={busy}
              className="group w-full rounded-[28px] border border-[#E7E1FF] bg-white/95 p-8 text-left shadow-[0_18px_56px_rgba(31,27,75,0.09)] transition-all hover:-translate-y-0.5 hover:border-[#B8A8FF] hover:shadow-[0_24px_68px_rgba(31,27,75,0.13)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F7F3FF] transition-colors group-hover:bg-[#6D4AFF]">
                  <FileText className="h-6 w-6 text-[#6D4AFF] transition-colors group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-[#1E1B4B]">
                    Organize My Records
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-[#1E1B4B]/64">
                    For individuals organizing records, timelines, and supporting materials across intake types.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#5B35D5]">
                    Open your workspace
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.button>

            {/* Firm Option — invite-only; hidden unless the account arrived with firm intent. */}
            {allowFirmRole ? (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => void handleRoleSelection('firm')}
                disabled={busy}
                className="group w-full rounded-[28px] border border-[#E7E1FF] bg-white/95 p-8 text-left shadow-[0_18px_56px_rgba(31,27,75,0.09)] transition-all hover:-translate-y-0.5 hover:border-[#B8A8FF] hover:shadow-[0_24px_68px_rgba(31,27,75,0.13)]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F7F3FF] transition-colors group-hover:bg-[#6D4AFF]">
                    <Briefcase className="h-6 w-6 text-[#6D4AFF] transition-colors group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-2 text-lg font-semibold text-[#1E1B4B]">
                      Attorney / Participating Firm
                    </h3>
                    <p className="mb-4 text-sm leading-relaxed text-[#1E1B4B]/64">
                      For participating firms reviewing organized intake submissions and workflow-ready matter packets.
                    </p>
                    <div className="flex items-center gap-2 text-sm font-medium text-[#5B35D5]">
                      Continue to firm dashboard
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </motion.button>
            ) : null}
          </div>

          {/* Footer Note */}
          <div className="text-center space-y-4">
            <p className="text-xs leading-relaxed text-[#1E1B4B]/52">
              Choose carefully. This determines the dashboard and workflow for this account.
            </p>
            <One3SevenDisclaimer variant="compact" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
