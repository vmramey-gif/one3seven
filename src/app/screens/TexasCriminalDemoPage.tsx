/**
 * Texas criminal-defense intake demo — a guided, click-through simulation of the
 * one3seven intake flow themed for a criminal-defense client (Harris County).
 *
 * PURPOSE: a tangible "here's what it does for criminal intakes" walkthrough to show
 * a defense attorney. Presentation only — sample data, no real records.
 *
 * HARD RULE (criminal context): one3seven ORGANIZES AND REFLECTS. It must never
 * assess guilt or innocence, weigh evidence, or suggest a defense strategy. All copy
 * here stays strictly organizational; the attorney evaluates everything.
 *
 * Accessible via /tx-demo or /?tx-demo.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, ArrowLeft, CheckCircle2, Shield, FileText, MessageSquare,
  Image, Scale, Gavel, Landmark, IdCard, Search, Lock,
} from 'lucide-react';
import { OneThreeSevenLoader } from '../components/ui/OneThreeSevenLoader';

type Phase = 'intro' | 'intake' | 'processing' | 'summary';

// ── Sample client data (Harris County) — fictional, for demonstration ──────────
const CLIENT = 'Daniel Alvarez';
const MATTER = 'DWI — first offense (alleged) · Harris County';

const STORY_TEXT =
  "I got pulled over on the Gulf Freeway late on March 8th coming home from a friend's place. The officer said I rolled a stop sign. They had me do some roadside tests and then arrested me for DWI. I was booked overnight and my brother posted bond the next morning. I have the bond paperwork and a citation with a court date, and I saved some texts from that night. I don't really understand what all the paperwork means or what happens next.";

// Helpful-details set for a criminal intake (client-reported, optional, never assumed).
const KEY_FACTS = [
  { label: 'Full legal name', answer: 'Daniel Alvarez' },
  { label: 'County / court', answer: 'Harris County, TX — County Criminal Court' },
  { label: 'Charge as written on paperwork', answer: 'Driving While Intoxicated (DWI), first offense' },
  { label: 'Date of arrest', answer: 'March 8, 2026 (late evening)' },
  { label: 'Arresting agency', answer: 'Texas DPS — traffic stop, Gulf Freeway' },
  { label: 'Custody / release status', answer: 'Released on bond, March 9, 2026' },
  { label: 'Next court date on file', answer: 'April 21, 2026 — arraignment' },
  { label: 'Tests mentioned by client', answer: 'Roadside field sobriety; client unsure about a breath test' },
  { label: 'Any prior record (client-reported)', answer: 'None reported' },
  { label: 'Witnesses the client recalls', answer: 'Passenger — friend, name on hand' },
];

type DemoDoc = { icon: typeof FileText; label: string; cat: string; size: string; recovered?: string };
const DOCS: DemoDoc[] = [
  { icon: Gavel, label: 'Citation / charging notice — Mar 8', cat: 'Court Documents', size: '142 KB' },
  { icon: FileText, label: 'Bond paperwork & release — Mar 9', cat: 'Bond & Release', size: '210 KB' },
  { icon: FileText, label: 'Booking sheet', cat: 'Arrest Records', size: '96 KB' },
  { icon: FileText, label: 'Offense / arrest report', cat: 'Arrest Records', size: '388 KB', recovered: 'Requested from agency' },
  { icon: Landmark, label: 'Notice of court date — arraignment', cat: 'Court Documents', size: '74 KB' },
  { icon: IdCard, label: "Driver's license", cat: 'Identity', size: '120 KB' },
  { icon: MessageSquare, label: 'Text messages — night of Mar 8', cat: 'Communications', size: '301 KB' },
  { icon: Image, label: 'Photos from the scene', cat: 'Communications', size: '1.4 MB' },
  { icon: FileText, label: 'Employer / character letter', cat: 'Personal Records', size: '88 KB' },
];

const PROCESSING_STEPS = [
  'Files received',
  'Reviewing records',
  'Connecting account to records',
  'Organizing by date',
  'Building the timeline',
  'Surfacing missing information',
  'Preparing review packet',
];

const TIMELINE = [
  { date: 'Mar 8, 2026 · ~11pm', label: 'Traffic stop', detail: 'Stop on the Gulf Freeway; client states officer cited a rolled stop sign.', tag: "From client's account", gap: false },
  { date: 'Mar 8, 2026', label: 'Field sobriety tests & arrest', detail: 'Roadside tests administered; client arrested for DWI.', tag: 'From citation', gap: false },
  { date: 'Mar 8–9, 2026', label: 'Booking', detail: 'Held overnight; booking sheet on file.', tag: 'From booking sheet', gap: false },
  { date: 'Mar 9, 2026', label: 'Bond posted — released', detail: 'Bond paperwork shows release the following morning.', tag: 'From bond docs', gap: false },
  { date: 'Pending', label: 'Breath/blood test result', detail: 'Client unsure whether a breath test occurred; no result in the file yet.', tag: 'Not in record', gap: true },
  { date: 'Apr 21, 2026', label: 'Arraignment', detail: 'Next court date per the notice on file.', tag: 'From court notice', gap: false },
];

const ORGANIZED_SUMMARY =
  "According to the client's account and the records provided, Daniel Alvarez was arrested following a traffic stop in Harris County on March 8, 2026, charged with a first-offense DWI, booked overnight, and released on bond the next morning. The file currently includes the citation, bond paperwork, a booking sheet, a notice of an April 21 arraignment, and messages and photos from that night. These records are organized for attorney review and may require confirmation against the source documents.";

const AREAS = ['Traffic Stop', 'Arrest & Booking', 'Bond & Release', 'Upcoming Court Date'];

const SUGGESTIONS = [
  'Dashcam / bodycam footage from the stop is not yet in the file — a records request may help complete it.',
  'Breath or blood test result and the testing-device maintenance records are not present.',
  'Passenger / witness contact information would help complete the account.',
];

// ── Page ───────────────────────────────────────────────────────────────────────
export function TexasCriminalDemoPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [procStep, setProcStep] = useState(0);

  useEffect(() => {
    if (phase !== 'processing') return;
    setProcStep(0);
    const stepMs = 520;
    const iv = setInterval(() => setProcStep((s) => Math.min(s + 1, PROCESSING_STEPS.length)), stepMs);
    const done = setTimeout(() => setPhase('summary'), stepMs * (PROCESSING_STEPS.length + 1));
    return () => { clearInterval(iv); clearTimeout(done); };
  }, [phase]);

  const cats = Array.from(new Set(DOCS.map((d) => d.cat)));

  return (
    <div className="min-h-screen bg-[#FAF9FE] text-[#14112E]">
      <nav className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/92 px-5 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-[15px] font-bold tracking-tight">one<span className="font-black text-[#42574E]">3</span>seven</span>
          <span className="rounded-full bg-[#EDE7FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#42574E]">TX criminal · demo</span>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <AnimatePresence mode="wait">
          {/* INTRO */}
          {phase === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center">
              <Scale className="mx-auto mb-5 h-10 w-10 text-[#42574E]" />
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-2xl font-medium leading-snug">
                This is {CLIENT}.
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#14112E]/70">
                Days after an arrest in Harris County, his life is a stack of paperwork he doesn't understand —
                a citation, bond documents, a court date he's afraid to miss. Here's how one3seven helps him walk
                into a defense attorney's office <span className="font-semibold text-[#14112E]">organized</span> instead of overwhelmed.
              </p>
              <button onClick={() => setPhase('intake')} className="mt-7 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#42574E] px-6 text-sm font-semibold text-white hover:bg-[#4C1D96]">
                See the intake <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-5 text-[11px] text-[#14112E]/40">Sample data for demonstration. one3seven is not a law firm and does not provide legal advice.</p>
            </motion.div>
          )}

          {/* INTAKE */}
          {phase === 'intake' && (
            <motion.div key="intake" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <Section title="His story, in his own words">
                <p className="rounded-[14px] border border-violet-100 bg-white p-4 text-[14px] leading-relaxed text-[#14112E]/80">{STORY_TEXT}</p>
              </Section>

              <Section title="What he has">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DOCS.map((d) => (
                    <div key={d.label} className="flex items-center gap-3 rounded-[12px] border border-violet-100 bg-white p-3">
                      <d.icon className="h-4 w-4 shrink-0 text-[#42574E]" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{d.label}</p>
                        <p className="text-[11px] text-[#14112E]/45">{d.cat} · {d.size}{d.recovered ? ` · ${d.recovered}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="A few details — only what he knows">
                <div className="overflow-hidden rounded-[14px] border border-violet-100 bg-white">
                  {KEY_FACTS.map((f, i) => (
                    <div key={f.label} className={`flex flex-col gap-0.5 px-4 py-2.5 ${i ? 'border-t border-violet-50' : ''}`}>
                      <span className="text-[11px] font-medium text-[#14112E]/45">{f.label}</span>
                      <span className="text-[13px] text-[#14112E]/85">{f.answer}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <div className="flex items-center justify-between">
                <button onClick={() => setPhase('intro')} className="inline-flex items-center gap-1 text-sm font-medium text-[#14112E]/55 hover:text-[#14112E]"><ArrowLeft className="h-4 w-4" /> Back</button>
                <button onClick={() => setPhase('processing')} className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#42574E] px-6 text-sm font-semibold text-white hover:bg-[#4C1D96]">
                  Organize this <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* PROCESSING */}
          {phase === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-10 text-center">
              <OneThreeSevenLoader />
              <p className="mt-6 text-[15px] font-semibold">Organizing the file…</p>
              <div className="mx-auto mt-5 max-w-xs space-y-2 text-left">
                {PROCESSING_STEPS.map((s, i) => (
                  <div key={s} className={`flex items-center gap-2 text-[13px] transition ${i < procStep ? 'text-[#14112E]' : 'text-[#14112E]/30'}`}>
                    {i < procStep ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <div className="h-4 w-4 rounded-full border border-[#14112E]/20" />}
                    {s}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* SUMMARY */}
          {phase === 'summary' && (
            <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="rounded-[16px] border border-violet-100 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#42574E]">What the attorney receives</p>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mt-1 text-xl font-medium">{CLIENT}</h2>
                <p className="text-[12px] text-[#14112E]/50">{MATTER}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-[#14112E]/75">{ORGANIZED_SUMMARY}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {AREAS.map((a) => <span key={a} className="rounded-full bg-[#F3EEFF] px-2.5 py-1 text-[11px] font-semibold text-[#42574E]">{a}</span>)}
                </div>
              </div>

              <Section title="Timeline">
                <div className="space-y-3">
                  {TIMELINE.map((t) => (
                    <div key={t.label} className="flex gap-3 rounded-[12px] border border-violet-100 bg-white p-3">
                      <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${t.gap ? 'bg-amber-400' : 'bg-[#42574E]'}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-bold">{t.label}</span>
                          <span className="text-[11px] text-[#14112E]/45">{t.date}</span>
                          {t.tag && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.gap ? 'bg-amber-50 text-amber-700' : 'bg-[#F3EEFF] text-[#42574E]'}`}>{t.tag}</span>}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-[#14112E]/65">{t.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Documents — categorized & source-linked">
                <div className="space-y-3">
                  {cats.map((c) => (
                    <div key={c}>
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#14112E]/45">{c}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {DOCS.filter((d) => d.cat === c).map((d) => (
                          <span key={d.label} className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-2.5 py-1 text-[11px] font-medium">
                            <d.icon className="h-3 w-3 text-[#42574E]" /> {d.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Additional information that may help">
                <ul className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s} className="flex gap-2 rounded-[12px] border border-amber-100 bg-amber-50/50 p-3 text-[12px] leading-relaxed text-[#14112E]/75">
                      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> {s}
                    </li>
                  ))}
                </ul>
              </Section>

              {/* The discipline line — non-negotiable in a criminal context */}
              <div className="rounded-[16px] border border-[#42574E]/20 bg-[#F2F4EC] p-5">
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-[#42574E]" /><p className="text-[13px] font-bold text-[#42574E]">one3seven organizes and reflects.</p></div>
                <p className="mt-2 text-[12px] leading-relaxed text-[#14112E]/70">
                  It does not assess guilt or innocence, weigh the evidence, or suggest a defense strategy. It organizes the
                  record so the attorney opens a structured file — every decision stays with the attorney.
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#14112E]/45"><Lock className="h-3 w-3" /> Sample data. Not a law firm. Not legal advice.</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button onClick={() => setPhase('intro')} className="inline-flex items-center gap-1 text-sm font-medium text-[#14112E]/55 hover:text-[#14112E]"><ArrowLeft className="h-4 w-4" /> Start over</button>
                <span className="text-[12px] font-medium text-[#14112E]/45">Scattered paperwork in → a clear file out.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#14112E]/55">{title}</h3>
      {children}
    </section>
  );
}
