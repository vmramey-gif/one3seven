import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, ShieldCheck, FileText, Check } from 'lucide-react';
import { WordMark } from '../components/WordMark';
import { submitPilotInterest } from '../../services/pilotInterestService';

interface ForFirmsPageProps {
  onBack: () => void;
  onStartWorker: () => void;
}

export function ForFirmsPage({ onBack, onStartWorker }: ForFirmsPageProps) {
  const [name, setName] = useState('');
  const [firm, setFirm] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await submitPilotInterest({ name, firmName: firm, email, note });
    setSubmitting(false);
    if (res.error) { setError(res.error); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-white text-[#1E1B4B] antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#F0EBFF] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-[#1E1B4B]">
            <WordMark />
          </button>
          <button type="button" onClick={onStartWorker} className="text-sm font-medium text-[#1E1B4B]/60 transition hover:text-[#1E1B4B]">
            For workers
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#FAFAFF] px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DCD3FF] bg-white px-4 py-1.5 text-xs font-semibold text-[#6D4AFF] shadow-sm">
            For law firms
          </div>
          <h1 className="mb-5 text-[32px] font-bold leading-[1.1] tracking-tight text-[#1E1B4B] sm:text-[46px]">
            Client records, organized before you open the file.
          </h1>
          <p className="mx-auto mb-8 max-w-[620px] text-[16px] leading-relaxed text-[#1E1B4B]/62 sm:text-[17px]">
            Your team spends unbilled hours assembling scattered client records before a matter can be
            reviewed. one3seven delivers an organized, source-linked intake — so review starts with
            structure instead of sorting.
          </p>
          <a
            href="#pilot-interest"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6D4AFF] to-[#7C3AED] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_48px_rgba(109,74,255,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(109,74,255,0.45)]"
          >
            Request pilot access
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Proof of work */}
      <section className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#6D4AFF]">How it arrives</div>
            <h2 className="text-[26px] font-bold tracking-tight text-[#1E1B4B] sm:text-[32px]">
              You see the mechanism, not a feature list.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Card 1: document-linked chronology entry */}
            <div className="rounded-[24px] border border-[#E7E1FF] bg-white p-6 shadow-[0_18px_56px_rgba(31,27,75,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1E1B4B]">Document-linked chronology</div>
                <span className="rounded-full bg-[#F3EFFF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6D4AFF]">Sample</span>
              </div>
              <div className="rounded-2xl border border-[#EFEAFE] bg-[#FAFAFF] p-4">
                <div className="text-xs font-semibold text-[#6D4AFF]">Sep 9, 2024</div>
                <div className="mt-1 text-[15px] font-semibold text-[#1E1B4B]">Concern raised with HR</div>
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[12.5px] italic leading-relaxed text-[#1E1B4B]/70 border border-[#EFEAFE]">
                  "...writing to formally raise concerns about overtime hours and missed meal breaks..."
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[#6D4AFF]">
                  <FileText className="h-3.5 w-3.5" />
                  Source: hr-complaint.pdf · p.1 · view source
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#1E1B4B]/50">
                Each organized entry links back to the exact line in the original PDF for direct review.
              </p>
            </div>

            {/* Card 2: records-based arithmetic */}
            <div className="rounded-[24px] border border-[#E7E1FF] bg-white p-6 shadow-[0_18px_56px_rgba(31,27,75,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1E1B4B]">Records-based arithmetic</div>
                <span className="rounded-full bg-[#F3EFFF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6D4AFF]">Sample</span>
              </div>
              <div className="space-y-2 rounded-2xl border border-[#EFEAFE] bg-[#FAFAFF] p-4 text-[13.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#1E1B4B]/70">Hours logged (per timecard.pdf)</span>
                  <span className="font-semibold text-[#1E1B4B]">110</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#1E1B4B]/70">Hours with a matching overtime rate applied</span>
                  <span className="font-semibold text-[#1E1B4B]">80</span>
                </div>
                <div className="my-1 h-px bg-[#EFEAFE]" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1E1B4B]">Hours logged without a matching rate applied</span>
                  <span className="font-bold text-[#6D4AFF]">30</span>
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#1E1B4B]/50">
                Arithmetic from the records only. one3seven organizes and reflects — it does not draw legal conclusions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Verified security */}
      <section className="bg-[#FAFAFF] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#6D4AFF]">
              <ShieldCheck className="h-4 w-4" /> What we can stand behind
            </div>
          </div>
          <div className="space-y-4">
            {[
              ['Firm data isolation', 'Each firm sees only its own intakes. Row-level database policies enforce separation between firms, and isolation has been independently verified.'],
              ['AI training', 'Uploaded documents are used to organize your intake. They are not used to train AI models.'],
              ['Attorney-decided', 'one3seven organizes records and surfaces information from documents. It does not provide legal advice, predictions, or conclusions. Source documents remain available for direct attorney review.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-[#E7E1FF] bg-white p-5">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#6D4AFF]" />
                <div>
                  <div className="text-[15px] font-semibold text-[#1E1B4B]">{title}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[#1E1B4B]/62">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pilot interest */}
      <section id="pilot-interest" className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[520px]">
          <div className="mb-6 text-center">
            <h2 className="text-[26px] font-bold tracking-tight text-[#1E1B4B] sm:text-[32px]">Request pilot access</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#1E1B4B]/60">
              Tell us a little about your firm. We review pilot requests and reach out directly.
            </p>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-[#DCD3FF] bg-[#F7F5FF] p-8 text-center"
            >
              <Check className="mx-auto mb-3 h-8 w-8 text-[#6D4AFF]" />
              <div className="text-[16px] font-semibold text-[#1E1B4B]">Thanks — your request is recorded.</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#1E1B4B]/60">
                We'll reach out about pilot access. You can close this page.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-[24px] border border-[#E7E1FF] bg-white p-6 shadow-[0_18px_56px_rgba(31,27,75,0.08)] sm:p-8">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">Full name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full rounded-xl border border-[#DCD3FF] bg-[#F8F6FF] px-4 py-3 text-sm text-[#1E1B4B] focus:border-[#6D4AFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/10" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">Firm / organization</label>
                <input value={firm} onChange={(e) => setFirm(e.target.value)}
                  className="w-full rounded-xl border border-[#DCD3FF] bg-[#F8F6FF] px-4 py-3 text-sm text-[#1E1B4B] focus:border-[#6D4AFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/10" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">Work email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full rounded-xl border border-[#DCD3FF] bg-[#F8F6FF] px-4 py-3 text-sm text-[#1E1B4B] focus:border-[#6D4AFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/10" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1E1B4B]/50">Anything you'd like us to know?</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                  className="w-full resize-none rounded-xl border border-[#DCD3FF] bg-[#F8F6FF] px-4 py-3 text-sm text-[#1E1B4B] focus:border-[#6D4AFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/10" />
              </div>
              <button type="submit" disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 py-4 font-medium text-white shadow-[0_18px_48px_rgba(109,74,255,0.26)] transition hover:-translate-y-0.5 hover:bg-[#5B35D5] disabled:translate-y-0 disabled:opacity-60">
                {submitting ? 'Sending…' : 'Request pilot access'}
                {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#F0EBFF] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-center">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6D4AFF]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to one3seven
          </button>
          <p className="max-w-[640px] text-[11px] leading-relaxed text-[#1E1B4B]/45">
            one3seven is not a law firm and does not provide legal advice. It organizes records and surfaces
            information for review preparation. Attorneys independently evaluate all information.
          </p>
        </div>
      </footer>
    </div>
  );
}
