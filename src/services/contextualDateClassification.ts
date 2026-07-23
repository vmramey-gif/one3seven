/**
 * Contextual date classification for employment chronology vs legal/birth/reference dates.
 * Shared by timeline generation, summaries, and sorting — not one-off year blocklists.
 */

export type DateContextCategory =
  | 'employment_chronology'
  | 'legal_reference'
  | 'birth_personal'
  | 'historical_reference'
  | 'unknown';

export const DATE_UNCLEAR_LABEL = 'Date unclear — review source document';

/**
 * Guards against fabricated precision. The AI extraction sometimes stamps an unknown or year-only
 * date as January 1 ("January 1, 2022", "01/01/2025", "2022-01-01"). A real employment event on
 * New Year's Day is rare; a Jan-1 stamp is almost always a default. Downgrade it to the year alone
 * so we never present a false-precise date the source doesn't actually support. Non-Jan-1 dates
 * (and real partial dates like "March 2025") pass through untouched.
 */
export function normalizeEventDisplayDate(date: string | null | undefined): string {
  const d = (date ?? '').trim();
  if (!d) return d;
  const janName = d.match(/^jan(?:uary)?\.?\s+0?1(?:st)?,?\s+((?:19|20)\d{2})$/i);
  if (janName) return janName[1];
  const janNum = d.match(/^0?1[/-]0?1[/-]((?:19|20)\d{2})$/);
  if (janNum) return janNum[1];
  const janIso = d.match(/^((?:19|20)\d{2})-01-01$/);
  if (janIso) return janIso[1];
  return d;
}

export type ClassifiedDateHit = {
  token: string;
  index: number;
  category: DateContextCategory;
  /** Higher = preferred employment timeline anchor (only meaningful when category is employment_chronology). */
  employmentPriority: number;
};

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_PLAUSIBLE_YEAR = 1950;
const MAX_PLAUSIBLE_YEAR = CURRENT_YEAR + 2;

const LEGAL_REFERENCE_NEAR =
  /\b(act\s+of|immigration\s+reform|control\s+act|statute|regulation|regulations|civil\s+code|labor\s+code|u\.?\s*s\.?\s*c\.?|c\.?\s*f\.?\s*r\.?|code\s+section|§\s*\d|pursuant\s+to\s+the)\b/i;

const LEGAL_REFERENCE_NEAR_LAW =
  /\b(law|laws)\b/i;

const BIRTH_PERSONAL_NEAR =
  /\b(dob|date\s+of\s+birth|birth\s*date|birthdate|born\s+on|born\s*:)\b/i;

const HISTORICAL_REFERENCE_NEAR =
  /\b(historical|history\s+of|prior\s+to\s+the\s+act|as\s+amended\s+in|originally\s+enacted)\b/i;

/** Strong employment document anchors (header / HR / payroll). */
const EMPLOYMENT_ANCHOR_HIGH =
  /\b(date\s*:|dated\s+|as\s+of\s+|effective\s+date|date\s+of\s+hire|hire\s+date|start\s+date|employment\s+dates?|employment\s+start|commencement\s+date|offer\s+date|pay\s+period|payroll\s+period|pay\s+stub|wage\s+statement|termination\s+date|separation\s+date|last\s+day|resignation\s+date|signed\s+on|signature\s+date|email\s+sent|sent\s+on|review\s+date|offer\s+letter)\b/i;

const EMPLOYMENT_ANCHOR_MEDIUM =
  /\b(effective|hired|terminated|separated|payroll|pay\s+period|timesheet|offer\s+letter|employment\s+agreement)\b/i;

const OFFER_OR_HEADER_LINE =
  /^\s*(date|offer\s+letter|employment\s+agreement)\s*[:]/im;

function windowAround(corpus: string, start: number, end: number, chars = 72): string {
  const from = Math.max(0, start - chars);
  const to = Math.min(corpus.length, end + chars);
  return corpus.slice(from, to);
}

function lineAround(corpus: string, index: number): string {
  const lineStart = corpus.lastIndexOf('\n', index) + 1;
  const lineEnd = corpus.indexOf('\n', index);
  return corpus.slice(lineStart, lineEnd === -1 ? corpus.length : lineEnd);
}

function allYearsInToken(token: string): number[] {
  const years: number[] = [];
  for (const m of token.matchAll(/\b((?:19|20)\d{2})\b/g)) {
    years.push(parseInt(m[1], 10));
  }
  return years;
}

/** Drop impossible calendar years (OCR noise, IDs, etc.). */
export function isPlausibleDateToken(token: string): boolean {
  for (const y of allYearsInToken(token)) {
    if (y < MIN_PLAUSIBLE_YEAR || y > MAX_PLAUSIBLE_YEAR) return false;
  }
  const slash = token.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (slash) {
    const y = slash[3].length === 2 ? 2000 + parseInt(slash[3], 10) : parseInt(slash[3], 10);
    if (!Number.isNaN(y) && (y < MIN_PLAUSIBLE_YEAR || y > MAX_PLAUSIBLE_YEAR)) return false;
  }
  return true;
}

function isStandaloneYearToken(token: string): boolean {
  return /^\s*(19|20)\d{2}\s*$/.test(token.trim());
}

function isFullCalendarDateToken(token: string): boolean {
  const t = token.trim();
  if (new RegExp(`^(${MONTHS})\\s+\\d{1,2},?\\s+(19|20)\\d{2}$`, 'i').test(t)) return true;
  if (/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(t)) return true;
  if (/\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/.test(t)) return true;
  return false;
}

function isMonthYearDateToken(token: string): boolean {
  return new RegExp(`^(${MONTHS})\\s+(19|20)\\d{2}$`, 'i').test(token.trim());
}

function isCalendarDateToken(token: string): boolean {
  return isFullCalendarDateToken(token) || isMonthYearDateToken(token);
}

function scoreEmploymentPriority(around: string, line: string, token: string): number {
  const lower = around.toLowerCase();
  const lineLower = line.toLowerCase();

  if (OFFER_OR_HEADER_LINE.test(lineLower) && isCalendarDateToken(token)) return 100;
  if (/\bdate\s*:\s*/i.test(lower) && isCalendarDateToken(token)) return 98;
  if (EMPLOYMENT_ANCHOR_HIGH.test(lower) && isCalendarDateToken(token)) return 95;
  if (EMPLOYMENT_ANCHOR_HIGH.test(lower) && isStandaloneYearToken(token)) return 55;
  if (EMPLOYMENT_ANCHOR_MEDIUM.test(lower) && isCalendarDateToken(token)) return 75;
  if (EMPLOYMENT_ANCHOR_MEDIUM.test(lower) && isStandaloneYearToken(token)) return 45;
  if (isFullCalendarDateToken(token)) return 40;
  if (isMonthYearDateToken(token)) return 38;
  if (isStandaloneYearToken(token)) return 0;
  return 25;
}

/**
 * Classify one date token using local text window (not global heuristics on year alone).
 */
export function classifyDateToken(
  corpus: string,
  index: number,
  token: string
): Pick<ClassifiedDateHit, 'category' | 'employmentPriority'> {
  const around = windowAround(corpus, index, index + token.length);
  const aroundLower = around.toLowerCase();
  const line = lineAround(corpus, index);
  const lineLower = line.toLowerCase();

  const priority = scoreEmploymentPriority(around, line, token);

  const birthOnLine = BIRTH_PERSONAL_NEAR.test(lineLower);
  const legalOnLine =
    LEGAL_REFERENCE_NEAR.test(lineLower) ||
    (LEGAL_REFERENCE_NEAR_LAW.test(lineLower) && /\b(act|code|section|§)\b/i.test(lineLower)) ||
    /\bact\s+of\s+(19|20)\d{2}\b/i.test(lineLower);
  const employmentOnLine =
    EMPLOYMENT_ANCHOR_HIGH.test(lineLower) || OFFER_OR_HEADER_LINE.test(lineLower);

  if (birthOnLine && !employmentOnLine) {
    return { category: 'birth_personal', employmentPriority: 0 };
  }

  if (legalOnLine) {
    return { category: 'legal_reference', employmentPriority: 0 };
  }

  // Header / hire-date lines win over legal wording on nearby lines (wide-window bleed).
  if (employmentOnLine && priority >= 75 && isCalendarDateToken(token)) {
    return { category: 'employment_chronology', employmentPriority: priority };
  }

  // Standalone years: prefer line-local legal/historical signals; fall back to narrow window.
  if (isStandaloneYearToken(token)) {
    const narrow = windowAround(corpus, index, index + token.length, 36);
    const narrowLower = narrow.toLowerCase();
    if (
      LEGAL_REFERENCE_NEAR.test(narrowLower) ||
      (LEGAL_REFERENCE_NEAR_LAW.test(narrowLower) && /\b(act|code|section|§)\b/i.test(narrowLower)) ||
      /\bact\s+of\s+(19|20)\d{2}\b/i.test(narrowLower)
    ) {
      return { category: 'legal_reference', employmentPriority: 0 };
    }
    if (HISTORICAL_REFERENCE_NEAR.test(narrowLower)) {
      return { category: 'historical_reference', employmentPriority: 0 };
    }
    if (priority >= 45) {
      return { category: 'employment_chronology', employmentPriority: priority };
    }
    return { category: 'historical_reference', employmentPriority: 0 };
  }

  if (HISTORICAL_REFERENCE_NEAR.test(aroundLower)) {
    return { category: 'historical_reference', employmentPriority: 0 };
  }

  if (priority >= 40) {
    return { category: 'employment_chronology', employmentPriority: priority };
  }

  if (isCalendarDateToken(token)) {
    return { category: 'unknown', employmentPriority: 0 };
  }

  return { category: 'unknown', employmentPriority: 0 };
}

export function isExcludedFromEmploymentChronology(category: DateContextCategory): boolean {
  return category !== 'employment_chronology';
}

function scanDatePatterns(corpus: string, onHit: (token: string, index: number) => void) {
  const run = (re: RegExp, transform?: (m: RegExpExecArray) => string) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(corpus)) !== null) {
      const token = (transform ? transform(m) : m[0]).trim();
      if (!token) continue;
      onHit(token, m.index ?? 0);
    }
  };

  run(/\b(19|20)\d{2}\b/g);
  run(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g);
  run(/\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g);
  run(
    new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2}),\\s*((?:19|20)\\d{2})\\b`, 'gi'),
    (m) => `${m[1]} ${m[2]}, ${m[3]}`
  );
  run(
    new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})\\s+((?:19|20)\\d{2})\\b`, 'gi'),
    (m) => `${m[1]} ${m[2]}, ${m[3]}`
  );
  run(
    new RegExp(`\\b(${MONTHS})\\s+((?:19|20)\\d{2})\\b`, 'gi'),
    (m) => `${m[1]} ${m[2]}`
  );
}

/** Extract and classify every plausible date-like token in corpus. */
export function extractClassifiedDates(corpus: string): ClassifiedDateHit[] {
  const seen = new Set<string>();
  const hits: ClassifiedDateHit[] = [];

  scanDatePatterns(corpus, (token, index) => {
    const key = `${index}|${token}`;
    if (seen.has(key)) return;
    if (!isPlausibleDateToken(token)) return;
    seen.add(key);

    const { category, employmentPriority } = classifyDateToken(corpus, index, token);
    hits.push({ token, index, category, employmentPriority });
  });

  return hits;
}

function employmentYearSubsumedByFullDate(hits: ClassifiedDateHit[], yearToken: string): boolean {
  const y = yearToken.trim();
  if (!isStandaloneYearToken(y)) return false;
  return hits.some(
    (h) =>
      h.category === 'employment_chronology' &&
      h.token !== y &&
      !isStandaloneYearToken(h.token) &&
      /\b(19|20)\d{2}\b/.test(h.token) &&
      h.token.includes(y)
  );
}

/** Employment-only date tokens for summaries, spans, and overview lists (deduped, chronology-sorted). */
export function uniqueSortedEmploymentChronologyDates(corpus: string, limit = 28): string[] {
  const employment = extractClassifiedDates(corpus).filter((h) => h.category === 'employment_chronology');
  const byToken = new Map<string, ClassifiedDateHit>();
  for (const h of employment) {
    const prev = byToken.get(h.token);
    if (!prev || h.employmentPriority > prev.employmentPriority) {
      byToken.set(h.token, h);
    }
  }
  const deduped = [...byToken.values()].filter(
    (h) => !employmentYearSubsumedByFullDate(employment, h.token)
  );
  const tokens = deduped
    .sort((a, b) => compareEmploymentChronologyDates(a.token, b.token))
    .map((h) => h.token);
  return tokens.slice(0, limit);
}

/** Best single anchor for a timeline row (employment chronology only). */
export function bestEmploymentChronologyAnchor(corpus: string): string {
  const employment = extractClassifiedDates(corpus).filter((h) => h.category === 'employment_chronology');
  if (!employment.length) return DATE_UNCLEAR_LABEL;

  const candidates = employment.filter((h) => !employmentYearSubsumedByFullDate(employment, h.token));

  candidates.sort((a, b) => {
    const aStandalone = isStandaloneYearToken(a.token) ? 1 : 0;
    const bStandalone = isStandaloneYearToken(b.token) ? 1 : 0;
    if (aStandalone !== bStandalone) return aStandalone - bStandalone;
    if (b.employmentPriority !== a.employmentPriority) {
      return b.employmentPriority - a.employmentPriority;
    }
    return compareEmploymentChronologyDates(a.token, b.token);
  });

  return candidates[0]?.token ?? DATE_UNCLEAR_LABEL;
}

export function buildEmploymentDateSpanSummary(dates: string[]): string {
  if (dates.length >= 2) {
    return `Date references in the text span ${dates[0]} through ${dates[dates.length - 1]} (${dates.length} total).`;
  }
  if (dates.length === 1) {
    return `Date reference in the text: ${dates[0]}.`;
  }
  return '';
}

function parseSortableTime(token: string): number | null {
  const t = token.trim();
  if (t === DATE_UNCLEAR_LABEL) return null;
  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) return parsed;
  const y = t.match(/\b(19|20)\d{2}\b/);
  if (y) return new Date(parseInt(y[0], 10), 0, 1).getTime();
  return null;
}

/** Sort employment timeline labels: dated entries first, unclear last. */
export function compareEmploymentChronologyDates(a: string, b: string): number {
  if (a === DATE_UNCLEAR_LABEL && b === DATE_UNCLEAR_LABEL) return 0;
  if (a === DATE_UNCLEAR_LABEL) return 1;
  if (b === DATE_UNCLEAR_LABEL) return -1;
  const ta = parseSortableTime(a);
  const tb = parseSortableTime(b);
  if (ta != null && tb != null && ta !== tb) return ta - tb;
  if (ta != null && tb == null) return -1;
  if (ta == null && tb != null) return 1;
  return a.localeCompare(b);
}

/** Metadata buckets for optional downstream use (not written to timeline). */
export function classifiedDatesByCategory(corpus: string): Record<DateContextCategory, string[]> {
  const out: Record<DateContextCategory, string[]> = {
    employment_chronology: [],
    legal_reference: [],
    birth_personal: [],
    historical_reference: [],
    unknown: [],
  };
  const seen = new Set<string>();
  for (const h of extractClassifiedDates(corpus)) {
    const key = `${h.category}|${h.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out[h.category].push(h.token);
  }
  for (const k of Object.keys(out) as DateContextCategory[]) {
    out[k].sort((x, y) => x.localeCompare(y));
  }
  return out;
}
