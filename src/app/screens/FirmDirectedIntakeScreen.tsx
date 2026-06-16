import { useState } from 'react';
import { WordMark } from '../components/WordMark';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export const FD_SS_KEY = 'o3s_fd_intake_v1';

export type FirmDirectedIntakeData = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  employer: string;
  story: string;
};

interface FirmDirectedIntakeScreenProps {
  firmName: string;
  onSubmit: (data: FirmDirectedIntakeData) => Promise<{ error?: string }>;
}

export function FirmDirectedIntakeScreen({ firmName, onSubmit }: FirmDirectedIntakeScreenProps) {
  const [step, setStep] = useState<'form' | 'email' | 'sent'>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [employer, setEmployer] = useState('');
  const [story, setStory] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFormContinue = () => {
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!employer.trim()) {
      setError('Employer name is required.');
      return;
    }
    if (!story.trim() || story.trim().length < 20) {
      setError('Please describe your situation in a few sentences.');
      return;
    }
    setStep('email');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('A valid email address is required.');
      return;
    }
    setBusy(true);
    const res = await onSubmit({ firstName, lastName, phone, email, employer, story });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStep('sent');
  };

  return (
    <div className="min-h-screen bg-[#F6F2FF]">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-[#E7E1FF] bg-white/90 backdrop-blur-md px-6 py-4">
        <span className="text-base font-semibold text-[#1E1B4B]"><WordMark /></span>
      </nav>

      <div className="mx-auto max-w-[520px] px-6 py-10">
        {/* Firm badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#DCD3FF] bg-white px-4 py-1.5 text-xs font-semibold text-[#6D4AFF]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6D4AFF] animate-pulse" />
          Submitted to {firmName}
        </div>

        {step === 'form' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="mb-2 text-2xl font-bold text-[#1E1B4B] leading-tight">
              Tell us about your situation.
            </h1>
            <p className="mb-8 text-sm text-[#1E1B4B]/60 leading-relaxed">
              {firmName} asked you to submit your records here. This takes about 10 minutes.
              Your documents will be organized and sent directly to the firm.
            </p>

            <div className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">
                    First name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First"
                    className="w-full rounded-xl border border-[#E7E1FF] bg-white px-4 py-3 text-sm text-[#1E1B4B] placeholder-[#1E1B4B]/30 focus:border-[#6D4AFF] focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">
                    Last name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                    className="w-full rounded-xl border border-[#E7E1FF] bg-white px-4 py-3 text-sm text-[#1E1B4B] placeholder-[#1E1B4B]/30 focus:border-[#6D4AFF] focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">
                  Phone number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full rounded-xl border border-[#E7E1FF] bg-white px-4 py-3 text-sm text-[#1E1B4B] placeholder-[#1E1B4B]/30 focus:border-[#6D4AFF] focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20"
                />
              </div>

              {/* Employer */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">
                  Employer name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={employer}
                  onChange={(e) => setEmployer(e.target.value)}
                  placeholder="Who did you work for?"
                  className="w-full rounded-xl border border-[#E7E1FF] bg-white px-4 py-3 text-sm text-[#1E1B4B] placeholder-[#1E1B4B]/30 focus:border-[#6D4AFF] focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20"
                />
              </div>

              {/* Story */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">
                  What happened? <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="Describe your situation in your own words. Include dates, key events, and anything you think matters."
                  rows={5}
                  className="w-full rounded-xl border border-[#E7E1FF] bg-white px-4 py-3 text-sm text-[#1E1B4B] placeholder-[#1E1B4B]/30 focus:border-[#6D4AFF] focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20 resize-none"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              <button
                type="button"
                onClick={handleFormContinue}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_32px_rgba(109,74,255,0.28)] transition hover:bg-[#5B35D5] hover:-translate-y-0.5"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="text-center text-xs text-[#1E1B4B]/40">
                You'll upload your documents in the next step.
              </p>
            </div>
          </motion.div>
        )}

        {step === 'email' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="mb-2 text-2xl font-bold text-[#1E1B4B] leading-tight">
              Where should {firmName} send updates?
            </h1>
            <p className="mb-8 text-sm text-[#1E1B4B]/60 leading-relaxed">
              We'll send you a secure link to submit your documents and track your intake status.
              No password needed.
            </p>

            <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">
                  Your email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  className="w-full rounded-xl border border-[#E7E1FF] bg-white px-4 py-3 text-sm text-[#1E1B4B] placeholder-[#1E1B4B]/30 focus:border-[#6D4AFF] focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_32px_rgba(109,74,255,0.28)] transition hover:bg-[#5B35D5] disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send my secure link'}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => { setError(''); setStep('form'); }}
                className="w-full text-center text-sm text-[#1E1B4B]/50 hover:text-[#1E1B4B] transition"
              >
                ← Back
              </button>
            </form>
          </motion.div>
        )}

        {step === 'sent' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <h1 className="mb-3 text-2xl font-bold text-[#1E1B4B]">Check your email.</h1>
            <p className="mb-2 text-sm text-[#1E1B4B]/60 leading-relaxed">
              We sent a secure link to <span className="font-semibold text-[#1E1B4B]">{email}</span>.
            </p>
            <p className="text-sm text-[#1E1B4B]/60 leading-relaxed">
              Click that link to upload your documents and submit your records to {firmName}.
            </p>
            <p className="mt-6 text-xs text-[#1E1B4B]/40">
              Didn't get it? Check your spam folder or{' '}
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-[#6D4AFF] underline underline-offset-2"
              >
                try again
              </button>
              .
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
