import { supabase } from '../lib/supabaseClient';

/**
 * Worker reminders — WORKER-OWNED "what's mine to do" list.
 *
 * The worker owns their case journey, so they own the checklist that goes with it: "upload my
 * pay records", "expert examination Tuesday 10am", "send the signed form back". This is the
 * "What's mine to do" pane of the case-journey home — orientation, not information overload.
 *
 * DOCTRINE (hard line): reminders are LOGISTICS the worker sets for themselves, or that a firm
 * authors for them. The engine NEVER computes a legal deadline (a statute-of-limitations date, a
 * filing window, "you have 14 days left") — that is a legal-adequacy calculation = UPL, and an
 * anxiety engine. Any date on a reminder is a plain value the WORKER typed or a FIRM supplied;
 * 137 does not calculate when anything is legally due. `source` records who set it so a firm-
 * authored reminder is never presented as the worker's own computation.
 *
 * Storage: an `--- O3S_WORKER_REMINDERS ---` JSON block inside `intake_summaries.overview` — the
 * same migration-free, worker-writable pattern as the mitigation log and story follow-up. The
 * generic O3S-block stripper in firmIntakeDisplay keeps the raw block out of firm-facing prose.
 */

export type ReminderSource = 'worker' | 'firm';

export interface WorkerReminder {
  id: string;
  /** What to do, in plain words (worker- or firm-authored). Never a computed legal deadline. */
  text: string;
  /** Optional date the worker typed or a firm supplied (e.g. "2026-08-12"). NOT computed by 137. */
  dueDate?: string;
  source: ReminderSource;
  done: boolean;
  /** ISO timestamp when the reminder was created. */
  createdAt: string;
}

const BLOCK_RE = /\n?--- O3S_WORKER_REMINDERS ---\n([\s\S]*?)\n--- O3S_WORKER_REMINDERS_END ---\n?/;

const SOURCES: readonly ReminderSource[] = ['worker', 'firm'];

function isReminder(v: unknown): v is WorkerReminder {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.text === 'string' &&
    typeof r.source === 'string' &&
    (SOURCES as readonly string[]).includes(r.source) &&
    typeof r.done === 'boolean' &&
    typeof r.createdAt === 'string'
  );
}

export function extractReminders(overview: string | null | undefined): WorkerReminder[] {
  const m = (overview ?? '').match(BLOCK_RE);
  if (!m?.[1]) return [];
  try {
    const parsed = JSON.parse(m[1]) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isReminder) : [];
  } catch {
    return [];
  }
}

export function stripRemindersBlock(overview: string): string {
  return (overview ?? '').replace(BLOCK_RE, '\n').replace(/\n{3,}/g, '\n\n');
}

export function buildRemindersBlock(reminders: WorkerReminder[]): string {
  if (!reminders.length) return '';
  return `--- O3S_WORKER_REMINDERS ---\n${JSON.stringify(reminders)}\n--- O3S_WORKER_REMINDERS_END ---`;
}

export function mergeRemindersIntoOverview(overview: string, reminders: WorkerReminder[]): string {
  const base = stripRemindersBlock(overview ?? '').replace(/\s+$/u, '');
  const block = buildRemindersBlock(reminders);
  if (!block) return base;
  return base ? `${base}\n${block}\n` : `${block}\n`;
}

/** Common starter reminders the worker can add with one tap — all pure logistics, no deadlines. */
export const SUGGESTED_REMINDER_KEYS = [
  'pay_records',
  'personnel_file',
  'expert_appointment',
  'signed_forms',
  'timeline_gaps',
] as const;
export type SuggestedReminderKey = (typeof SUGGESTED_REMINDER_KEYS)[number];

async function latestSummaryRow(intakeId: string) {
  return supabase
    .from('intake_summaries')
    .select('id, overview')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function loadReminders(
  intakeId: string
): Promise<{ reminders: WorkerReminder[]; error?: string }> {
  const { data, error } = await latestSummaryRow(intakeId);
  if (error) return { reminders: [], error: error.message };
  return { reminders: extractReminders((data?.overview as string | null) ?? '') };
}

/** Escape a text value per RFC 5545 (iCalendar). */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** "2026-08-12" -> "20260812". Returns null if not a plain YYYY-MM-DD date the worker/firm typed. */
function icsDateStamp(dueDate: string): string | null {
  const m = dueDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/**
 * Build a downloadable .ics file from reminders that have a date. Exports the date exactly as
 * the worker or firm typed it — this never computes or infers a date, matching the same doctrine
 * line as the reminders themselves.
 */
export function buildRemindersIcs(reminders: WorkerReminder[]): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const events = reminders
    .filter((r) => !r.done && r.dueDate)
    .map((r) => {
      const stamp = icsDateStamp(r.dueDate as string);
      if (!stamp) return '';
      return [
        'BEGIN:VEVENT',
        `UID:o3s-reminder-${r.id}@one3seven.com`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${stamp}`,
        `SUMMARY:${icsEscape(r.text)}`,
        r.source === 'firm' ? 'DESCRIPTION:Added by your firm via one3seven' : 'DESCRIPTION:Added by you via one3seven',
        'END:VEVENT',
      ].join('\r\n');
    })
    .filter(Boolean);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//one3seven//Reminders//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Read-modify-write the worker's own summary overview (same path as the mitigation log). */
export async function saveReminders(
  intakeId: string,
  reminders: WorkerReminder[]
): Promise<{ error?: string }> {
  const { data: row, error } = await latestSummaryRow(intakeId);
  if (error) return { error: error.message };
  if (!row) {
    return {
      error: 'Your intake summary isn’t ready yet — add your story first, then your reminders will save here.',
    };
  }
  const next = mergeRemindersIntoOverview((row.overview as string | null) ?? '', reminders);
  const { error: up } = await supabase
    .from('intake_summaries')
    .update({ overview: next })
    .eq('id', row.id as string);
  return up ? { error: up.message } : {};
}
