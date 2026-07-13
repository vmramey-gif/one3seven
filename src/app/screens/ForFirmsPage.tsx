import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, ShieldCheck, FileText, Check } from 'lucide-react';
import { submitPilotInterest } from '../../services/pilotInterestService';
import { track } from '../../lib/analytics';

interface ForFirmsPageProps {
  onBack: () => void;
  onStartWorker: () => void;
}

// Sage brand (2026-07-08): light off-white + ink + cool sage; violet reserved for AI only.
const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

export function ForFirmsPage({ onBack, onStartWorker }: ForFirmsPageProps) {
  const [name, setName] = useState('');
  const [firm, setFirm] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
    const res = await submitPilotInterest({ name, firmName: firm, email, phone, note });
    setSubmitting(false);
    if (res.error) { setError(res.error); return; }
    track('pilot_success');
    setSent(true);
  };

  const inputCls =
    'w-full rounded-xl border border-[#D3DED6] bg-white px-4 py-3 text-sm text-[#17181C] placeholder:text-[#9aa39b] focus:border-[#42574E] focus:outline-none focus:ring-4 focus:ring-[#42574E]/15';

  return (
    <div style={BODY} className="min-h-screen bg-[#F1F3EF] text-[#17181C] antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#E1E4DD] bg-[#F1F3EF]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <button type="button" onClick={onBack} style={SERIF} className="text-[19px] font-semibold tracking-[-0.01em] text-[#17181C]">
            one3seven
          </button>
          <button type="button" onClick={onStartWorker} className="text-sm font-medium text-[#3f4a44] transition hover:text-[#17181C]">
            For workers
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div style={MONO} className="mb-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">
            For law firms
          </div>
          <h1 style={SERIF} className="mb-5 text-balance text-[32px] font-semibold leading-[1.05] tracking-[-0.015em] text-[#17181C] sm:text-[46px]">
            Your intake organization partner — <span className="text-[#5E7268]">shaped around your firm.</span>
          </h1>
          <p className="mx-auto mb-5 max-w-[620px] text-[16px] leading-relaxed text-[#40433f] sm:text-[17px]">
            A worker uploads scattered employment records. Your firm opens a clean, source-linked intake
            file — with the worker's story, timeline, documents, and key dates organized from the records
            provided, before your first call.
          </p>
          <p className="mx-auto mb-8 max-w-[560px] text-[14px] font-medium leading-relaxed text-[#42574E]">
            For intake review, you don't have to prompt a chatbot. You open the organized file.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#pilot-interest"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#42574E] px-7 py-3.5 text-[15px] font-semibold text-[#EAF0EC] transition hover:-translate-y-0.5 hover:bg-[#374a42]"
            >
              Request a pilot
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/demo"
              onClick={() => track('firm_see_sample')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#B7BCB2] px-7 py-3.5 text-[15px] font-semibold text-[#22262a] transition hover:border-[#8f958b] hover:bg-white/50"
            >
              See a sample intake packet
            </a>
          </div>
          <p className="mx-auto mt-5 max-w-[600px] text-[12px] leading-relaxed text-[#6a6d66]">
            No prompts required. No legal conclusions. No case scoring. one3seven organizes and reflects —
            it does not advise. Key facts link back to source records, so your firm can verify and decide.
          </p>
        </div>
      </section>

      {/* The change is here — why now (firm-page only; kept off the homepage) */}
      <section className="px-5 pb-4 pt-2 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div style={MONO} className="mb-4 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">The change is here</div>
          <h2 style={SERIF} className="text-[30px] font-semibold leading-[1.04] tracking-[-0.015em] text-[#17181C] sm:text-[44px]">
            The tools are changing.
            <span className="block text-[#5E7268]">Your judgment shouldn't.</span>
          </h2>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#40433f] sm:text-[16px]">
            <p className="max-w-[62ch]">
              Artificial intelligence is changing how records can be organized and reviewed. We built
              one3seven to help firms adopt that change without changing how legal decisions are made.
            </p>
            <p className="max-w-[62ch]">
              A worker uploads scattered employment records. one3seven organizes them into a review-ready,
              source-linked intake. Every source document remains available. Every legal judgment remains yours.
            </p>
            <p className="max-w-[62ch] text-[16px] font-medium text-[#2c332e] sm:text-[17px]">
              The technology changes how the record arrives. It doesn't change who evaluates it.
            </p>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="px-5 pb-2 pt-12 sm:px-8 sm:pt-16">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {([['0', 'Legal conclusions drawn'], ['100%', 'Source documents preserved for review'], ['1 link', 'Shared with your clients, on your terms'], ['Minutes', 'From upload to an organized packet']] as const).map(([n, l]) => (
            <div key={l} className="text-center">
              <div className="text-[28px] font-semibold text-[#17181C]" style={SERIF}>{n}</div>
              <div className="mt-1 text-[11px] leading-snug text-[#6a6d66]">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Built differently */}
      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-[24px] border border-[#E4E5DE] bg-[#FBFBFA] p-7 sm:p-9">
          <div style={MONO} className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">Why one3seven</div>
          <h2 style={SERIF} className="text-[24px] font-semibold text-[#17181C] sm:text-[28px]">Built differently from legal-drafting AI.</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#40433f]">
            Most legal AI drafts, scores, or recommends — which invites hallucinated citations and blurred responsibility. one3seven is intentionally narrower.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['No drafting', 'No chatbot', 'No case scoring', 'No outcome estimates', 'No attorney recommendations', 'We organize the record'].map((tt) => (
              <span key={tt} className="rounded-full border border-[#CBD6CF] px-3 py-1.5 text-[12px] font-medium text-[#42574E]">{tt}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Proof of work */}
      <section className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div style={MONO} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">How it arrives</div>
            <h2 style={SERIF} className="text-[26px] font-semibold tracking-[-0.01em] text-[#17181C] sm:text-[32px]">
              You see the mechanism, not a feature list.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Card 1: document-linked chronology entry */}
            <div className="rounded-[24px] border border-[#E4E5DE] bg-[#FBFBFA] p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#17181C]">Document-linked chronology</div>
                <span style={MONO} className="rounded-full bg-[#E7EDE8] px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-[#42574E]">Sample</span>
              </div>
              <div className="rounded-2xl border border-[#E4E5DE] bg-white p-4">
                <div style={MONO} className="text-[11px] text-[#7c857f]">Sep 9, 2024</div>
                <div className="mt-1 text-[15px] font-semibold text-[#20242a]">Concern raised with HR</div>
                <p className="mt-2 rounded-lg border border-[#E4E5DE] bg-[#F7F9F5] px-3 py-2 text-[12.5px] italic leading-relaxed text-[#40433f]">
                  "...writing to formally raise concerns about overtime hours and missed meal breaks..."
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[#42574E]">
                  <FileText className="h-3.5 w-3.5" />
                  Source: hr-complaint.pdf · p.1 · view source
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#6a6d66]">
                Each organized entry links back to the exact line in the original PDF for direct review.
              </p>
            </div>

            {/* Card 2: records-based arithmetic */}
            <div className="rounded-[24px] border border-[#E4E5DE] bg-[#FBFBFA] p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#17181C]">Records-based arithmetic</div>
                <span style={MONO} className="rounded-full bg-[#E7EDE8] px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-[#42574E]">Sample</span>
              </div>
              <div className="space-y-2 rounded-2xl border border-[#E4E5DE] bg-white p-4 text-[13.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#40433f]">Hours logged (per timecard.pdf)</span>
                  <span className="font-semibold text-[#20242a]">110</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#40433f]">Hours with a matching overtime rate applied</span>
                  <span className="font-semibold text-[#20242a]">80</span>
                </div>
                <div className="my-1 h-px bg-[#E4E5DE]" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#20242a]">Hours logged without a matching rate applied</span>
                  <span className="font-bold text-[#42574E]">30</span>
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#6a6d66]">
                Arithmetic from the records only. one3seven organizes and reflects — it does not draw legal conclusions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="border-y border-[#E1E4DD] bg-[#ECEFEA] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div style={MONO} className="mb-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">
              <ShieldCheck className="h-4 w-4" /> What we can stand behind
            </div>
          </div>
          <div className="space-y-4">
            {[
              ['Firm data isolation', 'Each firm sees only its own intakes. Row-level database policies enforce separation between firms.'],
              ['AI foundation', 'Powered by Anthropic\'s Claude for record organization.'],
              ['AI training', 'Uploaded documents are used to organize your intake. They are not used to train AI models.'],
              ['Built for auditability', 'Every surfaced fact links back to the worker’s input or a source document — review never depends on trusting a black-box summary.'],
              ['Attorney-decided', 'one3seven organizes records and surfaces information from documents. It does not provide legal advice, predictions, or conclusions. Source documents remain available for direct attorney review.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-[#E1E4DD] bg-[#F7F9F5] p-5">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#42574E]" />
                <div>
                  <div className="text-[15px] font-semibold text-[#17181C]">{title}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[#40433f]">{body}</p>
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
            <h2 style={SERIF} className="text-[26px] font-semibold tracking-[-0.01em] text-[#17181C] sm:text-[32px]">Founding firms — shaped around your practice</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-[#40433f]">
              We are opening a small founding cohort of California employment firms — onboarded a few at a
              time, hands-on — and shaping the intake experience around real plaintiff-side workflows: your
              matter types, your review process, your documents, and the way your team evaluates new matters.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-[#40433f]">
              Founding firms receive hands-on onboarding, direct founder access, and founder pricing locked
              for life during the founding program. Your pilot begins with your first real intake and runs
              30 days from there — enough time to evaluate it on real matters, not a rushed week.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-[#6a6d66]">
              Your firm stays in control. Attorney judgment stays with your team. one3seven only organizes the intake file.
            </p>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-[#E4E5DE] bg-[#FBFBFA] p-8 text-center"
            >
              <Check className="mx-auto mb-3 h-8 w-8 text-[#42574E]" />
              <div className="text-[16px] font-semibold text-[#17181C]">Thanks — your request is recorded.</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#40433f]">
                We'll reach out about pilot access. You can close this page.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-[24px] border border-[#E4E5DE] bg-[#FBFBFA] p-6 sm:p-8">
              {error ? (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6a6d66]">Full name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6a6d66]">Firm / organization</label>
                <input value={firm} onChange={(e) => setFirm(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6a6d66]">Work email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6a6d66]">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6a6d66]">Anything you'd like us to know?</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>
              <button type="submit" disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#42574E] px-6 py-4 font-semibold text-[#EAF0EC] transition hover:-translate-y-0.5 hover:bg-[#374a42] disabled:translate-y-0 disabled:opacity-60">
                {submitting ? 'Sending…' : 'Start free pilot'}
                {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E1E4DD] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-center">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#42574E] transition hover:text-[#2c332e]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to one3seven
          </button>
          <p className="text-[12px] text-[#6a6d66]">
            Contact: <a href="mailto:info@one3seven.com" className="font-semibold text-[#42574E] hover:underline">info@one3seven.com</a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-[#6a6d66]">
            <a href="/terms" className="font-medium text-[#42574E] hover:underline">Terms</a>
            <span aria-hidden className="text-[#c3c7bd]">·</span>
            <a href="/privacy" className="font-medium text-[#42574E] hover:underline">Privacy</a>
          </div>
          <p className="max-w-[640px] text-[11px] leading-relaxed text-[#6a6d66]">
            one3seven is not a law firm and does not provide legal advice. one3seven is not a lawyer referral
            service and does not recommend, rank, or select attorneys for workers. It organizes records and
            surfaces information for review preparation. Attorneys independently evaluate all information.
          </p>
        </div>
      </footer>
    </div>
  );
}
