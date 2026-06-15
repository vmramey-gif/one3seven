/**
 * Deterministic structured fact hints from extracted plain text (no LLM, no legal conclusions).
 * Attorney-facing wording only; worker narrative stays in dedicated intake note blocks elsewhere.
 */

import {
  availableRecordsShowPhrase,
  formatSupportingFileList,
  reviewingMayConfirmPhrase,
  takenTogetherPhrase,
} from './intakeGenerationVoice';
import { safeTrim, trimAssemblyValue } from './summarySaveDiagnostics';

export type FactSource = {
  uploadedFileId: string;
  fileName: string;
  category: string | null;
};

export type CommunicationExtractionInput = {
  uploaded_file_id: string;
  file_name: string;
  category: string | null;
  extracted_text: string;
};

export type CommunicationFacts = {
  kind: 'workplace_communications';
  source: FactSource;
  messageDate: string | null;
  sender: string | null;
  recipient: string | null;
  peopleMentioned: string[];
  employerOrCompany: string | null;
  subjectOrTopic: string | null;
  workerConcernExcerpt: string | null;
  employerOrHrResponseExcerpt: string | null;
  confidence: 'low' | 'medium';
};

/** Same shape as communication rows; both use `file_text_extractions.extracted_text`. */
export type PayRecordExtractionInput = CommunicationExtractionInput;

export type PayRecordFacts = {
  kind: 'pay_record';
  source: FactSource;
  employerName: string | null;
  employeeName: string | null;
  payPeriodStart: string | null;
  payPeriodEnd: string | null;
  payDate: string | null;
  payRateOrSalaryText: string | null;
  regularHours: string | null;
  overtimeHours: string | null;
  grossPay: string | null;
  deductionsSummary: string | null;
  netPay: string | null;
  finalPayReferences: string | null;
  confidence: 'low' | 'medium';
};

const CLIP = 120;
const BANNED_IN_OUTPUT =
  /\b(violation|violations|illegal|claim|proves|strong case|weak case|wage theft|evidence of discrimination|evidence of retaliation|legal merit|wrongful termination)\b/gi;

const MIN_PLAUSIBLE_YEAR = 1950;
const MAX_PLAUSIBLE_YEAR = new Date().getFullYear() + 2;

function plausibleYearsInString(s: string): boolean {
  const years = [...s.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => parseInt(m[1], 10));
  if (!years.length) return true;
  for (const y of years) {
    if (y < MIN_PLAUSIBLE_YEAR || y > MAX_PLAUSIBLE_YEAR) return false;
  }
  return true;
}

function partiesDistinct(sender: string | null, recipient: string | null): boolean {
  if (!sender?.trim() || !recipient?.trim()) return false;
  const a = sender.replace(/\s+/g, ' ').trim().toLowerCase();
  const b = recipient.replace(/\s+/g, ' ').trim().toLowerCase();
  if (a === b) return false;
  const fold = (x: string) => x.replace(/[^a-z0-9]+/g, '');
  const fa = fold(a);
  const fb = fold(b);
  if (fa.length > 4 && fb.length > 4 && fa === fb) return false;
  const sortedTokens = (x: string) =>
    x
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');
  if (sortedTokens(a) === sortedTokens(b) && sortedTokens(a).length > 3) return false;
  return true;
}

function snapToWordBoundaryStart(text: string, idx: number): number {
  let i = Math.max(0, idx);
  while (i > 0 && /[A-Za-z0-9]/.test(text[i - 1]) && /[A-Za-z0-9]/.test(text[i])) i--;
  return i;
}

function looksLikeEmailHeaderLine(s: string): boolean {
  return /^(from|to|subject|date|sent|cc|bcc|reply-to|message-id):\s/i.test(s.trim());
}

function isMostlyEmailHeaderLike(s: string): boolean {
  const lower = s.toLowerCase();
  const hits = (lower.match(/\b(from|to|subject|date|sent|cc|bcc):\b/g) ?? []).length;
  if (hits >= 2) return true;
  if (hits === 1 && /^.{0,48}(from|to|subject|date|sent|cc|bcc):/i.test(s.trim())) return true;
  return false;
}

function excerptStartsAtWordBoundary(full: string, excerpt: string): boolean {
  const idx = full.indexOf(excerpt);
  if (idx < 0) return true;
  if (idx === 0) return true;
  return !/[A-Za-z0-9]/.test(full[idx - 1]);
}

function excerptStartsAtSourceIndex(full: string, startIdx: number): boolean {
  if (startIdx <= 0) return true;
  return !/[A-Za-z0-9]/.test(full[startIdx - 1]);
}

const TOPIC_KEYWORDS = [
  'hr',
  'human resources',
  'manager',
  'supervisor',
  'payroll',
  'resignation',
  'termination',
  'final pay',
  'complaint',
  'schedule',
  'overtime',
  'wage',
  'wages',
  'wage terms',
  'pay period',
  'hourly',
  'pto',
] as const;

function clip(s: string, max = CLIP): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** Strip angle-bracket emails for display; keep a short human-readable token. */
function humanizeAddressField(raw: unknown): string {
  const t = trimAssemblyValue(raw, {
    file: 'documentFactExtractionService.ts',
    line: 157,
    variable: 'humanizeAddressField.raw',
  });
  const nameMatch = t.match(/^"?([^"<]+?)"?\s*</);
  if (nameMatch) return clip(nameMatch[1].trim(), 80);
  const emailOnly = t.match(/<([^>]+)>/);
  if (emailOnly) return clip(emailOnly[1].trim(), 80);
  return clip(t.replace(/^["']|["']$/g, ''), 80);
}

function scrubOutputPhrase(s: unknown): string {
  const text = typeof s === 'string' ? s : s == null ? '' : String(s);
  return clip(
    text.replace(BANNED_IN_OUTPUT, (w) => {
      const x = w.toLowerCase();
      if (x.includes('violation')) return 'concerns mentioned';
      if (x === 'illegal') return 'serious workplace issues described';
      if (x.includes('claim')) return 'issues described';
      if (x === 'proves') return 'material referenced';
      return 'items described';
    }),
    CLIP + 40
  );
}

/** Raw header value (trimmed, length-capped) before address parsing. */
function headerValue(lines: string[], prefix: RegExp, max = 220): string | null {
  for (const line of lines) {
    const m = line.match(prefix);
    if (m?.[1]) return clip(m[1].trim(), max);
  }
  return null;
}

function collectTopicHits(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  if (/\bhuman resources\b/.test(lower)) found.add('human resources');
  if (/\bhr\b/.test(lower)) found.add('hr');
  for (const kw of TOPIC_KEYWORDS) {
    if (kw === 'hr' || kw === 'human resources') continue;
    if (lower.includes(kw)) found.add(kw);
  }
  return [...found];
}

function findOnWroteDate(text: string): string | null {
  const m = text.match(/\bOn\s+(.+?)\s+wrote:/i);
  if (!m?.[1]) return null;
  const raw = clip(scrubOutputPhrase(m[1].trim()), 100);
  return plausibleYearsInString(raw) ? raw : null;
}

function findEmployerLine(lines: string[]): string | null {
  const re = /\b(inc\.?|llc|l\.l\.c\.|corp\.?|corporation|company)\b/i;
  for (const line of lines.slice(0, 50)) {
    if (line.length > 8 && re.test(line)) return clip(scrubOutputPhrase(line.trim()), CLIP);
  }
  return null;
}

function findWorkerConcernExcerpt(text: string): string | null {
  const patterns = [
    /\b(i am|i'm|i feel|concerned|worried|uncomfortable|confused about|question about)\b[^.!?]{0,200}[.!?]?/i,
    /\b(not sure|please advise|need clarification)\b[^.!?]{0,200}[.!?]?/i,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      if (idx > 0 && /[A-Za-z0-9]/.test(text[idx - 1])) continue;
      const raw = m[0].trim();
      if (looksLikeEmailHeaderLine(raw)) continue;
      if (/^(from|to|subject|date|sent)\b/i.test(raw)) continue;
      const clipped = clip(scrubOutputPhrase(raw), CLIP);
      if (!excerptStartsAtWordBoundary(text, raw)) continue;
      if (isMostlyEmailHeaderLike(clipped)) continue;
      return clipped;
    }
  }
  return null;
}

function findEmployerResponseAfterWrote(text: string): string | null {
  const idx = text.search(/\bwrote:\s*/i);
  if (idx < 0) return null;
  const after = text.slice(idx + 6).trim();
  const block = after.split(/\n{2,}/)[0] ?? after;
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    if (looksLikeEmailHeaderLine(line)) continue;
    if (/\b(hr|human resources|thanks|regards|please let me know|policy)\b/i.test(line)) {
      return clip(scrubOutputPhrase(line), CLIP);
    }
  }
  return null;
}

/** Neutral excerpt around the first detected workplace topic term (for digest context). */
function excerptAroundFirstTopic(text: string, topics: string[]): string | null {
  const lower = text.toLowerCase();
  for (const kw of topics) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx < 0) continue;
    const start = snapToWordBoundaryStart(text, Math.max(0, idx - 36));
    const end = Math.min(text.length, idx + kw.length + 72);
    const frag = text.slice(start, end).replace(/\s+/g, ' ');
    const clipped = clip(scrubOutputPhrase(frag), CLIP);
    if (!excerptStartsAtSourceIndex(text, start)) return null;
    if (isMostlyEmailHeaderLike(clipped)) return null;
    return clipped;
  }
  return null;
}

function namesFromSenderRecipient(sender: string | null, recipient: string | null): string[] {
  const out: string[] = [];
  const pushPart = (s: string) => {
    for (const part of s.split(/[,;&]/)) {
      const t = part.replace(/<[^>]+>/g, '').replace(/"/g, '').trim();
      if (t.length >= 2 && t.length < 60 && !out.includes(t)) out.push(t);
    }
  };
  if (sender) pushPart(sender);
  if (recipient) pushPart(recipient);
  return out.slice(0, 8);
}

/**
 * Deterministic communication/email-style facts from one extraction row.
 * Returns null when the text does not resemble workplace communication enough to emit facts.
 */
export function extractCommunicationFacts(row: CommunicationExtractionInput): CommunicationFacts | null {
  const text = (row.extracted_text ?? '').trim();
  if (text.length < 24) return null;

  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const headLines = lines.slice(0, 60);

  const messageDateRaw =
    headerValue(headLines, /^Date:\s*(.+)$/i) ??
    headerValue(headLines, /^Sent:\s*(.+)$/i) ??
    null;
  const messageDateFromHeader = messageDateRaw ? clip(scrubOutputPhrase(messageDateRaw), CLIP) : null;
  const messageDateFromOnWrote = findOnWroteDate(text);
  let messageDate = messageDateFromHeader ?? messageDateFromOnWrote;
  if (messageDate && !plausibleYearsInString(messageDate)) messageDate = null;

  const senderRaw = headerValue(headLines, /^From:\s*(.+)$/i);
  const recipientRaw = headerValue(headLines, /^To:\s*(.+)$/i);
  const subjectRaw = headerValue(headLines, /^Subject:\s*(.+)$/i);

  const sender = senderRaw ? humanizeAddressField(scrubOutputPhrase(senderRaw)) : null;
  const recipient = recipientRaw ? humanizeAddressField(scrubOutputPhrase(recipientRaw)) : null;
  const subjectOrTopic = subjectRaw ? scrubOutputPhrase(subjectRaw) : null;

  const topics = collectTopicHits(text);
  const employerOrCompany = findEmployerLine(headLines);
  let workerConcernExcerpt = findWorkerConcernExcerpt(text);
  if (!workerConcernExcerpt && topics.length) {
    workerConcernExcerpt = excerptAroundFirstTopic(text, topics);
  }
  if (workerConcernExcerpt && /^\s*(from|to|subject|date|sent|cc):\s/i.test(workerConcernExcerpt)) {
    workerConcernExcerpt = null;
  }
  if (workerConcernExcerpt && isMostlyEmailHeaderLike(workerConcernExcerpt)) {
    workerConcernExcerpt = null;
  }
  if (workerConcernExcerpt && !excerptStartsAtWordBoundary(text, workerConcernExcerpt)) {
    workerConcernExcerpt = null;
  }
  const employerOrHrResponseExcerpt = findEmployerResponseAfterWrote(text);

  const hasRfcHeaders = Boolean(
    /^Date:\s*/im.test(text) || /^From:\s*/im.test(text) || /^Subject:\s*/im.test(text)
  );
  const hasOnWrote = /On\s+.+\s+wrote:/i.test(text);
  const commCategory = (row.category ?? '').toLowerCase().includes('communication');

  const usable =
    hasRfcHeaders ||
    hasOnWrote ||
    topics.length >= 2 ||
    (commCategory && (subjectOrTopic || sender || recipient));

  if (!usable) return null;

  const hasStrongHeaders = Boolean(
    sender && messageDate && (subjectOrTopic || (recipient && messageDateFromHeader))
  );
  const confidence: 'low' | 'medium' = hasStrongHeaders ? 'medium' : 'low';

  const peopleMentioned = namesFromSenderRecipient(sender, recipient);

  return {
    kind: 'workplace_communications',
    source: {
      uploadedFileId: row.uploaded_file_id,
      fileName: String(row.file_name ?? 'Uploaded file'),
      category: row.category,
    },
    messageDate,
    sender,
    recipient,
    peopleMentioned,
    employerOrCompany: employerOrCompany ? scrubOutputPhrase(employerOrCompany) : null,
    subjectOrTopic,
    workerConcernExcerpt,
    employerOrHrResponseExcerpt,
    confidence,
  };
}

const PAY_TEXT_SCAN_MAX = 12_000;
const PAY_LINE_SCAN_MAX = 100;

const PAYROLL_DISTINCT_KEYWORDS = [
  'pay stub',
  'paystub',
  'gross pay',
  'net pay',
  'pay period',
  'earnings statement',
  'ytd',
  'hourly rate',
  'direct deposit',
  'tax withholding',
  'wage statement',
  'payroll',
  'deduction',
  'paycheck',
] as const;

function payScanLines(text: string): string[] {
  const slice = text.slice(0, PAY_TEXT_SCAN_MAX);
  return slice
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, PAY_LINE_SCAN_MAX);
}

function payrollKeywordDistinctCount(lower: string): number {
  let n = 0;
  for (const k of PAYROLL_DISTINCT_KEYWORDS) {
    if (lower.includes(k)) n++;
  }
  return n;
}

function payMoneyLikeContext(lower: string): boolean {
  return (
    /\bgross\b/.test(lower) ||
    /\bnet\s+(?:pay|amount|check|wages?|due)\b/i.test(lower) ||
    /\bnet\s*pay\b/i.test(lower) ||
    /\bpay\s*date\b/i.test(lower) ||
    /\bcheck\s*date\b/i.test(lower) ||
    /\bpayment\s*date\b/i.test(lower) ||
    /\bpay\s*period\b/i.test(lower) ||
    /\bearnings\s+statement\b/i.test(lower) ||
    /\bytd\b/i.test(lower)
  );
}

function firstPayLineMatch(lines: string[], re: RegExp): RegExpMatchArray | null {
  for (const line of lines) {
    const m = line.match(re);
    if (m) return m;
  }
  return null;
}

function cleanPayPhrase(s: unknown): string | null {
  const t = trimAssemblyValue(scrubOutputPhrase(s), {
    file: 'documentFactExtractionService.ts',
    line: 428,
    variable: 'cleanPayPhrase.scrubOutputPhrase(s)',
  });
  if (t.length < 4 || t.length > 100) return null;
  return t;
}

function findInlinePayDate(lines: string[]): string | null {
  const m = firstPayLineMatch(lines, /\b(?:Pay|Payment|Check)\s+Date\s*[#:]?\s*(.+)$/i);
  return m?.[1] ? clip(m[1].trim(), 80) : null;
}

/** First currency amount on a line that matches `labelTest`. */
function findLabeledCurrencyLine(lines: string[], labelTest: RegExp): string | null {
  for (const line of lines) {
    if (!labelTest.test(line)) continue;
    const m = line.match(/\$?\s*([\d,]+\.\d{2})\b/);
    if (m?.[1]) return m[1];
  }
  return null;
}

function findGrossAmount(lines: string[]): string | null {
  return findLabeledCurrencyLine(lines, /\bgross\b/i);
}

function findNetPayAmount(lines: string[]): string | null {
  for (const line of lines) {
    if (!/\bnet\b/i.test(line)) continue;
    if (!/\b(?:pay|amount|check|wages?|due|deposit)\b/i.test(line) && !/\$?\s*[\d,]+\.\d{2}/.test(line)) continue;
    const m = line.match(/\$?\s*([\d,]+\.\d{2})\b/);
    if (m?.[1]) return m[1];
  }
  return null;
}

function findRegularHours(lines: string[]): string | null {
  for (const line of lines) {
    if (!/\bregular\b/i.test(line) || !/\bhours?\b/i.test(line)) continue;
    const m =
      line.match(/\bHours?\s*[#:]?\s*([\d,]+\.?\d*)\b/i) ??
      line.match(/\bRegular\b[^|\n]{0,32}?([\d,]+\.?\d*)\s*(?:hrs?|hours)?\b/i);
    if (m?.[1]) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (!Number.isNaN(v) && v >= 0 && v < 10000) return m[1];
    }
  }
  return null;
}

function findOvertimeHours(lines: string[]): string | null {
  for (const line of lines) {
    if (!/\b(?:overtime|o\.?\s*t\.?)\b/i.test(line) || !/\bhours?\b/i.test(line)) continue;
    const m = line.match(/\bHours?\s*[#:]?\s*([\d,]+\.?\d*)\b/i) ?? line.match(/\b(?:overtime|o\.?\s*t\.?)\b[^|\n]{0,32}?([\d,]+\.?\d*)\b/i);
    if (m?.[1]) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (!Number.isNaN(v) && v >= 0 && v < 10000) return m[1];
    }
  }
  return null;
}

function payExtractIsWorthEmitting(p: {
  employerName: string | null;
  employeeName: string | null;
  payPeriodStart: string | null;
  payPeriodEnd: string | null;
  payDate: string | null;
  payRateOrSalaryText: string | null;
  regularHours: string | null;
  overtimeHours: string | null;
  grossPay: string | null;
  deductionsSummary: string | null;
  netPay: string | null;
  finalPayReferences: string | null;
}): boolean {
  let score = 0;
  if (p.grossPay) score += 2;
  if (p.netPay) score += 2;
  if (p.payPeriodStart && p.payPeriodEnd) score += 2;
  else if (p.payPeriodStart || p.payPeriodEnd) score += 1;
  if (p.payDate) score += 1;
  if (p.regularHours || p.overtimeHours) score += 1;
  if (p.payRateOrSalaryText) score += 1;
  if (p.employerName || p.employeeName) score += 1;
  if (p.deductionsSummary) score += 1;
  if (p.finalPayReferences) score += 1;
  return score >= 2;
}

/**
 * Deterministic pay-statement style facts from one extraction row.
 * Returns null when text does not look like a pay record or yields too little anchored content.
 */
export function extractPayRecordFacts(row: PayRecordExtractionInput): PayRecordFacts | null {
  const text = (row.extracted_text ?? '').trim();
  if (text.length < 32) return null;

  const lower = text.toLowerCase();
  const cat = (row.category ?? '').trim().toLowerCase();
  const isPayCategory =
    cat === 'pay records / payroll' ||
    cat === 'pay records' ||
    (cat.includes('pay') && cat.includes('payroll'));

  const kwCount = payrollKeywordDistinctCount(lower);
  const moneyCtx = payMoneyLikeContext(lower);

  if (isPayCategory) {
    if (!moneyCtx && kwCount < 2) return null;
  } else if (kwCount < 3 || !moneyCtx) {
    return null;
  }

  const lines = payScanLines(text);

  const employerFromLabel =
    headerValue(lines, /^Employer\s*[#:]?\s*(.+)$/i) ?? headerValue(lines, /^Company\s*[#:]?\s*(.+)$/i);
  let employerName = employerFromLabel ? scrubOutputPhrase(employerFromLabel) : null;
  if (!employerName) {
    const co = findEmployerLine(lines);
    if (co) employerName = scrubOutputPhrase(co);
  }

  const employeeNameRaw =
    headerValue(lines, /^Employee(?:\s+Name)?\s*[#:]?\s*(.+)$/i) ??
    headerValue(lines, /^EE\s*Name\s*[#:]?\s*(.+)$/i);
  const employeeName = employeeNameRaw ? scrubOutputPhrase(employeeNameRaw) : null;

  let payPeriodStart: string | null = null;
  let payPeriodEnd: string | null = null;
  const periodRange =
    firstPayLineMatch(lines, /\bPay\s*Period\s*[#:]?\s*(.+?)\s*(?:through|to|[-–])\s*(.+)$/i) ??
    firstPayLineMatch(
      lines,
      /\bPeriod\s+(?:Beginning|Start|From)\s*[#:]?\s*(.+?)\s+(?:To|Through|Ending|End|[-–])\s*(.+)$/i
    ) ??
    firstPayLineMatch(lines, /\bBegin\s*[#:]?\s*(.+?)\s+End\s*[#:]?\s*(.+)$/i);
  if (periodRange?.[1] && periodRange[2]) {
    payPeriodStart = cleanPayPhrase(periodRange[1]);
    payPeriodEnd = cleanPayPhrase(periodRange[2]);
  } else {
    const ppl = headerValue(lines, /^Pay\s*Period\s*[#:]?\s*(.+)$/i);
    if (ppl) {
      const parts = ppl.split(/\s*(?:through|to|[-–])\s*/i);
      if (parts.length >= 2) {
        payPeriodStart = cleanPayPhrase(parts[0] ?? '');
        payPeriodEnd = cleanPayPhrase(parts[1] ?? '');
      } else {
        payPeriodStart = cleanPayPhrase(ppl);
      }
    }
  }
  if (payPeriodStart && !plausibleYearsInString(payPeriodStart)) payPeriodStart = null;
  if (payPeriodEnd && !plausibleYearsInString(payPeriodEnd)) payPeriodEnd = null;

  const payDateRaw =
    headerValue(lines, /^Pay\s*Date\s*[#:]?\s*(.+)$/i) ??
    headerValue(lines, /^Payment\s*Date\s*[#:]?\s*(.+)$/i) ??
    headerValue(lines, /^Check\s*Date\s*[#:]?\s*(.+)$/i) ??
    findInlinePayDate(lines);
  let payDate = payDateRaw ? scrubOutputPhrase(payDateRaw) : null;
  if (payDate && !plausibleYearsInString(payDate)) payDate = null;

  const grossRaw = findGrossAmount(lines);
  const netRaw = findNetPayAmount(lines);

  let payRateOrSalaryText: string | null = null;
  const rateMatch =
    firstPayLineMatch(
      lines,
      /\b(?:Hourly\s*)?Rate\s*[#:$]?\s*(\$?\s*[\d,]+\.?\d*(?:\s*\/\s*(?:hr|hour))?)/i
    ) ?? firstPayLineMatch(lines, /\bRate\s+of\s+Pay\s*[#:$]?\s*(.+)$/i);
  if (rateMatch?.[1]) payRateOrSalaryText = scrubOutputPhrase(rateMatch[1]);
  if (!payRateOrSalaryText) {
    const sal = firstPayLineMatch(lines, /\bSalary\s*[#:$]?\s*(.+)$/i);
    if (sal?.[1]) payRateOrSalaryText = scrubOutputPhrase(sal[1]);
  }

  let deductionsSummary: string | null = null;
  for (const line of lines) {
    if (!/\btotal\s+deductions?\b/i.test(line)) continue;
    const m = line.match(/\$?\s*([\d,]+\.\d{2})\b/);
    if (m?.[1]) {
      deductionsSummary = scrubOutputPhrase(`total deductions labeled $${m[1]}`);
      break;
    }
  }
  if (!deductionsSummary) {
    const ded = firstPayLineMatch(
      lines,
      /\b(?:Federal|State|FICA|Medicare|401\s*\(?k\)?)\b[^$\n]{0,48}\$?\s*([\d,]+\.\d{2})\b/i
    );
    if (ded?.[0]) deductionsSummary = scrubOutputPhrase(ded[0].replace(/\s+/g, ' ').trim());
  }

  const finalPayReferences = /\b(?:final\s+pay|final\s+paycheck|last\s+paycheck|termination\s+pay)\b/i.test(lower)
    ? 'includes language about final pay, a final or last paycheck, or termination pay'
    : null;

  const regularHours = findRegularHours(lines);
  const overtimeHours = findOvertimeHours(lines);

  const grossPay = grossRaw ? `$${grossRaw}` : null;
  const netPay = netRaw ? `$${netRaw}` : null;

  if (
    !payExtractIsWorthEmitting({
      employerName,
      employeeName,
      payPeriodStart,
      payPeriodEnd,
      payDate,
      payRateOrSalaryText,
      regularHours,
      overtimeHours,
      grossPay,
      deductionsSummary,
      netPay,
      finalPayReferences,
    })
  ) {
    return null;
  }

  const confidence: 'low' | 'medium' =
    grossRaw && netRaw && (payDate || (payPeriodStart && payPeriodEnd))
      ? 'medium'
      : isPayCategory && (grossRaw || netRaw) && (Boolean(payPeriodStart) || Boolean(payDate))
        ? 'medium'
        : grossRaw && netRaw
          ? 'medium'
          : 'low';

  return {
    kind: 'pay_record',
    source: {
      uploadedFileId: row.uploaded_file_id,
      fileName: String(row.file_name ?? 'Uploaded file'),
      category: row.category,
    },
    employerName,
    employeeName,
    payPeriodStart,
    payPeriodEnd,
    payDate,
    payRateOrSalaryText,
    regularHours,
    overtimeHours,
    grossPay,
    deductionsSummary,
    netPay,
    finalPayReferences,
    confidence,
  };
}

/**
 * Short intake-organizer digest lines for pay records (synthesized across files when possible).
 */
export function buildPayRecordFactDigest(facts: PayRecordFacts[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (line: string) => {
    const t = trimAssemblyValue(scrubOutputPhrase(line), {
      file: 'documentFactExtractionService.ts',
      line: 690,
      variable: 'buildPayRecordFactDigest.push.scrubOutputPhrase(line)',
    });
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  if (!facts.length) return out;

  const fileNames = [...new Set(facts.map((f) => f.source.fileName))];
  if (facts.length >= 2) {
    push(
      takenTogetherPhrase(
        `uploaded payroll records (${fileNames.length} files: ${formatSupportingFileList(fileNames)}) include pay periods, amounts, or hours that may need side-by-side review in the source files.`
      )
    );
  }

  for (const f of facts) {
    if (out.length >= 8) break;
    const file = f.source.fileName;
    const highlights: string[] = [];

    if (f.payPeriodStart && f.payPeriodEnd) {
      highlights.push(
        `pay period ${scrubOutputPhrase(f.payPeriodStart)} through ${scrubOutputPhrase(f.payPeriodEnd)}`
      );
    } else if (f.payPeriodStart) {
      highlights.push(`pay period ${scrubOutputPhrase(f.payPeriodStart)}`);
    }
    if (f.payDate) highlights.push(`pay date ${scrubOutputPhrase(f.payDate)}`);
    if (f.grossPay || f.netPay) {
      highlights.push(
        [f.grossPay ? `gross ${scrubOutputPhrase(f.grossPay)}` : null, f.netPay ? `net ${scrubOutputPhrase(f.netPay)}` : null]
          .filter(Boolean)
          .join(', ')
      );
    }
    if (f.regularHours || f.overtimeHours) {
      highlights.push(
        [f.regularHours ? `regular hours ${f.regularHours}` : null, f.overtimeHours ? `overtime ${f.overtimeHours}` : null]
          .filter(Boolean)
          .join(', ')
      );
    }
    if (f.finalPayReferences) highlights.push(scrubOutputPhrase(f.finalPayReferences));

    if (highlights.length) {
      push(
        availableRecordsShowPhrase(`in “${file}”: ${highlights.slice(0, 2).join('; ')}.`)
      );
    } else if (f.employeeName || f.employerName) {
      const who = [f.employeeName, f.employerName].filter(Boolean).map(scrubOutputPhrase).join('; ');
      push(availableRecordsShowPhrase(`in “${file}” naming or employer lines such as ${who}.`));
    }
  }

  if (out.length === 1 && facts.length === 1) {
    push(reviewingMayConfirmPhrase('pay period and amount wording against the original upload.'));
  }

  return out.slice(0, 8);
}

/**
 * Short intake-organizer digest lines for communications (grouped across files when possible).
 */
export function buildCommunicationFactDigest(facts: CommunicationFacts[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (line: string) => {
    const t = trimAssemblyValue(scrubOutputPhrase(line), {
      file: 'documentFactExtractionService.ts',
      line: 761,
      variable: 'buildCommunicationFactDigest.push.scrubOutputPhrase(line)',
    });
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  if (!facts.length) return out;

  const fileNames = [...new Set(facts.map((f) => f.source.fileName))];
  const datedFiles = facts.filter((f) => f.messageDate).map((f) => f.source.fileName);
  const uniqueDates = [...new Set(facts.map((f) => f.messageDate).filter(Boolean))] as string[];

  if (datedFiles.length) {
    push(
      availableRecordsShowPhrase(
        `dated messages or threads in ${formatSupportingFileList([...new Set(datedFiles)])}${
          uniqueDates.length ? ` (for example ${uniqueDates.slice(0, 3).join(', ')})` : ''
        }.`
      )
    );
  }

  const topicSet = new Set<string>();
  for (const f of facts) {
    for (const t of collectTopicHits(
      `${f.subjectOrTopic ?? ''} ${f.workerConcernExcerpt ?? ''} ${f.employerOrHrResponseExcerpt ?? ''}`
    )) {
      topicSet.add(t);
    }
  }
  if (topicSet.size) {
    push(
      takenTogetherPhrase(
        `communication wording across ${fileNames.length} file${fileNames.length === 1 ? '' : 's'} touches ${[...topicSet].slice(0, 5).join(', ')}.`
      )
    );
  }

  let perFileDetail = 0;
  for (const f of facts) {
    if (out.length >= 9 || perFileDetail >= 4) break;
    const file = f.source.fileName;
    if (
      f.workerConcernExcerpt &&
      trimAssemblyValue(f.workerConcernExcerpt, {
        file: 'documentFactExtractionService.ts',
        line: 803,
        variable: 'buildCommunicationFactDigest.f.workerConcernExcerpt',
      }).length >= 12
    ) {
      push(
        availableRecordsShowPhrase(
          `in “${file}”, wording that may describe a worker concern (“${scrubOutputPhrase(f.workerConcernExcerpt)}”).`
        )
      );
      perFileDetail++;
    } else if (f.employerOrHrResponseExcerpt) {
      push(
        availableRecordsShowPhrase(
          `in “${file}”, wording that may reflect an HR or management reply (“${scrubOutputPhrase(f.employerOrHrResponseExcerpt)}”).`
        )
      );
      perFileDetail++;
    } else if (f.sender && f.recipient && partiesDistinct(f.sender, f.recipient)) {
      push(
        availableRecordsShowPhrase(
          `in “${file}”, a thread between ${scrubOutputPhrase(f.sender)} and ${scrubOutputPhrase(f.recipient)}.`
        )
      );
      perFileDetail++;
    }
  }

  if (!out.length) {
    push(
      takenTogetherPhrase(
        `workplace communications in ${formatSupportingFileList(fileNames)} may need review in date order with related HR or pay records.`
      )
    );
  }

  return out.slice(0, 9);
}

export type FileTitleSuggestionInput = {
  file_name: string;
  category: string;
  extracted_text?: string | null;
};

const TITLE_SNIPPET_MAX = 48;

function splitFileNameExt(fileName: string): { base: string; ext: string } {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return { base: fileName, ext: '' };
  }
  return { base: fileName.slice(0, lastDot), ext: fileName.slice(lastDot) };
}

function normalizeComparableName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function titleSnippet(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const t = scrubOutputPhrase(s.replace(/\s+/g, ' ').trim());
  if (!t || !plausibleYearsInString(t)) return null;
  if (t.length <= TITLE_SNIPPET_MAX) return t;
  return `${t.slice(0, TITLE_SNIPPET_MAX - 1).trim()}…`;
}

function looksAttorneyFriendlyFileName(fileName: string): boolean {
  const { base } = splitFileNameExt(fileName);
  return /^(pay stub|paystub|timecard|time card|offer letter|hr email|workplace email|final pay|pto record|payroll|wage statement)/i.test(
    base.trim()
  );
}

function isVagueUploadFileName(fileName: string): boolean {
  const { base } = splitFileNameExt(fileName);
  const b = base.trim();
  if (!b) return true;
  const lower = b.toLowerCase();
  if (b.length <= 5) return true;
  if (/^(scan|img|dsc|doc|file|document|photo|pic|image|upload|cam)[\s_-]*\d*$/i.test(lower)) return true;
  if (/^v\s+\w{1,24}\s+\d{6,10}$/i.test(lower)) return true;
  if (looksAttorneyFriendlyFileName(fileName)) return false;
  const words = lower.match(/[a-z]{3,}/g) ?? [];
  if (words.length === 0 && /\d{4,}/.test(lower)) return true;
  if (words.length <= 1 && /\d{6,}/.test(lower)) return true;
  if (words.length >= 2 && b.length >= 12) return false;
  return words.length < 2 || b.length < 10;
}

function dateHintFromFileName(fileName: string): string | null {
  const { base } = splitFileNameExt(fileName);
  const glued = base.match(/(?:^|[^\d])(\d{1,2})(\d{2})(\d{4})(?:[^\d]|$)/);
  if (glued) {
    const mm = Number(glued[1]);
    const dd = Number(glued[2]);
    const yyyy = Number(glued[3]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const candidate = `${String(mm).padStart(2, '0')}/${String(dd).padStart(2, '0')}/${yyyy}`;
      if (plausibleYearsInString(candidate)) return candidate;
    }
  }
  const iso = base.match(/\b(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})\b/);
  if (iso) {
    const candidate = `${iso[2].padStart(2, '0')}/${iso[3].padStart(2, '0')}/${iso[1]}`;
    if (plausibleYearsInString(candidate)) return candidate;
  }
  const us = base.match(/\b(\d{1,2})[-_./](\d{1,2})[-_./](20\d{2}|\d{2})\b/);
  if (us) {
    let y = us[3];
    if (y.length === 2) y = `20${y}`;
    const candidate = `${us[1].padStart(2, '0')}/${us[2].padStart(2, '0')}/${y}`;
    if (plausibleYearsInString(candidate)) return candidate;
  }
  return null;
}

function payPeriodLabel(f: PayRecordFacts): string | null {
  if (f.payPeriodStart && f.payPeriodEnd) {
    return titleSnippet(`${f.payPeriodStart} – ${f.payPeriodEnd}`);
  }
  return titleSnippet(f.payPeriodEnd) ?? titleSnippet(f.payPeriodStart) ?? titleSnippet(f.payDate);
}

function suggestionFromPayFacts(f: PayRecordFacts): string | null {
  const period = payPeriodLabel(f);
  if (f.finalPayReferences) {
    return period ? `Final pay record - ${period}` : 'Final pay record';
  }
  if (period) return `Pay stub - ${period}`;
  const payDate = titleSnippet(f.payDate);
  return payDate ? `Pay stub - ${payDate}` : 'Pay stub';
}

function suggestionFromCommFacts(f: CommunicationFacts): string | null {
  const subj = titleSnippet(f.subjectOrTopic);
  const date = titleSnippet(f.messageDate);
  if (subj && date) return `HR email - ${subj} (${date})`;
  if (subj) return `HR email - ${subj}`;
  if (date) return `HR email - ${date}`;
  return 'HR email';
}

function offerLetterPartyHint(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).slice(0, 80);
  const dear = headerValue(lines, /^Dear\s+([^,]+),/i, 60);
  if (dear) return titleSnippet(dear);
  const emp =
    headerValue(lines, /^Employee(?:\s+Name)?\s*[#:]?\s*(.+)$/i, 60) ??
    headerValue(lines, /^Candidate\s*[#:]?\s*(.+)$/i, 60);
  if (emp) return titleSnippet(emp);
  const co = findEmployerLine(lines);
  if (co) return titleSnippet(co);
  return null;
}

function timecardHint(text: string, fileName: string): string | null {
  const week =
    text.match(/\bweek\s+ending\s+([^\n\r]{4,40})/i)?.[1] ??
    text.match(/\bwork\s+week\s+([^\n\r]{4,32})/i)?.[1];
  if (week) return titleSnippet(week);
  return dateHintFromFileName(fileName);
}

function categoryTitleFromNameAndText(category: string, fileName: string, text: string): string | null {
  const cat = category.trim().toLowerCase();
  const date = dateHintFromFileName(fileName);
  const lowerText = text.toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (cat.includes('pay') || /\bpay\s*stub|payroll|paycheck\b/i.test(lowerText) || /\bpay\s*stub|payroll\b/i.test(lowerName)) {
    if (
      /\bfinal\s+pay|last\s+paycheck|termination\s+pay\b/i.test(lowerText) ||
      /\bfinal\s+pay|last\s+pay\b/i.test(lowerName)
    ) {
      return date ? `Final pay record - ${date}` : 'Final pay record';
    }
    return date ? `Pay stub - ${date}` : 'Pay stub';
  }
  if (cat.includes('time') || /\btimecard|timesheet|hours worked\b/i.test(lowerText)) {
    const hint = text.length >= 20 ? timecardHint(text, fileName) : date;
    return hint ? `Timecard - ${hint}` : 'Timecard';
  }
  if (cat.includes('offer') || /\boffer\s+of\s+employment|offer\s+letter\b/i.test(lowerText)) {
    const party = text.length >= 20 ? offerLetterPartyHint(text) : null;
    if (party) return `Offer letter - ${party}`;
    return date ? `Offer letter - ${date}` : 'Offer letter';
  }
  if (cat.includes('communication') || /\b(from:|subject:|wrote:)\b/i.test(lowerText)) {
    return date ? `HR email - ${date}` : 'HR email';
  }
  if (cat.includes('pto')) return date ? `PTO record - ${date}` : 'PTO record';
  if (cat.includes('hr')) return date ? `HR document - ${date}` : 'HR document';
  if (cat.includes('reimburse')) return date ? `Reimbursement record - ${date}` : 'Reimbursement record';
  if (cat.includes('performance')) return date ? `Performance review - ${date}` : 'Performance review';
  return null;
}

function suggestionFromExtractedText(text: string, category: string, fileName: string): string | null {
  const row: PayRecordExtractionInput = {
    uploaded_file_id: 'local',
    file_name: fileName,
    category,
    extracted_text: text,
  };
  const pay = extractPayRecordFacts(row);
  if (pay) return suggestionFromPayFacts(pay);
  const comm = extractCommunicationFacts(row);
  if (comm) return suggestionFromCommFacts(comm);
  return categoryTitleFromNameAndText(category, fileName, text);
}

function suggestionFromFileNameAndCategory(fileName: string, category: string): string | null {
  return categoryTitleFromNameAndText(category, fileName, '');
}

/**
 * Suggest a clearer, attorney-friendly file title (no rename applied).
 * Uses extracted text when available; otherwise category + filename hints.
 */
export function suggestAttorneyFriendlyFileTitle(input: FileTitleSuggestionInput): string | null {
  const fileName = (input.file_name ?? '').trim();
  if (!fileName) return null;
  const category = (input.category ?? '').trim() || 'Uncategorized';
  const text = (input.extracted_text ?? '').trim();

  let base =
    text.length >= 24 ? suggestionFromExtractedText(text, category, fileName) : null;
  if (!base) base = suggestionFromFileNameAndCategory(fileName, category);
  if (!base) return null;

  const cleaned = base.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const { ext } = splitFileNameExt(fileName);
  const suggestion =
    ext && !cleaned.toLowerCase().endsWith(ext.toLowerCase()) ? `${cleaned}${ext}` : cleaned;

  if (normalizeComparableName(suggestion) === normalizeComparableName(fileName)) return null;
  if (!isVagueUploadFileName(fileName) && looksAttorneyFriendlyFileName(fileName)) return null;

  return suggestion;
}
