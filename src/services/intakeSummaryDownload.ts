/**
 * Intake packet export: text-based PDF download (jsPDF) and optional HTML print view.
 * Organizational tone only; section order aligned to one3Seven intake packet structure.
 */

import {
  buildIntakePacketHtml,
  buildPacketCoreStoryDisplay,
  buildWorkerSummaryModel,
  collectIntakePacketPdfLines,
} from './intakePacketPresentation';
import { extractStoryFollowUpFromOverview } from './storyFollowUpPersistence';
import { ONE3SEVEN_UNIVERSAL_DISCLAIMER } from '../app/constants/one3sevenProduct';
import type { IntakeOrganizationSections } from './intakeOrganizationTypes';

export type CategoryCountRow = { name: string; count: number };

/** Fixed download filename for the worker “Print / Download PDF” action. */
export const INTAKE_SUMMARY_PDF_FILENAME = 'one3seven-intake-summary.pdf';

type KvRow = { label: string; value: string };

export type UploadedFileInventoryRow = { fileName: string; category: string };

export type IntakeSummaryDownloadPayload = {
  intakeNumber: string;
  /** Optional packet header fields (worker export / firm review). */
  workerName?: string;
  employerName?: string;
  firmCode?: string;
  intakeStatus?: string;
  overview: string;
  timelineSummary: string;
  /** Optional structured rows (e.g. Supabase `timeline_events`) when the client supplies them for export. */
  timelineEvents?: Array<{ date: string; title: string; category: string; summary: string; sourceDates?: string[] }>;
  workerContext?: string;
  categories: string[];
  /** Stored initial upload categories with counts (used for export tables). */
  categoryBreakdown?: CategoryCountRow[];
  /** Worker-approved file titles from uploaded_files (or session File list). */
  uploadedFileInventory?: UploadedFileInventoryRow[];
  documentsUploaded?: number;
  readiness: string[];
  missing: string[];
  disclaimer: string;
  /** Structured sections from O3S_ORG_ENGINE when available. */
  orgSections?: IntakeOrganizationSections;
};

const EXPORT_SECTION_BUCKETS = [
  'Compensation & Payroll',
  'Employment Records',
  'Workplace Communications',
  'Scheduling, Attendance & Leave',
  'Incident & Workplace Evidence',
  'Identity & Professional Verification',
  'Additional Supporting Records',
] as const;

type ExportBucket = (typeof EXPORT_SECTION_BUCKETS)[number];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function legacyCategoryToBucket(name: string): ExportBucket {
  switch (name) {
    case 'Pay Records / Payroll':
    case 'Reimbursement Records':
      return 'Compensation & Payroll';
    case 'Offer Letters':
    case 'HR Documents':
    case 'Performance Reviews':
      return 'Employment Records';
    case 'Workplace Communications':
      return 'Workplace Communications';
    case 'Time Records':
    case 'PTO Records':
      return 'Scheduling, Attendance & Leave';
    case 'Uncategorized':
    default:
      return 'Additional Supporting Records';
  }
}

function aggregateBucketCounts(payload: IntakeSummaryDownloadPayload): Map<ExportBucket, number> {
  const map = new Map<ExportBucket, number>();
  for (const b of EXPORT_SECTION_BUCKETS) map.set(b, 0);

  if (payload.categoryBreakdown?.length) {
    for (const row of payload.categoryBreakdown) {
      const b = legacyCategoryToBucket(row.name);
      map.set(b, (map.get(b) ?? 0) + row.count);
    }
  } else {
    for (const c of payload.categories) {
      if (!c || c === '—') continue;
      const b = legacyCategoryToBucket(c);
      map.set(b, (map.get(b) ?? 0) + 1);
    }
  }

  return map;
}

const READINESS_ISSUE_PREFIX = 'Record pattern for review: ';
const LEGACY_READINESS_ISSUE_PREFIX = 'Issue signal for attorney review only: ';

function readinessIssuePrefixMatch(line: string): { matched: boolean; rest: string } {
  if (line.startsWith(READINESS_ISSUE_PREFIX)) {
    return { matched: true, rest: line.slice(READINESS_ISSUE_PREFIX.length) };
  }
  if (line.startsWith(LEGACY_READINESS_ISSUE_PREFIX)) {
    return { matched: true, rest: line.slice(LEGACY_READINESS_ISSUE_PREFIX.length) };
  }
  return { matched: false, rest: '' };
}

function mapInternalIssueLabelToHeading(internalLabelLower: string): string | null {
  if (/wage|payroll/.test(internalLabelLower)) return 'Payroll Structure';
  if (/contract|classification|promised-pay/.test(internalLabelLower)) return 'Classification / Pay Structure';
  if (/termination|separation/.test(internalLabelLower)) return 'Final Pay';
  if (/hr|complaint|workplace communication/.test(internalLabelLower)) return 'HR Communications';
  if (/disability|accommodation|pregnancy|medical-leave/.test(internalLabelLower)) return 'HR Communications';
  if (/scheduling|attendance|meal|rest|leave/.test(internalLabelLower)) return 'Scheduling Patterns';
  return null;
}

function reviewAreaDescription(heading: string): string {
  if (/payroll/i.test(heading)) return 'Payroll and wage records appear throughout the uploaded materials.';
  if (/classification/i.test(heading)) return 'Records include salary, overtime, or classification language.';
  if (/final pay/i.test(heading)) return 'Separation or final-pay-related materials appear in the record set.';
  if (/hr communications/i.test(heading)) return 'Records include communications involving supervisors or Human Resources.';
  if (/scheduling/i.test(heading)) return 'Timekeeping materials and scheduling references appear across uploaded records.';
  if (/missing/i.test(heading)) return 'Additional records may help complete the file set.';
  return 'Available records appear to relate to this review area.';
}

function issueSignalMapFromReadiness(readiness: string[]): string[] {
  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const line of readiness) {
    const issue = readinessIssuePrefixMatch(line);
    if (!issue.matched) continue;
    const rest = issue.rest;
    const internal = (rest.split(':')[0] ?? rest).trim();
    const heading = mapInternalIssueLabelToHeading(internal.toLowerCase());
    if (!heading || seen.has(heading)) continue;
    seen.add(heading);
    bullets.push(`${heading}: ${reviewAreaDescription(heading)}`);
  }
  return bullets;
}

function hasRecordsAccessOrMissingSignal(payload: IntakeSummaryDownloadPayload): boolean {
  if (payload.missing?.length) return true;
  return payload.readiness.some((r) => {
    const x = r.toLowerCase();
    return (
      x.includes('did not have completed text extraction') ||
      x.includes('unsupported format') ||
      x.includes('empty text layer') ||
      x.includes('pending, failed, or empty text layer')
    );
  });
}

function issueSignalMapFallbackBuckets(buckets: Map<ExportBucket, number>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (heading: string, body: string) => {
    if (seen.has(heading)) return;
    seen.add(heading);
    out.push(`${heading}: ${body}`);
  };
  if ((buckets.get('Compensation & Payroll') ?? 0) > 0) add('Payroll Structure', 'Payroll and wage records appear throughout the uploaded materials.');
  if ((buckets.get('Employment Records') ?? 0) > 0) add('Classification / Pay Structure', 'Records include offer letters, HR documents, or performance materials.');
  if ((buckets.get('Workplace Communications') ?? 0) > 0) add('HR Communications', 'Records include workplace communications involving supervisors or Human Resources.');
  if ((buckets.get('Scheduling, Attendance & Leave') ?? 0) > 0) add('Scheduling Patterns', 'Timekeeping materials and scheduling references appear across uploaded records.');
  if ((buckets.get('Incident & Workplace Evidence') ?? 0) > 0) add('HR Communications', 'Records include incident or discipline-style workplace materials.');
  if ((buckets.get('Identity & Professional Verification') ?? 0) > 0) add('Records Included', 'Identity or verification documents are included in the record set.');
  if ((buckets.get('Additional Supporting Records') ?? 0) > 0) add('Supporting Records', 'Supporting or uncategorized uploads are present.');
  return out;
}

function issueSignalMapItems(payload: IntakeSummaryDownloadPayload, buckets: Map<ExportBucket, number>): string[] {
  const bullets = issueSignalMapFromReadiness(payload.readiness);
  const headingsSeen = new Set<string>();
  for (const b of bullets) {
    const m = b.match(/^(.+?):/);
    if (m) headingsSeen.add(m[1].trim());
  }
  const recordsHeading = 'Possible Missing Records';
  if (hasRecordsAccessOrMissingSignal(payload) && !headingsSeen.has(recordsHeading)) {
    bullets.push(`${recordsHeading}: Additional records may help complete the file set.`);
  }
  if (bullets.length) return bullets;
  return issueSignalMapFallbackBuckets(buckets);
}

const EXPORT_MIN_PLAUSIBLE_YEAR = 1950;
const EXPORT_MAX_PLAUSIBLE_YEAR = new Date().getFullYear() + 2;
const TIMELINE_SUMMARY_FALLBACK = 'Review source file for details.';

function stripImplausibleYears(text: string): string {
  return text
    .replace(/\b(19|20)\d{2}\b/g, (y) => {
      const n = parseInt(y, 10);
      if (n < EXPORT_MIN_PLAUSIBLE_YEAR || n > EXPORT_MAX_PLAUSIBLE_YEAR) return '';
      return y;
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function isMachineStatusParagraph(p: string): boolean {
  const x = p.toLowerCase();
  return (
    x.includes('we pulled readable text') ||
    x.includes('we noticed') ||
    x.includes('date-like pattern') ||
    x.includes('date references(s)') ||
    x.includes('date reference(s)') ||
    /\bdate references\(s\)/i.test(p) ||
    x.includes('suggested category labels') ||
    x.includes('your own notes') ||
    x.includes('worker-provided narrative stay')
  );
}

function firstCompleteSentences(s: string, maxLen: number): string {
  const t = s.replace(/…+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const sentences = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  let out = '';
  for (const sent of sentences) {
    const next = out ? `${out} ${sent}` : sent;
    if (next.length <= maxLen) out = next;
    else break;
  }
  if (out) return out;
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const sp = cut.lastIndexOf(' ');
  return sp > maxLen * 0.35 ? cut.slice(0, sp).trim() : cut.trim();
}

function hasIncompleteTrailingToken(s: string): boolean {
  if (/[.!?]$/.test(s.trim())) return false;
  const parts = s.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  if (last.length <= 3 && /^[a-z]+$/i.test(last)) return true;
  return /\b(fro|hin|tha|wit|rem|pre|wor|con|par|sig|det|lab|tit)$/i.test(last);
}

function hasOnlyPlausibleYearsInString(s: string): boolean {
  for (const m of s.matchAll(/\b((?:19|20)\d{2})\b/g)) {
    const y = parseInt(m[1], 10);
    if (y < EXPORT_MIN_PLAUSIBLE_YEAR || y > EXPORT_MAX_PLAUSIBLE_YEAR) return false;
  }
  return true;
}

function sanitizeEventDateForExport(d: string | undefined): string {
  const raw = (d ?? '').trim();
  if (!raw || raw === '—') return '—';
  if (!hasOnlyPlausibleYearsInString(raw)) return '—';
  const s = stripImplausibleYears(raw);
  return s || '—';
}

function exportDocumentTotal(payload: IntakeSummaryDownloadPayload): number {
  const n = Math.max(0, payload.documentsUploaded ?? 0);
  if (n > 0) return n;
  const catSum = payload.categoryBreakdown?.reduce((a, r) => a + r.count, 0) ?? 0;
  if (catSum > 0) return catSum;
  return payload.categories.filter((c) => c && c !== '—').length;
}

function extractionCompletionSummaryForExport(payload: IntakeSummaryDownloadPayload): string | null {
  const total = exportDocumentTotal(payload);
  if (total <= 0) return null;

  let withoutExtraction = 0;
  const reNumbered = /\b(\d+)\s+upload\(s\)\s+did not have completed text extraction\b/i;
  let sawIncompleteSignalWithoutCount = false;

  const scan = (text: string) => {
    const m = text.match(reNumbered);
    if (m) withoutExtraction = Math.max(withoutExtraction, parseInt(m[1], 10));
    else if (
      /did not have completed text extraction|empty text layer|pending.*extraction|unsupported format/i.test(text) &&
      /\bupload/i.test(text)
    ) {
      sawIncompleteSignalWithoutCount = true;
    }
  };

  for (const line of payload.readiness) scan(line);
  for (const m of payload.missing) scan(m);

  if (withoutExtraction > total || (sawIncompleteSignalWithoutCount && withoutExtraction === 0)) {
    return 'Readable text was available for some uploaded records; remaining files may require manual review.';
  }

  const withText = Math.max(0, total - withoutExtraction);
  if (withoutExtraction > 0) {
    return `Text available for review: ${withText} of ${total} uploaded record${total === 1 ? '' : 's'}. ${withoutExtraction} record${withoutExtraction === 1 ? '' : 's'} may need manual review or clearer source text.`;
  }
  return `Text available for review: ${total} uploaded record${total === 1 ? '' : 's'}.`;
}

function formatUploadedFileInventoryForExport(rows: UploadedFileInventoryRow[]): string {
  if (!rows.length) return 'No uploaded file titles were listed for this packet.';
  const byCat = new Map<string, string[]>();
  for (const row of rows) {
    const c = (row.category ?? '').trim() || 'Uncategorized';
    const list = byCat.get(c) ?? [];
    list.push((row.fileName ?? '').trim() || 'Uploaded file');
    byCat.set(c, list);
  }
  return [...byCat.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, names]) => `${cat}: ${names.join('; ')}`)
    .join('\n');
}

function formatCategoryBreakdownForExport(payload: IntakeSummaryDownloadPayload): string {
  if (payload.categoryBreakdown?.length) {
    return payload.categoryBreakdown.map((r) => `${r.name}: ${r.count}`).join('; ');
  }
  const counts = new Map<string, number>();
  for (const c of payload.categories) {
    if (!c || c === '—') continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  if (!counts.size) return 'Initial record categories were not available.';
  return [...counts.entries()].map(([n, c]) => `${n}: ${c}`).join('; ');
}

function formatReviewAreasForExport(payload: IntakeSummaryDownloadPayload, buckets: Map<ExportBucket, number>): string {
  return issueSignalMapItems(payload, buckets)
    .map((line) => `• ${line}`)
    .join('\n');
}

function reviewAreaHeadingsForDigest(payload: IntakeSummaryDownloadPayload, buckets: Map<ExportBucket, number>): string[] {
  const headings: string[] = [];
  const seen = new Set<string>();
  for (const line of issueSignalMapItems(payload, buckets)) {
    const m = line.match(/review area\s+[—-]\s+(.+?)\./i);
    const heading = (m?.[1] ?? line).trim();
    if (!heading || seen.has(heading)) continue;
    seen.add(heading);
    headings.push(heading);
    if (headings.length >= 5) break;
  }
  return headings;
}

const SUGGESTED_REVIEW_PRIORITY_PREFIX = 'Suggested review priority: ';
const PACKET_BOUNDARY_PHRASE = 'this packet organizes records and worker-provided context';

function initialReviewAreasForSnapshot(payload: IntakeSummaryDownloadPayload, buckets: Map<ExportBucket, number>): string {
  const areas = issueSignalMapItems(payload, buckets);
  const headings: string[] = [];
  for (const line of areas) {
    const m = line.match(/^Topic for human review — (.+?)\./);
    if (m) headings.push(m[1].trim());
    else headings.push(line.slice(0, 100).trim());
    if (headings.length >= 5) break;
  }
  if (!headings.length) {
    return 'No additional review areas were highlighted beyond the worker story and uploaded records.';
  }
  return headings.map((h) => `• ${h}`).join('\n');
}

function sanitizeOverviewForExportDigest(text: string): string {
  return text
    .replace(/\bviolations?\b/gi, 'concerns described in uploaded materials')
    .replace(/\billegal(?:ly)?\b/gi, 'potentially serious workplace issues described in uploaded materials')
    .replace(/\bproves?\b/gi, 'suggests')
    .replace(/\bclaim exists\b/gi, 'issues described in uploaded materials')
    .replace(/\bemployer violated\b/gi, 'employer conduct described in uploaded materials')
    .replace(/\brecords show violations\b/gi, 'uploaded text describes concerns that warrant attorney confirmation')
    .replace(/\bdate-like patterns?\b/gi, 'date references')
    .replace(/\borganized review signals\b/gi, 'document-text review prompts')
    .replace(/\byour originals\b/gi, 'source records on file')
    .replace(/\byour uploaded documents?\b/gi, 'uploaded records')
    .replace(/\byour own notes\b/gi, 'worker-provided narrative');
}

function clipExportProse(s: string, max: number): string {
  const t = s.replace(/…+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return sp > max * 0.45 ? cut.slice(0, sp).trim() : cut.trim();
}

function buildSection2ExportDigest(payload: IntakeSummaryDownloadPayload): string {
  return buildPacketCoreStoryDisplay(payload);
}

export function buildIntakeSummaryPreviewDigest(payload: IntakeSummaryDownloadPayload): string {
  return buildPacketCoreStoryDisplay(payload);
}

function normalizeReadinessPartyFragment(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u201c\u201d"']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function trimReadinessPartyTail(s: string): string {
  const cut = s.split(/\b(?:in|on|regarding|about|during|based|according)\b/i)[0] ?? s;
  return cut.replace(/[.,;)]+$/g, '').trim();
}

function isDuplicateCommunicationBetweenReadiness(line: string): boolean {
  if (!/communication\s+between/i.test(line)) return false;
  const m = line.match(/communication\s+between\s+(.+?)\s+and\s+(.+)/i);
  if (!m) return false;
  const a = normalizeReadinessPartyFragment(m[1]);
  const b = normalizeReadinessPartyFragment(trimReadinessPartyTail(m[2]));
  return Boolean(a && a === b);
}

function hasMidWordReadinessSnippet(line: string): boolean {
  const q = `["'(\u201c\u2018]`;
  if (new RegExp(`${q}\\s*[a-z]{0,6}(?:ployment|duction|struction|formation|viewing|ization)\\b`, 'i').test(line))
    return true;
  if (/…\s*[a-z]{2,}(?:ment|tion|view|ords)\b/i.test(line)) return true;
  return false;
}

function hasReadinessEmailHeaderFragment(line: string): boolean {
  if (/humanresources@/i.test(line)) return true;
  return /\b(from|to|subject|sent):\s*[\w"'<@]/i.test(line);
}

function shouldDropStaleReadinessLine(line: string): boolean {
  const low = line.toLowerCase();
  if (isDuplicateCommunicationBetweenReadiness(line)) return true;
  if (hasMidWordReadinessSnippet(line)) return true;
  if (hasReadinessEmailHeaderFragment(line)) return true;
  if (low.startsWith('records show (excerpt') || low.includes('records show (excerpt')) return true;
  if (low.includes('suggested category from document wording')) return true;
  if (low.includes('did not clearly suggest a bucket')) return true;
  return false;
}

function formatReadinessForRecordPatterns(readiness: string[]): string[] {
  const filtered: string[] = [];
  for (const raw of readiness) {
    const line = raw.trim();
    if (!line) continue;
    if (shouldDropStaleReadinessLine(line)) continue;
    if (line.toLowerCase().includes(PACKET_BOUNDARY_PHRASE)) continue;
    const low = line.toLowerCase();
    if (
      isMachineStatusParagraph(line) ||
      low.includes('extracted plain text is available') ||
      low.includes('worker-provided context (if any) is stored') ||
      low.includes('was compared to document text for repeated neutral terms')
    ) {
      continue;
    }
    filtered.push(sanitizeOverviewForExportDigest(line));
  }
  return formatReadinessForExportPacket(filtered);
}

function digestTimelineSummaryCell(summary: string): string {
  const raw = summary.replace(/…+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw || raw === '—') return TIMELINE_SUMMARY_FALLBACK;
  const cleaned = stripImplausibleYears(raw);
  if (!cleaned || isMachineStatusParagraph(cleaned)) return TIMELINE_SUMMARY_FALLBACK;
  const capped = firstCompleteSentences(cleaned, 360);
  if (!capped || capped.length < 12) return TIMELINE_SUMMARY_FALLBACK;
  if (hasIncompleteTrailingToken(capped)) return TIMELINE_SUMMARY_FALLBACK;
  return stripImplausibleYears(capped);
}

function chronologyHighlightLines(payload: IntakeSummaryDownloadPayload): string[] {
  const cleanLine = (s: string) => {
    const t = stripImplausibleYears(sanitizeOverviewForExportDigest(s.replace(/…+/g, ' '))).trim();
    if (!t || isMachineStatusParagraph(t)) return '';
    const one = firstCompleteSentences(t, 520);
    if (!one || hasIncompleteTrailingToken(one)) return '';
    return stripImplausibleYears(one);
  };
  const raw = stripImplausibleYears((payload.timelineSummary ?? '').trim());
  if (raw && raw !== '—' && !isMachineStatusParagraph(raw)) {
    const lines = raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(cleanLine)
      .filter(Boolean);
    if (lines.length > 1) return lines.slice(0, 10);
    const sentences = raw
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(cleanLine)
      .filter(Boolean);
    if (sentences.length > 1) return sentences.slice(0, 10);
    const single = cleanLine(raw);
    if (single) return [single];
  }
  return [
    'Use the timeline summary together with source uploads and any intake date narratives to anchor chronology; firm review should confirm dates in primary records.',
  ];
}

function softAdditionalRecords(missing: string[]): string[] {
  const base = [
    'Offer letter or compensation agreement',
    'Employee handbook acknowledgment',
    'Final wage statement or severance materials',
    'Additional performance documentation',
    'Full separation notice or restructuring communication',
    'Reimbursement-related records or expense documentation',
  ];
  const merged = [...missing.map((m) => m.trim()).filter(Boolean)];
  for (const b of base) {
    if (!merged.some((x) => x.toLowerCase() === b.toLowerCase())) merged.push(b);
  }
  return merged;
}

function tableRow(label: string, value: string): string {
  return `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value).replace(/\n/g, '<br/>')}</td></tr>`;
}

function ulItems(items: string[]): string {
  if (!items.length) return `<p class="muted">${escapeHtml('—')}</p>`;
  return `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
}

function buildTimelineEventsTable(
  events: NonNullable<IntakeSummaryDownloadPayload['timelineEvents']>
): string {
  const header = `<thead><tr><th scope="col">${escapeHtml('Date')}</th><th scope="col">${escapeHtml(
    'Title'
  )}</th><th scope="col">${escapeHtml('Category')}</th><th scope="col">${escapeHtml('Summary')}</th></tr></thead>`;
  const rows = events
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.date || '—')}</td><td>${escapeHtml(e.title || '—')}</td><td>${escapeHtml(
          e.category || '—'
        )}</td><td class="prose digest-timeline-sum">${escapeHtml(digestTimelineSummaryCell(e.summary || '—'))}</td></tr>`
    )
    .join('');
  return `<table class="memo-table digest" role="presentation">${header}<tbody>${rows}</tbody></table>`;
}

function computeIntakeSummaryExportState(payload: IntakeSummaryDownloadPayload): {
  generated: string;
  workerBlock: string;
  employmentRows: KvRow[];
  supportingRows: KvRow[];
  uploadedFileTitleRows: KvRow[];
  issueMap: string[];
  chronology: string[];
  completeness: string[];
  additional: string[];
  keyIndividualsNote: string;
  digestedOverview: string;
  platformDisclaimerMerged: string;
  timelineText: string;
  timelineEvents: NonNullable<IntakeSummaryDownloadPayload['timelineEvents']>;
} {
  const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const buckets = aggregateBucketCounts(payload);
  const docCount = exportDocumentTotal(payload);
  const workerBlock = (payload.workerContext ?? '').trim();

  const represented = EXPORT_SECTION_BUCKETS.filter((b) => (buckets.get(b) ?? 0) > 0);
  const employmentRows: KvRow[] = [
    {
      label: 'Upload inventory',
      value:
        docCount > 0
          ? `Uploaded materials include ${docCount} document${docCount === 1 ? '' : 's'} in this intake session.`
          : 'Upload count was not available; supporting categories may still reflect saved intake data.',
    },
    {
      label: 'Category buckets represented',
      value: represented.length
        ? represented.join('; ')
        : 'No record categories were available for the supporting table.',
    },
    { label: 'Initial Review Areas', value: initialReviewAreasForSnapshot(payload, buckets) },
  ];

  const nonEmptyBuckets = EXPORT_SECTION_BUCKETS.filter((bucket) => (buckets.get(bucket) ?? 0) > 0);
  const totalBucketFiles = [...buckets.values()].reduce((a, n) => a + n, 0);
  const supportingRows: KvRow[] =
    nonEmptyBuckets.length === 0
      ? [
          {
            label: 'Records reviewed',
            value:
              totalBucketFiles === 0 && docCount === 0
                ? 'No uploaded records were counted for this packet.'
                : 'No categorized records were available for this packet.',
          },
        ]
      : nonEmptyBuckets.map((bucket) => {
          const n = buckets.get(bucket) ?? 0;
          const desc = `${n} record${n === 1 ? '' : 's'} in this intake bucket; confirm details in source files when reviewing.`;
          return { label: bucket, value: desc };
        });

  const uploadedFileTitleRows: KvRow[] =
    payload.uploadedFileInventory && payload.uploadedFileInventory.length > 0
      ? [
          {
            label: 'Uploaded file titles',
            value: formatUploadedFileInventoryForExport(payload.uploadedFileInventory),
          },
        ]
      : [];

  const issueMap = issueSignalMapItems(payload, buckets);
  const chronology = chronologyHighlightLines(payload);
  const completeness =
    payload.readiness.length > 0
      ? formatReadinessForRecordPatterns(payload.readiness)
      : ['Additional organizational signals may be added as the intake record set grows.'];
  const additional = softAdditionalRecords(payload.missing);

  const keyIndividualsNote =
    'No separate name index is generated yet. Individuals may appear in worker-provided context or within the documents themselves.';

  const digestedOverview = buildSection2ExportDigest(payload);

  const platformDisclaimerMerged = [
    'This packet organizes employment-related records and worker-provided context for participating firm intake review. It is not legal analysis, a theory of the case, or an outcome prediction. It does not decide claims or provide legal advice.',
    ONE3SEVEN_UNIVERSAL_DISCLAIMER,
  ].join('\n\n');

  const timelineRaw = (payload.timelineSummary ?? '').trim();
  const timelineText =
    !timelineRaw || timelineRaw === '—' || isMachineStatusParagraph(timelineRaw)
      ? ''
      : stripImplausibleYears(timelineRaw);
  const timelineEvents =
    payload.timelineEvents && payload.timelineEvents.length > 0
      ? payload.timelineEvents.map((e) => ({
          ...e,
          date: sanitizeEventDateForExport(e.date),
          summary: digestTimelineSummaryCell(e.summary || '—'),
        }))
      : [];

  return {
    generated,
    workerBlock,
    employmentRows,
    supportingRows,
    uploadedFileTitleRows,
    issueMap,
    chronology,
    completeness,
    additional,
    keyIndividualsNote,
    digestedOverview,
    platformDisclaimerMerged,
    timelineText,
    timelineEvents,
  };
}

/** Normalize a few typographic characters for reliable PDF literal strings (WinAnsi subset). */
function pdfSafeText(s: string): string {
  return s
    .replace(/\u00b7/g, ' - ')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2192/g, '->')   // \u2192 arrow (used in Evidence Support rows)
    .replace(/\u2691/g, '!')    // \u2691 flag marker (used for payroll alert)
    .replace(/\u2713|\u2714/g, '[x]'); // \u2713 checkmarks, if present
}

function escapePdfLiteral(s: string): string {
  return pdfSafeText(s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\x20-\x7e]/g, '?');
}

function wrapPdfLine(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) out.push(cur);
      if (w.length <= maxChars) cur = w;
      else {
        for (let i = 0; i < w.length; i += maxChars) out.push(w.slice(i, i + maxChars));
        cur = '';
      }
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

function pushWrapped(lines: string[], text: string, maxChars = 92): void {
  for (const ln of wrapPdfLine(pdfSafeText(text), maxChars)) lines.push(ln);
}

function pushBlank(lines: string[]): void {
  if (lines.length && lines[lines.length - 1] !== '') lines.push('');
}

function collectIntakeSummaryPdfLines(
  payload: IntakeSummaryDownloadPayload,
  state: ReturnType<typeof computeIntakeSummaryExportState>
): string[] {
  const lines: string[] = [];
  const push = (t: string) => pushWrapped(lines, t);
  const blank = () => pushBlank(lines);

  push('Story packet organized for review');
  push(`Intake reference: ${payload.intakeNumber} / Generated ${state.generated} / one3Seven`);
  blank();

  push('1. Review Summary');
  const followUp = extractStoryFollowUpFromOverview(payload.workerContext ?? '');
  const storyRows: KvRow[] = [
    { label: 'Worker', value: followUp?.employmentName?.trim() || payload.workerName || '' },
    { label: 'Employer', value: followUp?.employer?.trim() || payload.employerName || '' },
    { label: 'Employment Dates', value: followUp?.employmentDates?.trim() || '' },
  ].filter((row) => Boolean(row.value.trim()));
  for (const r of storyRows) {
    push(`${r.label}:`);
    for (const part of wrapPdfLine(pdfSafeText(r.value), 88)) lines.push(`    ${part}`);
  }
  if (storyRows.length > 0) blank();
  if (state.digestedOverview) push(state.digestedOverview);
  else push('The intake is being organized from worker-provided context and uploaded records.');
  blank();
  if (state.timelineEvents.length > 0) {
    push('Major events:');
    for (const e of state.timelineEvents.slice(0, 4)) push(`- ${e.title || e.summary || e.category}`);
    blank();
  }
  if (followUp?.complainedOrReported?.trim()) {
    push(`Worker-reported concerns: ${followUp.complainedOrReported.trim()}`);
    blank();
  }
  if (followUp?.changedAfterward?.trim()) {
    push(`What changed afterward: ${followUp.changedAfterward.trim()}`);
    blank();
  }

  push('2. Review Areas');
  if (!state.issueMap.length) push('No specific review areas were highlighted beyond the worker story and uploaded records.');
  else for (const it of state.issueMap.slice(0, 7)) push(`- ${it}`);
  blank();

  push('3. Timeline');
  if (state.timelineEvents.length > 0) {
    for (const e of state.timelineEvents) {
      const sum = digestTimelineSummaryCell(e.summary || '-');
      push(e.date || 'Date not yet clear');
      push(e.title || 'Timeline event');
      for (const part of wrapPdfLine(sum, 88)) lines.push(`    ${part}`);
      blank();
    }
  } else {
    push('No timeline rows were available for this packet.');
  }
  blank();

  push('4. Possible Missing Records');
  if (state.additional.length > 0) {
    for (const it of state.additional.slice(0, 5)) push(`- ${it}`);
  } else {
    push('No missing records listed yet.');
  }
  blank();

  push('5. In Your Own Words / Worker Statement');
  if (state.workerBlock.length > 0) push(state.workerBlock);
  else push('No additional free-form worker statement was available in the captured intake fields.');
  blank();

  push('6. Supporting Documents');
  for (const r of state.supportingRows) {
    push(`${r.label}:`);
    for (const part of wrapPdfLine(pdfSafeText(r.value), 88)) lines.push(`    ${part}`);
    blank();
  }
  for (const r of state.uploadedFileTitleRows) {
    push(`${r.label}:`);
    for (const part of wrapPdfLine(pdfSafeText(r.value), 88)) lines.push(`    ${part}`);
    blank();
  }

  push('7. Legal Disclaimer');
  push(state.platformDisclaimerMerged);
  if ((payload.disclaimer ?? '').trim()) push(payload.disclaimer.trim());
  blank();
  push('Text-based PDF generated by one3Seven for search and copy.');

  return lines;
}

/** Letter-size pages with built-in Helvetica (selectable text, no embedded canvas). */
function buildAsciiTextPdf(allLines: string[]): Uint8Array {
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 48;
  const FONT_SIZE = 9;
  const LEADING = 11;
  const MAX_CHARS = 92;
  const firstY = PAGE_H - MARGIN;
  const minY = MARGIN + 36;
  const perPage = Math.max(8, Math.floor((firstY - minY) / LEADING));

  const normalized = allLines.flatMap((l) => (l.length <= MAX_CHARS ? [l] : wrapPdfLine(l, MAX_CHARS)));
  const pages: string[][] = [];
  for (let i = 0; i < normalized.length; i += perPage) {
    pages.push(normalized.slice(i, i + perPage));
  }
  if (!pages.length) pages.push(['']);

  const P = pages.length;
  const fontId = 2 * P + 3;
  const obj = new Map<number, string>();

  obj.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kidRefs = Array.from({ length: P }, (_, k) => `${3 + 2 * k} 0 R`).join(' ');
  obj.set(2, `<< /Type /Pages /Kids [ ${kidRefs} ] /Count ${P} >>`);

  for (let p = 0; p < P; p++) {
    const pageId = 3 + 2 * p;
    const contentId = 4 + 2 * p;
    const streamOps = pages[p]
      .map((line, idx) => {
        const y = firstY - idx * LEADING;
        const lit = escapePdfLiteral(line.length ? line : ' ');
        return `BT /F1 ${FONT_SIZE} Tf 1 0 0 1 ${MARGIN} ${y} Tm (${lit}) Tj ET`;
      })
      .join('\n');
    const streamBody = `${streamOps}\n`;
    obj.set(
      contentId,
      `<< /Length ${new TextEncoder().encode(streamBody).length} >>\nstream\n${streamBody}endstream`
    );
    obj.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
  }

  obj.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  chunks.push(enc.encode('%PDF-1.4\n'));
  let pos = chunks[0].length;
  const maxId = fontId;
  for (let id = 1; id <= maxId; id++) {
    const body = obj.get(id);
    if (!body) continue;
    offsets[id] = pos;
    const chunkStr = `${id} 0 obj\n${body}\nendobj\n`;
    const b = enc.encode(chunkStr);
    chunks.push(b);
    pos += b.length;
  }

  const xrefStart = pos;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    const off = offsets[id] ?? 0;
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  const xrefBytes = enc.encode(xref);
  chunks.push(xrefBytes);
  pos += xrefBytes.length;

  const trailer = `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(enc.encode(trailer));

  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export function triggerPdfDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function renderIntakeSummaryPdfDownload(payload: IntakeSummaryDownloadPayload): void {
  const pdfLines = collectIntakePacketPdfLines(payload);
  const bytes = buildAsciiTextPdf(pdfLines);
  triggerPdfDownload(bytes, INTAKE_SUMMARY_PDF_FILENAME);
}

export function buildIntakeSummaryHtml(payload: IntakeSummaryDownloadPayload): string {
  return buildIntakePacketHtml(payload);
}

export async function downloadIntakeSummaryDocument(payload: IntakeSummaryDownloadPayload): Promise<void> {
  // Prestige (pdf-lib) renderer, built from the worker Story Packet data so content
  // matches the worker workflow exactly. Falls back to the text PDF on any failure.
  try {
    const model = buildWorkerSummaryModel(payload);
    // Lazy-load the pdf-lib renderer so pdf-lib stays out of the initial bundle.
    const { renderWorkerSummaryPdf } = await import('./firmIntakePdfRenderer');
    const bytes = await renderWorkerSummaryPdf(model);
    triggerPdfDownload(bytes, INTAKE_SUMMARY_PDF_FILENAME);
  } catch {
    renderIntakeSummaryPdfDownload(payload);
  }
}

/** Build and download a text PDF from pre-wrapped lines (firm review packets, etc.). */
export function downloadPdfFromTextLines(allLines: string[], filename: string): void {
  triggerPdfDownload(buildAsciiTextPdf(allLines), filename);
}

/** Append word-wrapped lines suitable for `downloadPdfFromTextLines`. */
export function appendPdfWrappedLines(lines: string[], text: string): void {
  for (const ln of wrapPdfLine(pdfSafeText(text), 92)) lines.push(ln);
}

export function appendPdfBlankLine(lines: string[]): void {
  pushBlank(lines);
}

export function printIntakeSummaryDocument(payload: IntakeSummaryDownloadPayload): void {
  const html = buildIntakeSummaryHtml(payload);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '8.5in';
  iframe.style.height = '11in';
  iframe.style.border = '0';
  iframe.style.background = 'white';

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };

  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  const w = iframe.contentWindow;
  if (!doc || !w) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      w.focus();
      w.print();
      window.setTimeout(cleanup, 5000);
    } catch {
      cleanup();
    }
  };

  w.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(runPrint, 250);
}
