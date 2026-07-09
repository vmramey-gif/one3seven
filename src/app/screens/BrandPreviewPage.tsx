/**
 * BRAND PREVIEW — /brand route. A safe, standalone preview of the new sage
 * visual identity (2026-07-08 direction) before promoting it to the live "/".
 * Light off-white + ink + cool sage accent; deep violet (#5B21B6) reserved for
 * AI-only moments; the source-linked vertical timeline is the signature visual.
 * Self-contained (no auth/Supabase) so it renders like the demo routes.
 */

const SERIF = { fontFamily: '"Fraunces", Georgia, "Times New Roman", serif' } as const;
const MONO = { fontFamily: 'ui-monospace, "IBM Plex Mono", Menlo, monospace' } as const;

const EVENTS = [
  { date: 'Nov 2025', title: 'Concern raised with HR', doc: 'Rivera_HR_Complaint.pdf' },
  { date: 'Dec 2025', title: 'Written warning issued', doc: 'Rivera_Warning_Dec2025.pdf' },
  { date: 'Jan 2026', title: 'Employment terminated', doc: 'Rivera_Termination.pdf' },
];

function TimelineCard() {
  return (
    <div className="rounded-2xl border border-[#E4E5DE] bg-[#FBFBFA] p-6 shadow-[0_1px_2px_rgba(27,38,35,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <span style={MONO} className="text-[10.5px] uppercase tracking-[0.1em] text-[#7c857f]">Source-linked intake</span>
        <span style={MONO} className="rounded-full border border-[#DDD0F2] bg-[#EFE9FA] px-2.5 py-1 text-[10px] text-[#5B21B6]">AI · 0 conclusions</span>
      </div>
      <div>
        {EVENTS.map((e, i) => (
          <div key={e.doc} className="flex gap-3.5">
            <div className="relative w-3 flex-none">
              <span className="absolute left-[1px] top-[3px] h-2.5 w-2.5 rounded-full bg-[#42574E]" />
              {i < EVENTS.length - 1 && (
                <span className="absolute left-[5px] top-[13px] bottom-[-13px] w-[2px] bg-[#CBD6CF]" />
              )}
            </div>
            <div className={i < EVENTS.length - 1 ? 'pb-5' : ''}>
              <div style={MONO} className="text-[11px] text-[#7c857f]">{e.date}</div>
              <div className="mb-[7px] mt-px text-[14px] font-semibold text-[#20242a]">{e.title}</div>
              <span style={MONO} className="inline-flex items-center gap-2 rounded-[7px] border border-[#D3DED6] bg-[#E7EDE8] px-2.5 py-[3px] text-[10.5px] text-[#3c5049]">
                <span className="h-2.5 w-[7px] flex-none rounded-[1px] bg-[#42574E]" />
                {e.doc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrandPreviewPage() {
  return (
    <div className="min-h-screen bg-[#F1F3EF] text-[#17181C]">
      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span style={SERIF} className="text-[19px] font-semibold tracking-[-0.01em]">one3seven</span>
        <div className="flex items-center gap-6">
          <a href="/demo" className="hidden text-[13.5px] font-medium text-[#3f4a44] hover:text-[#17181C] sm:block">See a sample</a>
          <a href="#pilot" className="rounded-full bg-[#42574E] px-5 py-2.5 text-[13.5px] font-semibold text-[#EAF0EC] transition hover:bg-[#374a42]">Request a pilot</a>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-11 px-6 py-14 md:grid-cols-[1.08fr_.92fr] md:py-20">
        <div>
          <div style={MONO} className="text-[11px] uppercase tracking-[0.16em] text-[#42574E]">Employment intake, organized</div>
          <h1 style={SERIF} className="mt-3.5 text-[clamp(40px,6.5vw,66px)] font-semibold leading-[0.96] tracking-[-0.022em] text-balance">
            Open the file.
            <span className="block text-[#5E7268]">Decide in minutes.</span>
          </h1>
          <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.65] text-[#40433f]">
            A worker uploads their scattered records. Your firm opens a clean, source-linked intake — every event tied to the document it came from — before the first call.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="#pilot" className="rounded-full bg-[#42574E] px-6 py-3 text-[14px] font-semibold text-[#EAF0EC] transition hover:bg-[#374a42]">Request a pilot</a>
            <a href="/demo" className="rounded-full border border-[#B7BCB2] px-5 py-3 text-[14px] font-semibold text-[#22262a] transition hover:border-[#8f958b]">See a sample intake</a>
          </div>
          <div className="mt-6 flex items-center gap-2 text-[12.5px] text-[#5b5e59]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#5B21B6] shadow-[0_0_0_4px_rgba(91,33,182,0.16)]" />
            You don’t prompt a chatbot. The AI works in the background — you open the organized file.
          </div>
        </div>
        <TimelineCard />
      </section>

      {/* roles legend + how it works */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[#6a6d66]">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-[#42574E]" /> Sage — the brand</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-[#5B21B6]" /> Violet — reserved for AI activity only</span>
        </div>
      </section>

      <section className="border-t border-[#E1E4DD] bg-[#ECEFEA]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
          {[
            ['01', 'The worker uploads', 'Pay stubs, HR emails, write-ups, texts — one upload, no forms to decode.'],
            ['02', 'one3seven organizes', 'A dated, source-linked timeline and grouped documents — it organizes and reflects, never concludes.'],
            ['03', 'You open and decide', 'The intake is waiting in your dashboard. Evaluate the matter instead of assembling it.'],
          ].map(([n, t, b]) => (
            <div key={n}>
              <div style={MONO} className="text-[12px] text-[#42574E]">{n}</div>
              <h3 style={SERIF} className="mt-2 text-[20px] font-semibold tracking-[-0.01em]">{t}</h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-[#454a44]">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10">
        <p className="max-w-[70ch] text-[12px] leading-[1.6] text-[#7a7d76]">
          one3seven organizes records — attorneys independently evaluate them. It is not a law firm, does not provide legal advice, and is not a lawyer referral service; it does not recommend, rank, or select attorneys for workers. Built on Anthropic’s Claude for record organization.
        </p>
      </footer>
    </div>
  );
}
