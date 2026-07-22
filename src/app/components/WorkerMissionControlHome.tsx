import { ArrowRight, FileText, Plus } from 'lucide-react';

type WorkerMissionControlHomeProps = {
  greetingName?: string | null;
  hasSavedIntakes?: boolean;
  /** Continue the most recent case (or, for a first-time worker, start their first). */
  onStart?: () => void;
  /** Always creates a brand-new case (a different job or a new issue). */
  onStartNew?: () => void;
  /** Open the "Get your employment records" self-help tool. */
  onGetRecords?: () => void;
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

export function WorkerMissionControlHome({
  greetingName,
  hasSavedIntakes = false,
  onStart,
  onStartNew,
  onGetRecords,
}: WorkerMissionControlHomeProps) {
  const headline = resolvePacificGreeting(greetingName);

  return (
    <div className="mx-auto w-full max-w-[680px] rounded-[28px] border border-[#D3DED6] bg-white/95 px-6 py-7 shadow-[0_24px_80px_rgba(31,27,75,0.10)] sm:px-9 sm:py-9">
      <h1 className="font-display text-[clamp(1.6rem,5.5vw,2rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#1B2623]">
        {headline}
      </h1>
      <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-[#5E6B62]">
        {hasSavedIntakes
          ? 'Pick up where you left off — or start something new.'
          : 'Let’s get what happened to you into one clear, organized place. Free, private, and yours to keep.'}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {onStart ? (
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#42574E] px-5 py-4 text-left text-white transition hover:bg-[#374A42]"
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
            <ArrowRight className="h-5 w-5 flex-none" />
          </button>
        ) : null}

        {hasSavedIntakes && onStartNew ? (
          <button
            type="button"
            onClick={onStartNew}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-[#CBD6CF] bg-[#FBFBFA] px-4 py-3.5 text-left transition hover:border-[#7C8B6F]"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#EFF3ED] text-[#42574E]">
              <Plus className="h-[18px] w-[18px]" />
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
            className="flex w-full items-center gap-3.5 rounded-2xl border border-[#CBD6CF] bg-[#FBFBFA] px-4 py-3.5 text-left transition hover:border-[#7C8B6F]"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#EFF3ED] text-[#42574E]">
              <FileText className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[#1B2623]">Get your employment records</span>
              <span className="block text-[12.5px] leading-snug text-[#6A6D66]">
                California law entitles you to them — we’ll write the request letter.
              </span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
