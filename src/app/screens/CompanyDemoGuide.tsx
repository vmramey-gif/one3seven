/**
 * /company-demo — guided, click-by-click coach for running the live product demo.
 * Reimplements docs/company-demo.html in our stack. Two modes: Coach (notes + capture
 * tags + panic strip) and Present (clean, larger type for screen-share).
 *
 * Demo subject is Marcus Reyes — matches the live /fire-demo Tad screen-shares.
 * UPL-safe: customer-facing bubbles never assert legal conclusions; the
 * "organizes and reflects, never concludes" line is preserved.
 */
import { useEffect, useState } from 'react';

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;

interface Step {
  phase: string;
  kicker: string;
  title: string;
  do: string;
  say: string;
  note?: string;
  watch?: string;
  /** Coach-only fallback note (styled like .note) when a beat can't deliver a live action. */
  fallback?: string;
}

const STEPS: Step[] = [
  {
    phase: 'Open',
    kicker: 'Before you share screen',
    title: 'Hand the prospect the floor first',
    do: 'Do <b>not</b> share your screen yet. Camera on, app ready in the background. Ask one question, then go quiet.',
    say: 'Before I show you anything — when a new wage or wrongful-termination case comes in through your intake form, who organizes all the answers and the documents the worker uploads, and how long does that take before you can actually evaluate it?',
    note: 'Then <b>stop talking.</b> Let them answer in full. Write down the exact words they use for the pain — you’ll repeat that phrase back during the demo. The prospect carrying the first two minutes takes the pressure off you.',
    watch: 'Capture their literal phrase for the intake problem. That sentence becomes our landing-page headline.',
  },
  {
    phase: 'Beat 1',
    kicker: 'Show the scattered state',
    title: 'This is how the case arrives',
    do: 'Share screen. Land on Marcus’s <b>raw uploaded documents</b> — the unsorted pile: pay stubs, text screenshots, termination letter, HR emails. Scroll it slowly. Let it look like a lot.',
    say: 'This is how Marcus’s case arrives — same as yours. A worker fills out the form and uploads whatever they have. Screenshots, PDFs, a termination letter, text threads. Out of order, nothing labeled. Right now, someone on your side has to read all of this and rebuild what happened, and when, before you can even decide if it’s a case.',
    note: 'Don’t rush past the mess — the mess is the whole point. End the beat looking right at them: <em>“That reconstruction is what I want to show you.”</em>',
  },
  {
    phase: 'Beat 2',
    kicker: 'Show the cited timeline',
    title: 'Same records. Now they’re a timeline',
    do: 'Click into Marcus’s <b>organized intake / timeline</b>. Let the clean chronology load. Point to the events that match <b>their</b> form fields: HR complaint, termination date + employer’s reason vs. Marcus’s, the wage flags.',
    say: 'Same records — now they’re a timeline. Hired here. First complaint to HR here. Retaliation here. Termination here. And notice: these are the exact things your intake form asks for. The employer’s reason for termination versus his. The break and overtime flags. Already pulled, already in order.',
    note: 'Then land it with <b>their own number</b> from the opening: <em>“This is the couple hours your paralegal spends.”</em> Don’t narrate every row — let it breathe.',
    watch: 'Note which moment made them lean in — the mess, the timeline, or the source-labeled facts. That’s your strongest demo beat.',
  },
  {
    phase: 'Beat 3',
    kicker: 'The trust beat — do not skip',
    title: 'Every fact shows where it came from',
    // TODO: wire to real citation jump once source-link feature ships.
    do: 'Pick <b>one</b> important fact — the termination date or the HR complaint. <b>Point to its source label</b> — every fact shows the document it came from. Sit on it for a second.',
    say: 'And you never have to take our word for it. Every fact in here is labeled with the exact document it came from — the termination date, the HR complaint, each one traceable back to the record. You can verify any line against its source. It organizes and reflects. It never concludes — the legal judgment stays entirely yours.',
    note: 'This is the beat that answers an attorney’s real objection: <b>“can I trust this without re-reading everything?”</b> If you do only one thing well, do this one. It’s the mic-drop.',
    fallback: 'Citation <b>click-to-jump isn’t live yet</b> — point to the source label on the fact and say the line above. Do not click anything you can’t deliver.',
  },
  {
    phase: 'Close',
    kicker: 'Make the ask, from strength',
    title: 'One real case through the system',
    do: 'Stop showing features — resist the urge to keep clicking. Move to the ask. Use the controlled-beta framing: you’re checking fit, not begging.',
    say: 'We’re in a controlled beta — selectively bringing on a few California employment firms where intake quality really matters. Based on what you do, you’d be a strong fit. The next step is getting one of your real cases through it, so you see it on your own work. Want to try that?',
    note: 'Small, concrete ask — one real case, not “sign up.” If yes, <b>schedule the follow-up before you hang up.</b> If “not now,” leave warm: <em>“Can I check back when your caseload picks up?”</em>',
    watch: 'Write objections down verbatim, and note any feature they asked for — especially if they want to search or interrogate the record.',
  },
];

const PANIC = [
  '“This is how the case arrives — scattered.”',
  '“This is it organized into a sourced timeline.”',
  '“Every fact is labeled with the document it came from.”',
];

export function CompanyDemoGuide() {
  const [i, setI] = useState(0);
  const [present, setPresent] = useState(false);

  const go = (n: number) => {
    setI(Math.max(0, Math.min(STEPS.length - 1, n)));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((p) => Math.min(STEPS.length - 1, p + 1));
      if (e.key === 'ArrowLeft') setI((p) => Math.max(0, p - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const s = STEPS[i];
  const html = (markup: string) => ({ dangerouslySetInnerHTML: { __html: markup } });

  return (
    <div className="min-h-screen bg-[#FAF8FE] text-[#16121F] antialiased">
      <div className={`mx-auto px-5 pb-16 pt-7 ${present ? 'max-w-[880px]' : 'max-w-[760px]'}`}>
        {/* Masthead */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div style={SERIF} className="text-[20px] font-bold tracking-tight">
            one<span className="text-[#42574E]">3</span>seven
          </div>
          <div className="inline-flex gap-0.5 rounded-full border border-[#E8E3F2] bg-white p-[3px]">
            {(['coach', 'present'] as const).map((m) => {
              const active = (m === 'present') === present;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPresent(m === 'present')}
                  className={`rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C4DD6] ${
                    active ? 'bg-[#42574E] text-white shadow-sm' : 'text-[#4B4458]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title block */}
        <div className="mb-4">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7C4DD6]">
            Company demo · Marcus Reyes
          </div>
          <h1 style={SERIF} className="text-[clamp(28px,7vw,40px)] font-bold leading-[1.02] tracking-[-0.03em]">
            Run the demo, click&nbsp;by&nbsp;click.
          </h1>
          {!present && (
            <p className="mt-2.5 max-w-[58ch] text-[15.5px] text-[#4B4458]">
              Each step tells you what to click and exactly what to say. Three beats carry the whole thing:
              show the mess, show the cited timeline, point to one fact and its source.
            </p>
          )}
        </div>

        {/* The one rule */}
        {!present && (
          <div className="my-6 rounded-xl border-l-4 border-[#B45309] bg-[#FDF4E3] px-4 py-3.5 text-[14px] text-[#6B4410]">
            <strong className="text-[#B45309]">The one rule:</strong> talk less than you want to. The product does
            the showing. If the prospect is talking more than you, you’re winning.
          </div>
        )}

        {/* Progress rail */}
        <div className="mb-6 flex gap-1.5" role="tablist" aria-label="Demo progress">
          {STEPS.map((st, idx) => (
            <button
              key={st.phase}
              type="button"
              aria-label={`Go to ${st.phase}`}
              onClick={() => go(idx)}
              className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-[#E8E3F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C4DD6]"
            >
              <span
                className={`absolute inset-0 origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none ${
                  idx < i ? 'scale-x-100 bg-[#42574E]' : idx === i ? 'scale-x-100 bg-[#7C4DD6]' : 'scale-x-0 bg-[#42574E]'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Step card */}
        <div className="overflow-hidden rounded-[20px] border border-[#E8E3F2] bg-white shadow-[0_12px_40px_-12px_rgba(46,16,80,0.28)]">
          <div className="h-[5px] w-full bg-gradient-to-r from-[#42574E] to-[#7C4DD6]" />
          <div className={present ? 'p-10' : 'p-6'}>
            <div className="mb-3.5 flex items-center gap-3">
              <div style={SERIF} className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-[#42574E] text-[13px] font-bold text-white">
                {i + 1}
              </div>
              <div className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#7C4DD6]">{s.phase}</div>
              {!present && <div className="ml-auto text-[12px] font-medium text-[#4B4458]">{s.kicker}</div>}
            </div>

            <h2 style={SERIF} className={`mb-4 font-bold leading-[1.12] tracking-[-0.02em] ${present ? 'text-[30px]' : 'text-[23px]'}`}>
              {s.title}
            </h2>

            {/* Do this */}
            <div className="mb-4 flex gap-3 rounded-[13px] bg-[#F3EDFD] p-[14px_15px]">
              <div className="mt-0.5 grid h-[26px] w-[26px] flex-none place-items-center rounded-lg bg-[#42574E] text-[14px] text-white" aria-hidden>
                ▷
              </div>
              <div className={present ? 'text-[17px]' : 'text-[14.5px]'}>
                <span className="mb-0.5 block text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#7C4DD6]">Do this</span>
                <span {...html(s.do)} />
              </div>
            </div>

            {/* Say bubble */}
            <div className={`relative my-1.5 rounded-[15px] bg-[#16121F] p-[17px_18px_16px] leading-[1.5] text-white ${present ? 'text-[19px]' : 'text-[15.5px]'}`}>
              <span className="absolute -top-[9px] left-[26px] border-x-[9px] border-b-[9px] border-x-transparent border-b-[#16121F]" aria-hidden />
              <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#B79AEC]">Say — word for word</span>
              <span>{s.say}</span>
            </div>

            {/* Coach-only: note, fallback, capture-after */}
            {!present && s.note && (
              <div className="mt-3.5 border-l-2 border-[#E8E3F2] pl-3.5 text-[13px] text-[#4B4458]" {...html(s.note)} />
            )}
            {!present && s.fallback && (
              <div className="mt-3.5 border-l-2 border-[#E8E3F2] pl-3.5 text-[13px] text-[#4B4458]">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#7C4DD6]">Coach only</span>
                <span {...html(s.fallback)} />
              </div>
            )}
            {!present && s.watch && (
              <div className="mt-3.5 flex gap-2.5 rounded-[11px] bg-[#FDF4E3] p-[11px_13px] text-[13px] text-[#6B4410]">
                <span aria-hidden>👁</span>
                <div>
                  <b className="text-[#B45309]">Capture after:</b> {s.watch}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => go(i - 1)}
            disabled={i === 0}
            className="inline-flex items-center gap-2 rounded-[11px] border border-[#E8E3F2] bg-white px-5 py-3 text-[14.5px] font-semibold transition hover:border-[#7C4DD6] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C4DD6]"
          >
            ← Back
          </button>
          <span className="mx-auto text-[13px] font-medium text-[#4B4458]">{i + 1} of {STEPS.length}</span>
          {i === STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => go(0)}
              className="inline-flex items-center gap-2 rounded-[11px] border border-[#42574E] bg-[#42574E] px-5 py-3 text-[14.5px] font-semibold text-white shadow-sm transition hover:bg-[#4C1A9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C4DD6]"
            >
              Run it again ↺
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go(i + 1)}
              className="inline-flex items-center gap-2 rounded-[11px] border border-[#42574E] bg-[#42574E] px-5 py-3 text-[14.5px] font-semibold text-white shadow-sm transition hover:bg-[#4C1A9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C4DD6]"
            >
              Next →
            </button>
          )}
        </div>

        {/* Panic strip (coach only) */}
        {!present && (
          <div className="mt-6 rounded-[14px] border border-dashed border-[#E8E3F2] bg-white/60 p-[16px_18px]">
            <h3 style={SERIF} className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.04em] text-[#4B4458]">
              If you freeze — the entire demo in 3 sentences
            </h3>
            <ol className="grid gap-[7px]">
              {PANIC.map((line, idx) => (
                <li key={idx} className="flex gap-2.5 text-[14px]">
                  <span className="grid h-[19px] w-[19px] flex-none place-items-center rounded-md bg-[#42574E] text-[11px] font-bold text-white">
                    {idx + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Debrief link (coach only) */}
        {!present && (
          <div className="mt-5 text-center">
            <a href="/company-demo/debrief" className="text-[13px] font-semibold text-[#42574E] underline underline-offset-2">
              After the call → log the debrief
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
