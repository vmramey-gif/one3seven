import type { WorkerTimelineItem } from '../types/workerTimeline';
import { softenWorkerReviewLine } from './workerIntakePresentationUtils';
import { normalizeEventDisplayDate } from '../../services/contextualDateClassification';

const PAYROLL_EVENT_RE = /employment activity documented through payroll|payroll record/i;
// Events a worker has at most once — keep a single row even if the engine dated copies differently.
const SINGULAR_EVENT_RE = /terminat|separat|employment (begins|began|start)|\bhired\b|\bfired\b|resign/i;

function baseTimelineKey(title: string): string {
  return (title ?? '').trim().toLowerCase().replace(/\s+\([^)]*\)\s*$/, '');
}

/**
 * Removes timeline noise before display: (1) collapses the one-event-per-paystub spam into a single
 * "Payroll records on file" row (a real timeline has a few meaningful moments, not ten identical
 * payroll rows), and (2) de-dupes exact-duplicate events by title+date (e.g. two "Termination
 * documented" rows). Order is preserved.
 */
export function collapseWorkerTimelineNoise(events: WorkerTimelineItem[]): WorkerTimelineItem[] {
  if (!events?.length) return events ?? [];
  const payrollEvents = events.filter((e) => PAYROLL_EVENT_RE.test(e.event ?? ''));
  const payrollCount = payrollEvents.length;
  const payrollSources = Array.from(
    new Set(payrollEvents.flatMap((e) => e.sourceFileNames ?? []))
  );

  const seen = new Set<string>();
  let payrollEmitted = false;
  const out: WorkerTimelineItem[] = [];
  for (const e of events) {
    if (PAYROLL_EVENT_RE.test(e.event ?? '') && payrollCount >= 2) {
      if (payrollEmitted) continue;
      payrollEmitted = true;
      out.push({
        ...e,
        event: 'Payroll records on file',
        summary: `${payrollCount} pay periods documented across your payroll records.`,
        relatedDocs: payrollSources.length || payrollCount,
        sourceFileNames: payrollSources,
      });
      continue;
    }
    const base = baseTimelineKey(e.event ?? '');
    const key = SINGULAR_EVENT_RE.test(e.event ?? '')
      ? `singular|${base}`
      : `${base}|${normalizeEventDisplayDate(e.date).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

const EXACT_TITLE_NARRATIVES: Record<string, string> = {
  'pay period record materials': 'Regular payroll activity',
  'compensation and pay periods': 'Regular payroll activity',
  'compensation and pay period materials': 'Regular payroll activity',
  'scheduling and timekeeping materials': 'Schedule changes begin',
  'scheduling materials': 'Schedule changes begin',
  'timekeeping materials': 'Schedule changes begin',
  'policy or handbook materials': 'Policy acknowledgment',
  'policy materials': 'Policy acknowledgment',
  'workplace complaint materials': 'Complaint raised to management',
  'separation notice materials': 'Employment separation',
  'separation-related materials': 'Employment separation',
  'hr response materials': 'HR response received',
  'workplace communication materials': 'Message exchanged at work',
  'workplace communications': 'Message exchanged at work',
  'workplace incident or discipline materials': 'Performance review issued',
  'identity or verification materials': 'Identity verification on file',
  'employment-related materials': 'Employment activity recorded',
  'employment-related activity': 'Employment activity recorded',
  'supporting employment records': 'Supporting employment activity',
  'employment and hr paperwork': 'HR paperwork on file',
  'uncategorized': 'Record added to chronology',
};

const TITLE_PATTERN_NARRATIVES: Array<[RegExp, string]> = [
  [/pay\s*period|payroll|wage|compensation|pay stub|final pay/i, 'Regular payroll activity'],
  [/schedul|timekeeping|timesheet|timecard|hours worked/i, 'Schedule changes begin'],
  [/policy|handbook|acknowledgment|acknowledgement/i, 'Policy acknowledgment'],
  [/complaint|grievance|concern raised|reported concern/i, 'Complaint raised to management'],
  [/separat|terminat|resign|layoff|end of employment/i, 'Employment separation'],
  [/performance review|disciplin|write[- ]?up|corrective action|pip\b/i, 'Performance review issued'],
  [/hr response|investigation response|response from hr/i, 'HR response received'],
  [/incident|workplace evidence|discipline/i, 'Performance review issued'],
  [/communication|correspondence|email|memo|message/i, 'Message exchanged at work'],
  [/verification|identity|i-9|onboarding/i, 'Identity verification on file'],
  [/medical|leave|fmla|accommodation/i, 'Leave or accommodation noted'],
  [/retaliation|adverse action/i, 'Workplace action noted'],
];

const STORY_SUMMARY_BY_NARRATIVE: Record<string, string> = {
  'Regular payroll activity': 'Pay records were found for this period.',
  'Schedule changes begin': 'Scheduling records mention changes in hours or tracking.',
  'Policy acknowledgment': 'A workplace policy or handbook acknowledgment appears in your records.',
  'Complaint raised to management': 'Records mention a concern raised to management.',
  'Employment separation': 'Separation-related records mark a change in employment status.',
  'Performance review issued': 'Discipline or performance review materials appear in this period.',
  'HR response received': 'HR responded after earlier workplace correspondence.',
  'Message exchanged at work': 'Workplace correspondence was added to your timeline.',
  'Identity verification on file': 'Identity or verification paperwork appears in this period.',
  'Employment activity recorded': 'Employment records were found for this date.',
  'Supporting employment activity': 'Supporting records were found for this part of your story.',
  'HR paperwork on file': 'HR paperwork was found for this period.',
  'Record added to chronology': 'This record was added to your timeline.',
  'Leave or accommodation noted': 'Leave or accommodation records appear in this part of your story.',
  'Workplace action noted': 'Records mention a workplace action during this period.',
};

const GENERIC_TITLE =
  /^(workplace communications|compensation and pay periods|employment and hr paperwork|scheduling and timekeeping|supporting employment records|employment-related activity|workplace incident or discipline materials|identity or verification materials|uncategorized|general)$/i;

const MATERIALS_TITLE =
  /\b(materials?|records?|paperwork|uploads?|documentation|communications?)\s*$/i;

function normalizeTitleKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function looksLikeDocumentCategoryTitle(title: string): boolean {
  const t = normalizeTitleKey(title);
  if (!t) return true;
  if (GENERIC_TITLE.test(t)) return true;
  if (MATERIALS_TITLE.test(t)) return true;
  if (/\b(materials|records|paperwork|uploads|documentation)\b/.test(t)) return true;
  if (/^employment[- ]related\b/.test(t) && /\b(materials|records)\b/.test(t)) return true;
  return false;
}

function narrativeFromPatterns(title: string, category: string): string | null {
  const haystack = `${title} ${category}`.trim();
  for (const [pattern, narrative] of TITLE_PATTERN_NARRATIVES) {
    if (pattern.test(haystack)) return narrative;
  }
  return null;
}

function polishExistingTitle(title: string): string {
  const cleaned = title
    .replace(/\b(materials?|records?|paperwork|uploads?|documentation)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return title.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Convert document-category timeline titles into worker-facing story moments. */
export function presentWorkerTimelineStoryTitle(event: WorkerTimelineItem): string {
  if (event.packetPresentationApplied) {
    const raw = (event.event ?? '').trim();
    return raw || 'Timeline moment';
  }
  const raw = (event.event ?? '').trim();
  if (!raw) return 'Timeline moment';

  const exact = EXACT_TITLE_NARRATIVES[normalizeTitleKey(raw)];
  if (exact) return exact;

  const category = (event.category ?? '').trim();
  if (looksLikeDocumentCategoryTitle(raw)) {
    const fromPattern = narrativeFromPatterns(raw, category);
    if (fromPattern) return fromPattern;

    const fromCategory = narrativeFromPatterns(category, category);
    if (fromCategory) return fromCategory;

    const polished = polishExistingTitle(raw);
    if (polished && !looksLikeDocumentCategoryTitle(polished)) return polished;

    return 'Record added to chronology';
  }

  return raw;
}

function stripFilenameReferences(text: string): string {
  return text
    .replace(/Available records show supporting uploads include [^.!?]+[.!?]?/gi, '')
    .replace(/supporting uploads include [^.!?]+[.!?]?/gi, '')
    .replace(/Uploaded records show [^.!?]+[.!?]?/gi, '')
    .replace(/References?:\s*[^.!?]+[.!?]?/gi, '')
    .replace(/\b\d+\s+file\(s\):\s*[^.!?]+[.!?]?/gi, '')
    .replace(/From uploaded records:\s*[^.!?]+[.!?]?/gi, '')
    .replace(/Indexed excerpt[^.!?]+[.!?]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeFilenameFragment(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 12) return true;
  if (/\.(pdf|png|jpe?g|docx?|xlsx?|txt|eml)\b/i.test(t)) return true;
  if (/^[a-z0-9_.\-]+(?:,\s*[a-z0-9_.\-]+)+\.?$/i.test(t)) return true;
  return false;
}
function isMechanicalSummary(text: string): boolean {
  const t = text.toLowerCase();
  return (
    !t ||
    t.includes('in this part of the sequence') ||
    t.includes('supporting uploads include') ||
    t.includes('uploaded records show') ||
    t.includes('available records show') ||
    t.includes('records appear related to') ||
    t.includes('may be relevant for review')
  );
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match ? match[0] : trimmed.slice(0, 180)).trim();
}

/** One calm sentence for timeline rows — no filenames. */
export function presentWorkerTimelineStorySummary(
  event: WorkerTimelineItem,
  storyTitle?: string
): string {
  if (event.packetPresentationApplied) {
    const count = event.sourceFileNames?.length ?? event.relatedDocs ?? 0;
    if (count > 0) {
      return `${count} related record${count === 1 ? '' : 's'} found for this event.`;
    }
    return 'Organized from available records.';
  }
  const title = storyTitle ?? presentWorkerTimelineStoryTitle(event);
  const softened = stripFilenameReferences(softenWorkerReviewLine(event.summary ?? ''));
  const sentence = firstSentence(softened);

  if (sentence && !isMechanicalSummary(sentence) && !looksLikeFilenameFragment(sentence)) {
    return sentence.endsWith('.') ? sentence : `${sentence}.`;
  }

  const fallback = STORY_SUMMARY_BY_NARRATIVE[title];
  if (fallback) return fallback;

  return `Timeline includes ${title.charAt(0).toLowerCase()}${title.slice(1)}.`;
}

/** Full detail copy for expanded views — still avoids filename lists when possible. */
export function presentWorkerTimelineDetailSummary(
  event: WorkerTimelineItem,
  storyTitle?: string
): string {
  const title = storyTitle ?? presentWorkerTimelineStoryTitle(event);
  const softened = stripFilenameReferences(softenWorkerReviewLine(event.summary ?? ''));
  if (softened && !isMechanicalSummary(softened)) {
    return softened.endsWith('.') ? softened : `${softened}.`;
  }
  return presentWorkerTimelineStorySummary(event, title);
}

export function presentWorkerTimelineSourceCount(event: WorkerTimelineItem): number {
  return event.sourceFileNames?.length ?? event.relatedDocs ?? 0;
}

export function presentWorkerTimelineRow(event: WorkerTimelineItem): {
  title: string;
  summary: string;
  sourceCount: number;
} {
  const title = presentWorkerTimelineStoryTitle(event);
  return {
    title,
    summary: presentWorkerTimelineStorySummary(event, title),
    sourceCount: presentWorkerTimelineSourceCount(event),
  };
}

export function isWorkerTimelineKeyStoryMoment(title: string, index: number): boolean {
  if (index === 0) return true;
  const t = title.toLowerCase();
  return (
    t.includes('separation') ||
    t.includes('complaint') ||
    t.includes('performance review') ||
    t.includes('terminat') ||
    t.includes('final pay') ||
    t.includes('discipline')
  );
}

export function isWorkerTimelineGapMoment(event: WorkerTimelineItem, title: string): boolean {
  const cat = (event.category ?? '').toLowerCase();
  const raw = (event.event ?? '').toLowerCase();
  return (
    event.sourceStrength === 'needs_review' ||
    cat.includes('gap') ||
    raw.includes('gap') ||
    raw.includes('missing') ||
    title.toLowerCase().includes('gap')
  );
}
