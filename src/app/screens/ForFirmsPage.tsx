import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, ShieldCheck, FileText, Check } from 'lucide-react';
import { submitPilotInterest } from '../../services/pilotInterestService';
import { WordMark } from '../components/WordMark';
import { track } from '../../lib/analytics';

interface ForFirmsPageProps {
  onBack: () => void;
  onStartWorker: () => void;
}

// Sage brand (2026-07-08): light off-white + ink + cool sage; violet reserved for AI only.
// SaaS-led type (2026-08-02): display is the tight sans, matching WorkerLandingPage — one brand
// across both public pages. Name kept as SERIF to avoid churning every style={SERIF} usage.
const SERIF = { fontFamily: '"Inter Tight", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em', fontWeight: 680 } as const;
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
    <div style={BODY} className="min-h-screen o3s-warm-sky text-[#17181C] antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#E1E4DD] bg-[#FBF7EF]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <button type="button" onClick={onBack} style={SERIF} className="text-[19px] font-semibold tracking-[-0.01em] text-[#17181C] transition hover:opacity-70">
            <WordMark />
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
            Screen the case, <span className="text-[#5E7268]">not the chaos.</span>
          </h1>
          <p className="mx-auto mb-5 max-w-[620px] text-[16px] leading-relaxed text-[#40433f] sm:text-[17px]">
            A worker arrives with their whole story already organized — texts, pay stubs, emails, key
            dates — every fact linked back to the document behind it. Your firm opens a review-ready file
            and screens it in minutes, instead of spending a week of intake building it.
          </p>
          <p className="mx-auto mb-8 max-w-[560px] text-[14px] font-medium leading-relaxed text-[#42574E]">
            Intake used to eat hours of your team's time per matter — much of it on matters you'll
            ultimately pass on. one3seven moves that work off your clock: the worker assembles the file
            themselves, before they ever reach you.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#pilot-interest"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#42574E] px-7 py-3.5 text-[15px] font-semibold text-[#EAF0EC] transition hover:-translate-y-0.5 hover:bg-[#374a42]"
            >
              Apply to the founding cohort
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
            Every key fact links back to its source record — so your firm verifies in a click and decides for itself.
          </p>
        </div>
      </section>

      {/* Product preview — the firm mirror of the worker's "show up ready" glass section.
          The hook: the prepared client every firm wishes for now walks in as a review-ready,
          source-linked file. Dark "cockpit" glass tiles = one tile per statutory element.
          Element count varies by theory (5–8); this lens shows 5. Illustrative; counsel-gate. */}
      <section className="px-5 pb-6 pt-2 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 text-center">
            <div style={MONO} className="mb-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">What the attorney gets</div>
            <h2 style={SERIF} className="mx-auto max-w-[20ch] text-balance text-[26px] font-semibold leading-[1.06] tracking-[-0.015em] text-[#17181C] sm:text-[34px]">
              The client everyone wishes they had <span className="text-[#5E7268]">now exists.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-[#40433f]">
              Not a stack of screenshots and a 90-minute retelling. A file already sorted by the claim's
              statutory elements — each fact one click from the page it came from, each gap named out loud.
            </p>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-[#243029] bg-[#0e1512] p-6 shadow-[0_34px_80px_-34px_rgba(20,45,32,0.55)] sm:p-7" style={{ color: '#ECF3ED' }}>
            <div className="flex items-center justify-between">
              <div style={MONO} className="text-[10px] uppercase tracking-[0.16em] text-[#8FA495]">Element Lens · firm workspace</div>
              <div style={MONO} className="rounded-full border border-[#243029] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-[#8FA495]">Illustrative</div>
            </div>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
              <span style={SERIF} className="text-[20px] font-semibold">Retaliation</span>
              <span style={MONO} className="text-[11px] text-[#8FA495]">Labor Code §1102.5</span>
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-[14px] border border-[#243029] bg-[#131c17] p-4">
              <div className="flex-none">
                <div style={MONO} className="text-[9.5px] uppercase tracking-[0.14em] text-[#8FA495]">Element coverage</div>
                <div style={SERIF} className="text-[34px] font-semibold leading-none text-[#8FD3A6]">4<span className="text-[20px] text-[#61756A]">/5</span></div>
              </div>
              <div className="min-w-0 flex-1">
                {/* Discrete element segments — a locator ("4 of 5 elements located"), not a % gauge */}
                <div className="flex gap-1">{[1, 1, 1, 1, 0].map((f, i) => (<div key={i} className={`h-[7px] flex-1 rounded-full ${f ? 'bg-[#8FD3A6]' : 'bg-[#1b2620]'}`} />))}</div>
                <div className="mt-2 text-[11.5px] leading-snug text-[#8FA495]">Four of this claim's five elements have material on file. A structural fact about the record — not a verdict on the case.</div>
              </div>
            </div>

            {/* One glass tile per statutory element */}
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {[
                { el: 'Reports & complaints made', src: 'Rosa_HR_Complaint.pdf · p.1' },
                { el: 'Recipient of the report', src: 'Email_to_Ramirez.pdf · p.1' },
                { el: 'Employer awareness of the report', src: 'HR_Acknowledgment.pdf · p.2' },
                { el: 'Employment actions after, with dates', src: 'Termination_Letter.pdf · p.1' },
              ].map((t) => (
                <div key={t.el} className="rounded-[13px] border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#8FD3A6]">✓</span>
                    <div className="text-[13px] font-medium leading-snug text-[#ECF3ED]">{t.el}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span style={{ ...MONO, background: 'rgba(124,92,255,0.15)', borderColor: 'rgba(167,139,250,0.4)', color: '#A78BFA' }} className="flex-none rounded-md border px-1.5 py-0.5 text-[9px]">Source-linked »</span>
                    <span style={MONO} className="truncate text-[9.5px] text-[#61756A]">{t.src}</span>
                  </div>
                </div>
              ))}
              {/* The gap — the fifth element, named out loud */}
              <div className="rounded-[13px] border p-3.5 backdrop-blur-md sm:col-span-2" style={{ borderColor: 'rgba(224,123,62,0.45)', background: 'rgba(224,123,62,0.07)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[#F3A268]">!</span>
                  <div className="text-[13px] font-medium leading-snug text-[#ECF3ED]">Sequence &amp; interval between report and action</div>
                </div>
                <div style={MONO} className="mt-1.5 text-[9.5px] uppercase tracking-[0.1em] text-[#F3A268]">No material on file — a question for the first call</div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11.5px] text-[#6a6d66]">One lens; element counts vary by claim theory (five here).</p>
        </div>
      </section>

      {/* Proof of work — moved up directly under the glass preview: show what lands on the desk
          before any boundary talk. Sell first, disclaim once (in "Built differently"). */}
      <section className="px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div style={MONO} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">What lands on your desk</div>
            <h2 style={SERIF} className="text-[26px] font-semibold tracking-[-0.01em] text-[#17181C] sm:text-[32px]">
              Nothing to assemble. You open the file and screen it.
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
                Arithmetic from the records only — not a legal conclusion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What your firm gets — capabilities framed as record-organization (never scoring/conclusions).
          Pulled up directly under the product preview (Clio-style "sell it up front").
          Counsel-gate: the Element Lens + coverage naming should get a counsel glance before go-live. */}
      <section className="px-5 pb-4 pt-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div style={MONO} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">What your firm gets</div>
          <h2 style={SERIF} className="mb-8 max-w-[22ch] text-[clamp(24px,4vw,34px)] font-semibold tracking-[-0.015em] text-[#17181C]">
            Read the record faster — <span className="text-[#5E7268]">without reading everything.</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[20px] border border-[#CBD6CF] bg-[#FBFBFA] p-6">
              <div style={MONO} className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-[#42574E]">Element Lens</div>
              <h3 style={SERIF} className="mb-2 text-[19px] font-semibold text-[#17181C]">The record, re-sorted by the elements.</h3>
              <p className="text-[14px] leading-relaxed text-[#40433f]">
                Pick a theory. Element Lens reorganizes the file around it in seconds — including what you
                don&rsquo;t have yet.
              </p>
            </div>
            <div className="rounded-[20px] border border-[#CBD6CF] bg-[#FBFBFA] p-6">
              <div style={MONO} className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-[#42574E]">Source-linked</div>
              <h3 style={SERIF} className="mb-2 text-[19px] font-semibold text-[#17181C]">Every fact opens its page.</h3>
              <p className="text-[14px] leading-relaxed text-[#40433f]">
                Each item links back to the exact document and page it came from. Verify in a click —
                nothing to take on faith, nothing to un-hallucinate.
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-[70ch] text-[12px] leading-relaxed text-[#6a6d66]">
            one3seven organizes the record; attorneys independently evaluate everything.
          </p>
        </div>
      </section>

      {/* Built differently */}
      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-[24px] border border-[#E4E5DE] bg-[#FBFBFA] p-7 sm:p-9">
          <div style={MONO} className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">Why one3seven</div>
          <h2 style={SERIF} className="text-[24px] font-semibold text-[#17181C] sm:text-[28px]">Built differently from legal-drafting AI.</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#40433f]">
            Most legal AI drafts, scores, or recommends — which invites hallucinated citations and blurred
            responsibility. one3seven is intentionally narrower: the tools are changing, but who evaluates
            the record shouldn't. We change how the record arrives, not who decides.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['No drafting', 'No chatbot', 'No case scoring', 'No outcome estimates', 'No attorney recommendations', 'We organize the record'].map((tt) => (
              <span key={tt} className="rounded-full border border-[#CBD6CF] px-3 py-1.5 text-[12px] font-medium text-[#42574E]">{tt}</span>
            ))}
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
            <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#42574E]">
              The firm side of one3seven is by invitation while we're in the founding cohort — request access
              below, or email <a href="mailto:info@one3seven.com" className="underline hover:text-[#374a42]">info@one3seven.com</a> directly.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-[#40433f]">
              We are opening a small founding cohort of California employment firms — onboarded a few at a
              time, hands-on — and shaping the intake experience around real plaintiff-side workflows: your
              matter types, your review process, your documents, and the way your team evaluates new matters.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-[#40433f]">
              Founding firms receive hands-on onboarding, direct founder access, and founder pricing — with
              the specific terms set out in a founding-firm agreement we&rsquo;ll walk you through. Pilots run
              30 days from onboarding — enough time to evaluate it on real matters, not a rushed week.
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
                {submitting ? 'Sending…' : 'Apply to the founding cohort'}
                {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer — rests in the ripened deep-green bottom; light-inverted for readability. */}
      <footer className="border-t border-white/10 px-5 pb-12 pt-9 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-center">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#CBD8C4] transition hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to one3seven
          </button>
          <p className="text-[12px] text-[#9DB097]">
            Contact: <a href="mailto:info@one3seven.com" className="font-semibold text-[#CBD8C4] hover:underline">info@one3seven.com</a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-[#9DB097]">
            <a href="/terms" className="font-medium text-[#CBD8C4] hover:underline">Terms</a>
            <span aria-hidden className="text-white/25">·</span>
            <a href="/privacy" className="font-medium text-[#CBD8C4] hover:underline">Privacy</a>
            <span aria-hidden className="text-white/25">·</span>
            <a href="/privacy#california-privacy-rights" className="font-medium text-[#CBD8C4] hover:underline">Your Privacy Choices</a>
          </div>
          <p className="max-w-[640px] text-[11px] leading-relaxed text-[#9DB097]">
            one3seven is not a law firm and does not provide legal advice. one3seven is not a lawyer referral
            service and does not recommend, rank, or select attorneys for workers. It organizes records and
            surfaces information for review preparation. Attorneys independently evaluate all information.
          </p>
        </div>
      </footer>
    </div>
  );
}
