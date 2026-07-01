import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, ShieldCheck, FileText, Check } from 'lucide-react';
import { WordMark } from '../components/WordMark';
import { submitPilotInterest } from '../../services/pilotInterestService';
import { track } from '../../lib/analytics';

interface ForFirmsPageProps {
  onBack: () => void;
  onStartWorker: () => void;
}

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;

export function ForFirmsPage({ onBack, onStartWorker }: ForFirmsPageProps) {
  const [name, setName] = useState('');
  const [firm, setFirm] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { track('pilot_view'); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    track('pilot_submit');
    const res = await submitPilotInterest({ name, firmName: firm, email, note });
    setSubmitting(false);
    if (res.error) { setError(res.error); return; }
    track('pilot_success');
    setSent(true);
  };

  const inputCls =
    'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#6D4AFF] focus:bg-white/[0.07] focus:outline-none focus:ring-4 focus:ring-[#6D4AFF]/20';

  return (
    <div className="min-h-screen bg-[#14112E] text-[#E8E5F5] antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#14112E]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <button type="button" onClick={onBack} className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-white">
            <WordMark />
          </button>
          <button type="button" onClick={onStartWorker} className="text-sm font-medium text-white/60 transition hover:text-white">
            For workers
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#14112E] px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#6D4AFF]/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C4B5FD]">
            For law firms
          </div>
          <h1 style={SERIF} className="mb-5 text-[32px] font-medium leading-[1.05] tracking-[-0.01em] text-white sm:text-[46px]">
            Open the file. Decide in minutes.
          </h1>
          <p className="mx-auto mb-8 max-w-[620px] text-[16px] leading-relaxed text-[#C9C4E6] sm:text-[17px]">
            Share one intake link with your clients. They self-serve through a guided intake, and you
            get a review-ready, source-linked record in your dashboard — so you decide in minutes
            instead of burning hours on triage.
          </p>
          <a
            href="#pilot-interest"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_48px_rgba(109,74,255,0.40)] transition hover:-translate-y-0.5 hover:bg-[#5B35D5]"
          >
            Start free pilot
            <ArrowRight className="h-4 w-4" />
          </a>
          <p className="mx-auto mt-5 max-w-[560px] text-[12px] leading-relaxed text-[#9A93C2]">
            Only organizes and reflects — never concludes. Every surfaced fact traces to the worker's story or a source document.
          </p>
        </div>
      </section>

      {/* Metrics */}
      <section className="px-5 pt-2 sm:px-8">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {([['0', 'Legal conclusions drawn'], ['100%', 'Source documents preserved for review'], ['1 link', 'Shared with your clients, on your terms'], ['Minutes', 'From upload to an organized packet']] as const).map(([n, l]) => (
            <div key={l} className="text-center">
              <div className="text-[28px] font-medium text-white" style={SERIF}>{n}</div>
              <div className="mt-1 text-[11px] leading-snug text-[#8E88B5]">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Built differently */}
      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-[24px] border border-white/10 bg-white/[0.03] p-7 sm:p-9">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#A78BFA]">Why one3seven</div>
          <h2 style={SERIF} className="text-[24px] font-medium text-white sm:text-[28px]">Built differently from legal-drafting AI.</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#C9C4E6]">
            Most legal AI drafts, scores, or recommends — which invites hallucinated citations and blurred responsibility. one3seven is intentionally narrower.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['No drafting', 'No chatbot', 'No case scoring', 'No outcome estimates', 'No attorney recommendations', 'We organize the record'].map((t) => (
              <span key={t} className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-medium text-[#C4B5FD]">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Proof of work */}
      <section className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#A78BFA]">How it arrives</div>
            <h2 style={SERIF} className="text-[26px] font-medium tracking-[-0.01em] text-white sm:text-[32px]">
              You see the mechanism, not a feature list.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Card 1: document-linked chronology entry */}
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Document-linked chronology</div>
                <span className="rounded-full bg-[#6D4AFF]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C4B5FD]">Sample</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs font-semibold text-[#C4B5FD]">Sep 9, 2024</div>
                <div className="mt-1 text-[15px] font-semibold text-white">Concern raised with HR</div>
                <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] italic leading-relaxed text-[#C9C4E6]">
                  "...writing to formally raise concerns about overtime hours and missed meal breaks..."
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[#A78BFA]">
                  <FileText className="h-3.5 w-3.5" />
                  Source: hr-complaint.pdf · p.1 · view source
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#8E88B5]">
                Each organized entry links back to the exact line in the original PDF for direct review.
              </p>
            </div>

            {/* Card 2: records-based arithmetic */}
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Records-based arithmetic</div>
                <span className="rounded-full bg-[#6D4AFF]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C4B5FD]">Sample</span>
              </div>
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#C9C4E6]">Hours logged (per timecard.pdf)</span>
                  <span className="font-semibold text-white">110</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#C9C4E6]">Hours with a matching overtime rate applied</span>
                  <span className="font-semibold text-white">80</span>
                </div>
                <div className="my-1 h-px bg-white/10" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Hours logged without a matching rate applied</span>
                  <span className="font-bold text-[#C4B5FD]">30</span>
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#8E88B5]">
                Arithmetic from the records only. one3seven organizes and reflects — it does not draw legal conclusions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Verified security */}
      <section className="border-y border-white/10 bg-[#14112E] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#A78BFA]">
              <ShieldCheck className="h-4 w-4" /> What we can stand behind
            </div>
          </div>
          <div className="space-y-4">
            {[
              ['Firm data isolation', 'Each firm sees only its own intakes. Row-level database policies enforce separation between firms, and isolation has been independently verified.'],
              ['AI foundation', 'Built on the same AI platform California adopted statewide for its agencies.'],
              ['AI training', 'Uploaded documents are used to organize your intake. They are not used to train AI models.'],
              ['Built for auditability', 'Every surfaced fact links back to the worker’s input or a source document — review never depends on trusting a black-box summary.'],
              ['Attorney-decided', 'one3seven organizes records and surfaces information from documents. It does not provide legal advice, predictions, or conclusions. Source documents remain available for direct attorney review.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#A78BFA]" />
                <div>
                  <div className="text-[15px] font-semibold text-white">{title}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[#C9C4E6]">{body}</p>
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
            <h2 style={SERIF} className="text-[26px] font-medium tracking-[-0.01em] text-white sm:text-[32px]">Be one of the first 100 founder firms</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#C9C4E6]">
              Founder pricing locked for life, priority support, and a direct line to the founders. Free
              pilot — no credit card. Tell us about your firm and we'll set up your intake link.
            </p>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-white/10 bg-white/[0.04] p-8 text-center"
            >
              <Check className="mx-auto mb-3 h-8 w-8 text-[#A78BFA]" />
              <div className="text-[16px] font-semibold text-white">Thanks — your request is recorded.</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#C9C4E6]">
                We'll reach out about pilot access. You can close this page.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
              ) : null}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8E88B5]">Full name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8E88B5]">Firm / organization</label>
                <input value={firm} onChange={(e) => setFirm(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8E88B5]">Work email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8E88B5]">Anything you'd like us to know?</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>
              <button type="submit" disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-6 py-4 font-medium text-white shadow-[0_18px_48px_rgba(109,74,255,0.34)] transition hover:-translate-y-0.5 hover:bg-[#5B35D5] disabled:translate-y-0 disabled:opacity-60">
                {submitting ? 'Sending…' : 'Start free pilot'}
                {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-center">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#A78BFA] transition hover:text-[#C4B5FD]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to one3seven
          </button>
          <p className="text-[12px] text-[#8E88B5]">
            Contact: <a href="mailto:info@one3seven.com" className="font-semibold text-[#A78BFA] hover:underline">info@one3seven.com</a>
          </p>
          <p className="max-w-[640px] text-[11px] leading-relaxed text-[#8E88B5]">
            one3seven is not a law firm and does not provide legal advice. Not a lawyer referral service. It
            organizes records and surfaces information for review preparation. Attorneys independently evaluate
            all information.
          </p>
        </div>
      </footer>
    </div>
  );
}
