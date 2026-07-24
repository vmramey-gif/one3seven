/**
 * Case-timeline patterns — the "four dates" / proximity engine.
 *
 * DOCTRINE ("describe the record, not the case"): this classifies timeline events as protected
 * ACTIVITY vs adverse ACTION and computes the INTERVAL between a protected activity and a later
 * adverse action. It states the two dated facts and the number of days between them. It NEVER
 * concludes retaliation, causation, that a legal presumption applies, or that the worker "wins."
 * Temporal proximity is the single most outcome-determinative FACT an attorney reconstructs
 * (SB 497's 90-day presumption is why) — so surfacing it is powerful AND the closest thing in the
 * product to implying causation. Build the engine; gate the surface (attorney-facing).
 *
 * The `withinNinetyDays` flag is a neutral arithmetic boolean for downstream/attorney use — the
 * UI must render the INTERVAL as a fact, never label it "a presumption" or "retaliation."
 */

import { parseLooseDate } from './gapDetection';

export type EventRole = 'protected_activity' | 'adverse_action' | 'neutral';

export type TimelineEventInput = {
  date: string;
  title: string;
  category?: string;
};

// Stem-safe patterns: leading \b anchors the word start, but NO trailing \b (so "terminat" still
// matches "terminated", "complain" matches "complaint/complained"). Order-independent.

// Protected ACTIVITY — the worker did something the law protects (the "trigger").
const PROTECTED_ACTIVITY_PATTERNS: RegExp[] = [
  /\bcomplain/i, // complain, complaint, complained
  /\bgrievance/i,
  /\bwhistleblow/i,
  /\bdisclos/i, // disclose, disclosed, disclosure
  /\baccommodation/i,
  /\b(fmla|cfra)\b/i,
  /\bmedical leave/i,
  /\btook\b.*\bleave/i,
  /\brequested\b.*\b(leave|accommodation)/i,
  /\breported/i,
  /\braised\b.*\bconcern/i,
  /\bconcern raised/i,
  /\brefused/i,
  /\bobjected/i,
  /\bprotested/i,
  /\bfiled\b.*\b(claim|complaint|charge)/i,
];

// Adverse ACTION — the employer did something negative (the "response").
const ADVERSE_ACTION_PATTERNS: RegExp[] = [
  /\btermin/i, // terminate, terminated, termination
  /\bfired\b/i,
  /\bdischarg/i,
  /\blet go\b/i,
  /\blaid off\b/i,
  /\blayoff/i,
  /\bdemot/i, // demote, demoted, demotion
  /\bsuspend/i,
  /\bwarning\b/i, // written warning, final warning
  /\bwrite[- ]?up/i,
  /\bdisciplin/i,
  /\bcorrective action/i,
  /\bpip\b/i,
  /\bperformance improvement/i,
  /\bcut\b.*\b(hours|pay)/i,
  /\breduced\b.*\b(hours|pay|schedule)/i,
  /\bpay cut/i,
  /\bhours cut/i,
  /\bforced\b.*\bresign/i,
  /\bconstructive discharge/i,
];

export function classifyEventRole(title: string, category?: string): EventRole {
  const hay = `${title ?? ''} ${category ?? ''}`;
  // Adverse action takes precedence — a "warning about the complaint" is an action, not activity.
  if (ADVERSE_ACTION_PATTERNS.some((re) => re.test(hay))) return 'adverse_action';
  if (PROTECTED_ACTIVITY_PATTERNS.some((re) => re.test(hay))) return 'protected_activity';
  return 'neutral';
}

export type ClassifiedEvent = TimelineEventInput & {
  role: EventRole;
  parsedDate: Date | null;
};

export type ProximitySequence = {
  activity: ClassifiedEvent;
  action: ClassifiedEvent;
  intervalDays: number;
  /** Neutral arithmetic flag: adverse action fell within 90 days of the protected activity. */
  withinNinetyDays: boolean;
};

export type CaseTimelinePatternResult = {
  events: ClassifiedEvent[];
  protectedActivities: ClassifiedEvent[];
  adverseActions: ClassifiedEvent[];
  /** Each protected activity paired with the NEXT adverse action that follows it, with the gap. */
  sequences: ProximitySequence[];
  /** True when at least one adverse action follows a protected activity in time. */
  hasProximityPattern: boolean;
  /** The tightest interval found (smallest days between an activity and a following action). */
  closestIntervalDays: number | null;
};

const MS_DAY = 86_400_000;

export function detectCaseTimelinePatterns(
  events: TimelineEventInput[]
): CaseTimelinePatternResult {
  const classified: ClassifiedEvent[] = (events ?? []).map((e) => ({
    ...e,
    role: classifyEventRole(e.title, e.category),
    parsedDate: parseLooseDate(e.date),
  }));

  const dated = classified.filter((e) => e.parsedDate !== null);
  const protectedActivities = classified.filter((e) => e.role === 'protected_activity');
  const adverseActions = classified.filter((e) => e.role === 'adverse_action');

  const sequences: ProximitySequence[] = [];
  for (const activity of dated.filter((e) => e.role === 'protected_activity')) {
    // The next adverse action strictly after this activity (by date).
    const following = dated
      .filter((e) => e.role === 'adverse_action' && e.parsedDate!.getTime() > activity.parsedDate!.getTime())
      .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());
    const action = following[0];
    if (!action) continue;
    const intervalDays = Math.round(
      (action.parsedDate!.getTime() - activity.parsedDate!.getTime()) / MS_DAY
    );
    sequences.push({
      activity,
      action,
      intervalDays,
      withinNinetyDays: intervalDays <= 90,
    });
  }
  sequences.sort((a, b) => a.intervalDays - b.intervalDays);

  return {
    events: classified,
    protectedActivities,
    adverseActions,
    sequences,
    hasProximityPattern: sequences.length > 0,
    closestIntervalDays: sequences.length ? sequences[0].intervalDays : null,
  };
}

/**
 * Describe a sequence as PLAIN FACTS — the two dated events and the interval. Never a conclusion.
 * e.g. "Concern raised with HR (Nov 14, 2025) → Written warning issued (Nov 25, 2025) — 11 days later."
 */
export function describeSequence(seq: ProximitySequence): string {
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const days = seq.intervalDays;
  const dayText = days === 1 ? '1 day later' : `${days} days later`;
  return `${seq.activity.title} (${fmt(seq.activity.parsedDate)}) → ${seq.action.title} (${fmt(
    seq.action.parsedDate
  )}) — ${dayText}.`;
}
