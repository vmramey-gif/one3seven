import { ArrowRight } from 'lucide-react';

/**
 * Worker-facing front door — the destination for worker advertising.
 * Worker-first, verb-test clean, referral-safe (worker owns + chooses; one3seven never
 * routes/matches/selects). Reached at /for-workers and via the homepage "For workers" nav.
 *
 * TODO (before fully live, not blocking wiring): EN/ES. This audience — esp. fire-displaced
 * workers — skews Spanish-preferring. Move this hardcoded copy into src/i18n/i18n.tsx and add
 * the ES translations + LangToggle, matching the homepage. Flagged 2026-07-14.
 */

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

interface WorkerLandingPageProps {
  onStart: () => void;   // "Start organizing — free" → low-friction worker sign-up
  onSignIn: () => void;
  onBack?: () => void;
}

const STEPS: [string, string, string][] = [
  ['01', 'Tell us what happened', "In your own words — start wherever makes sense. We keep your account exactly as you tell it. No forms, no legal terms."],
  ['02', 'Add what you have', "Upload the texts, pay stubs, emails, schedules, and photos you've saved. Don't worry if it's a mess — that's the point."],
  ['03', 'Get an organized file', 'one3seven builds a clear, dated timeline where every fact links back to your document — ready to bring to an attorney.'],
];

const YOURS: [string, string][] = [
  ['You own it', 'Your documents and your words belong to you. one3seven organizes them — it never takes them over, and never sells your information.'],
  ['You choose the attorney', 'When you’re ready, you decide which attorney to share your organized file with. one3seven never picks a lawyer for you and is not a referral service.'],
  ['You control sharing', 'Nothing goes to anyone until you choose to send it. Your employer is never notified, and you’re never locked to a single firm.'],
  ['You can delete it', 'Change your mind? Request deletion at any time — it’s your account and your decision.'],
];

export function WorkerLandingPage({ onStart, onSignIn, onBack }: WorkerLandingPageProps) {
  return (
    <div style={BODY} className="min-h-screen bg-[#F1F3EF] text-[#17181C] antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#E1E4DD] bg-[#F1F3EF]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <button type="button" onClick={onBack} style={SERIF} className="text-[19px] font-semibold tracking-[-0.01em] text-[#17181C]">
            one3seven
          </button>
          <button type="button" onClick={onSignIn} className="text-sm font-medium text-[#3f4a44] transition hover:text-[#17181C]">
            Sign in
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        {/* Hero */}
        <section className="pb-8 pt-14 sm:pt-20">
          <div style={MONO} className="mb-4 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">For California workers</div>
          <h1 style={SERIF} className="mb-4 max-w-[15ch] text-balance text-[clamp(34px,7vw,58px)] font-semibold leading-[1.02] tracking-[-0.02em]">
            Wronged at work? <span className="text-[#5E7268]">Get your records in order.</span>
          </h1>
          <p style={SERIF} className="mb-4 max-w-[24ch] text-[clamp(18px,3vw,23px)] font-medium italic leading-snug text-[#42574E]">
            You were heard — not processed.
          </p>
          <p className="mb-6 max-w-[54ch] text-[16.5px] leading-[1.65] text-[#40433f]">
            Fired unfairly, shorted on pay, or pushed out? Before you talk to a lawyer, one3seven helps you
            tell your story and organize your scattered records — texts, pay stubs, emails, photos — into one
            clear, dated file you can bring to any attorney you choose. Free, private, and yours to keep.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-[#42574E] px-7 py-3.5 text-[16px] font-semibold text-[#EAF0EC] shadow-[0_14px_30px_-12px_rgba(66,87,78,0.55)] transition hover:-translate-y-0.5 hover:bg-[#374a42]">
              Start organizing — free <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#how" className="inline-flex items-center rounded-full border border-[#B7BCB2] bg-white/60 px-6 py-3.5 text-[16px] font-semibold text-[#22262a] transition hover:border-[#8f958b] hover:bg-white">
              See how it works
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-[18px] gap-y-2.5 border-t border-[#E4E5DE] pt-4 text-[13.5px] font-semibold text-[#42574E]">
            {['Free', 'Your employer isn’t notified', 'Yours to keep', 'You choose who sees it'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#95AB9B]" />{s}</span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-16">
          <div className="text-center">
            <div style={MONO} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">How it works</div>
            <h2 style={SERIF} className="text-[clamp(24px,4vw,32px)] font-semibold tracking-[-0.01em]">Three steps. No legal jargon.</h2>
            <p className="mx-auto mt-3 max-w-[60ch] text-[15.5px] leading-relaxed text-[#40433f]">
              You don’t need to know if you “have a case.” You just need to get your story and your records in one place.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([n, title, body]) => (
              <div key={n} className="rounded-[20px] border border-[#E4E5DE] bg-[#FBFBFA] p-6">
                <div style={MONO} className="text-[12px] tracking-[0.1em] text-[#42574E]">{n}</div>
                <h3 style={SERIF} className="mb-1.5 mt-2.5 text-[19px] font-semibold">{title}</h3>
                <p className="text-[14.5px] leading-relaxed text-[#40433f]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Straight with you */}
        <section className="py-4">
          <div className="rounded-[24px] bg-[#42574E] p-8 sm:p-10 text-[#EAF0EC]">
            <div style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#AFC3B4]">Straight with you</div>
            <p style={SERIF} className="mt-3 max-w-[24ch] text-[clamp(20px,3vw,26px)] font-medium text-white">
              We organize your records. We don’t tell you whether you have a case.
            </p>
            <p className="mt-3.5 max-w-[56ch] text-[16px] leading-[1.65] text-[#D3DED6]">
              An attorney decides that — that’s their job, not a tool’s. What one3seven does is make sure that
              when you walk into that conversation, you’re prepared, your story is intact, and nothing important
              got lost. You’ll be taken seriously because your record speaks for itself.
            </p>
          </div>
        </section>

        {/* Your record, your call */}
        <section className="py-16">
          <div className="mb-8 text-center">
            <div style={MONO} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-[#42574E]">Your record, your call</div>
            <h2 style={SERIF} className="text-[clamp(24px,4vw,32px)] font-semibold tracking-[-0.01em]">It stays yours — start to finish.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {YOURS.map(([h, body]) => (
              <div key={h} className="rounded-[20px] border border-[#E4E5DE] bg-[#FBFBFA] p-6">
                <div className="flex items-center gap-2 text-[16px] font-bold text-[#20242a]">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E7EDE8] text-[13px] font-extrabold text-[#42574E]">✓</span>
                  {h}
                </div>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#40433f]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-10 text-center">
          <h2 style={SERIF} className="text-[clamp(24px,4vw,32px)] font-semibold tracking-[-0.01em]">Get your story in order — free.</h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-[15.5px] leading-relaxed text-[#40433f]">It takes minutes to start, and you keep everything you build.</p>
          <div className="mt-6 flex justify-center">
            <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-[#42574E] px-7 py-3.5 text-[16px] font-semibold text-[#EAF0EC] shadow-[0_14px_30px_-12px_rgba(66,87,78,0.55)] transition hover:-translate-y-0.5 hover:bg-[#374a42]">
              Start organizing — free <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E1E4DD] px-5 py-9 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
          <div style={MONO} className="text-[11px] uppercase tracking-[0.14em] text-[#6a6d66]">one3seven</div>
          <p className="max-w-[640px] text-[11.5px] leading-relaxed text-[#6a6d66]">
            one3seven is not a law firm and does not provide legal advice. It is not a lawyer referral service
            and does not recommend, rank, or select attorneys for you. It organizes your records and preserves
            your account so you can prepare to speak with an attorney of your own choosing. Built on Anthropic’s
            Claude for record organization.
          </p>
        </div>
      </footer>
    </div>
  );
}
