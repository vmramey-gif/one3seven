/**
 * Chronology trust layer — event titles, document association, category inference, dates.
 * Presentation only; does not alter generation, storage, or routing.
 */

import { formatPacketFileName, sanitizePacketDateLabel } from './intakePacketFormatting';

export type PacketTimelineEventInput = {
  date: string;
  title: string;
  category: string;
  summary: string;
  sourceDates?: string[];
};

export type InventoryRow = { fileName: string; category: string };

export type ChronologyPresentationContext = {
  /** Parsed start of employment_dates follow-up (e.g. "March 2021"). */
  employmentStartDate?: string;
};

export type PreparedChronologyEvent = {
  date: string;
  title: string;
  supportingUploads: string[];
};

const MIN_SUPPORT_SCORE = 10;

const GENERIC_TITLE_RE =
  /^(event documented in uploaded records|message exchanged at work|workplace communication documented|general workplace event|timeline event noted|record added to chronology|payroll period documented|hr record documented|workplace record documented)$/i;

/** Internal storage categories inferred from filenames when Uncategorized. */
const FILENAME_CATEGORY_RULES: Array<{ pattern: RegExp; category: string; weight: number }> = [
  { pattern: /complaint_to_supervisor|complaint.?supervisor|supervisor.?complaint/i, category: 'Workplace Communications', weight: 92 },
  { pattern: /complaint_to_hr|complaint.?hr|hr.?complaint|grievance/i, category: 'Workplace Communications', weight: 92 },
  { pattern: /safety.?concern|safety.?complaint|safety.?email|safety.?report/i, category: 'Workplace Communications', weight: 88 },
  { pattern: /witness_statement|witness.?statement/i, category: 'Workplace Communications', weight: 88 },
  { pattern: /written_warning|write_?up|disciplinary/i, category: 'Performance Reviews', weight: 88 },
  { pattern: /termination_letter|terminat/i, category: 'HR Documents', weight: 90 },
  { pattern: /separation|severance|final_pay/i, category: 'HR Documents', weight: 86 },
  { pattern: /project_removal|removed_from_project/i, category: 'HR Documents', weight: 84 },
  { pattern: /coaching_memo|coaching.?memo/i, category: 'Performance Reviews', weight: 82 },
  { pattern: /separation_benefits|separation.?benefits/i, category: 'HR Documents', weight: 88 },
  { pattern: /offer_letter|employment_agreement|offer letter/i, category: 'Offer Letters', weight: 90 },
  { pattern: /paystub|pay_stub|payroll|wage_statement/i, category: 'Pay Records', weight: 86 },
  { pattern: /timesheet|time_sheet|schedule|attendance/i, category: 'Time Records', weight: 84 },
  { pattern: /performance_review|performance review|pip|performance_improvement/i, category: 'Performance Reviews', weight: 86 },
  { pattern: /recognition|award|commendation/i, category: 'HR Documents', weight: 80 },
];

const EVENT_TITLE_RULES: Array<{ title: string; pattern: RegExp }> = [
  { title: 'Complaint submitted to Human Resources', pattern: /complaint.*human resources|complaint.*\bhr\b|\bhr\b.*complaint|complaint_to_hr|grievance.*hr/i },
  { title: 'Complaint submitted to supervisor', pattern: /complaint.*supervisor|complaint.*manager|supervisor.*complaint|complaint_to_supervisor/i },
  { title: 'Concern raised with management', pattern: /safety.?concern|concern.*raised|raised.*concern|workplace.?concern/i },
  { title: 'Performance improvement plan issued', pattern: /\bpip\b|performance improvement plan/i },
  { title: 'Written warning issued', pattern: /written warning|write[-_]?up|corrective action notice/i },
  { title: 'Project removal documented', pattern: /project removal|removed from project|project_removal/i },
  { title: 'Witness statement provided', pattern: /witness statement|witness_statement/i },
  { title: 'Recognition received', pattern: /recognition|award|commendation|employee of the month/i },
  { title: 'Termination documented', pattern: /termination letter|termination_letter|termination notice|terminat.*document/i },
  { title: 'Schedule change documented', pattern: /schedule change|scheduling change|shift change|hours change/i },
  { title: 'Employment activity documented through payroll records', pattern: /payroll period|pay period|paystub|pay stub|wage statement/i },
  { title: 'Employment ends', pattern: /separat|resign|layoff|employment ends|final day|offboard/i },
  { title: 'Employment begins', pattern: /offer letter|employment agreement|onboard|hire|start date|employment begins/i },
  { title: 'Performance review documented', pattern: /performance review|performance evaluation/i },
];

const EVENT_ALLOWED_CATEGORIES: Record<string, string[]> = {
  'Employment begins': ['Offer Letters'],
  'Employment ends': ['HR Documents', 'Workplace Communications'],
  'Termination documented': ['HR Documents', 'Workplace Communications'],
  'Complaint submitted to Human Resources': ['Workplace Communications', 'HR Documents'],
  'Complaint submitted to supervisor': ['Workplace Communications', 'HR Documents'],
  'Performance improvement plan issued': ['Performance Reviews', 'HR Documents'],
  'Written warning issued': ['Performance Reviews', 'HR Documents', 'Workplace Communications'],
  'Performance review documented': ['Performance Reviews'],
  'Project removal documented': ['HR Documents', 'Workplace Communications'],
  'Schedule change documented': ['Time Records', 'Workplace Communications', 'PTO Records'],
  'Employment activity documented through payroll records': ['Pay Records', 'Pay Records / Payroll'],
  'Witness statement provided': ['Workplace Communications', 'HR Documents'],
  'Recognition received': ['HR Documents', 'Workplace Communications', 'Performance Reviews'],
};

const EVENT_FILENAME_HINTS: Record<string, RegExp[]> = {
  'Employment begins': [/offer/i, /employment.?agreement/i, /onboard/i, /hire/i, /welcome/i],
  'Employment ends': [/termin/i, /separ/i, /resign/i, /severance/i, /final/i, /exit/i],
  'Termination documented': [/termin/i, /separation/i, /severance/i],
  'Complaint submitted to Human Resources': [/complaint/i, /\bhr\b/i, /human resources/i, /grievance/i],
  'Complaint submitted to supervisor': [/complaint/i, /supervisor/i, /manager/i],
  'Performance improvement plan issued': [/\bpip\b/i, /performance improvement/i],
  'Written warning issued': [/warning/i, /disciplin/i, /write[-_]?up/i],
  'Performance review documented': [/performance/i, /review/i, /evaluation/i],
  'Project removal documented': [/project.?removal/i, /removed.?from.?project/i],
  'Schedule change documented': [/schedule/i, /shift/i, /hours/i, /timesheet/i],
  'Employment activity documented through payroll records': [/pay/i, /payroll/i, /stub/i, /wage/i],
  'Witness statement provided': [/witness/i, /statement/i],
  'Recognition received': [/recognition/i, /award/i, /commend/i],
};

const EVENT_FORBIDDEN_FILE_PATTERNS: Record<string, RegExp[]> = {
  'Employment begins': [/witness/i, /complaint/i, /warning/i, /termin/i, /pip/i, /project.?removal/i, /performance.?review/i, /paystub/i, /payroll/i],
  'Employment ends': [/handbook/i, /offer/i, /onboard/i, /paystub/i, /payroll/i, /witness/i, /complaint/i],
  'Termination documented': [/offer/i, /onboard/i, /handbook/i, /paystub/i, /witness/i],
  'Complaint submitted to Human Resources': [/offer/i, /onboard/i, /termin/i, /paystub/i, /witness/i, /performance.?review/i],
  'Complaint submitted to supervisor': [/offer/i, /onboard/i, /termin/i, /paystub/i, /witness/i],
  'Performance improvement plan issued': [/offer/i, /onboard/i, /termin/i, /paystub/i, /witness/i],
  'Written warning issued': [/offer/i, /onboard/i, /termin/i, /paystub/i, /witness/i],
  'Project removal documented': [/offer/i, /onboard/i, /termin/i, /paystub/i],
  'Employment activity documented through payroll records': [/offer/i, /onboard/i, /termin/i, /complaint/i, /witness/i, /warning/i],
  'Witness statement provided': [/offer/i, /onboard/i, /paystub/i, /payroll/i],
};

/**
 * Upstream titles that are known to mislabel events (e.g. "safety concerns" when
 * the context is a wage complaint). These are forced through EVENT_TITLE_RULES
 * instead of passing through as-is.
 */
const MISLEADING_UPSTREAM_TITLE_RE =
  /\bsafety concern\b|\braised safety\b|\bworker raises safety\b|\bsafety issue\b/i;

/** Maps resolved event titles to a human-readable display category for the firm card badge. */
const TITLE_TO_DISPLAY_CATEGORY: Record<string, string> = {
  'Employment begins': 'Employment',
  'Employment ends': 'Separation',
  'Termination documented': 'Separation',
  'Written warning issued': 'Disciplinary',
  'Performance improvement plan issued': 'Performance Review',
  'Performance review documented': 'Performance Review',
  'Complaint submitted to Human Resources': 'HR Communication',
  'Complaint submitted to supervisor': 'Workplace Communication',
  'Concern raised with management': 'Workplace Communication',
  'Schedule change documented': 'Scheduling',
  'Employment activity documented through payroll records': 'Pay Records',
  'Witness statement provided': 'Workplace Communication',
  'Project removal documented': 'HR Communication',
  'Recognition received': 'HR Communication',
};

/**
 * Resolves the display category badge for a firm-facing timeline event card.
 * Falls back to the stored category unless it is Uncategorized and the resolved
 * title maps to a known category.
 */
export function resolveEventDisplayCategory(storedCategory: string, resolvedTitle: string): string {
  const stored = (storedCategory ?? '').trim();
  if (stored && stored !== 'Uncategorized') return stored;
  return TITLE_TO_DISPLAY_CATEGORY[resolvedTitle] ?? stored ?? 'Uncategorized';
}

const CATEGORY_FALLBACK_TITLES: Record<string, string> = {
  'Offer Letters': 'Employment begins',
  'Pay Records': 'Employment activity documented through payroll records',
  'Pay Records / Payroll': 'Employment activity documented through payroll records',
  'Time Records': 'Schedule change documented',
  'Workplace Communications': 'Workplace communication documented',
  'HR Documents': 'Human Resources communication documented',
  'Performance Reviews': 'Performance review documented',
  'Uncategorized': 'Workplace concern documented',
};

const MONTH_WORD =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

function normalizeFileKey(name: string): string {
  return name.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
}

function inventoryRowForName(inventory: InventoryRow[], name: string): InventoryRow | undefined {
  const key = normalizeFileKey(name);
  return inventory.find((row) => {
    const rowKey = normalizeFileKey(row.fileName);
    const formatted = normalizeFileKey(formatPacketFileName(row.fileName));
    return rowKey === key || formatted === key || row.fileName.toLowerCase() === name.toLowerCase();
  });
}

/** Infer storage category from filename when Uncategorized or empty. */
export function inferInventoryCategory(fileName: string, storedCategory: string): string {
  const stored = (storedCategory ?? '').trim();
  if (stored && stored !== 'Uncategorized') return stored;

  const base = fileName.toLowerCase();
  let best = { category: stored || 'Uncategorized', weight: 0 };
  for (const rule of FILENAME_CATEGORY_RULES) {
    if (rule.pattern.test(base) && rule.weight > best.weight) {
      best = { category: rule.category, weight: rule.weight };
    }
  }
  return best.weight >= 80 ? best.category : stored || 'Uncategorized';
}

/** Normalize inventory with inferred categories for chronology scoring. */
export function normalizeInventoryCategories(inventory: InventoryRow[]): InventoryRow[] {
  return inventory.map((row) => ({
    fileName: row.fileName,
    category: inferInventoryCategory(row.fileName, row.category),
  }));
}

function parseSourceNamesFromSummary(summary: string): string[] {
  const refMatch = summary.match(/References?:\s*(.+?)(?:\.|$)/i);
  if (refMatch?.[1]) {
    return refMatch[1]
      .split(/,\s*/)
      .map((n) => n.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  const filesMatch = summary.match(/\b\d+\s+file\(s\):\s*(.+?)\./i);
  if (filesMatch?.[1]) {
    return filesMatch[1]
      .split(/,\s*/)
      .map((n) => n.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return [];
}

/** Filename / short-string date patterns used by packet chronology and evidence clustering. */
export function extractFilenameDateToken(text: string): string | null {
  const t = (text ?? '').trim();
  if (!t) return null;

  const monthDayYear = t.match(
    new RegExp(`\\b(?:${MONTH_WORD})\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'i')
  );
  if (monthDayYear) return monthDayYear[0];

  const monthYear = t.match(
    new RegExp(`(?:${MONTH_WORD})[\\s_-]+\\d{4}\\b`, 'i')
  );
  if (monthYear) return monthYear[0].replace(/_/g, ' ');

  const numeric = t.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
  if (numeric) return numeric[0];

  const yearMonth = t.match(/\b(20\d{2})[-_](0[1-9]|1[0-2])\b/);
  if (yearMonth) return yearMonth[0].replace('_', '-');

  const yearOnly = t.match(/\b(19|20)\d{2}\b/);
  if (yearOnly && /(?:19|20)\d{2}/.test(t) && t.length < 60) return yearOnly[0];

  return null;
}

function baseEventTitle(eventTitle: string): string {
  return eventTitle.replace(/\s+\([^)]+\)\s*$/, '').trim();
}

function isForbiddenForEvent(eventTitle: string, fileName: string, category: string): boolean {
  const baseTitle = baseEventTitle(eventTitle);
  const file = fileName.toLowerCase();
  const forbidden = EVENT_FORBIDDEN_FILE_PATTERNS[baseTitle] ?? [];
  if (forbidden.some((p) => p.test(file))) return true;

  const allowed = EVENT_ALLOWED_CATEGORIES[baseTitle];
  if (!allowed?.length) return false;
  return !allowed.includes(category);
}

function scoreSupportingRecord(
  eventTitle: string,
  event: PacketTimelineEventInput,
  row: InventoryRow
): number {
  const fileName = row.fileName.toLowerCase();
  const category = inferInventoryCategory(row.fileName, row.category);
  const baseTitle = baseEventTitle(eventTitle);
  const allowed = EVENT_ALLOWED_CATEGORIES[baseTitle];

  if (isForbiddenForEvent(eventTitle, row.fileName, category)) return -100;

  let score = 0;
  if (allowed?.includes(category)) score += 14;
  else if (category === event.category) score += 8;

  for (const pattern of EVENT_FILENAME_HINTS[baseTitle] ?? []) {
    if (pattern.test(fileName)) score += 10;
  }

  const refNames = parseSourceNamesFromSummary(event.summary);
  if (refNames.some((n) => normalizeFileKey(n) === normalizeFileKey(row.fileName))) score += 20;

  const eventYear = event.date.match(/\b(19|20)\d{2}\b/)?.[0];
  if (eventYear && fileName.includes(eventYear)) score += 5;

  const summaryTokens = event.summary
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 4);
  for (const token of summaryTokens.slice(0, 6)) {
    if (fileName.includes(token)) score += 2;
  }

  return score;
}

function categoryFallbackTitle(category: string, index: number): string {
  if (index === 0 && category === 'Offer Letters') {
    return 'Employment begins';
  }
  return CATEGORY_FALLBACK_TITLES[category] ?? 'Workplace concern documented';
}

function isConcreteUpstreamTitle(title: string): boolean {
  const raw = title.trim();
  if (!raw || raw.length < 4) return false;
  if (GENERIC_TITLE_RE.test(raw)) return false;
  if (/\b(materials?|records?|paperwork|uploads?)\b/i.test(raw)) return false;
  return true;
}

function roleAwareTitle(baseTitle: string, haystack: string): string {
  if (baseTitle !== 'Complaint submitted to Human Resources') return baseTitle;
  const match = haystack.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*(?:\((?:Human Resources|HR|HR Generalist|Human Resources Representative)[^)]+\)|[-,]\s*(?:Human Resources|HR|HR Generalist|Human Resources Representative)|\s+(?:Human Resources|HR Generalist|Human Resources Representative))\b/
  );
  const name = match?.[1]?.trim();
  if (!name || /\b(Human Resources|Resources Representative|Complaint Submitted)\b/i.test(name)) return baseTitle;
  return `${baseTitle} (${name})`;
}

function normalizeDateTokenForMatch(value: string): string {
  return (value ?? '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function employmentStartMatches(eventDate: string, employmentStart: string): boolean {
  const eventNorm = normalizeDateTokenForMatch(eventDate);
  const startNorm = normalizeDateTokenForMatch(employmentStart);
  if (!eventNorm || !startNorm) return false;
  if (eventNorm === startNorm) return true;
  if (eventNorm.includes(startNorm) || startNorm.includes(eventNorm)) return true;

  const monthYear =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(19|20)\d{2}\b/i;
  const eventMonth = eventNorm.match(monthYear)?.[0]?.toLowerCase();
  const startMonth = startNorm.match(monthYear)?.[0]?.toLowerCase();
  return Boolean(eventMonth && startMonth && eventMonth === startMonth);
}

function eventSupportedByOfferLetter(event: PacketTimelineEventInput): boolean {
  const hay = `${event.title} ${event.category} ${event.summary}`.toLowerCase();
  if (/offer letter|offer_letter|employment agreement|employment_agreement/i.test(hay)) return true;

  const refs = parseSourceNamesFromSummary(event.summary);
  if (refs.some((name) => /offer|employment.?agreement/i.test(name))) return true;

  return (
    inferInventoryCategory('', event.category) === 'Offer Letters' &&
    /offer|employment.?agreement|onboard|hire/i.test(hay)
  );
}

/** Resolve the most specific supported event title. */
export function resolveChronologyEventTitle(
  event: PacketTimelineEventInput,
  index = 0,
  ctx?: ChronologyPresentationContext,
  inventory: InventoryRow[] = []
): string {
  const start = (ctx?.employmentStartDate ?? '').trim();
  const dateMatch = Boolean(start && employmentStartMatches(event.date, start));
  const offerSupport = eventSupportedByOfferLetter(event);
  if (dateMatch || offerSupport) {
    return 'Employment begins';
  }

  const hay = `${event.title} ${event.category} ${event.summary}`.toLowerCase();

  const rawTitle = (event.title ?? '').trim();
  if (isConcreteUpstreamTitle(rawTitle) && !MISLEADING_UPSTREAM_TITLE_RE.test(rawTitle)) {
    return rawTitle.length > 100 ? rawTitle.slice(0, 100).trim() : rawTitle;
  }

  for (const rule of EVENT_TITLE_RULES) {
    if (rule.pattern.test(hay)) {
      if (rule.title === 'Employment begins' && index > 0 && !/offer|onboard|hire|start/i.test(hay)) continue;
      return roleAwareTitle(rule.title, `${event.title} ${event.category} ${event.summary}`);
    }
  }

  if (index === 0 && /offer|onboard|hire|employment agreement/i.test(hay)) {
    return 'Employment begins';
  }

  const inferred = inferInventoryCategory('', event.category);
  return categoryFallbackTitle(inferred !== 'Uncategorized' ? inferred : event.category, index);
}

/** Confidence-aware event date; may derive from references when raw date is unclear. */
export function resolveChronologyEventDate(
  rawDate: string,
  summary: string,
  referenceNames: string[]
): string {
  const raw = (rawDate ?? '').trim();
  const sum = (summary ?? '').trim();

  if (/date unclear|review source document/i.test(raw)) {
    for (const name of referenceNames) {
      const fromFile = extractFilenameDateToken(name);
      if (fromFile && sanitizePacketDateLabel(fromFile) !== 'Date to confirm') return sanitizePacketDateLabel(fromFile);
    }
    const fromSummary = extractFilenameDateToken(sum);
    if (fromSummary && sanitizePacketDateLabel(fromSummary) !== 'Date to confirm') {
      return sanitizePacketDateLabel(fromSummary);
    }
    return /approximate|roughly|around|during \d{4}|timeframe/i.test(`${raw} ${sum}`)
      ? 'Approximate timeframe identified'
      : 'Date not yet clear';
  }

  const label = sanitizePacketDateLabel(raw);
  if (label !== 'Date to confirm' && label && label !== '—') return label;

  for (const name of referenceNames) {
    const fromFile = extractFilenameDateToken(name);
    if (fromFile && sanitizePacketDateLabel(fromFile) !== 'Date to confirm') return sanitizePacketDateLabel(fromFile);
  }

  const fromSummary = extractFilenameDateToken(sum);
  if (fromSummary && sanitizePacketDateLabel(fromSummary) !== 'Date to confirm') {
    return sanitizePacketDateLabel(fromSummary);
  }

  return 'Date not yet clear';
}

/** Pick up to 2 directly relevant supporting records for a resolved event title. */
export function pickSupportingRecordsForEvent(
  eventTitle: string,
  event: PacketTimelineEventInput,
  inventory: InventoryRow[]
): string[] {
  if (!inventory.length) return [];

  const normalizedInventory = normalizeInventoryCategories(inventory);
  const parsedRefs = parseSourceNamesFromSummary(event.summary);

  if (parsedRefs.length) {
    const validated = parsedRefs
      .map((name) => {
        const row = inventoryRowForName(normalizedInventory, name);
        if (!row) return null;
        const score = scoreSupportingRecord(eventTitle, event, row);
        if (score < MIN_SUPPORT_SCORE) return null;
        return formatPacketFileName(row.fileName);
      })
      .filter(Boolean) as string[];
    if (validated.length) return [...new Set(validated)].slice(0, 2);
  }

  const scored = normalizedInventory
    .map((row) => ({
      name: formatPacketFileName(row.fileName),
      score: scoreSupportingRecord(eventTitle, event, row),
    }))
    .filter((row) => row.score >= MIN_SUPPORT_SCORE)
    .sort((a, b) => b.score - a.score);

  let names = [...new Set(scored.map((r) => r.name))];
  if (eventTitle === 'Employment begins') {
    names = names.filter((name) => /offer|employment.?agreement/i.test(name));
    return names.slice(0, 1);
  }
  return names.slice(0, 2);
}

function validateEventAssociations(eventTitle: string, supportingUploads: string[], inventory: InventoryRow[]): string[] {
  const normalized = normalizeInventoryCategories(inventory);
  return supportingUploads.filter((displayName) => {
    const row = normalized.find((r) => formatPacketFileName(r.fileName) === displayName);
    if (!row) return false;
    return scoreSupportingRecord(eventTitle, { date: '', title: eventTitle, category: row.category, summary: '' }, row) >= MIN_SUPPORT_SCORE;
  });
}

/** Prepare a single chronology row for packet presentation. */
export function prepareChronologyPresentationEvent(
  event: PacketTimelineEventInput,
  index: number,
  inventory: InventoryRow[],
  ctx?: ChronologyPresentationContext
): PreparedChronologyEvent {
  const title = resolveChronologyEventTitle(event, index, ctx, inventory);
  let supportingUploads = pickSupportingRecordsForEvent(title, event, inventory);
  supportingUploads = validateEventAssociations(title, supportingUploads, inventory);
  const sourceDates = (event.sourceDates ?? []).filter(Boolean);
  const date = resolveChronologyEventDate(event.date, event.summary, [...sourceDates, ...supportingUploads]);

  // When the date cannot be confirmed, avoid asserting a specific outcome like "Termination documented"
  // — use a safer label that acknowledges the record exists but the date needs confirmation.
  let finalTitle = title;
  if (date === 'Date not yet clear' && /^(Termination documented|Employment ends)$/.test(title)) {
    finalTitle = 'Separation-related record requires date confirmation';
  }

  return { date, title: finalTitle, supportingUploads };
}

/** Prepare full chronology for packet rendering. */
export function prepareChronologyPresentationEvents(
  events: PacketTimelineEventInput[],
  inventory: InventoryRow[],
  ctx?: ChronologyPresentationContext
): PreparedChronologyEvent[] {
  return events
    .slice(0, 20)
    .map((event, index) => prepareChronologyPresentationEvent(event, index, inventory, ctx));
}
