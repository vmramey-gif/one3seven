import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import { WordMark } from '../components/WordMark';
import { SeedMark } from '../components/ui/SeedMark';

interface SetNewPasswordScreenProps {
  onSetPassword: (password: string) => Promise<{ error?: string }>;
  onDone: () => void;
}

/**
 * Reached only via a real Supabase password-recovery session (the PASSWORD_RECOVERY auth event
 * in App.tsx routes here directly, before any normal sign-in handling runs). The worker is
 * already authenticated at this point — this screen's only job is collecting a new password and
 * calling supabase.auth.updateUser({ password }).
 */
export function SetNewPasswordScreen({ onSetPassword, onDone }: SetNewPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (password.length < 8) {
      setApiError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setApiError('Passwords don’t match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSetPassword(password);
      if (res.error) {
        setApiError(res.error);
      } else {
        setDone(true);
        setTimeout(() => onDone(), 1800);
      }
    } catch {
      setApiError('Something went wrong while setting your password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen o3s-warm-page text-[#1B2623]">
      <div className="flex items-center justify-center px-6 pb-16 pt-16">
        <div className="w-full max-w-[420px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-[32px] border border-[#E4E5DE] bg-white/95 p-6 shadow-[0_28px_90px_rgba(31,27,75,0.12)] sm:p-8"
          >
            <div className="mb-8 text-center">
              <SeedMark size={36} className="mx-auto mb-3" />
              <h1 className="mb-2 text-xl font-semibold text-[#1B2623]"><WordMark /></h1>
              <p className="text-sm text-[#1B2623]/64">Set a new password</p>
            </div>

            {done ? (
              <div className="rounded-[14px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Password updated. Taking you to your dashboard&hellip;
              </div>
            ) : (
              <>
                {apiError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {apiError}
                  </motion.div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1B2623]">New password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1B2623]/38" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full rounded-2xl border border-[#E4E5DE] bg-[#FAF9F6] py-4 pl-12 pr-4 text-sm text-[#1B2623] placeholder:text-[#1B2623]/38 focus:border-[#42574E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#42574E]/10"
                        required
                        minLength={8}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1B2623]">Confirm new password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1B2623]/38" />
                      <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Retype your new password"
                        className="w-full rounded-2xl border border-[#E4E5DE] bg-[#FAF9F6] py-4 pl-12 pr-4 text-sm text-[#1B2623] placeholder:text-[#1B2623]/38 focus:border-[#42574E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#42574E]/10"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--o3s-action)] px-6 py-4 font-medium text-white shadow-[0_18px_48px_rgba(181,83,31,0.28)] transition hover:-translate-y-0.5 hover:brightness-95 disabled:translate-y-0 disabled:opacity-60"
                  >
                    {submitting ? 'Saving…' : 'Set new password'}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
