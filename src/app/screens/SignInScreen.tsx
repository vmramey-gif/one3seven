import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Mail, Lock } from 'lucide-react';
import { Screen } from '../App';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';
import { WordMark } from '../components/WordMark';

// TODO(Supabase): Enable Google in Auth → Providers and wire `signInWithOAuth` instead of the placeholder handler from App.

interface SignInScreenProps {
  onNavigate: (screen: Screen) => void;
  onSignIn: (email: string, password: string) => Promise<{ error?: string }>;
  /** Google OAuth placeholder until Supabase provider is configured */
  onGoogleAuth?: () => void | Promise<void>;
}

export function SignInScreen({ onNavigate, onSignIn, onGoogleAuth }: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (email.trim() && password.trim()) {
      setSubmitting(true);
      try {
        const res = await onSignIn(email, password);
        if (res.error) setApiError(res.error);
      } catch {
        setApiError('Something went wrong while signing in. Please try again in a moment.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F2FF] text-[#1E1B4B]">
      {/* Back Navigation */}
      <div className="px-6 pt-6">
        <button
          onClick={() => onNavigate('authWelcome')}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-normal uppercase tracking-wide text-[#1E1B4B]/60 transition-colors duration-200 hover:bg-[#F7F3FF] hover:text-[#1E1B4B]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex items-center justify-center px-6 pb-16 pt-12">
        <div className="w-full max-w-[420px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-[32px] border border-[#E7E1FF] bg-white/95 p-6 shadow-[0_28px_90px_rgba(31,27,75,0.12)] sm:p-8"
          >
            {/* Logo */}
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-xl font-semibold text-[#1E1B4B]"><WordMark /></h1>
              <p className="text-sm text-[#1E1B4B]/64">Sign in to continue</p>
            </div>

            {apiError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {apiError}
              </motion.div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleSubmit} className="mb-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1E1B4B]">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1E1B4B]/38" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-2xl border border-[#DCD3FF] bg-[#F8F6FF] py-4 pl-12 pr-4 text-sm text-[#1E1B4B] placeholder:text-[#1E1B4B]/38 focus:border-[#6D4AFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1E1B4B]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1E1B4B]/38" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-[#DCD3FF] bg-[#F8F6FF] py-4 pl-12 pr-4 text-sm text-[#1E1B4B] placeholder:text-[#1E1B4B]/38 focus:border-[#6D4AFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/10"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 py-4 font-medium text-white shadow-[0_18px_48px_rgba(109,74,255,0.26)] transition hover:-translate-y-0.5 hover:bg-[#5B35D5] disabled:translate-y-0 disabled:opacity-60"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            {/* Forgot Password */}
            <div className="mb-6 text-center">
              <button
                type="button"
                onClick={() =>
                  window.alert(
                    'Password reset will connect through Supabase Auth when email templates are configured.'
                  )
                }
                className="text-sm text-[#1E1B4B]/64 transition-colors hover:text-[#1E1B4B]"
              >
                Forgot password?
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E7E1FF]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 uppercase tracking-wide text-[#1E1B4B]/52">Or</span>
              </div>
            </div>

            {/* Alternative Sign In */}
            {onGoogleAuth ? (
              <button
                type="button"
                onClick={() => void onGoogleAuth()}
                className="w-full rounded-full border border-[#DCD3FF] bg-white px-6 py-4 text-sm font-medium text-[#1E1B4B] shadow-[0_12px_32px_rgba(31,27,75,0.08)] transition-colors hover:bg-[#F7F3FF]"
              >
                Continue with Google
              </button>
            ) : null}

            {/* Create Account — open to workers */}
            <div className="mt-8 text-center">
              <span className="text-sm text-[#1E1B4B]/64">New here? </span>
              <button
                type="button"
                onClick={() => onNavigate('createAccount')}
                className="text-sm font-medium text-[#6D4AFF] transition-colors hover:text-[#5B35D5]"
              >
                Create an account
              </button>
            </div>
            <One3SevenDisclaimer variant="compact" className="mt-8" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
