/**
 * Firm-side intake review export: access-aware polished intake packet PDF.
 * Presentation layer only — reuses intake data without changing workflow behavior.
 */

import { ONE3SEVEN_NOTICES } from '../app/constants/one3sevenProduct';
import { FIRM_REVIEW_SECTION } from '../app/constants/firmIntakePresentation';
import type { FirmLiveIntakeView } from './intakeDataService';
import type { FirmAccessibleUploadFile } from './intakeDataService';
import {
  appendPdfBlankLine,
  appendPdfWrappedLines,
  downloadPdfFromTextLines,
  type CategoryCountRow,
  type IntakeSummaryDownloadPayload,
} from './intakeSummaryDownload';
import {
  buildFirmIntakeOverviewFields,
  partitionFirmReadinessPresentation,
  polishFirmFacingProse,
  polishFirmFacingText,
  polishMissingContextLine,
  polishTimelineEventSummary,
  polishTimelineEventTitle,
} from './firmIntakeDisplay';
import { buildIntakePacketViewModel } from './intakePacketPresentation';
import { inferCategoryFromFileName } from './intakeDataService';

export type FirmExportAccessTier = 'limited_preview' | 'full_access' | 'direct_firm_code';

export function resolveFirmExportAccessTier(view: FirmLiveIntakeView): FirmExportAccessTier {
  if (view.isFirmCodeIntake) return 'direct_firm_code';
  if (view.previewOnly) return 'limited_preview';
  return 'full_access';
}

export function firmIntakeReviewPdfFilename(intakeNumber: string): string {
  const safe = (intakeNumber || 'intake').replace(/[^\w.-]+/g, '-').slice(0, 48);
  return `one3seven-firm-intake-review-${safe}.pdf`;
}

function categoryBreakdownFromFiles(files: FirmAccessibleUploadFile[]): CategoryCountRow[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const stored = (f.category ?? '').trim();
    const cat = stored && stored !== 'Uncategorized'
      ? stored
      : inferCategoryFromFileName(f.file_name || '');
    counts.set(cat || 'Uncategorized', (counts.get(cat || 'Uncategorized') ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/** Humanize a raw filename: remove underscores and extension. */
function humanizeFileName(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\.[^.]+$/, '').trim();
}

/** Strip email headers that leak into AI-generated event titles. */
function sanitizeEventTitle(raw: string): string {
  return raw
    .replace(/\s*\([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^)]*\)/g, '')
    .replace(/\bFROM:\s*\S+/gi, '')
    .replace(/\bTO:\s*\S+/gi, '')
    .replace(/\bSUBJECT:\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Correct event titles where the stored category is wrong — use category when reliable. */
function correctEventTitle(title: string, category: string | null | undefined): string {
  const cat = (category ?? '').toLowerCase();
  if (/schedule change/i.test(title) && /meal|rest period/i.test(cat)) {
    return 'Meal-break and timekeeping records documented';
  }
  if (/schedule change/i.test(title) && /pay record|payroll/i.test(cat)) {
    return 'Pay period records documented';
  }
  return title;
}

/**
 * Cross-reference a "Schedule change" event title against the file inventory.
 * If the only file from that month is a meal-break or pay record, correct the title.
 */
function crossReferenceEventTitle(
  title: string,
  date: string,
  resolvedFiles: Array<{ file_name: string; category: string }>
): string {
  if (!/schedule change/i.test(title)) return title;

  const monthMatch = date.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[\s,]*(\d{4})?/i
  );
  const monthStr = monthMatch ? monthMatch[0].toLowerCase() : '';
  if (!monthStr) return title;

  const matchingFile = resolvedFiles.find((f) => {
    const fname = (f.file_name || '').toLowerCase().replace(/_/g, ' ');
    const cat = (f.category || '').toLowerCase();
    const monthParts = monthStr.split(/\s+/);
    const monthHit = monthParts.every((p) => fname.includes(p));
    const notSchedule = !/schedule/i.test(cat);
    return monthHit && notSchedule;
  });

  if (!matchingFile) return title;

  const cat = (matchingFile.category || '').toLowerCase();
  if (/meal|rest period/i.test(cat)) return 'Meal-break and timekeeping records documented';
  if (/pay record|payroll/i.test(cat)) return 'Pay period records documented';
  if (/witness|statement/i.test(cat)) return 'Coworker statement documented';
  if (/discipline|warning/i.test(cat)) return 'Performance record documented';
  return title;
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // "October 3, 2023" / "Oct 3 2023"
  const long = s.match(/^([a-zA-Z]+)\s+(\d{1,2})[,\s]+(\d{4})$/);
  if (long) {
    const m = MONTH_MAP[long[1].toLowerCase()];
    if (m !== undefined) return new Date(+long[3], m, +long[2]);
  }
  // "October 6, 2023" — same but with comma
  const long2 = s.match(/^([a-zA-Z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (long2) {
    const m = MONTH_MAP[long2[1].toLowerCase()];
    if (m !== undefined) return new Date(+long2[3], m, +long2[2]);
  }
  // "January 2024" — month-only
  const monthOnly = s.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthOnly) {
    const m = MONTH_MAP[monthOnly[1].toLowerCase()];
    if (m !== undefined) return new Date(+monthOnly[2], m, 1);
  }
  // "September 12, 2024" / "Sep 12 2024"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  return null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function intervalLabel(days: number): string {
  if (days === 0) return 'same day as complaint';
  if (days < 0) return `${Math.abs(days)} days before complaint`;
  if (days === 1) return '1 day after complaint';
  if (days < 30) return `${days} days after complaint`;
  const months = Math.round(days / 30.4);
  return months === 1 ? '1 month after complaint' : `approximately ${months} months after complaint`;
}

// ---------------------------------------------------------------------------
// Event-to-file linking
// ---------------------------------------------------------------------------

interface ResolvedFile {
  file_name: string;
  category: string;
}

function linkEventsToFiles(
  events: Array<{ date: string; title: string; category?: string | null }>,
  files: ResolvedFile[]
): Array<{ date: string; title: string; category?: string | null; sourceFile: string | null }> {
  return events.map((e) => {
    const evDate = parseEventDate(e.date);
    const title = e.title.toLowerCase();

    // Build date fingerprint for this event
    const dateMatch = (fname: string): boolean => {
      if (!evDate) return false;
      const yr = evDate.getFullYear().toString();
      const mo = Object.entries(MONTH_MAP)
        .filter(([, v]) => v === evDate.getMonth())
        .map(([k]) => k.slice(0, 3))
        .join('|');
      const moRe = new RegExp(mo, 'i');
      return fname.includes(yr) && moRe.test(fname);
    };

    // Try specific name-based match first (avoids wrong-file-in-same-category errors)
    let match = files.find((f) => {
      const fname = (f.file_name || '').toLowerCase().replace(/_/g, ' ');
      const cat = (f.category || '').toLowerCase();

      if (/complaint|hr complaint/i.test(title) && /workplace communications/i.test(cat))
        return /complaint/i.test(fname);
      if (/hr response/i.test(title) && /workplace communications/i.test(cat))
        return /response|email/i.test(fname);
      if (/schedule change/i.test(title) && /schedule/i.test(cat))
        return /schedule/i.test(fname);
      if (/written warning|warning issued/i.test(title) && /discipline/i.test(cat))
        return /warning/i.test(fname);
      if (/meal.break|timekeeping/i.test(title) && /meal|rest/i.test(cat))
        return /meal|break/i.test(fname);
      if (/terminat/i.test(title) && /separation/i.test(cat))
        return /terminat/i.test(fname);
      if (/employment begins|offer/i.test(title) && /offer letter/i.test(cat))
        return /offer/i.test(fname);
      // For pay events: prefer date-matching paystub; allow final paystub only for termination-date events
      if (/pay period|overtime/i.test(title) && /pay record|payroll/i.test(cat)) {
        if (/employment ends|final pay/i.test(title)) return /final/i.test(fname);
        return dateMatch(fname) && !/final/i.test(fname);
      }
      return false;
    });

    // Fall back to date-based match if no specific match found
    if (!match) {
      match = files.find((f) => {
        const fname = (f.file_name || '').toLowerCase().replace(/_/g, ' ');
        return dateMatch(fname);
      });
    }

    return { ...e, sourceFile: match ? humanizeFileName(match.file_name) : null };
  });
}

// ---------------------------------------------------------------------------
// Narrative section builders
// ---------------------------------------------------------------------------

function buildWhyThisIntakeRequiresReview(
  events: Array<{ date: string; title: string }>,
  complaintDate: Date | null
): string {
  const namedEvents = events.filter((e) => {
    const t = e.title.toLowerCase();
    return (
      /complaint|hr response|schedule change|warning|terminat|meal.break|coworker/i.test(t)
    );
  });

  if (!namedEvents.length) {
    return 'The uploaded records document an employment relationship that ended. Firm review is needed to determine what the underlying records establish.';
  }

  const sequence = namedEvents
    .map((e) => `${e.date}: ${e.title.toLowerCase()}`)
    .join('; ');

  const timingNote = complaintDate
    ? ' The sequence, timing, and relationship between these events require attorney review to assess.'
    : '';

  return `Records document the following sequence: ${sequence}.${timingNote} Firm review is needed to determine whether these events are related and what the underlying records establish.`;
}

type EventWithSource = {
  date: string;
  title: string;
  category?: string | null;
  sourceFile: string | null;
};

function buildSequenceWithTiming(
  events: EventWithSource[],
  complaintDate: Date | null
): string[] {
  const lines: string[] = [];
  for (const e of events) {
    const evDate = parseEventDate(e.date);
    let interval = '';
    if (complaintDate && evDate && evDate > complaintDate) {
      const days = daysBetween(complaintDate, evDate);
      interval = `  [${intervalLabel(days)}]`;
    }
    lines.push(`${e.date}:  ${e.title}${interval}`);
    if (e.sourceFile) {
      lines.push(`  Supported by: ${e.sourceFile}`);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Record priority groups
// ---------------------------------------------------------------------------

const RECORD_PRIORITY_ORDER: string[] = [
  'Workplace Communications',
  'Performance / discipline records',
  'Separation Records',
  'Witness Statement',
  'Schedules',
  'Meal & Rest Period Records',
  'Pay Records / Payroll',
  'Offer Letters',
  'HR Documents',
];

// Keyword-based priority test — tolerant of category-naming differences across the
// app (e.g. "HR Communications" vs. "Workplace Communications", "Termination Records"
// vs. "Separation Records"). Exact-string matching previously demoted the most
// important records (HR complaint, warning, termination letter) to "Supporting".
function isPriorityCategory(category: string | null | undefined): boolean {
  const c = (category ?? '').toLowerCase();
  if (!c) return false;
  return (
    /\bhr\b|communication|complaint|workplace/.test(c) ||
    /discipline|disciplinary|warning|performance/.test(c) ||
    /separation|termination/.test(c) ||
    /witness|statement|coworker/.test(c) ||
    /schedule/.test(c)
  );
}

function sortFilesByPriority(files: ResolvedFile[]): ResolvedFile[] {
  return [...files].sort((a, b) => {
    const ai = RECORD_PRIORITY_ORDER.indexOf(a.category);
    const bi = RECORD_PRIORITY_ORDER.indexOf(b.category);
    const aRank = ai === -1 ? 99 : ai;
    const bRank = bi === -1 ? 99 : bi;
    return aRank - bRank;
  });
}

// ---------------------------------------------------------------------------
// Supporting materials table
// ---------------------------------------------------------------------------

interface SupportingMaterialRow {
  question: string;
  support: string;
}

function buildSupportingMaterialRows(
  linkedEvents: Array<{ title: string; sourceFile: string | null }>
): SupportingMaterialRow[] {
  const rows: SupportingMaterialRow[] = [];

  for (const e of linkedEvents) {
    const title = e.title.toLowerCase();
    const hasDoc = e.sourceFile !== null;

    if (/complaint|hr complaint/i.test(title)) {
      rows.push({
        question: 'HR complaint occurred',
        support: hasDoc ? 'Document available' : 'Worker reported only',
      });
    } else if (/hr response/i.test(title)) {
      rows.push({
        question: 'Employer responded to complaint',
        support: hasDoc ? 'Employer communication available' : 'Worker reported only',
      });
    } else if (/schedule change/i.test(title)) {
      rows.push({
        question: 'Schedule or conditions changed after complaint',
        support: hasDoc ? 'Schedule notice available' : 'Worker reported only',
      });
    } else if (/written warning|warning issued/i.test(title)) {
      rows.push({
        question: 'Written warning issued',
        support: hasDoc ? 'Document available — content review required' : 'Worker reported only',
      });
    } else if (/meal.break|timekeeping/i.test(title)) {
      rows.push({
        question: 'Meal-break or timekeeping issue',
        support: hasDoc ? 'Meal-break record available — discrepancy not yet calculated' : 'Worker reported only',
      });
    } else if (/pay period|overtime|payroll/i.test(title)) {
      rows.push({
        question: 'Compensation or overtime discrepancy',
        support: hasDoc ? 'Payroll records available — discrepancy not yet calculated' : 'Worker reported only',
      });
    } else if (/terminat/i.test(title)) {
      rows.push({
        question: 'Termination documented',
        support: hasDoc ? 'Document available — stated reason requires review' : 'Worker reported only',
      });
    } else if (/coworker|witness/i.test(title)) {
      rows.push({
        question: 'Coworker corroboration',
        support: hasDoc ? 'Witness statement available' : 'Worker reported only',
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Items Requiring Confirmation
// ---------------------------------------------------------------------------

function buildItemsRequiringConfirmation(
  view: FirmLiveIntakeView,
  events: EventWithSource[],
  resolvedFiles: ResolvedFile[],
  overviewFields: Array<{ label: string; value: string }>
): string[] {
  const items: string[] = [];
  const fnames = resolvedFiles.map((f) => (f.file_name || '').toLowerCase());
  const cats = resolvedFiles.map((f) => f.category.toLowerCase());
  const titles = events.map((e) => e.title.toLowerCase());

  // Start date discrepancy
  const datesField = overviewFields.find((f) => /employment date/i.test(f.label))?.value ?? '';
  const workerStart = (datesField.split(/[-–]/)[0] ?? '').trim();
  const earliestEvent = events[0];
  if (workerStart && earliestEvent) {
    const wd = parseEventDate(workerStart);
    const ed = parseEventDate(earliestEvent.date);
    if (wd && ed && Math.abs(daysBetween(wd, ed)) > 3) {
      items.push(
        `Worker-reported start date (${workerStart}) differs from earliest employment record (${earliestEvent.date}). Actual first day worked requires confirmation.`
      );
    }
  }

  // Coworker statement dated after termination
  const termEvent = events.find((e) => /terminat/i.test(e.title));
  const coworkerFile = resolvedFiles.find((f) => /coworker|witness|statement/i.test(f.file_name));
  if (termEvent && coworkerFile) {
    const termDate = parseEventDate(termEvent.date);
    const cwFname = (coworkerFile.file_name || '').toLowerCase();
    // Look for year/month in filename
    const cwDateMatch = cwFname.match(/(\d{4})/);
    if (termDate && cwDateMatch) {
      const cwYear = parseInt(cwDateMatch[1]);
      if (cwYear >= termDate.getFullYear()) {
        items.push(
          `Coworker statement is dated after or at separation. Firm should confirm the statement was prepared independently of the claim.`
        );
      }
    }
  }

  // HR complaint substance not yet summarized
  if (titles.some((t) => /complaint/i.test(t))) {
    items.push('The substance of the HR complaint has not been extracted. Content review required to determine what was reported.');
  }

  // Termination reason not confirmed
  if (titles.some((t) => /terminat/i.test(t))) {
    items.push('The employer-stated reason for termination has not been extracted. Content review of termination letter required.');
  }

  // Meal break — discrepancy not calculated
  if (cats.some((c) => /meal|rest/i.test(c))) {
    items.push('Meal-break records are available but discrepancies have not been calculated. Review required.');
  }

  // Worker-reported facts without document support
  if (view.workerFollowUp?.arbitrationAgreement === 'yes') {
    const hasArb = fnames.some((f) => /arbitration|offer_letter|onboarding/i.test(f));
    if (!hasArb) {
      items.push('Worker reports signing an arbitration agreement. No onboarding packet or offer letter with arbitration clause has been uploaded.');
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Priority questions
// ---------------------------------------------------------------------------

function buildPriorityQuestions(
  events: Array<{ title: string }>,
  files: ResolvedFile[],
  workerStory: string,
  workerFollowUp: FirmLiveIntakeView['workerFollowUp']
): string[] {
  const titles = events.map((e) => (e.title ?? '').toLowerCase());
  const fileNames = files.map((f) => (f.file_name ?? '').toLowerCase());
  const cats = files.map((f) => (f.category ?? '').toLowerCase());
  const all = titles.join(' ') + ' ' + fileNames.join(' ') + ' ' + workerStory.toLowerCase();
  const questions: string[] = [];

  if (titles.some((t) => /complaint|human resources|hr response/i.test(t)) ||
      fileNames.some((f) => /complaint|hr_email|text_messages/i.test(f))) {
    questions.push('What specific concern did the worker report to Human Resources?');
    questions.push('What explanation, if any, did the employer provide in response?');
  }
  if (titles.some((t) => /schedule change|shift/i.test(t)) || fileNames.some((f) => /schedule/i.test(f))) {
    questions.push('Did the worker\'s schedule, duties, or treatment change after the complaint was filed?');
  }
  if (titles.some((t) => /warning|discipline/i.test(t)) || fileNames.some((f) => /warning/i.test(f))) {
    questions.push('What reason does the written warning give, and when was it issued relative to the complaint?');
  }
  if (cats.some((c) => /meal|rest period/i.test(c)) || fileNames.some((f) => /meal|break/i.test(f))) {
    questions.push('Do the meal-break records show missed breaks or unpaid premiums?');
  }
  if (cats.some((c) => /pay record|payroll/i.test(c)) || fileNames.some((f) => /paystub|payroll/i.test(f))) {
    questions.push('Do the payroll records show a measurable discrepancy in hours, overtime, or compensation?');
  }
  if (titles.some((t) => /terminat|separation/i.test(t)) || fileNames.some((f) => /terminat/i.test(f))) {
    questions.push('What reason does the termination letter provide?');
  }
  if (cats.some((c) => /witness/i.test(c)) || fileNames.some((f) => /coworker|witness|statement/i.test(f))) {
    questions.push('What events does the coworker statement independently confirm, and were they personally observed?');
  }
  if (workerFollowUp?.arbitrationAgreement === 'yes' || /arbitration/i.test(all)) {
    questions.push('Does the onboarding paperwork include a signed arbitration agreement?');
  }
  return questions.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Review Snapshot
// ---------------------------------------------------------------------------

function buildReviewSnapshot(
  view: FirmLiveIntakeView,
  overviewFields: Array<{ label: string; value: string }>,
  events: Array<{ date: string; title: string }>,
  files: ResolvedFile[]
): string[] {
  const employer = overviewFields.find((f) => /^employer/i.test(f.label))?.value ?? '';
  const dates = overviewFields.find((f) => /employment date/i.test(f.label))?.value ?? '';
  const workerName = view.workerFollowUp?.employmentName?.trim() || '';
  const nameLabel = workerName ? `${workerName} reports` : 'The worker reports';

  const lines: string[] = [];
  if (employer && dates) {
    lines.push(`${nameLabel} working for ${employer} from approximately ${dates}.`);
  } else if (employer) {
    lines.push(`${nameLabel} working for ${employer}.`);
  } else {
    lines.push(`${nameLabel} an employment matter with the records described below.`);
  }

  // Record types from files
  const fnames = files.map((f) => (f.file_name ?? '').toLowerCase());
  const cats = files.map((f) => f.category.toLowerCase());
  const allTitles = events.map((e) => e.title.toLowerCase());
  const recordTypes: string[] = [];
  if (allTitles.some((t) => /complaint|hr/i.test(t)) || fnames.some((f) => /complaint/i.test(f))) recordTypes.push('an HR complaint and documented response');
  if (fnames.some((f) => /schedule_change/i.test(f)) || cats.some((c) => /schedule/i.test(c))) recordTypes.push('a schedule-change notice');
  if (allTitles.some((t) => /warning/i.test(t)) || fnames.some((f) => /warning/i.test(f))) recordTypes.push('a written warning');
  if (cats.some((c) => /meal|rest period/i.test(c)) || fnames.some((f) => /meal|break/i.test(f))) recordTypes.push('meal-break records');
  if (cats.some((c) => /pay record|payroll/i.test(c))) recordTypes.push('payroll records');
  if (allTitles.some((t) => /terminat/i.test(t)) || fnames.some((f) => /terminat/i.test(f))) recordTypes.push('a termination letter and final paystub');
  if (cats.some((c) => /witness/i.test(c)) || fnames.some((f) => /coworker|witness|statement/i.test(f))) recordTypes.push('a coworker statement');
  if (recordTypes.length > 0) {
    lines.push(`The current record set includes ${recordTypes.join(', ')}.`);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

export function firmViewToNarrativePayload(view: FirmLiveIntakeView): IntakeSummaryDownloadPayload {
  const categoryBreakdown = categoryBreakdownFromFiles(view.files);
  const { supplementalBrief } = partitionFirmReadinessPresentation(view.readiness);

  return {
    intakeNumber: view.intakeNumber,
    overview: polishFirmFacingProse(view.overview),
    timelineSummary: polishFirmFacingProse(view.timelineSummary),
    timelineEvents: view.events.map((e) => ({
      date: e.event_date,
      title: polishTimelineEventTitle(e.title),
      category: e.category,
      summary: polishTimelineEventSummary(
        [e.ai_summary, e.worker_context].filter(Boolean).join(' — ') || '—'
      ),
    })),
    workerContext: (view.workerProvidedContext || '').trim() || '',
    categories: categoryBreakdown.map((r) => r.name),
    categoryBreakdown,
    uploadedFileInventory: view.files.map((f) => ({
      fileName: f.file_name,
      category: f.category,
    })),
    documentsUploaded: view.files.length,
    readiness: supplementalBrief,
    missing: view.missing.map(polishMissingContextLine),
    disclaimer: ONE3SEVEN_NOTICES.positioning,
    intakeStatus: view.intakeWorkflowStatus.trim() || undefined,
    orgSections: view.orgSections,
  };
}

function firmViewToExportPayload(
  view: FirmLiveIntakeView,
  tier: FirmExportAccessTier
): IntakeSummaryDownloadPayload {
  const base = firmViewToNarrativePayload(view);
  if (tier !== 'limited_preview') return base;
  return {
    ...base,
    workerContext: '',
    timelineEvents: (base.timelineEvents ?? []).map((e) => ({
      date: e.date,
      title: e.title,
      category: e.category,
      summary: '',
    })),
    uploadedFileInventory: (base.uploadedFileInventory ?? []).map((row) => ({
      fileName: '[Withheld pending approval]',
      category: row.category,
    })),
  };
}

// ---------------------------------------------------------------------------
// PDF line helpers
// ---------------------------------------------------------------------------

function push(target: string[], text: string): void {
  appendPdfWrappedLines(target, text);
}

function blank(target: string[]): void {
  appendPdfBlankLine(target);
}

function section(target: string[], title: string): void {
  blank(target);
  push(target, title);
  blank(target);
}

function bullet(target: string[], text: string): void {
  push(target, `  · ${text}`);
  blank(target);
}

function tableRow(target: string[], question: string, support: string): void {
  push(target, `  ${question}`);
  push(target, `      → ${support}`);
  blank(target);
}

// ---------------------------------------------------------------------------
// Main PDF builder
// ---------------------------------------------------------------------------

function buildFirmPolishedPacketPdfLines(
  view: FirmLiveIntakeView,
  payload: IntakeSummaryDownloadPayload,
  tier: FirmExportAccessTier
): string[] {
  const lines: string[] = [];
  const vm = buildIntakePacketViewModel(payload);
  const overviewFields = buildFirmIntakeOverviewFields(view, vm);

  const workerStory = tier === 'limited_preview'
    ? ''
    : (view.workerProvidedContext || '').trim() || payload.workerContext || '';

  // Resolve file categories
  const resolvedFiles: ResolvedFile[] = view.files.map((f) => ({
    file_name: f.file_name || '',
    category: (() => {
      const stored = (f.category ?? '').trim();
      return stored && stored !== 'Uncategorized'
        ? stored
        : inferCategoryFromFileName(f.file_name || '');
    })(),
  }));

  // Clean and deduplicate events, cross-reference titles
  const seen = new Set<string>();
  const cleanEvents = (payload.timelineEvents ?? [])
    .map((e) => {
      const sanitized = sanitizeEventTitle(polishFirmFacingText(e.title) || 'Timeline event');
      const corrected = correctEventTitle(sanitized, e.category);
      const crossChecked = crossReferenceEventTitle(corrected, e.date, resolvedFiles);
      return { ...e, title: crossChecked };
    })
    .filter((e) => {
      const key = `${e.date}::${e.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Link events to source files
  const linkedEvents = linkEventsToFiles(cleanEvents, resolvedFiles);

  // Find complaint date for timing calculations
  const complaintEvent = cleanEvents.find((e) => /complaint/i.test(e.title));
  const complaintDate = complaintEvent ? parseEventDate(complaintEvent.date) : null;

  // --- Header ---
  const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  push(lines, 'Firm Intake Review');
  push(lines, `Prepared ${generated}  ·  one3seven`);
  blank(lines);
  push(lines, `Total records: ${resolvedFiles.length}  ·  Timeline events: ${cleanEvents.length}`);

  // --- 1. Review Snapshot ---
  section(lines, '1.  Review Snapshot');
  const snapshotLines = buildReviewSnapshot(view, overviewFields, cleanEvents, resolvedFiles);
  for (const s of snapshotLines) {
    push(lines, s);
    blank(lines);
  }

  // --- 2. Why This Intake Requires Review ---
  section(lines, '2.  Why This Intake Requires Review');
  push(lines, buildWhyThisIntakeRequiresReview(cleanEvents, complaintDate));
  blank(lines);

  // --- 2B. Extracted from documents (Phase 2B — shown only when document intelligence block is present) ---
  const intel = view.intelligence;
  if (intel) {
    section(lines, '2B.  Extracted from documents  [From document content]');

    const confirmedFacts: Array<[string, string]> = [
      ['HR complaint topic', intel.confirmedComplaintTopic],
      ['Complaint date', intel.confirmedComplaintDate],
      ['HR response', intel.confirmedHrResponseSummary],
      ['Warning states', intel.confirmedWarningReason],
      ['Warning date', intel.confirmedWarningDate],
      ['Termination states', intel.confirmedTerminationReason],
      ['Termination date', intel.confirmedTerminationDate],
    ].filter((pair): pair is [string, string] => Boolean(pair[1]));

    if (confirmedFacts.length) {
      push(lines, 'Confirmed from documents:');
      blank(lines);
      for (const [label, value] of confirmedFacts) {
        push(lines, `  ${label}:  ${value}`);
        blank(lines);
      }
    }

    if (intel.coworkerCorroboration.length) {
      push(lines, `Coworker confirms:  ${intel.coworkerCorroboration.join('; ')}`);
      blank(lines);
    }

    if (intel.timingIntervals.length) {
      push(lines, 'Timing from complaint date:');
      blank(lines);
      for (const t of intel.timingIntervals) {
        bullet(lines, t.description);
      }
    }

    if (intel.keyQuotes.length) {
      push(lines, 'Key document language:');
      blank(lines);
      for (const q of intel.keyQuotes.slice(0, 4)) {
        push(lines, `  ${q.category}  —  ${q.file_name.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}`);
        push(lines, `  "${q.quote}"`);
        blank(lines);
      }
    }

    if (intel.overtimeIssueDetected) {
      push(lines, '  ⚑  Overtime hours recorded without matching overtime rate — payroll review required.');
      blank(lines);
    }
  }

  // --- 3. Intake Overview ---
  section(lines, '3.  Intake Overview');
  const meaningfulFields = overviewFields.filter((f) => {
    const v = (f.value ?? '').trim().toLowerCase();
    return v && v !== 'n/a' && v !== 'na' && v !== 'not provided' && v !== 'none';
  });
  for (const field of meaningfulFields) {
    push(lines, `${field.label}:  ${field.value}`);
    blank(lines);
  }

  // --- 4. Timeline With Source Links + Timing ---
  section(lines, '4.  Sequence for Firm Review');
  if (tier === 'limited_preview') {
    push(lines, 'Full timeline available upon approval.');
    blank(lines);
  } else if (!linkedEvents.length) {
    push(lines, 'Timeline entries will appear as dated records are organized.');
    blank(lines);
  } else {
    const seqLines = buildSequenceWithTiming(linkedEvents, complaintDate);
    for (const l of seqLines) {
      if (l.startsWith('  ')) {
        push(lines, l);
      } else {
        push(lines, l);
      }
      blank(lines);
    }
  }

  // --- 5. Priority Questions ---
  if (tier !== 'limited_preview') {
    const questions = buildPriorityQuestions(cleanEvents, resolvedFiles, workerStory, view.workerFollowUp);
    if (questions.length > 0) {
      section(lines, '5.  Priority Questions');
      for (const q of questions) {
        bullet(lines, q);
      }
    }
  }

  // --- 6. Priority Review Records ---
  section(lines, '6.  Supporting Records');
  if (tier === 'limited_preview') {
    push(lines, 'Individual file titles are withheld in limited preview exports.');
    blank(lines);
  } else if (resolvedFiles.length) {
    const sorted = sortFilesByPriority(resolvedFiles);
    const priority = sorted.filter((f) => isPriorityCategory(f.category));
    const supporting = sorted.filter((f) => !isPriorityCategory(f.category));

    if (priority.length) {
      push(lines, 'Priority Review Records');
      blank(lines);
      priority.forEach((f, i) => {
        bullet(lines, `${i + 1}.  ${humanizeFileName(f.file_name)}  —  ${f.category}`);
      });
    }
    if (supporting.length) {
      blank(lines);
      push(lines, 'Supporting Records');
      blank(lines);
      for (const f of supporting) {
        bullet(lines, `${humanizeFileName(f.file_name)}  —  ${f.category}`);
      }
    }
  } else {
    push(lines, 'No records listed for this intake yet.');
    blank(lines);
  }

  // --- 7. Supporting Materials ---
  if (tier !== 'limited_preview') {
    const evidenceRows = buildSupportingMaterialRows(linkedEvents);
    if (evidenceRows.length > 0) {
      section(lines, '7.  Supporting Materials');
      for (const row of evidenceRows) {
        tableRow(lines, row.question, row.support);
      }
    }
  }

  // --- 8. Items Requiring Confirmation ---
  // Use intelligence-derived items if available (more specific); fall back to heuristic detection
  const confirmItems = intel?.confirmationNeeded?.length
    ? intel.confirmationNeeded
    : buildItemsRequiringConfirmation(view, linkedEvents, resolvedFiles, overviewFields);
  if (confirmItems.length > 0) {
    section(lines, '8.  Items Requiring Confirmation');
    for (const item of confirmItems) {
      bullet(lines, item);
    }
  }

  // --- 9. Worker Context ---
  if (tier !== 'limited_preview') {
    section(lines, '9.  Worker Context');
    if (workerStory) {
      const paragraphs = workerStory.split(/\n+/).map((p) => p.trim()).filter(Boolean);
      for (const para of paragraphs) {
        push(lines, para);
        blank(lines);
      }
    } else {
      push(lines, 'No narrative was provided with this intake.');
      blank(lines);
    }
  }

  // --- 10. Firm Review Options ---
  section(lines, '10.  Firm Review Options');

  // Dynamic summary line
  const unresolvedCount = confirmItems.length;
  const priorityCount = resolvedFiles.filter((f) => isPriorityCategory(f.category)).length;
  push(lines, `Current items requiring confirmation: ${unresolvedCount}`);
  blank(lines);
  push(lines, `Priority records available for review: ${priorityCount} of ${resolvedFiles.length}`);
  blank(lines);

  // Additional records suggestion (filtered)
  const noReimburse = view.workerFollowUp?.reimbursed === 'no' || view.workerFollowUp?.workedRemotely === 'no';
  const additionalRec = [
    'Timecards or time records for the full employment period',
    'Wage statements for any periods not covered by uploaded paystubs',
    'Applicable employer policies (attendance, discipline, accommodation)',
    !noReimburse ? 'Expense reimbursement records if applicable' : null,
    'Any communications explaining or leading to the termination decision',
  ].filter(Boolean) as string[];

  blank(lines);
  push(lines, 'Additional records that may help complete this review:');
  blank(lines);
  for (const r of additionalRec) {
    bullet(lines, r);
  }

  blank(lines);
  push(lines, 'Actions available: Review priority documents  ·  Request clarification  ·  Request additional records  ·  Schedule consultation  ·  Accept intake  ·  Decline intake');

  // --- Disclaimer ---
  section(lines, 'Disclaimer');
  push(lines, ONE3SEVEN_NOTICES.positioning);
  blank(lines);
  push(lines, 'This packet organizes uploaded employment-related records for firm intake review. It is not a legal analysis, theory of the case, or outcome prediction.');

  return lines;
}

function buildFirmDocumentWorkflowLines(view: FirmLiveIntakeView): string[] {
  const hasDocWorkflow =
    view.documentRequest ||
    (view.documentResponse &&
      (view.documentResponse.fulfilled.length > 0 || view.documentResponse.note));
  if (!hasDocWorkflow) return [];

  const lines: string[] = [];
  blank(lines);
  push(lines, 'Supplement — Document request and worker response');
  blank(lines);
  if (view.documentRequest) {
    push(lines, 'Firm document request:');
    if (view.documentRequest.categories.length)
      push(lines, `Categories: ${view.documentRequest.categories.join('; ')}`);
    if (view.documentRequest.note.trim())
      push(lines, `Note: ${polishFirmFacingProse(view.documentRequest.note.trim())}`);
  }
  if (view.documentResponse) {
    push(lines, 'Worker response:');
    if (view.documentResponse.fulfilled.length)
      push(lines, `Fulfilled: ${view.documentResponse.fulfilled.join('; ')}`);
    if (view.documentResponse.note.trim())
      push(lines, `Worker note: ${polishFirmFacingProse(view.documentResponse.note.trim())}`);
  }
  blank(lines);
  return lines;
}

export function buildFirmIntakeReviewPdfLines(view: FirmLiveIntakeView): string[] {
  const tier = resolveFirmExportAccessTier(view);
  const payload = firmViewToExportPayload(view, tier);
  const body = buildFirmPolishedPacketPdfLines(view, payload, tier);
  return [...body, ...buildFirmDocumentWorkflowLines(view)];
}

export function downloadFirmIntakeReviewDocument(view: FirmLiveIntakeView): void {
  const pdfLines = buildFirmIntakeReviewPdfLines(view);
  downloadPdfFromTextLines(pdfLines, firmIntakeReviewPdfFilename(view.intakeNumber));
}
