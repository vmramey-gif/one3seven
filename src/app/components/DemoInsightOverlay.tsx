/**
 * DemoInsightOverlay — interactive "why this feature exists" panel for demo mode.
 *
 * Usage:
 *   1. Wrap the demo root with <DemoInsightProvider>.
 *   2. Call useDemoInsight().show('insight-id') on any click.
 *   3. Render <DemoInsightBadge id="insight-id" /> next to any CTA in demoMode.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

// ── Insight catalog ─────────────────────────────────────────────────────────

export type DemoInsightId =
  | 'at-a-glance'
  | 'download-pdf'
  | 'timeline'
  | 'retaliation-timing'
  | 'supporting-records'
  | 'key-quotes'
  | 'clarifications'
  | 'matter-tags'
  | 'eeoc-deadline';

interface InsightDef {
  title: string;
  stat: string;
  statLabel: string;
  body: string;
  cta?: string;
}

const INSIGHTS: Record<DemoInsightId, InsightDef> = {
  'at-a-glance': {
    title: 'Intake Snapshot',
    stat: '1 card',
    statLabel: 'worker, employer, record count, timeline — organized before the first call',
    body: "Attorneys make accept/decline decisions fast — often before a single document is opened. The Intake Snapshot surfaces worker, employer, matter type, timeline span, and record count in one view. Everything a firm needs for a first read before the consultation clock starts.",
    cta: 'See how fast a real intake reviews',
  },
  'download-pdf': {
    title: 'Structured Intake Export',
    stat: '1 click',
    statLabel: 'exports the full structured intake — timeline, documents, key quotes, and gap analysis',
    body: "Before a firm can evaluate a matter, someone has to read every document, build a timeline, and organize the records. one3seven performs an initial organization pass automatically before the intake reaches the firm. This button exports the full structured packet — structured for review, with source records retained.",
    cta: 'Download what this looks like',
  },
  'timeline': {
    title: 'Chronological Timeline',
    stat: '6 events',
    statLabel: 'extracted from 11 source documents — each pinned to a date and source file',
    body: "Disorganized intake can make it difficult to evaluate what happened and when. When events aren't ordered and dated, attorneys can't see the sequence clearly. The chronology surfaces what happened in order, with source document references attached to each event so nothing is a floating claim.",
    cta: 'Explore the full timeline',
  },
  'retaliation-timing': {
    title: 'Event Timing Analysis',
    stat: '11 days',
    statLabel: 'between the documented HR complaint and written warning in this intake',
    body: "Timing between workplace events may be relevant to attorney review. one3seven calculates elapsed time between selected documented events and links each event to its source record. The attorney determines the legal significance, if any.",
    cta: 'Review the event timeline',
  },
  'supporting-records': {
    title: 'Organized Document Records',
    stat: '11 files',
    statLabel: 'categorized automatically — payroll, time records, HR, and termination',
    body: "HR complaints, termination letters, time records — the documents that define a case arrive scattered across phones, emails, and folders. one3seven categorizes every uploaded file automatically so attorneys see the full record set organized by type, not by upload date.",
    cta: 'See how records are organized',
  },
  'key-quotes': {
    title: 'Source-Linked Excerpt Extraction',
    stat: '3 excerpts',
    statLabel: 'selected from source documents and linked back to the original record',
    body: 'Important language can be difficult to locate across warnings, complaints, emails, and separation records. one3seven surfaces potentially relevant excerpts with source references so attorneys can review them in context.',
    cta: 'Review the extracted excerpts',
  },
  'clarifications': {
    title: 'Information Gap Detection',
    stat: '2 gaps',
    statLabel: 'identified in this intake — missing documents flagged before the consultation',
    body: "Prior performance reviews. Offer letters. Arbitration agreements. By the time an attorney asks for them at the consultation, workers have often moved on or can no longer access them. one3seven surfaces what's missing before the first call so workers can gather it in advance.",
    cta: 'See what this intake is missing',
  },
  'matter-tags': {
    title: 'Potential matter-topic tagging',
    stat: '4 tags',
    statLabel: 'suggested topics based on submitted information — for intake queue sorting',
    body: "Attorneys who specialize know which matters they want to review — but not until the intake is read and categorized. one3seven applies organizational tags based on worker-provided information and uploaded records so firms can sort their intake queue by topic area. Tags do not determine whether a legal claim exists.",
    cta: 'See how queue sorting works',
  },
  'eeoc-deadline': {
    title: 'Time-Sensitive Filing Review',
    stat: 'Multiple timelines',
    statLabel: 'filing periods depend on the allegations, agency, jurisdiction, and triggering event',
    body: "one3seven surfaces dates that may warrant timely attorney review. It does not determine the applicable filing period, agency, or triggering event. Applicable timelines vary — the EEOC, California Civil Rights Department, Labor Commissioner, and other agencies each operate on different rules.",
    cta: 'Review dates in this intake',
  },
};

// ── Context ──────────────────────────────────────────────────────────────────

interface DemoInsightCtx {
  show: (id: DemoInsightId) => void;
}

const DemoInsightContext = createContext<DemoInsightCtx | null>(null);

export function useDemoInsight(): DemoInsightCtx {
  const ctx = useContext(DemoInsightContext);
  // Graceful no-op when used outside the provider (non-demo renders)
  return ctx ?? { show: () => {} };
}

// ── Provider + Panel ─────────────────────────────────────────────────────────

interface ProviderProps {
  children: React.ReactNode;
  onSignUp?: () => void;
}

export function DemoInsightProvider({ children, onSignUp }: ProviderProps) {
  const [activeId, setActiveId] = useState<DemoInsightId | null>(null);

  const show = useCallback((id: DemoInsightId) => setActiveId(id), []);
  const dismiss = useCallback(() => setActiveId(null), []);

  const insight = activeId ? INSIGHTS[activeId] : null;

  return (
    <DemoInsightContext.Provider value={{ show }}>
      {children}

      <AnimatePresence>
        {insight && (
          <>
            {/* Backdrop */}
            <motion.div
              key="demo-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={dismiss}
              className="fixed inset-0 z-[1100] bg-[#1E1B4B]/70 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              key="demo-panel"
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="fixed inset-0 z-[1101] flex items-center justify-center p-5 pointer-events-none"
            >
              <div
                className="pointer-events-auto relative w-full max-w-md rounded-[28px] bg-white shadow-[0_40px_120px_rgba(31,27,75,0.28),0_0_0_1.5px_#DCD3FF] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Glow bar at top */}
                <div className="h-1 w-full bg-gradient-to-r from-[#6D4AFF] via-[#9C72FF] to-[#C4B5FD]" />

                <div className="p-7">
                  {/* Dismiss */}
                  <button
                    onClick={dismiss}
                    className="absolute top-5 right-5 rounded-full p-1.5 text-[#1E1B4B]/35 hover:bg-[#F7F3FF] hover:text-[#1E1B4B] transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Stat */}
                  <div className="mb-5">
                    <div
                      className="inline-block rounded-2xl px-4 py-3"
                      style={{
                        background: 'linear-gradient(135deg, #F0EBFF 0%, #E8E0FF 100%)',
                        border: '1.5px solid #DCD3FF',
                      }}
                    >
                      <p
                        className="text-[42px] font-black leading-none tracking-tight text-[#6D4AFF]"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {insight.stat}
                      </p>
                      <p className="text-[11px] font-medium text-[#1E1B4B]/55 mt-1 max-w-[220px] leading-snug">
                        {insight.statLabel}
                      </p>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-[17px] font-800 text-[#1E1B4B] mb-2.5 leading-snug" style={{ fontWeight: 800 }}>
                    {insight.title}
                  </h3>

                  {/* Body */}
                  <p className="text-[13.5px] text-[#1E1B4B]/65 leading-relaxed mb-6">
                    {insight.body}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2.5">
                    <button
                      onClick={dismiss}
                      className="flex-1 rounded-full border border-[#DCD3FF] bg-white py-2.5 text-sm font-semibold text-[#1E1B4B]/70 hover:border-[#B8A8FF] hover:bg-[#F7F3FF] transition-colors"
                    >
                      Got it
                    </button>
                    {onSignUp && (
                      <button
                        onClick={() => { dismiss(); onSignUp(); }}
                        className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition-colors"
                        style={{ background: 'linear-gradient(135deg, #6D4AFF, #5B35D5)' }}
                      >
                        Get your firm intake link →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DemoInsightContext.Provider>
  );
}

// ── DemoInsightBadge ─────────────────────────────────────────────────────────
// Small pulsing ⓘ badge. Drop next to any section title or CTA in demoMode.

interface BadgeProps {
  id: DemoInsightId;
  /** Compact styling for inline use */
  compact?: boolean;
}

export function DemoInsightBadge({ id, compact = false }: BadgeProps) {
  const { show } = useDemoInsight();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        show(id);
      }}
      title="Why does this exist?"
      className={`
        relative inline-flex items-center justify-center rounded-full
        bg-[#F0EBFF] border border-[#DCD3FF] text-[#6D4AFF]
        font-bold leading-none select-none
        hover:bg-[#E8E0FF] hover:border-[#C4B5FD] transition-colors
        ${compact ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]'}
      `}
      style={{ flexShrink: 0 }}
      aria-label="Learn why this feature exists"
    >
      {/* Pulse ring */}
      <span
        className="absolute inset-0 rounded-full border border-[#6D4AFF]/40 animate-ping"
        style={{ animationDuration: '2.2s' }}
      />
      ⓘ
    </button>
  );
}
