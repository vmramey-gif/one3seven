/**
 * Fire worker demo — guided simulation of the real one3seven 3-step intake flow,
 * themed for a fire-displaced employee (Tracy / Medline warehouse fire).
 *
 * A "better" sibling of WorkerDemoPage: adds an opening empathy beat, the live
 * reassurance line, the "Don't have your records handy?" sourcing helper (with a
 * recovered-record payoff), a settlement-pressure beat, and the "Where these
 * records can go" attorney handoff. Employment-only. No legal conclusions.
 *
 * Accessible via /fire-demo or /?fire-demo. Click-through with Marcus Reyes's data.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, ArrowLeft, CheckCircle2, Shield, FileText,
  MessageSquare, Image, AlertTriangle, Download,
  Lock, Eye, Mic, ChevronDown, ChevronUp, Upload, Flame, Scale, Search, Users,
} from 'lucide-react';
import { OneThreeSevenLoader } from '../components/ui/OneThreeSevenLoader';

type Phase = 'intro' | 'intake' | 'processing' | 'summary' | 'dashboard' | 'control';
const INTAKE_STEPS = 3;

// ── Marcus Reyes data (Tracy / Medline fire) ────────────────────────────────────

const STORY_TEXT =
  "I worked at the Medline warehouse in Tracy for almost four years. For most of it I was missing overtime and barely getting meal breaks — I've got some pay stubs that show it. In March 2025 I finally filed a complaint with HR. A few weeks later I was passed over for a promotion and a written warning showed up on my file. Then on June 11th the warehouse burned down and the job was just gone. Now Medline is offering me a settlement with a release I'm supposed to sign — and I lost a lot of my paperwork in everything that happened. I don't even know what I still have.";

// The real product's helpful-details set (employment intake) — 13 fields, matching
// UploadScreen's follow-up section and its "Intake Completeness — X of 13" counter.
// The settlement offer is NOT an intake question in the real product; it is a record
// (an uploaded document) and surfaces in the timeline, not here.
const OPTIONAL_FIELDS = [
  { label: 'Full Name Used During Employment', answer: 'Marcus Reyes' },
  { label: 'What employer or organization are these records connected to?', answer: 'Medline Industries — Tracy Distribution Center' },
  { label: 'Approximate employment dates?', answer: 'June 2022 – June 11, 2026 (warehouse fire)' },
  { label: 'Are there key people involved?', answer: 'Supervisor Dana Kimura · HR Manager Rob Pacheco' },
  { label: 'Were you working remotely at any point?', answer: 'No — on-site warehouse work' },
  { label: 'Did you use your own phone, internet, vehicle, equipment, tools, or supplies for work?', answer: 'Sometimes used my own phone for shift coordination' },
  { label: 'Were you reimbursed?', answer: 'No reimbursement received' },
  { label: 'Did you complain, report something, or ask HR/management for help?', answer: 'Yes — emailed HR a formal complaint March 14, 2025' },
  { label: 'Did anything change afterward?', answer: 'Passed over for promotion · written warning weeks later' },
  { label: 'In what state did you primarily work?', answer: 'California' },
  { label: 'Are you currently employed there, or has employment ended?', answer: 'Employment ended — warehouse fire, June 11, 2026' },
  { label: 'Do you recall signing an arbitration agreement?', answer: 'Not sure — no copy on hand' },
  { label: 'Have you filed a complaint with any agency?', answer: 'Not yet' },
];

type DemoDoc = {
  icon: typeof FileText; label: string; cat: string;
  color: string; bg: string; border: string; size: string; recovered?: string;
};

const DOCS: DemoDoc[] = [
  { icon: FileText, label: 'Pay stub — Jan 2025', cat: 'Wage Records', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', size: '281 KB' },
  { icon: FileText, label: 'Pay stub — Mar 2025', cat: 'Wage Records', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', size: '288 KB' },
  { icon: FileText, label: 'Wage & work history — EDD', cat: 'Wage Records', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', size: '402 KB', recovered: 'Recovered via EDD' },
  { icon: MessageSquare, label: 'HR complaint email — Mar 14 2025', cat: 'HR Communications', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', size: '76 KB', recovered: 'Saved from email' },
  { icon: FileText, label: 'Written warning — Apr 2025', cat: 'Employer Documents', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', size: '118 KB' },
  { icon: Image, label: 'Schedule screenshot — 2024', cat: 'Time Records', color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', size: '1.1 MB' },
  { icon: MessageSquare, label: 'Text messages — supervisor', cat: 'Communications', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', size: '326 KB' },
  { icon: FileText, label: 'Performance review — 2024', cat: 'Employer Documents', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', size: '197 KB' },
  { icon: FileText, label: 'Offer letter — June 2022', cat: 'Employment Records', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', size: '160 KB', recovered: 'Saved from email' },
  { icon: Scale, label: 'Settlement offer & release — Jun 15 2026', cat: 'Employer Documents', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', size: '233 KB' },
  { icon: FileText, label: 'Final paycheck stub', cat: 'Wage Records', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', size: '184 KB' },
];

const PROCESSING_STEPS = [
  'Files received',
  'Reviewing records',
  'Connecting story to records',
  'Organizing by timeline',
  'Building chronology',
  'Surfacing missing information',
  'Preparing review packet',
];

const TIMELINE = [
  { date: 'June 2022', label: 'Employment begins', detail: 'Warehouse associate role at Medline — Tracy Distribution Center.', dot: 'bg-slate-400', tag: null, gap: false },
  { date: '2023 – 2024', label: 'Wage discrepancies identified', detail: 'Pay records and EDD history show overtime and meal-break gaps across multiple pay periods.', dot: 'bg-amber-400', tag: 'From pay records', gap: false },
  { date: 'Mar 14, 2025', label: 'Formal HR complaint filed', detail: 'Written complaint regarding overtime and meal breaks emailed to HR.', dot: 'bg-blue-500', tag: 'From HR email', gap: false },
  { date: 'Apr 2025', label: 'Written warning issued', detail: "Warning cites 'attitude' — not reflected in the 2024 performance review on file.", dot: 'bg-orange-500', tag: 'Weeks after complaint', gap: true },
  { date: 'June 11, 2026', label: 'Warehouse fire — employment ends', detail: 'Tracy facility destroyed by fire. Role ended.', dot: 'bg-red-500', tag: null, gap: false },
  { date: 'June 15, 2026', label: 'Settlement offer received', detail: 'Settlement offer with a release presented for signature.', dot: 'bg-red-600', tag: '4 days after the fire', gap: true },
];

const ORGANIZED_SUMMARY =
  "According to the worker's account and supporting records, Marcus Reyes was employed as a warehouse associate at Medline's Tracy Distribution Center from June 2022 until the facility fire on June 11, 2026. Records currently reflect pay-related discrepancies across 2023–2024, a formal HR complaint dated March 14, 2025, a written warning weeks later, and a settlement offer with a release dated June 15, 2026. These records are organized for attorney review and may require confirmation against the source files.";

const CONCERNS = ['Wage & Hour', 'Employment Separation', 'After Raising a Concern', 'Settlement Offer on File'];

const SUGGESTIONS = [
  'Earlier pay records (2022–2023) may help complete the wage timeline — EDD or prior tax records can help',
  'Promotion decision communications not yet in record',
  'A copy of any signed acknowledgments or agreements would help complete the file',
];

// ── Shared components ─────────────────────────────────────────────────────────

function NavBar({ step, phase, onBack, onSignUp }: { step: number; phase: Phase; onBack: () => void; onSignUp: () => void }) {
  const inIntake = phase === 'intake';
  return (
    <nav className="sticky top-0 z-50 border-b border-violet-100/80 bg-white/92 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
        <div className="flex items-center gap-3">
          {inIntake && step > 1 && (
            <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-[#14112E]/55 transition hover:bg-[#F5F1FB] hover:text-[#14112E]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          <span className="text-[15px] font-bold tracking-tight text-[#14112E]">
            one<span className="font-black text-[#5B21B6]">3</span>seven
          </span>
        </div>
        <div className="flex items-center gap-4">
          {inIntake && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: INTAKE_STEPS }).map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i < step ? 'bg-[#5B21B6]' : 'bg-[#5B21B6]/15'} ${i === step - 1 ? 'w-6' : 'w-3'}`} />
              ))}
            </div>
          )}
          <button type="button" onClick={onSignUp} className="rounded-full border border-[#5B21B6]/30 px-4 py-1.5 text-xs font-semibold text-[#5B21B6] transition hover:bg-[#F5F1FB]">
            Sign up free
          </button>
        </div>
      </div>
    </nav>
  );
}

function NextButton({ onClick, label = 'Continue', disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(109,74,255,0.25)] transition ${disabled ? 'cursor-not-allowed bg-[#5B21B6]/30' : 'bg-[#5B21B6] hover:bg-[#4C1D96] hover:-translate-y-0.5'}`}
    >
      {label} <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function StepLabel({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="mb-6">
      <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#5B21B6]">Step {step} of {total}</div>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[24px] font-medium leading-tight tracking-[-0.01em] text-[#14112E] sm:text-[27px]">{title}</h2>
    </div>
  );
}

function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setStarted(true), delay); return () => clearTimeout(t); }, [delay]);
  useEffect(() => {
    if (!started) return;
    let n = 0;
    const iv = setInterval(() => { n = Math.min(n + Math.max(1, Math.ceil(to / 40)), to); setCount(n); if (n >= to) clearInterval(iv); }, 30);
    return () => clearInterval(iv);
  }, [started, to]);
  return <>{count}</>;
}

// ── Intro: empathy beat ───────────────────────────────────────────────────────

function IntroBeat({ onNext }: { onNext: () => void }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  return (
    <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">
        <Flame className="h-3.5 w-3.5" /> After the fire
      </div>
      <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mb-4 text-[28px] font-medium leading-tight tracking-[-0.01em] text-[#14112E] sm:text-[32px]">
        When everything is already hard, this part shouldn&apos;t be.
      </h1>
      <p className="mb-4 text-[15px] leading-relaxed text-[#14112E]/65">
        After a workplace fire, the job is gone — and so is the order of things. Records are scattered or lost.
        A settlement offer can arrive before you&apos;ve had a chance to understand any of it.
      </p>
      <p className="mb-8 text-[15px] leading-relaxed text-[#14112E]/65">
        This is a walk-through of how one3seven helps a worker named <span className="font-semibold text-[#14112E]">Marcus</span> organize
        what he has — and find what he lost — into one clear picture he can take to an attorney.
      </p>
      <div className="mb-8 rounded-[16px] border border-[#ECE7F5] bg-[#F5F1FB] p-5">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5B21B6]" />
          <p className="text-[13px] leading-relaxed text-[#14112E]/70">
            You don&apos;t have to do this all at once. one3seven organizes records and reflects a timeline —
            it does not give legal advice or decide what a situation means.
          </p>
        </div>
      </div>
      <NextButton onClick={onNext} label="See how it works" />
    </motion.div>
  );
}

// ── Step 1 of 3: Tell us what happened ────────────────────────────────────────

function Step1Story({ onNext }: { onNext: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let i = 0;
    ivRef.current = setInterval(() => {
      i++;
      setDisplayed(STORY_TEXT.slice(0, i));
      if (i >= STORY_TEXT.length) { if (ivRef.current) clearInterval(ivRef.current); setDone(true); }
    }, 12);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  // Let an impatient worker jump straight to the records step — don't make them wait
  // for the typing animation to finish.
  const finishNow = () => {
    if (ivRef.current) clearInterval(ivRef.current);
    setDisplayed(STORY_TEXT);
    setDone(true);
  };

  return (
    <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <StepLabel step={1} total={3} title="Tell us what happened" />
      <p className="mb-3 text-[14px] leading-relaxed text-[#14112E]/55">
        Use your own words. There are no wrong answers. You can add records in the next step.
      </p>

      {/* Live reassurance line */}
      <div className="mb-6 rounded-[12px] border border-[#ECE7F5] bg-[#FAF9F6] px-4 py-3 text-[13px] leading-relaxed text-[#14112E]/70">
        You don&apos;t have to do this all at once. Share what you have now — you can come back and add more anytime.
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#ECE7F5] bg-white px-3 py-1.5 text-xs font-semibold text-[#5B21B6]">
          <span className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <Mic className="h-3.5 w-3.5" />
          {done ? 'Story captured' : 'Marcus is speaking…'}
        </div>
        {!done && (
          <button type="button" onClick={finishNow} className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#5B21B6] underline-offset-2 transition hover:bg-[#F5F1FB] hover:underline">
            Skip to records ▸
          </button>
        )}
      </div>

      <div className="mb-6 min-h-[150px] w-full rounded-[18px] border border-[#ECE7F5] bg-[#FAF9F6] p-5 text-[14px] leading-relaxed text-[#14112E]">
        {displayed}
        {!done && <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-[#5B21B6] align-middle" />}
      </div>

      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <NextButton onClick={onNext} label="Add records" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Step 2 of 3: Add records (with sourcing helper) ──────────────────────────

function Step2Records({ onNext }: { onNext: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const [progress, setProgress] = useState<number[]>(Array(DOCS.length).fill(0));
  const [helperOpen, setHelperOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let docIdx = 0;
    const uploadNext = () => {
      if (docIdx >= DOCS.length) return;
      const current = docIdx++;
      setRevealed(r => r + 1);
      let pct = 0;
      const fill = setInterval(() => {
        pct = Math.min(pct + 8 + Math.random() * 12, 100);
        setProgress(prev => { const n = [...prev]; n[current] = pct; return n; });
        if (pct >= 100) { clearInterval(fill); setTimeout(uploadNext, 240); }
      }, 45);
    };
    setTimeout(uploadNext, 500);
  }, []);

  const allDone = revealed >= DOCS.length && (progress[DOCS.length - 1] ?? 0) >= 100;

  return (
    <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <StepLabel step={2} total={3} title="Add records" />
      <p className="mb-5 text-[14px] leading-relaxed text-[#14112E]/55">
        Upload anything relevant — pay stubs, emails, write-ups, HR complaints, schedules. PDFs work best. No legal knowledge needed.
      </p>

      {/* Sourcing helper — for workers who lost records */}
      <div className="mb-5 overflow-hidden rounded-[14px] border border-[#ECE7F5] bg-white">
        <button type="button" onClick={() => setHelperOpen(o => !o)} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
          <span className="flex items-center gap-2 text-[13px] font-bold text-[#5B21B6]">
            <Search className="h-4 w-4" /> Don&apos;t have your records handy?
          </span>
          {helperOpen ? <ChevronUp className="h-4 w-4 text-[#14112E]/40" /> : <ChevronDown className="h-4 w-4 text-[#14112E]/40" />}
        </button>
        <AnimatePresence>
          {helperOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
              <div className="border-t border-[#ECE7F5] px-4 pb-4 pt-3">
                <p className="mb-2.5 text-[12px] leading-relaxed text-[#14112E]/60">Many work records can still be found even if you lost the originals:</p>
                <ul className="space-y-1.5">
                  {[
                    'Pay stubs and W-2s — often in your employer’s HR or payroll portal, or with past tax returns (irs.gov).',
                    'Wage and work history — available through your EDD online account (edd.ca.gov).',
                    'Emails and termination letters — check your email inbox and saved messages.',
                    'Text messages — most phones can save or print a conversation as a PDF.',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
                      <span className="text-[12px] leading-snug text-[#14112E]/65">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed text-[#14112E]/40">Uploads need to be PDFs. A screenshot, photo, or email can be saved or printed as a PDF before uploading.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drop zone */}
      <div className="mb-5 flex flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[#ECE7F5] bg-[#FAF9F6] py-7">
        <Upload className="h-7 w-7 text-[#5B21B6]/40" />
        <span className="text-[13px] font-semibold text-[#5B21B6]">Drop files here, or click to browse</span>
        <span className="text-[11px] text-[#14112E]/35">PDF preferred · one3seven organizes the rest</span>
      </div>

      <div className="mb-4 space-y-1.5">
        {DOCS.map((doc, i) => {
          const visible = i < revealed;
          const pct = Math.round(progress[i] ?? 0);
          const complete = pct >= 100;
          return (
            <AnimatePresence key={doc.label}>
              {visible && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className={`rounded-[12px] border ${doc.border} ${doc.bg} px-3.5 py-2.5`}>
                  <div className="flex items-center gap-2.5">
                    <doc.icon className={`h-3.5 w-3.5 shrink-0 ${doc.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-[#14112E] truncate">{doc.label}</span>
                        <span className="shrink-0 text-[10px] text-[#14112E]/40">{doc.size}</span>
                      </div>
                      {!complete && (
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/60">
                          <div className={`h-full rounded-full transition-all ${doc.color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      {complete && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-[10px] text-[#14112E]/40">{doc.cat}</span>
                          {doc.recovered && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">{doc.recovered}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {complete && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>

      <AnimatePresence>
        {allDone && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="mb-5 rounded-[14px] border border-emerald-200 bg-emerald-50 px-5 py-3">
              <div className="flex items-center gap-2 mb-0.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[13px] font-semibold text-emerald-700">{DOCS.length} records received · 3 recovered from EDD and email</span>
              </div>
              <p className="pl-6 text-[12px] text-emerald-700/65">Records stay private until you decide to share them with a firm.</p>
            </div>
            <NextButton onClick={onNext} label="Add helpful details" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Step 3 of 3: Helpful details — chat bubble Q&A ───────────────────────────

function Step3Details({ onSubmit }: { onSubmit: () => void }) {
  const [visiblePairs, setVisiblePairs] = useState(0);
  const [showAnswer, setShowAnswer] = useState<boolean[]>(Array(OPTIONAL_FIELDS.length).fill(false));
  const started = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const scheduleNext = (idx: number) => {
      if (idx >= OPTIONAL_FIELDS.length) return;
      setTimeout(() => {
        setVisiblePairs(idx + 1);
        setTimeout(() => {
          setShowAnswer(prev => { const n = [...prev]; n[idx] = true; return n; });
          setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            scheduleNext(idx + 1);
          }, 220);
        }, 460);
      }, idx === 0 ? 400 : 0);
    };
    scheduleNext(0);
  }, []);

  const allDone = showAnswer[OPTIONAL_FIELDS.length - 1] === true;
  const pct = Math.round((showAnswer.filter(Boolean).length / OPTIONAL_FIELDS.length) * 100);

  return (
    <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <StepLabel step={3} total={3} title="Helpful details if you know them" />
      <p className="mb-2 text-[14px] leading-relaxed text-[#14112E]/55">
        These optional details help one3seven connect your story to the records you upload.
      </p>

      <div className="sticky top-14 z-10 mb-6 rounded-[14px] border border-[#ECE7F5] bg-white/95 backdrop-blur-sm p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-bold text-[#14112E]">Intake Completeness</span>
          <span className="text-[12px] font-bold text-[#5B21B6]">{showAnswer.filter(Boolean).length} of {OPTIONAL_FIELDS.length}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#ECE7F5]">
          <motion.div className="h-full rounded-full bg-[#5B21B6]" animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
        </div>
        {/* Honest next-step nudge — specific and optional, never a fabricated % or a merits claim */}
        <p className="mt-2 text-[11px] leading-relaxed text-[#14112E]/55">
          {allDone
            ? 'Your record is well-organized and ready to review.'
            : 'Each detail you add helps build a more complete timeline — all optional.'}
        </p>
      </div>

      <div className="mb-6 space-y-3">
        {OPTIONAL_FIELDS.map((f, i) => {
          const questionVisible = i < visiblePairs;
          const answerVisible = showAnswer[i];
          return (
            <div key={f.label}>
              <AnimatePresence>
                {questionVisible && (
                  <motion.div initial={{ opacity: 0, x: -14, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="mb-1.5 flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ECE7F5] bg-[#F5F1FB] mt-0.5">
                      <span className="text-[8px] font-black text-[#5B21B6]">137</span>
                    </div>
                    <div className="max-w-[78%] rounded-[14px] rounded-tl-[4px] border border-[#ECE7F5] bg-white px-4 py-2.5 text-[13px] font-medium text-[#14112E]">
                      {f.label}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {questionVisible && !answerVisible && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="mb-1.5 flex justify-end">
                    <div className="flex items-center gap-1 rounded-[14px] rounded-tr-[4px] bg-[#5B21B6]/10 px-4 py-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#5B21B6]/40" style={{ animation: 'o3s-dot-pulse 1.6s ease-in-out 0ms infinite' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#5B21B6]/40" style={{ animation: 'o3s-dot-pulse 1.6s ease-in-out 0.3s infinite' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#5B21B6]/40" style={{ animation: 'o3s-dot-pulse 1.6s ease-in-out 0.6s infinite' }} />
                    </div>
                    <style>{`@keyframes o3s-dot-pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.75; } }`}</style>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {answerVisible && (
                  <motion.div initial={{ opacity: 0, x: 14, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="mb-0.5 flex justify-end">
                    <div className="max-w-[78%] rounded-[14px] rounded-tr-[4px] bg-[#14112E] px-4 py-2.5 text-[13px] font-medium text-white/90">
                      {f.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />

      <AnimatePresence>
        {allDone && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <NextButton onClick={onSubmit} label="Begin Organizing" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Post-intake: Processing ───────────────────────────────────────────────────

function PostProcessing({ onNext }: { onNext: () => void }) {
  const [completedSteps, setCompletedSteps] = useState(0);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  useEffect(() => {
    let step = 0;
    const iv = setInterval(() => {
      step++;
      setCompletedSteps(step);
      if (step >= PROCESSING_STEPS.length) { clearInterval(iv); setTimeout(onNext, 1000); }
    }, 820);
    return () => clearInterval(iv);
  }, [onNext]);

  return (
    <motion.div key="processing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ECE7F5] bg-[#F5F1FB] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#5B21B6]">
        What one3seven builds from this
      </div>
      <h2 className="mb-8 text-[24px] font-bold leading-tight tracking-tight text-[#14112E]">Organizing your intake</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#ECE7F5] bg-[#FAF9F6] py-8">
          <OneThreeSevenLoader size="lg" />
        </div>
        <div className="flex flex-col justify-center space-y-3 py-2">
          {PROCESSING_STEPS.map((s, i) => {
            const done = i < completedSteps;
            const active = i === completedSteps - 1;
            return (
              <motion.div key={s} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: i * 0.07 }} className="flex items-center gap-2.5">
                <AnimatePresence mode="wait">
                  {done
                    ? <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}><CheckCircle2 className={`h-4 w-4 shrink-0 ${active ? 'text-[#5B21B6]' : 'text-emerald-500'}`} /></motion.div>
                    : <div key="empty" className="h-4 w-4 shrink-0 rounded-full border-2 border-[#ECE7F5]" />
                  }
                </AnimatePresence>
                <span className={`text-[13px] transition-colors ${done ? (active ? 'font-semibold text-[#5B21B6]' : 'font-medium text-[#14112E]') : 'text-[#14112E]/30'}`}>{s}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <p className="mt-8 text-center text-[11px] text-[#14112E]/35">
        one3seven organizes records for attorney review. It does not provide legal advice or determine legal outcomes.
      </p>
    </motion.div>
  );
}

// ── Post-intake: Summary stats ────────────────────────────────────────────────

function PostSummary({ onNext }: { onNext: () => void }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  const stats = [
    { n: DOCS.length, label: 'Documents Organized', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', delay: 0 },
    { n: TIMELINE.length, label: 'Timeline Events', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', delay: 200 },
    { n: SUGGESTIONS.length, label: 'Clarification Needs', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', delay: 400 },
  ];

  return (
    <motion.div key="postsummary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ECE7F5] bg-[#F5F1FB] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#5B21B6]">
        What one3seven builds from this
      </div>
      <div className="mb-2 mt-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <h2 className="text-[24px] font-bold leading-tight tracking-tight text-[#14112E]">Review packet ready</h2>
      </div>
      <p className="mb-7 text-[14px] leading-relaxed text-[#14112E]/55">
        Marcus&apos;s story and records — including the ones recovered after the fire — are organized into a structured intake for attorney review.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {stats.map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: s.delay / 1000 }} className={`rounded-[16px] border ${s.border} ${s.bg} p-4`}>
            <div className={`text-[30px] font-black leading-none ${s.color}`}><CountUp to={s.n} delay={s.delay + 200} /></div>
            <div className={`mt-1 text-[11px] font-semibold leading-tight ${s.color}`}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mb-7 rounded-[16px] border border-[#ECE7F5] bg-white p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-[13px] font-semibold text-[#14112E]">Review Packet Generated</span>
        </div>
        <p className="mt-1.5 pl-6 text-[12px] leading-relaxed text-[#14112E]/55">
          Story, timeline, document checklist, settlement offer on file, and employer response summary — structured for attorney review.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
        <NextButton onClick={onNext} label="View organized intake" />
      </motion.div>
    </motion.div>
  );
}

// ── Post-intake: Organized dashboard ─────────────────────────────────────────

function PostDashboard({ onNext }: { onNext: () => void }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  const [view, setView] = useState<'firm' | 'full'>('firm');
  const [concernsConfirmed, setConcernsConfirmed] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const DOC_CATEGORIES = [
    { label: 'Wage Records', count: 4, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
    { label: 'Employer Documents', count: 3, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'HR Communications', count: 1, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Time Records', count: 1, color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
    { label: 'Communications', count: 1, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Employment Records', count: 1, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
  ];

  const STATUS = ['Story Organized', 'Timeline Created', 'Records Categorized', 'Clarifications Identified', 'Review Packet Ready'];

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ECE7F5] bg-[#F5F1FB] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#5B21B6]">
        What one3seven builds from this
      </div>

      <div className="mb-5 mt-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold leading-tight tracking-tight text-[#14112E]">Marcus Reyes</h2>
          <div className="mt-0.5 text-[13px] text-[#14112E]/50">Medline — Tracy Distribution Center</div>
          <div className="mt-0.5 text-[12px] text-[#14112E]/40">June 2022 – June 11, 2026</div>
        </div>
        <div className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">Organized</div>
      </div>

      {/* Maturity message — matches the real summary screen (IntakeSummaryScreen),
          not the demo-only Readiness band (which is gated behind counsel review). */}
      <div className="mb-5 rounded-[16px] border border-[#ECE7F5] bg-[#F5F1FB] p-5">
        <p className="text-[13px] leading-relaxed text-[#14112E]/80">
          Your story and records have been organized into a timeline and summary.
        </p>
      </div>

      <div className="mb-5 flex rounded-[12px] border border-[#ECE7F5] bg-white p-1">
        {([['firm', 'What Firms See'], ['full', 'Full Review']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setView(key)}
            className={`flex-1 rounded-[9px] py-2 text-[13px] font-semibold transition ${view === key ? 'bg-[#5B21B6] text-white shadow-sm' : 'text-[#14112E]/55 hover:text-[#14112E]'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STATUS.map(s => (
          <div key={s} className="flex items-center gap-2 rounded-[12px] border border-[#ECE7F5] bg-white px-3 py-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="text-[11px] font-semibold text-[#14112E]">{s}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-[16px] border border-[#ECE7F5] bg-[#F5F1FB] p-5">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#5B21B6]">Organized Summary</div>
        <p className="text-[13px] leading-relaxed text-[#14112E]/80">{ORGANIZED_SUMMARY}</p>
      </div>

      <div className="mb-4 rounded-[16px] border border-[#ECE7F5] bg-white p-5">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#14112E]/40">Possible Review Areas</div>
        <div className="mb-4 flex flex-wrap gap-2">
          {CONCERNS.map(c => (
            <span key={c} className="rounded-full border border-[#ECE7F5] bg-[#F5F1FB] px-3 py-1.5 text-[12px] font-semibold text-[#5B21B6]">{c}</span>
          ))}
        </div>
        {!concernsConfirmed ? (
          <div>
            <p className="mb-3 text-[13px] font-medium text-[#14112E]">Does this sound accurate?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConcernsConfirmed(true)}
                className="flex items-center gap-1.5 rounded-full bg-[#5B21B6] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#4C1D96]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Yes, that&apos;s accurate
              </button>
              <button type="button" className="rounded-full border border-[#ECE7F5] px-5 py-2 text-[13px] font-semibold text-[#14112E]/55 transition hover:bg-[#F5F1FB]">
                Not exactly
              </button>
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-[13px] font-semibold text-emerald-700">Noted for attorney review</span>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {view === 'full' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
            <div className="mb-4 rounded-[16px] border border-[#ECE7F5] bg-white overflow-hidden">
              <button type="button" onClick={() => setTimelineOpen(o => !o)} className="flex w-full items-center justify-between px-5 py-4">
                <span className="text-[13px] font-bold text-[#14112E]">Timeline Preview</span>
                {timelineOpen ? <ChevronUp className="h-4 w-4 text-[#14112E]/40" /> : <ChevronDown className="h-4 w-4 text-[#14112E]/40" />}
              </button>
              <AnimatePresence>
                {timelineOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-[#ECE7F5] px-5 pb-4 pt-3 space-y-1">
                      {TIMELINE.map((e, i) => (
                        <div key={e.date} className="flex gap-3">
                          <div className="flex flex-col items-center pt-1.5">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${e.dot}`} />
                            {i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-[#ECE7F5] mt-1" style={{ minHeight: 20 }} />}
                          </div>
                          <div className="pb-3 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-bold text-[#14112E]/40">{e.date}</span>
                              {e.tag && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${e.gap ? 'bg-red-100 text-red-600' : 'bg-[#F5F1FB] text-[#5B21B6]'}`}>{e.tag}</span>}
                            </div>
                            <div className="text-[12px] font-semibold text-[#14112E]">{e.label}</div>
                            <div className="text-[11px] leading-relaxed text-[#14112E]/50 mt-0.5">{e.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mb-4 rounded-[16px] border border-[#ECE7F5] bg-white overflow-hidden">
              <button type="button" onClick={() => setDocsOpen(o => !o)} className="flex w-full items-center justify-between px-5 py-4">
                <span className="text-[13px] font-bold text-[#14112E]">Document Categories</span>
                {docsOpen ? <ChevronUp className="h-4 w-4 text-[#14112E]/40" /> : <ChevronDown className="h-4 w-4 text-[#14112E]/40" />}
              </button>
              <AnimatePresence>
                {docsOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-[#ECE7F5] px-5 pb-4 pt-3 grid grid-cols-2 gap-2">
                      {DOC_CATEGORIES.map(c => (
                        <div key={c.label} className={`rounded-[12px] border ${c.border} ${c.bg} px-3 py-2.5`}>
                          <div className={`text-[15px] font-black leading-none ${c.color}`}>{c.count}</div>
                          <div className={`mt-0.5 text-[11px] font-semibold ${c.color}`}>{c.label}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mb-4 rounded-[16px] border border-amber-200 bg-amber-50 p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-[12px] font-bold text-amber-800">Additional Information May Help</span>
              </div>
              <ul className="space-y-1.5">
                {SUGGESTIONS.map(s => <li key={s} className="text-[12px] leading-relaxed text-amber-800/75">· {s}</li>)}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Where these records can go — attorney handoff (employment-only) */}
      <div className="mb-2 rounded-[16px] border border-[#ECE7F5] bg-white p-5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5B21B6]">Where these records can go</div>
        <p className="text-[13px] leading-relaxed text-[#14112E]/70">
          Records about your job, pay, and how you were treated at work may be reviewed by an employment attorney.
          one3seven organizes them — it doesn&apos;t decide what your situation means. It shows you who to bring this to.
        </p>
      </div>

      <div className="mt-5">
        <NextButton onClick={onNext} label="Review worker controls" />
      </div>
    </motion.div>
  );
}

// ── Post-intake: Worker control + settlement beat ───────────────────────────

function PostControl({ onSignUp }: { onSignUp: () => void }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  const actions = [
    { icon: Download, label: 'Download Intake Packet', sub: 'A clean PDF: story, timeline, and records — yours to keep.', primary: true },
    { icon: Eye, label: 'Preview Firm View', sub: 'See exactly what a firm sees before you approve access.', primary: false },
    { icon: Shield, label: 'Approve Firm Access', sub: 'Grant a firm you choose access to your organized intake.', primary: false },
    { icon: Users, label: 'Reach more than one firm', sub: 'Make your organized intake available to multiple participating firms — not just one. You stay in control of who sees it.', primary: false },
  ];

  return (
    <motion.div key="control" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ECE7F5] bg-[#F5F1FB] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#5B21B6]">
        What one3seven builds from this
      </div>

      {/* Settlement beat — the emotional core of the fire scenario */}
      <div className="mb-6 mt-3 rounded-[18px] border border-red-200 bg-red-50 p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
            <Scale className="h-4 w-4 text-red-600" />
          </div>
          <div className="text-[15px] font-bold text-[#14112E]">A settlement offer is among your records.</div>
        </div>
        <p className="pl-12 text-[13px] leading-relaxed text-[#14112E]/65">
          The offer and its release — received four days after the fire — are organized alongside everything else.
          Now the full picture is in one place, so it can go to an attorney before any decision is made. one3seven
          organizes; it doesn&apos;t advise.
        </p>
      </div>

      {/* Privacy banner */}
      <div className="mb-6 rounded-[18px] border border-[#ECE7F5] bg-[#14112E] p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5B21B6]/20">
            <Lock className="h-4 w-4 text-[#A78BFA]" />
          </div>
          <div className="text-[15px] font-bold text-white">Your information is not shared until you approve.</div>
        </div>
        <div className="space-y-2 pl-12">
          {[
            'No firm can view your intake without your explicit approval',
            'You control which firm receives access — and when',
            'You can download your own packet at any time',
            'You can continue adding records after organizing',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#A78BFA] mt-0.5" />
              <span className="text-[12px] leading-relaxed text-white/65">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-2 text-[20px] font-bold leading-tight tracking-tight text-[#14112E]">What Marcus can do next</h2>
      <p className="mb-5 text-[14px] leading-relaxed text-[#14112E]/55">His intake is organized. He decides what happens to it.</p>

      <div className="mb-6 space-y-3">
        {actions.map(a => (
          <div key={a.label} className={`flex items-center gap-4 rounded-[16px] border p-5 ${a.primary ? 'border-[#ECE7F5] bg-[#F5F1FB]' : 'border-[#ECE7F5] bg-white'}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${a.primary ? 'bg-[#5B21B6]' : 'bg-[#ECE7F5]'}`}>
              <a.icon className={`h-4 w-4 ${a.primary ? 'text-white' : 'text-[#5B21B6]'}`} />
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#14112E]">{a.label}</div>
              <div className="text-[12px] leading-relaxed text-[#14112E]/50">{a.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <div className="text-[12px] font-bold text-amber-800">Time-sensitive dates surfaced</div>
          <div className="text-[11px] leading-relaxed text-amber-700/75">Filing periods may apply. Needs attorney review.</div>
        </div>
      </div>

      <p className="mb-6 text-[11px] leading-relaxed text-[#14112E]/35">
        one3seven surfaces dates and timing for attorney review. It does not determine applicable deadlines or filing requirements.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onSignUp}
          className="flex items-center justify-center gap-2 rounded-full bg-[#5B21B6] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(109,74,255,0.25)] transition hover:bg-[#4C1D96] hover:-translate-y-0.5">
          Start organizing my records <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => { window.location.href = '/'; }}
          className="flex items-center justify-center gap-2 rounded-full border border-[#ECE7F5] bg-white px-7 py-3.5 text-[15px] font-semibold text-[#14112E] transition hover:bg-[#F5F1FB]">
          Back to home
        </button>
      </div>
      <p className="mt-3 text-xs text-[#14112E]/35">Free to submit · No account required to start · Records stay private until you approve sharing</p>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function FireWorkerDemoPage() {
  const [intakeStep, setIntakeStep] = useState(1);
  const [phase, setPhase] = useState<Phase>('intro');

  const goNext = () => {
    if (phase === 'intro') setPhase('intake');
    else if (phase === 'intake') {
      if (intakeStep < INTAKE_STEPS) setIntakeStep(s => s + 1);
      else setPhase('processing');
    } else if (phase === 'processing') setPhase('summary');
    else if (phase === 'summary') setPhase('dashboard');
    else if (phase === 'dashboard') setPhase('control');
  };

  const goBack = () => {
    if (phase === 'intake' && intakeStep > 1) setIntakeStep(s => s - 1);
  };

  const handleSignUp = () => { window.location.href = '/'; };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#14112E] antialiased">
      <NavBar step={intakeStep} phase={phase} onBack={goBack} onSignUp={handleSignUp} />
      <AnimatePresence mode="wait">
        {phase === 'intro' && <IntroBeat key="intro" onNext={goNext} />}
        {phase === 'intake' && intakeStep === 1 && <Step1Story key="s1" onNext={goNext} />}
        {phase === 'intake' && intakeStep === 2 && <Step2Records key="s2" onNext={goNext} />}
        {phase === 'intake' && intakeStep === 3 && <Step3Details key="s3" onSubmit={goNext} />}
        {phase === 'processing' && <PostProcessing key="proc" onNext={goNext} />}
        {phase === 'summary' && <PostSummary key="sum" onNext={goNext} />}
        {phase === 'dashboard' && <PostDashboard key="dash" onNext={goNext} />}
        {phase === 'control' && <PostControl key="ctrl" onSignUp={handleSignUp} />}
      </AnimatePresence>
    </div>
  );
}
