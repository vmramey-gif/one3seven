import type { ReactNode } from 'react';
import { ArrowRight, FileText, Plus, Clock, HelpCircle, CheckCircle2 } from 'lucide-react';

type TimelinePeekItem = { date: string; event: string };

type WorkerMissionControlHomeProps = {
  greetingName?: string | null;
  hasSavedIntakes?: boolean;
  /** Continue the most recent case (or, for a first-time worker, start their first). */
  onStart?: () => void;
  /** Always creates a brand-new case (a different job or a new issue). */
  onStartNew?: () => void;
  /** Open the "Get your employment records" self-help tool. */
  onGetRecords?: () => void;
  // --- At-a-glance summary (inverted pyramid: status + what matters, before the actions) ---
  /** Human-readable workflow status for the active case, e.g. "Preview sent". */
  statusLabel?: string | null;
  /** Records on file for the active case. */
  recordCount?: number;
  /** Dated timeline events built from those records. */
  eventCount?: number;
  /** Elements/record-types still missing — completeness, never a merit judgment. */
  gapCount?: number;
  /** Up to a few most-recent dated events, newest first. */
  timelinePeek?: TimelinePeekItem[];
  /** Open the full timeline / summary. */
  onViewTimeline?: () => void;
};

function resolvePacificGreeting(name: string | null | undefined): string {
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  try {
    const hourText = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Los_Angeles',
    }).format(new Date());
    const hour = Number.parseInt(hourText, 10);
    if (Number.isNaN(hour)) {
      return firstName ? `Welcome back, ${firstName}` : 'Welcome back';
    }
    const timeGreeting =
      hour >= 5 && hour < 12
        ? 'Good morning'
        : hour >= 12 && hour < 17
          ? 'Good afternoon'
          : 'Good evening';
    return firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;
  } catch {
    return firstName ? `Welcome back, ${firstName}` : 'Welcome back';
  }
}

function StatTile({
  icon,
  value,
  label,
  tone = 'sage',
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone?: 'sage' | 'amber' | 'clear';
}) {
  const ring =
    tone === 'amber'
      ? 'border-[#E7C3A6] bg-[#FBF4EC]'
      : tone === 'clear'
        ? 'border-[#CBD6CF] bg-[#F1F5EE]'
        : 'border-[#CBD6CF] bg-[#FBFBFA]';
  const iconTone = tone === 'amber' ? 'text-[#B4531F]' : 'text-[#42574E]';
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border px-4 py-3.5 ${ring}`}>
      <span className={`inline-flex items-center gap-1.5 ${iconTone}`}>
        {icon}
        <span className="text-[22px] font-semibold leading-none text-[#1B2623]">{value}</span>
      </span>
      <span className="text-[12px] leading-snug text-[#6A6D66]">{label}</span>
    </div>
  );
}

export function WorkerMissionControlHome({
  greetingName,
  hasSavedIntakes = false,
  onStart,
  onStartNew,
  onGetRecords,
  statusLabel,
  recordCount = 0,
  eventCount = 0,
  gapCount = 0,
  timelinePeek = [],
  onViewTimeline,
}: WorkerMissionControlHomeProps) {
  const headline = resolvePacificGreeting(greetingName);
  const showGlance = hasSavedIntakes && (recordCount > 0 || eventCount > 0);

  return (
    <div className="mx-auto w-full max-w-[680px] rounded-[28px] border border-[#D3DED6] bg-white/95 px-6 py-7 shadow-[0_24px_80px_rgba(31,27,75,0.10)] sm:px-9 sm:py-9">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-[clamp(1.6rem,5.5vw,2rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#1B2623]">
          {headline}
        </h1>
        {showGlance && statusLabel ? (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[#CBD6CF] bg-[#EFF3ED] px-3 py-1 text-[12px] font-medium text-[#42574E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#42574E]" aria-hidden />
            {statusLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-[#5E6B62]">
        {showGlance
          ? 'Here’s where your record stands. Everything below is yours — private until you choose to share it.'
          : hasSavedIntakes
            ? 'Pick up where you left off — or start something new.'
            : 'Let’s get what happened to you into one clear, organized place. Free, private, and yours to keep.'}
      </p>

      {/* TOP OF THE PYRAMID — the few numbers that matter, before anything else. */}
      {showGlance ? (
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <StatTile
            icon={<FileText className="h-4 w-4" aria-hidden />}
            value={String(recordCount)}
            label={recordCount === 1 ? 'Record on file' : 'Records on file'}
          />
          <StatTile
            icon={<Clock className="h-4 w-4" aria-hidden />}
            value={String(eventCount)}
            label={eventCount === 1 ? 'Dated event' : 'Dated events'}
          />
          {gapCount > 0 ? (
            <StatTile
              icon={<HelpCircle className="h-4 w-4" aria-hidden />}
              value={String(gapCount)}
              label="Still to gather"
              tone="amber"
            />
          ) : (
            <StatTile
              icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
              value="—"
              label="Nothing flagged missing"
              tone="clear"
            />
          )}
        </div>
      ) : null}

      {/* THE ACTIONS */}
      <div className="mt-6 flex flex-col gap-3">
        {onStart ? (
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#42574E] px-5 py-4 text-left text-white transition hover:bg-[#374A42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2623] focus-visible:ring-offset-2"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">
                {hasSavedIntakes ? 'Continue organizing' : 'Start organizing'}
              </span>
              <span className="block text-[13px] leading-snug text-white/75">
                {hasSavedIntakes
                  ? 'Pick up your most recent case.'
                  : 'Tell your story and add what you have — no forms, no legal terms.'}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 flex-none" aria-hidden />
          </button>
        ) : null}

        {hasSavedIntakes && onStartNew ? (
          <button
            type="button"
            onClick={onStartNew}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-[#CBD6CF] bg-[#FBFBFA] px-4 py-3.5 text-left transition hover:border-[#7C8B6F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42574E] focus-visible:ring-offset-1"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#EFF3ED] text-[#42574E]">
              <Plus className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[#1B2623]">Start a new case</span>
              <span className="block text-[12.5px] leading-snug text-[#6A6D66]">
                A different job or a new issue? Begin a fresh file.
              </span>
            </span>
          </button>
        ) : null}

        {onGetRecords ? (
          <button
            type="button"
            onClick={onGetRecords}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-[#CBD6CF] bg-[#FBFBFA] px-4 py-3.5 text-left transition hover:border-[#7C8B6F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42574E] focus-visible:ring-offset-1"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#EFF3ED] text-[#42574E]">
              <FileText className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[#1B2623]">Get your employment records</span>
              <span className="block text-[12.5px] leading-snug text-[#6A6D66]">
                California law lets you request them — we’ll write the letter.
              </span>
            </span>
          </button>
        ) : null}
      </div>

      {/* THE MIDDLE — a peek at the most recent dated events, with a way into the full record. */}
      {showGlance && timelinePeek.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-[#E4E5DE] bg-[#FBFBFA] px-4 py-4">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#42574E]">Recent in your record</span>
            {onViewTimeline ? (
              <button
                type="button"
                onClick={onViewTimeline}
                className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-[#42574E] transition hover:text-[#1B2623] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42574E] focus-visible:ring-offset-1"
              >
                View full timeline <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <ul className="flex flex-col gap-2">
            {timelinePeek.slice(0, 3).map((item, i) => (
              <li key={`${item.date}-${i}`} className="flex gap-3 text-[13.5px]">
                <span className="w-24 flex-none font-medium text-[#42574E]">{item.date}</span>
                <span className="min-w-0 text-[#20242a]">{item.event}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
