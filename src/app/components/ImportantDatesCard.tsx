import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { loadReminders } from '../../services/workerReminders';

/**
 * Important dates — a single, read-only, chronological view of every date in the worker's case:
 * dates on their record (from uploaded documents), dates they set themselves, and dates their firm
 * gave them. It puts "when" in one place so nothing gets lost.
 *
 * DOCTRINE (hard line): every date here is a plain value that already exists — a document date, a
 * date the WORKER typed, or a date a FIRM supplied. one3seven NEVER computes a legal deadline
 * (statute of limitations, filing window, "X days left"). That is a legal-adequacy calculation =
 * UPL, and an anxiety engine. No countdowns, no "due in", no urgency math — just the dates, in order,
 * each tagged with where it came from. Filing dates are the attorney's to set.
 */

type DateSource = 'record' | 'worker' | 'firm';
type DateEntry = { label: string; dateText: string; source: DateSource };

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;

const SOURCE_TAG: Record<DateSource, { label: string; cls: string }> = {
  record: { label: 'On your record', cls: 'border-[#CBD6CF] bg-[#EFF3ED] text-[#42574E]' },
  worker: { label: 'You set', cls: 'border-[#CBD6CF] bg-[#FBFBFA] text-[#5a5f58]' },
  firm: { label: 'From your firm', cls: 'border-[#C9B7ED] bg-[#F1ECFA] text-[#5B21B6]' },
};

function formatDate(dateText: string): string {
  const t = dateText.trim();
  // Year-only ("2023") and ISO date-only ("2025-03-06") strings parse as UTC midnight,
  // which displays a day — or a whole year — early in any US timezone.
  if (/^\d{4}$/.test(t)) return t;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ts = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime() : Date.parse(t);
  if (Number.isNaN(ts)) return dateText; // free-form like "Q4 2022" or "January 2026" — show as-is
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ImportantDatesCard({
  intakeId,
  timeline = [],
}: {
  intakeId: string | null;
  /** Dated events from the worker's record (title + a date string, which may be free-form). */
  timeline?: Array<{ date: string; event: string }>;
}) {
  const [entries, setEntries] = useState<DateEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const recordDates: DateEntry[] = timeline
        .filter((t) => t.date?.trim() && t.event?.trim())
        .map((t) => ({ label: t.event.trim(), dateText: t.date.trim(), source: 'record' }));

      let reminderDates: DateEntry[] = [];
      if (intakeId && isSupabaseConfigured()) {
        const res = await loadReminders(intakeId);
        reminderDates = res.reminders
          .filter((r) => r.dueDate?.trim())
          .map((r) => ({ label: r.text, dateText: r.dueDate!.trim(), source: r.source }));
      }

      // Sort chronologically where the date parses; free-form / unparseable dates sit at the end,
      // in their original order. No date math beyond ordering — never a countdown.
      const merged = [...recordDates, ...reminderDates].map((e, i) => ({ ...e, ts: Date.parse(e.dateText), i }));
      merged.sort((a, b) => {
        const aN = Number.isNaN(a.ts);
        const bN = Number.isNaN(b.ts);
        if (aN && bN) return a.i - b.i;
        if (aN) return 1;
        if (bN) return -1;
        return a.ts - b.ts;
      });
      setEntries(merged.map(({ label, dateText, source }) => ({ label, dateText, source })));
      setReady(true);
    })();
  }, [intakeId, timeline]);

  // Keep Home quiet when there's nothing to show yet.
  if (!ready || entries.length === 0) return null;

  return (
    <section className="rounded-[22px] border border-[#CBD6CF] bg-white/80 p-6 sm:p-7">
      <div style={MONO} className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#42574E]">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Important dates
      </div>
      <h3 style={SERIF} className="text-[20px] font-semibold tracking-[-0.01em] text-[#17181C]">
        The dates in your case, in one place
      </h3>
      <p className="mt-1.5 max-w-[54ch] text-[13.5px] leading-relaxed text-[#5a5f58]">
        From your records, from you, and from your firm — in order.
      </p>

      <ul className="mt-4 flex flex-col">
        {entries.map((e, i) => (
          <li key={`${e.dateText}-${i}`} className="border-t border-[#EEF0EA] py-3 first:border-t-0">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span style={MONO} className="text-[12.5px] font-medium text-[#42574E]">
                {formatDate(e.dateText)}
              </span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${SOURCE_TAG[e.source].cls}`}>
                {SOURCE_TAG[e.source].label}
              </span>
            </div>
            <p className="text-[14px] leading-snug text-[#20242a]">{e.label}</p>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-[#EEF0EA] pt-3 text-[11.5px] leading-relaxed text-[#6A6D66]">
        These are dates that already exist in your case — one3seven never calculates legal deadlines.
        If a filing date matters, your attorney sets it.
      </p>
    </section>
  );
}
