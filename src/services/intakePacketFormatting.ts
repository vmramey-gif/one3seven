/**
 * Shared formatting for intake packet HTML/PDF export (dates, metadata, filenames, worker context).
 */

export const PACKET_METADATA_FALLBACK = 'Not yet identified';

const GUIDED_INTAKE_RE =
  /---\s*O3S_GUIDED_INTAKE\s*---\s*([\s\S]*?)\s*---\s*O3S_GUIDED_INTAKE_END\s*---/i;
const WORKER_STORY_RE =
  /---\s*O3S_WORKER_STORY\s*---\s*([\s\S]*?)\s*---\s*O3S_WORKER_STORY_END\s*---/i;
const WORKER_NOTES_RE =
  /---\s*O3S_WORKER_INTAKE_NOTES\s*---\s*([\s\S]*?)\s*---\s*O3S_WORKER_INTAKE_NOTES_END\s*---/i;
const GENERIC_O3S_MARKER_RE = /---\s*O3S_[A-Z0-9_]+\s*---/gi;
const GENERIC_O3S_END_RE = /---\s*O3S_[A-Z0-9_]+_END\s*---/gi;

export type ParsedHumanContextSections = {
  guidedIntake: string;
  availableRecords: string;
  workerStory: string;
  remainder: string;
};

export function formatPacketMetadataValue(value: string | undefined | null): string {
  const t = (value ?? '').replace(/\s+/g, ' ').trim();
  return t || PACKET_METADATA_FALLBACK;
}

/** Reject employer strings that look like merged titles, labels, or extraction noise. */
export function sanitizeEmployerForPacket(
  explicit: string | undefined,
  corpusHint?: string
): string {
  if (explicit?.trim()) {
    const cleaned = cleanEmployerCandidate(explicit);
    if (cleaned) return cleaned;
  }
  if (!corpusHint?.trim()) return PACKET_METADATA_FALLBACK;

  const companyMatch = corpusHint.match(
    /\b([A-Z][A-Za-z0-9&.'-]{1,48}(?:\s+[A-Z][A-Za-z0-9&.'-]{1,32}){0,3}\s+(?:Inc\.?|LLC|L\.L\.C\.|Corp\.?|Company|Co\.))\b/
  );
  if (companyMatch?.[1]) {
    const cleaned = cleanEmployerCandidate(companyMatch[1]);
    if (cleaned) return cleaned;
  }

  const labeled = corpusHint.match(
    /employer(?:\s+or\s+company)?\s+(?:line\s+)?labeled\s+as\s+([^;.\n]{2,40})/i
  );
  if (labeled?.[1]) {
    const cleaned = cleanEmployerCandidate(labeled[1]);
    if (cleaned) return cleaned;
  }

  return PACKET_METADATA_FALLBACK;
}

function cleanEmployerCandidate(raw: string): string | null {
  let t = raw.replace(/\s+/g, ' ').trim();
  if (!t || t.length < 2) return null;
  if (t.length > 56) t = t.slice(0, 56).trim();
  const low = t.toLowerCase();
  if (
    /employee name|job title|position title|department|supervisor|hiring manager|offer letter|payroll|labeled as/i.test(
      low
    )
  ) {
    return null;
  }
  if (/^(the|a|an)\s+/i.test(t)) t = t.replace(/^(the|a|an)\s+/i, '').trim();
  if (t.split(/\s+/).length > 8) return null;
  return t || null;
}

const MONTH_WORD =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';
const MONTH_YEAR_RE = new RegExp(`\\b${MONTH_WORD}\\s+\\d{4}\\b`, 'i');
const MONTH_DAY_YEAR_RE = new RegExp(`\\b${MONTH_WORD}\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'i');

function currentYear(): number {
  return new Date().getFullYear();
}

/** True when a token is usable for employment chronology (not legal-reference / DOB bleed). */
export function isPlausibleEmploymentDateToken(token: string): boolean {
  const t = token.trim();
  if (!t || t === '—') return false;

  if (/^\d{4}$/.test(t)) {
    const y = parseInt(t, 10);
    if (y < 1992 || y > currentYear() + 1) return false;
    if (y <= 1989) return false;
    return true;
  }

  if (/\b1986\b/.test(t)) {
    if (/act|immigration|reform|control|irca/i.test(t)) return false;
    if (MONTH_DAY_YEAR_RE.test(t)) return false;
    if (!MONTH_YEAR_RE.test(t)) return false;
  }

  if (MONTH_YEAR_RE.test(t) || MONTH_DAY_YEAR_RE.test(t)) {
    const yearMatch = t.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1], 10);
      if (y < 1992 || y > currentYear() + 1) return false;
    }
    return true;
  }

  if (/^\d{1,2}\/\d{4}$/.test(t)) {
    const y = parseInt(t.split('/')[1], 10);
    return y >= 1992 && y <= currentYear() + 1;
  }

  if (/^Q[1-4]\s+\d{4}$/i.test(t)) {
    const y = parseInt(t.replace(/\D/g, '').slice(-4), 10);
    return y >= 1992 && y <= currentYear() + 1;
  }

  if (/date to confirm/i.test(t)) return true;

  return t.length >= 4 && !/^\d{4}$/.test(t);
}

export function sanitizePacketDateLabel(raw: string | undefined | null): string {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t === '—') return 'Date to confirm';
  if (!isPlausibleEmploymentDateToken(t)) return 'Date to confirm';
  return t;
}

export function filterEmploymentDateTokens(dates: string[]): string[] {
  const out: string[] = [];
  for (const d of dates) {
    const label = sanitizePacketDateLabel(d);
    if (label === 'Date to confirm') continue;
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

export function formatPacketDateRange(dates: string[]): string {
  const valid = filterEmploymentDateTokens(dates);
  if (!valid.length) return 'Date to confirm';
  if (valid.length === 1) return valid[0];
  return `${valid[0]} – ${valid[valid.length - 1]}`;
}

export function formatPacketFileName(fileName: string, maxLen = 48): string {
  let name = (fileName ?? '').trim() || 'Uploaded file';
  name = name.replace(/\\/g, '/').split('/').pop() ?? name;
  name = name.replace(/[-_][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
  name = name.replace(/[-_][0-9a-f]{16,}/gi, '');
  name = name.replace(/[-_]\d{13,}(?=\.[a-z0-9]{2,5}$)/i, '');
  name = name.replace(/\s+/g, ' ').trim();

  const dot = name.lastIndexOf('.');
  const ext = dot > 0 && dot < name.length - 1 ? name.slice(dot) : '';
  let base = ext ? name.slice(0, dot) : name;
  const maxBase = Math.max(12, maxLen - ext.length);
  if (base.length > maxBase) {
    base = `${base.slice(0, maxBase - 1).trim()}…`;
  }
  return `${base}${ext}`;
}

export function stripO3sMarkers(text: string): string {
  return text
    .replace(GENERIC_O3S_MARKER_RE, '')
    .replace(GENERIC_O3S_END_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseHumanContextSections(raw: string): ParsedHumanContextSections {
  let rest = raw ?? '';
  let guidedIntake = '';
  let workerStory = '';
  let availableRecords = '';

  const guided = rest.match(GUIDED_INTAKE_RE);
  if (guided?.[1]) {
    guidedIntake = guided[1].trim();
    rest = rest.replace(GUIDED_INTAKE_RE, '\n');
  }

  const story = rest.match(WORKER_STORY_RE);
  if (story?.[1]) {
    workerStory = story[1].trim();
    rest = rest.replace(WORKER_STORY_RE, '\n');
  }

  const notes = rest.match(WORKER_NOTES_RE);
  if (notes?.[1]) {
    availableRecords = notes[1].trim();
    rest = rest.replace(WORKER_NOTES_RE, '\n');
  }

  const describes = rest.match(/Worker describes \(intake notes\):\s*([\s\S]*)/i);
  if (describes?.[1] && !availableRecords) {
    availableRecords = describes[1].trim();
    rest = rest.replace(/Worker describes \(intake notes\):\s*[\s\S]*/i, '');
  }

  rest = stripO3sMarkers(rest);
  return {
    guidedIntake: stripO3sMarkers(guidedIntake),
    availableRecords: stripO3sMarkers(availableRecords),
    workerStory: stripO3sMarkers(workerStory),
    remainder: stripO3sMarkers(rest),
  };
}

export function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case 'grounded':
      return 'Grounded';
    case 'partial':
      return 'Partial';
    default:
      return 'Sparse';
  }
}
