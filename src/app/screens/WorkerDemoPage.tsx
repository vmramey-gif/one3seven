/**
 * Worker demo — guided simulation of the real one3seven 3-step intake flow,
 * followed by the post-intake processing and organized review.
 *
 * Accessible via /?worker-demo. Fully click-through with Marcus Rivera's data.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, ArrowLeft, CheckCircle2, Shield, FileText,
  MessageSquare, Image, AlertTriangle, Download,
  Lock, Eye, Mic, ChevronDown, ChevronUp, Upload,
} from 'lucide-react';
import { OneThreeSevenLoader } from '../components/ui/OneThreeSevenLoader';
import { GapCoverageRail } from '../components/GapCoverageRail';
import { detectPayPeriodGaps, parseEmploymentDateRange, inferPayFrequency, DEFAULT_PAY_FREQUENCY, type PayFrequency } from '../../services/gapDetection';

// ── Phase tracking ─────────────────────────────────────────────────────────────
// phase: 'intake' (steps 1-3) → 'processing' → 'summary' → 'dashboard' → 'control'

type Phase = 'intake' | 'processing' | 'summary' | 'dashboard' | 'control';
const INTAKE_STEPS = 3;

// ── Marcus Rivera data ─────────────────────────────────────────────────────────

const STORY_TEXT =
  "I worked at Pacific Ridge for almost four years. They were consistently shorting my overtime — I could see it in the pay stubs but every time I brought it up I was brushed off. In November 2025 I finally put it in writing and filed a formal HR complaint. Eleven days later I got a written warning out of nowhere for 'attitude.' Then 34 days after my complaint they fired me — said it was performance. I never had a performance issue in four years.";

const OPTIONAL_FIELDS = [
  { label: 'Full name used during employment', answer: 'Marcus Rivera' },
  { label: 'What employer or organization are these records connected to?', answer: 'Pacific Ridge Distribution LLC' },
  { label: 'Approximate employment dates?', answer: 'March 2022 – January 2026' },
  { label: 'Are there key people involved?', answer: 'Shift supervisor Derek Howell · HR Manager Sandra Fitch' },
  { label: 'Were you working remotely at any point?', answer: 'No — on-site only' },
  { label: 'Were you reimbursed?', answer: 'No reimbursement received' },
  { label: 'Did you complain, report something, or ask HR/management for help?', answer: 'Yes — formal HR complaint filed November 14, 2025' },
  { label: 'Did anything change afterward?', answer: 'Written warning 11 days later · Terminated 34 days after complaint' },
  { label: 'Are you currently employed there, or has employment ended?', answer: 'Employment ended — terminated January 2026' },
  { label: 'Do you recall signing an arbitration agreement?', answer: 'Not sure — no copy on hand' },
  { label: 'Have you filed a complaint with any agency?', answer: 'Not yet' },
  { label: 'Is there anything you\'d like to add before we begin organizing?', answer: 'I want to make sure the timeline of events is clear — especially the 11 days between my complaint and the warning, and the 34 days to termination. That sequence felt very deliberate.' },
  { label: 'Link firm code', answer: 'No firm code' },
];

const DOCS = [
  { icon: FileText, label: 'Pay stub — Oct 2025', cat: 'Wage Records', color: 'text-[#42574E]', bg: 'bg-[#EEF2EE]', border: 'border-[#CBD6CF]', size: '284 KB' },
  { icon: FileText, label: 'Pay stub — Nov 2025', cat: 'Wage Records', color: 'text-[#42574E]', bg: 'bg-[#EEF2EE]', border: 'border-[#CBD6CF]', size: '291 KB' },
  { icon: FileText, label: 'Pay stub — Dec 2025', cat: 'Wage Records', color: 'text-[#42574E]', bg: 'bg-[#EEF2EE]', border: 'border-[#CBD6CF]', size: '278 KB' },
  { icon: MessageSquare, label: 'HR complaint — Nov 14 2025', cat: 'HR Communications', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', size: '89 KB' },
  { icon: FileText, label: 'Written warning — Nov 25 2025', cat: 'Employer Documents', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', size: '112 KB' },
  { icon: Image, label: 'Schedule screenshot — Q4 2022', cat: 'Time Records', color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', size: '1.2 MB' },
  { icon: Image, label: 'Schedule screenshot — Q1 2023', cat: 'Time Records', color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', size: '980 KB' },
  { icon: MessageSquare, label: 'Text messages — supervisor', cat: 'Communications', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', size: '340 KB' },
  { icon: FileText, label: 'Performance review — 2024', cat: 'Employer Documents', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', size: '203 KB' },
  { icon: FileText, label: 'Offer letter — March 2022', cat: 'Employment Records', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', size: '167 KB' },
  { icon: FileText, label: 'Termination letter — Dec 19 2025', cat: 'Employer Documents', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', size: '156 KB' },
  { icon: MessageSquare, label: 'Email — HR acknowledgment', cat: 'HR Communications', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', size: '44 KB' },
  { icon: FileText, label: 'Final paycheck stub', cat: 'Wage Records', color: 'text-[#42574E]', bg: 'bg-[#EEF2EE]', border: 'border-[#CBD6CF]', size: '188 KB' },
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
  { date: 'March 2022', label: 'Employment begins', detail: 'Warehouse associate role at Pacific Ridge Distribution LLC.', dot: 'bg-slate-400', tag: null, gap: false },
  { date: 'Q4 2022 – Q2 2023', label: 'Wage discrepancies identified', detail: 'Pay records show overtime gaps across 31 documented pay periods.', dot: 'bg-amber-400', tag: 'From pay stubs', gap: false },
  { date: 'Early 2023', label: 'Informal concern raised', detail: 'Supervisor advised concern was normal scheduling practice. No written record.', dot: 'bg-blue-300', tag: 'Worker context', gap: false },
  { date: 'Nov 14, 2025', label: 'Formal HR complaint filed', detail: 'Written complaint regarding overtime and timekeeping submitted to HR.', dot: 'bg-blue-500', tag: 'From HR complaint', gap: false },
  { date: 'Nov 25, 2025', label: 'Written warning issued', detail: "Warning cites 'attitude concerns' — not corroborated by 2024 performance review on file.", dot: 'bg-orange-500', tag: '11 days later', gap: true },
  { date: 'Dec 19, 2025', label: 'Employment terminated', detail: 'Stated reason: performance deficiency. Not reflected in prior reviews.', dot: 'bg-red-500', tag: '34 days after complaint', gap: true },
];

const ORGANIZED_SUMMARY =
  "According to the worker's account and supporting records, Marcus Rivera was employed as a warehouse associate at Pacific Ridge Distribution LLC from March 2022 through January 2026. Records currently reflect pay-related discrepancies beginning Q4 2022, a formal HR complaint dated November 14, 2025, a written warning 11 days later, and separation documentation dated December 19, 2025. These timeline patterns are organized for attorney review and may require confirmation against the source files.";

const CONCERNS = ['Wage & Hour', 'Employment Separation', 'After Raising a Concern'];

const SUGGESTIONS = [
  'Earlier pay records (2022–2023) may help complete the wage discrepancy timeline',
  'Supervisor communication prior to formal complaint not yet in record',
  'Performance review referenced in termination letter not located',
];

// ── Shared components ─────────────────────────────────────────────────────────

function NavBar({ step, phase, onBack, onSignUp }: { step: number; phase: Phase; onBack: () => void; onSignUp: () => void }) {
  const inIntake = phase === 'intake';
  return (
    <nav className="sticky top-0 z-50 border-b border-[#D3DED6]/80 bg-white/92 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
        <div className="flex items-center gap-3">
          {inIntake && step > 1 && (
            <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-[#1B2623]/55 transition hover:bg-[#F2F4EC] hover:text-[#1B2623]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          <span className="text-[15px] font-bold tracking-tight text-[#1B2623]">
            one<span className="font-black text-[#42574E]">3</span>seven
          </span>
        </div>
        <div className="flex items-center gap-4">
          {inIntake && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: INTAKE_STEPS }).map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i < step ? 'bg-[#42574E]' : 'bg-[#42574E]/15'} ${i === step - 1 ? 'w-6' : 'w-3'}`} />
              ))}
            </div>
          )}
          <button type="button" onClick={onSignUp} className="rounded-full border border-[#42574E]/30 px-4 py-1.5 text-xs font-semibold text-[#42574E] transition hover:bg-[#F2F4EC]">
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
      className={`flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(66,87,78,0.25)] transition ${disabled ? 'cursor-not-allowed bg-[#42574E]/30' : 'bg-[#42574E] hover:bg-[#42574E] hover:-translate-y-0.5'}`}
    >
      {label} <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function StepLabel({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="mb-6">
      <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#42574E]">Step {step} of {total}</div>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[24px] font-medium leading-tight tracking-[-0.01em] text-[#1B2623] sm:text-[27px]">{title}</h2>
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

// ── Step 1 of 3: Tell us what happened ────────────────────────────────────────

function Step1Story({ onNext }: { onNext: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  useEffect(() => {
    if (startedRef.current) return; // play once only — never restart
    startedRef.current = true;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(STORY_TEXT.slice(0, i));
      if (i >= STORY_TEXT.length) { clearInterval(iv); setDone(true); }
    }, 13);
    return () => clearInterval(iv);
  }, []);

  return (
    <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <StepLabel step={1} total={3} title="Tell us what happened" />
      <p className="mb-6 text-[14px] leading-relaxed text-[#1B2623]/55">
        Use your own words. There are no wrong answers. You can add records in the next step.
      </p>

      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E4E5DE] bg-white px-3 py-1.5 text-xs font-semibold text-[#42574E]">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        <Mic className="h-3.5 w-3.5" />
        {done ? 'Story captured' : 'Marcus is speaking…'}
      </div>

      <div className="mb-6 min-h-[140px] w-full rounded-[18px] border border-[#E4E5DE] bg-[#FAF9F6] p-5 text-[14px] leading-relaxed text-[#1B2623]">
        {displayed}
        {!done && <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-[#42574E] align-middle" />}
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

// ── Step 2 of 3: Add records ──────────────────────────────────────────────────

function Step2Records({ onNext }: { onNext: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const [progress, setProgress] = useState<number[]>(Array(DOCS.length).fill(0));
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
        if (pct >= 100) { clearInterval(fill); setTimeout(uploadNext, 260); }
      }, 45);
    };
    setTimeout(uploadNext, 500);
  }, []);

  const allDone = revealed >= DOCS.length && (progress[DOCS.length - 1] ?? 0) >= 100;

  return (
    <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <StepLabel step={2} total={3} title="Add records" />
      <p className="mb-5 text-[14px] leading-relaxed text-[#1B2623]/55">
        Upload anything relevant — pay stubs, emails, write-ups, HR complaints, screenshots. No legal knowledge needed.
      </p>

      {/* Suggested file types tip */}
      <div className="mb-5 rounded-[14px] border border-[#E4E5DE] bg-white p-4">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#42574E]">What to upload — common examples</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            ['Pay stubs or payroll records', 'bg-[#7C8B6F]'],
            ['HR complaint or written grievance', 'bg-blue-400'],
            ['Written warnings or write-ups', 'bg-amber-400'],
            ['Termination or separation letter', 'bg-red-400'],
            ['Performance reviews', 'bg-amber-300'],
            ['Schedule or time records', 'bg-pink-400'],
            ['Emails with HR or management', 'bg-blue-300'],
            ['Text messages with supervisors', 'bg-emerald-400'],
            ['Offer letter or employment agreement', 'bg-slate-400'],
            ['Screenshots of anything relevant', 'bg-pink-300'],
          ].map(([label, dot]) => (
            <div key={label} className="flex items-start gap-1.5">
              <span className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span className="text-[12px] leading-snug text-[#1B2623]/65">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[#1B2623]/35">Not sure what to include? Upload anything and one3seven will organize it.</p>
      </div>

      {/* Drop zone */}
      <div className="mb-5 flex flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[#E4E5DE] bg-[#FAF9F6] py-7">
        <Upload className="h-7 w-7 text-[#42574E]/40" />
        <span className="text-[13px] font-semibold text-[#42574E]">Drop files here, or click to browse</span>
        <span className="text-[11px] text-[#1B2623]/35">PDF · Images · Word · Any format</span>
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
                        <span className="text-[12px] font-semibold text-[#1B2623] truncate">{doc.label}</span>
                        <span className="shrink-0 text-[10px] text-[#1B2623]/40">{doc.size}</span>
                      </div>
                      {!complete && (
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/60">
                          <div className={`h-full rounded-full transition-all ${doc.color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      {complete && <div className="mt-0.5 text-[10px] text-[#1B2623]/40">{doc.cat}</div>}
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
                <span className="text-[13px] font-semibold text-emerald-700">13 records received</span>
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
  // visiblePairs: how many Q+A pairs have appeared so far
  const [visiblePairs, setVisiblePairs] = useState(0);
  // showAnswer[i]: whether the answer bubble for pair i is visible
  const [showAnswer, setShowAnswer] = useState<boolean[]>(Array(OPTIONAL_FIELDS.length).fill(false));
  const started = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to top on mount
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const scheduleNext = (idx: number) => {
      if (idx >= OPTIONAL_FIELDS.length) return;
      // Show the question bubble
      setTimeout(() => {
        setVisiblePairs(idx + 1);
        // After a short pause, show the answer
        setTimeout(() => {
          setShowAnswer(prev => { const n = [...prev]; n[idx] = true; return n; });
          // Scroll to bottom smoothly so new bubbles are visible
          setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            // Schedule next pair after answer settles
            scheduleNext(idx + 1);
          }, 220);
        }, 480);
      }, idx === 0 ? 400 : 0);
    };

    scheduleNext(0);
  }, []);

  const allDone = showAnswer[OPTIONAL_FIELDS.length - 1] === true;
  const pct = Math.round((showAnswer.filter(Boolean).length / OPTIONAL_FIELDS.length) * 100);

  return (
    <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <StepLabel step={3} total={3} title="Helpful details if you know them" />
      <p className="mb-2 text-[14px] leading-relaxed text-[#1B2623]/55">
        These optional details help one3seven connect your story to the records you upload.
      </p>

      {/* Completeness bar — sticky so it's always readable */}
      <div className="sticky top-14 z-10 mb-6 rounded-[14px] border border-[#E4E5DE] bg-white/95 backdrop-blur-sm p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-bold text-[#1B2623]">Intake Completeness</span>
          <span className="text-[12px] font-bold text-[#42574E]">{showAnswer.filter(Boolean).length} of {OPTIONAL_FIELDS.length}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#E4E5DE]">
          <motion.div className="h-full rounded-full bg-[#42574E]" animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
        </div>
      </div>

      {/* Chat bubbles */}
      <div className="mb-6 space-y-3">
        {OPTIONAL_FIELDS.map((f, i) => {
          const questionVisible = i < visiblePairs;
          const answerVisible = showAnswer[i];
          return (
            <div key={f.label}>
              {/* Question bubble — left aligned, system style */}
              <AnimatePresence>
                {questionVisible && (
                  <motion.div
                    initial={{ opacity: 0, x: -14, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-1.5 flex items-start gap-2"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#E4E5DE] bg-[#F2F4EC] mt-0.5">
                      <span className="text-[8px] font-black text-[#42574E]">137</span>
                    </div>
                    <div className="max-w-[78%] rounded-[14px] rounded-tl-[4px] border border-[#E4E5DE] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1B2623]">
                      {f.label}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Typing indicator while waiting for answer */}
              <AnimatePresence>
                {questionVisible && !answerVisible && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mb-1.5 flex justify-end"
                  >
                    <div className="flex items-center gap-1 rounded-[14px] rounded-tr-[4px] bg-[#42574E]/10 px-4 py-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#42574E]/40" style={{ animation: 'o3s-dot-pulse 1.6s ease-in-out 0ms infinite' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#42574E]/40" style={{ animation: 'o3s-dot-pulse 1.6s ease-in-out 0.3s infinite' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-[#42574E]/40" style={{ animation: 'o3s-dot-pulse 1.6s ease-in-out 0.6s infinite' }} />
                    </div>
                    <style>{`
                      @keyframes o3s-dot-pulse {
                        0%, 100% { opacity: 0.25; }
                        50% { opacity: 0.75; }
                      }
                    `}</style>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Answer bubble — right aligned, worker response */}
              <AnimatePresence>
                {answerVisible && (
                  <motion.div
                    initial={{ opacity: 0, x: 14, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-0.5 flex justify-end"
                  >
                    <div className="max-w-[78%] rounded-[14px] rounded-tr-[4px] bg-[#1B2623] px-4 py-2.5 text-[13px] font-medium text-white/90">
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
            <NextButton onClick={onSubmit} label="Submit intake" />
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
    }, 850);
    return () => clearInterval(iv);
  }, [onNext]);

  return (
    <motion.div key="processing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#42574E]">
        What one3seven builds from this
      </div>
      <h2 className="mb-8 text-[24px] font-bold leading-tight tracking-tight text-[#1B2623]">Organizing your intake</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#E4E5DE] bg-[#FAF9F6] py-8">
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
                    ? <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}><CheckCircle2 className={`h-4 w-4 shrink-0 ${active ? 'text-[#42574E]' : 'text-emerald-500'}`} /></motion.div>
                    : <div key="empty" className="h-4 w-4 shrink-0 rounded-full border-2 border-[#E4E5DE]" />
                  }
                </AnimatePresence>
                <span className={`text-[13px] transition-colors ${done ? (active ? 'font-semibold text-[#42574E]' : 'font-medium text-[#1B2623]') : 'text-[#1B2623]/30'}`}>{s}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <p className="mt-8 text-center text-[11px] text-[#1B2623]/35">
        one3seven organizes records for attorney review. It does not provide legal advice or determine legal outcomes.
      </p>
    </motion.div>
  );
}

// ── Post-intake: Summary stats ────────────────────────────────────────────────

function PostSummary({ onNext }: { onNext: () => void }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  const stats = [
    { n: 13, label: 'Documents Organized', color: 'text-[#42574E]', bg: 'bg-[#EEF2EE]', border: 'border-[#CBD6CF]', delay: 0 },
    { n: 9, label: 'Timeline Events', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', delay: 200 },
    { n: 3, label: 'Clarification Needs', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', delay: 400 },
  ];

  return (
    <motion.div key="postsummary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#42574E]">
        What one3seven builds from this
      </div>
      <div className="mb-2 mt-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <h2 className="text-[24px] font-bold leading-tight tracking-tight text-[#1B2623]">Review packet ready</h2>
      </div>
      <p className="mb-7 text-[14px] leading-relaxed text-[#1B2623]/55">
        Marcus's story and records have been organized into a structured intake for attorney review.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {stats.map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: s.delay / 1000 }} className={`rounded-[16px] border ${s.border} ${s.bg} p-4`}>
            <div className={`text-[30px] font-black leading-none ${s.color}`}><CountUp to={s.n} delay={s.delay + 200} /></div>
            <div className={`mt-1 text-[11px] font-semibold leading-tight ${s.color}`}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mb-7 rounded-[16px] border border-[#E4E5DE] bg-white p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-[13px] font-semibold text-[#1B2623]">Review Packet Generated</span>
        </div>
        <p className="mt-1.5 pl-6 text-[12px] leading-relaxed text-[#1B2623]/55">
          Story, timeline, document checklist, and employer response summary — structured for attorney review.
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

  // Gap Detection (Layer 1) — Marcus worked Mar 2022–Jan 2026 but only a handful of pay stubs
  // are on file, so most pay periods are undocumented. Frequency is DERIVED from the stub spacing
  // (not asked); the manual control below stays as an override.
  const gapStubDates = [
    new Date(2025, 9, 3), // Oct 2025 stub
    new Date(2025, 9, 17), // Oct 2025 stub (biweekly spacing → inferred biweekly)
    new Date(2025, 10, 14), // Nov 2025 stub
    new Date(2025, 11, 12), // Dec 2025 stub
  ];
  const [gapFreq, setGapFreq] = useState<PayFrequency>(
    () => inferPayFrequency(gapStubDates) ?? DEFAULT_PAY_FREQUENCY
  );
  const gapResult = (() => {
    const { start, end } = parseEmploymentDateRange('March 2022 – January 2026');
    return detectPayPeriodGaps({
      employmentStart: start,
      employmentEnd: end,
      payFrequency: gapFreq,
      payrollRecordDates: gapStubDates,
    });
  })();

  const [concernsConfirmed, setConcernsConfirmed] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const DOC_CATEGORIES = [
    { label: 'Wage Records', count: 4, color: 'text-[#42574E]', bg: 'bg-[#EEF2EE]', border: 'border-[#CBD6CF]' },
    { label: 'Employer Documents', count: 3, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'HR Communications', count: 2, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Time Records', count: 2, color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
    { label: 'Employment Records', count: 1, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
    { label: 'Communications', count: 1, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ];

  const STATUS = ['Story Organized', 'Timeline Created', 'Records Categorized', 'Clarifications Identified', 'Review Packet Ready'];

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#42574E]">
        What one3seven builds from this
      </div>

      <div className="mb-5 mt-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold leading-tight tracking-tight text-[#1B2623]">Marcus Rivera</h2>
          <div className="mt-0.5 text-[13px] text-[#1B2623]/50">Pacific Ridge Distribution LLC</div>
          <div className="mt-0.5 text-[12px] text-[#1B2623]/40">March 2022 – January 2026</div>
        </div>
        <div className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">Organized</div>
      </div>

      {/* Worker-owned file — the old "What Firms See / Full Review" toggle was removed in-product
          (the file is the worker's, always shown in full). Mirrors IntakeSummaryScreen's ownership intro. */}
      <div className="mb-5 rounded-[14px] border border-[#CBD6CF] bg-white p-4">
        <p className="text-[13px] leading-relaxed text-[#1B2623]/80">
          This is your organized file — built from your story and the records you added. It’s yours to
          review, download, and share whenever you choose.
        </p>
      </div>

      {/* Status grid */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STATUS.map(s => (
          <div key={s} className="flex items-center gap-2 rounded-[12px] border border-[#E4E5DE] bg-white px-3 py-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="text-[11px] font-semibold text-[#1B2623]">{s}</span>
          </div>
        ))}
      </div>

      {/* Organized summary */}
      <div className="mb-4 rounded-[16px] border border-[#E4E5DE] bg-[#F2F4EC] p-5">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#42574E]">Organized Summary</div>
        <p className="text-[13px] leading-relaxed text-[#1B2623]/80">{ORGANIZED_SUMMARY}</p>
      </div>

      {/* Gap Detection — the "what's missing from your file" reveal + request loop */}
      <GapCoverageRail
        className="mb-4"
        result={gapResult}
        payFrequency={gapFreq}
        onFrequencyChange={setGapFreq}
        onRequestRecords={() => {}}
      />

      {/* Possible review areas */}
      <div className="mb-4 rounded-[16px] border border-[#E4E5DE] bg-white p-5">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#1B2623]/40">Possible Review Areas</div>
        <div className="mb-4 flex flex-wrap gap-2">
          {CONCERNS.map(c => (
            <span key={c} className="rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1.5 text-[12px] font-semibold text-[#42574E]">{c}</span>
          ))}
        </div>
        {!concernsConfirmed ? (
          <div>
            <p className="mb-3 text-[13px] font-medium text-[#1B2623]">Does this sound accurate?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConcernsConfirmed(true)}
                className="flex items-center gap-1.5 rounded-full bg-[#42574E] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#42574E]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Yes, that's accurate
              </button>
              <button type="button" className="rounded-full border border-[#E4E5DE] px-5 py-2 text-[13px] font-semibold text-[#1B2623]/55 transition hover:bg-[#F2F4EC]">
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

      {/* The full organized file — timeline, document groups, and suggestions (always shown; worker owns it) */}
      <div>
            {/* Timeline */}
            <div className="mb-4 rounded-[16px] border border-[#E4E5DE] bg-white overflow-hidden">
              <button type="button" onClick={() => setTimelineOpen(o => !o)} className="flex w-full items-center justify-between px-5 py-4">
                <span className="text-[13px] font-bold text-[#1B2623]">Timeline Preview</span>
                {timelineOpen ? <ChevronUp className="h-4 w-4 text-[#1B2623]/40" /> : <ChevronDown className="h-4 w-4 text-[#1B2623]/40" />}
              </button>
              <AnimatePresence>
                {timelineOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-[#E4E5DE] px-5 pb-4 pt-3 space-y-1">
                      {TIMELINE.map((e, i) => (
                        <div key={e.date} className="flex gap-3">
                          <div className="flex flex-col items-center pt-1.5">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${e.dot}`} />
                            {i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-[#E4E5DE] mt-1" style={{ minHeight: 20 }} />}
                          </div>
                          <div className="pb-3 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-bold text-[#1B2623]/40">{e.date}</span>
                              {e.tag && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${e.gap ? 'bg-red-100 text-red-600' : 'bg-[#F2F4EC] text-[#42574E]'}`}>{e.tag}</span>}
                            </div>
                            <div className="text-[12px] font-semibold text-[#1B2623]">{e.label}</div>
                            <div className="text-[11px] leading-relaxed text-[#1B2623]/50 mt-0.5">{e.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Doc categories */}
            <div className="mb-4 rounded-[16px] border border-[#E4E5DE] bg-white overflow-hidden">
              <button type="button" onClick={() => setDocsOpen(o => !o)} className="flex w-full items-center justify-between px-5 py-4">
                <span className="text-[13px] font-bold text-[#1B2623]">Document Categories</span>
                {docsOpen ? <ChevronUp className="h-4 w-4 text-[#1B2623]/40" /> : <ChevronDown className="h-4 w-4 text-[#1B2623]/40" />}
              </button>
              <AnimatePresence>
                {docsOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-[#E4E5DE] px-5 pb-4 pt-3 grid grid-cols-2 gap-2">
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

            {/* Suggestions */}
            <div className="mb-4 rounded-[16px] border border-amber-200 bg-amber-50 p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-[12px] font-bold text-amber-800">Additional Information May Help</span>
              </div>
              <ul className="space-y-1.5">
                {SUGGESTIONS.map(s => <li key={s} className="text-[12px] leading-relaxed text-amber-800/75">· {s}</li>)}
              </ul>
            </div>
      </div>

      <div className="mt-5">
        <NextButton onClick={onNext} label="Review worker controls" />
      </div>
    </motion.div>
  );
}

// ── Post-intake: Worker control ───────────────────────────────────────────────

function PostControl({ onSignUp }: { onSignUp: () => void }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  const actions = [
    { icon: Download, label: 'Download your file', sub: 'A clean PDF — your story, timeline, and records — to bring to a consultation.', primary: true },
    { icon: Shield, label: 'Share it with a firm — your choice', sub: 'When you’re ready, share your organized file with a firm you choose. Nothing is shared until you say so.', primary: false },
    { icon: Eye, label: 'Keep adding records anytime', sub: 'Your file stays yours — add or update records whenever you like.', primary: false },
  ];

  return (
    <motion.div key="control" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#42574E]">
        What one3seven builds from this
      </div>

      {/* Privacy banner */}
      <div className="mb-6 mt-3 rounded-[18px] border border-[#E4E5DE] bg-[#1B2623] p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#42574E]/20">
            <Lock className="h-4 w-4 text-[#7C8B6F]" />
          </div>
          <div className="text-[15px] font-bold text-white">Your information is not shared until you approve.</div>
        </div>
        <div className="space-y-2 pl-12">
          {[
            'No firm can view your intake without your explicit approval',
            'You control which firm receives access — and when',
            'You can download your own packet at any time',
            'You can continue editing your records after organizing',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#7C8B6F] mt-0.5" />
              <span className="text-[12px] leading-relaxed text-white/65">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-2 text-[20px] font-bold leading-tight tracking-tight text-[#1B2623]">What Marcus can do next</h2>
      <p className="mb-5 text-[14px] leading-relaxed text-[#1B2623]/55">His intake is organized. He decides what happens to it.</p>

      <div className="mb-6 space-y-3">
        {actions.map(a => (
          <div key={a.label} className={`flex items-center gap-4 rounded-[16px] border p-5 ${a.primary ? 'border-[#E4E5DE] bg-[#F2F4EC]' : 'border-[#E4E5DE] bg-white'}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${a.primary ? 'bg-[#42574E]' : 'bg-[#E4E5DE]'}`}>
              <a.icon className={`h-4 w-4 ${a.primary ? 'text-white' : 'text-[#42574E]'}`} />
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#1B2623]">{a.label}</div>
              <div className="text-[12px] leading-relaxed text-[#1B2623]/50">{a.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-orange-200 bg-orange-50 p-4">
          <div className="text-[26px] font-black leading-none text-orange-600">11d</div>
          <div className="mt-1 text-[11px] font-semibold leading-tight text-orange-600/80">Complaint to written warning</div>
        </div>
        <div className="rounded-[14px] border border-red-200 bg-red-50 p-4">
          <div className="text-[26px] font-black leading-none text-red-600">34d</div>
          <div className="mt-1 text-[11px] font-semibold leading-tight text-red-600/80">Complaint to termination</div>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <div className="text-[12px] font-bold text-amber-800">Time-sensitive dates surfaced</div>
          <div className="text-[11px] leading-relaxed text-amber-700/75">Filing periods may apply. Needs attorney review.</div>
        </div>
      </div>

      <p className="mb-6 text-[11px] leading-relaxed text-[#1B2623]/35">
        one3seven surfaces dates and timing for attorney review. It does not determine applicable deadlines or filing requirements.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={onSignUp}
          className="flex items-center justify-center gap-2 rounded-full bg-[#42574E] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(66,87,78,0.25)] transition hover:bg-[#42574E] hover:-translate-y-0.5">
          Start organizing — free <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => { window.location.href = '/'; }}
          className="flex items-center justify-center gap-2 rounded-full border border-[#E4E5DE] bg-white px-7 py-3.5 text-[15px] font-semibold text-[#1B2623] transition hover:bg-[#F2F4EC]">
          Back to home
        </button>
      </div>
      <p className="mt-3 text-xs text-[#1B2623]/35">Free · Private until you choose to share · Yours to keep</p>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WorkerDemoPage() {
  const [intakeStep, setIntakeStep] = useState(1);
  const [phase, setPhase] = useState<Phase>('intake');

  const goNext = () => {
    if (phase === 'intake') {
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
    <div className="min-h-screen bg-[#FAF9F6] text-[#1B2623] antialiased">
      <NavBar step={intakeStep} phase={phase} onBack={goBack} onSignUp={handleSignUp} />
      <AnimatePresence mode="wait">
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
