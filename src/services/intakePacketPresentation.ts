/**
 * Legal Second Brain intake packet — HTML/PDF and in-app preview.
 * Progressive layers: labels → observations → relationships → review focus.
 */

import type { IntakeSummaryDownloadPayload } from './intakeSummaryDownload';
import {
  ATTORNEY_BUCKET_CATEGORY_LABELS,
  buildCaseSnapshot,
  buildExecutiveSummary,
  buildMissingRecordBullets,
  buildReviewTopicBullets,
  buildWorkerAccount,
  normalizeMissingRecordBullet,
  type PacketCaseSnapshot,
} from './packetStoryPresentation';
import { buildPacketChronologyPresentation } from './packetStoryPresentation';
import { normalizeEventDisplayDate } from './contextualDateClassification';
import type { WorkerPacketModel } from './firmIntakePdfRenderer';
import {
  filterEmploymentDateTokens,
  formatPacketDateRange,
  formatPacketFileName,
  formatPacketMetadataValue,
  parseHumanContextSections,
  PACKET_METADATA_FALLBACK,
  sanitizeEmployerForPacket,
  sanitizePacketDateLabel,
} from './intakePacketFormatting';
import {
  extractStoryFollowUpFromOverview,
} from './storyFollowUpPersistence';
import {
  ATTORNEY_PACKET_DISCLAIMER,
  ATTORNEY_PACKET_SECTIONS,
} from '../app/constants/workerStoryIntake';

export type PacketConfidence = 'grounded' | 'partial' | 'sparse';

export type PacketMetadataBar = {
  intakeId: string;
  workerName: string;
  employer: string;
  dateGenerated: string;
  firmCode: string;
  intakeStatus: string;
};

export type SnapshotModuleCard = {
  key: string;
  label: string;
  uploadCount: number;
  dateRange: string;
  barPercent: number;
  confidence: PacketConfidence;
  layerNote: string;
};

export type ReviewSignalRow = {
  id: string;
  label: string;
  hint: string;
};

export type ChronologyRailEvent = {
  date: string;
  categoryLabel: string;
  title: string;
  supportingUploads: string[];
  contextNote: string;
  linkedCount: number;
  /** @deprecated Legacy fields for previews */
  clusterLabel: string;
  reviewFocus: string;
  relationshipHint: string;
};

export type KnowledgeClusterBlock = {
  id: string;
  title: string;
  layerScan: string;
  layerObserve: string;
  layerRelate: string;
  layerReview: string;
  connectedRecords: string[];
  themes: string[];
  periods: string[];
  entities: string[];
  reviewAreas: string[];
};

export type AttorneyPromptChip = {
  label: string;
};

export type HumanContextSection = {
  label: string;
  body: string;
};

export type HumanContextBlock = {
  sections: HumanContextSection[];
  narrative: string;
  concerns: string[];
  contextualNotes: string[];
  missingNotes: string[];
};

/** Second Brain packet view model (also exported as IntakePacketViewModel). */
export type SecondBrainPacketViewModel = {
  metadata: PacketMetadataBar;
  coreStory: string;
  caseSnapshot: PacketCaseSnapshot;
  /** @deprecated Use coreStory — kept for callers that expect paragraphs */
  coreStoryParagraphs: string[];
  snapshotCards: SnapshotModuleCard[];
  reviewSignals: ReviewSignalRow[];
  chronologyLead: string;
  chronologyEvents: ChronologyRailEvent[];
  knowledgeClusters: KnowledgeClusterBlock[];
  humanContext: HumanContextBlock;
  attorneyPrompts: AttorneyPromptChip[];
  footerDisclaimer: string;
  /** Legacy preview fields */
  intakeNumber: string;
  generated: string;
  chronologySnapshot: string;
  timelineRows: Array<{ date: string; title: string; summary: string; materials: string }>;
  reviewChecklist: Array<{ label: string }>;
  themeRows: Array<{ theme: string; relatedMaterials: string; reviewNotes: string }>;
  supportingGroups: Array<{ label: string; count: number }>;
  workerContext: string;
  disclaimer: string;
};

export type IntakePacketViewModel = SecondBrainPacketViewModel;

const BUCKET_KEYS = [
  'Compensation & Payroll',
  'Employment Records',
  'Workplace Communications',
  'Scheduling, Attendance & Leave',
  'Incident & Workplace Evidence',
  'Identity & Professional Verification',
  'Additional Supporting Records',
] as const;

const SNAPSHOT_MODULES: Array<{
  key: string;
  label: string;
  buckets: string[];
  layerNote: string;
}> = [
  {
    key: 'payroll',
    label: 'Payroll & Compensation Records',
    buckets: ['Compensation & Payroll'],
    layerNote: 'Pay periods and compensation paperwork',
  },
  {
    key: 'hr',
    label: 'Employment Documents',
    buckets: ['Employment Records', 'Identity & Professional Verification'],
    layerNote: 'Core employment paperwork',
  },
  {
    key: 'communications',
    label: 'HR Complaints & Responses',
    buckets: ['Workplace Communications'],
    layerNote: 'HR and workplace correspondence',
  },
  {
    key: 'time',
    label: 'Timekeeping & Scheduling Records',
    buckets: ['Scheduling, Attendance & Leave'],
    layerNote: 'Schedules, attendance, and leave',
  },
  {
    key: 'separation',
    label: 'Separation Documents',
    buckets: ['Incident & Workplace Evidence', 'Employment Records'],
    layerNote: 'Separation and end-of-employment records',
  },
  {
    key: 'performance',
    label: 'Performance Reviews',
    buckets: ['Employment Records'],
    layerNote: 'Performance and discipline records',
  },
];

const CLUSTER_DEFS: Array<{
  id: string;
  title: string;
  buckets: string[];
  themeSeed: string;
  reviewSeed: string;
}> = [
  {
    id: 'pay-sched',
    title: 'Payroll + Scheduling',
    buckets: ['Compensation & Payroll', 'Scheduling, Attendance & Leave'],
    themeSeed: 'Compensation and timekeeping patterns',
    reviewSeed: 'Pay periods, hours, and scheduling references',
  },
  {
    id: 'hr-comms',
    title: 'HR + Workplace Communications',
    buckets: ['Employment Records', 'Workplace Communications'],
    themeSeed: 'HR paperwork alongside workplace messages',
    reviewSeed: 'HR decisions, notices, and written exchanges',
  },
  {
    id: 'separation-pay',
    title: 'Separation + Final Pay',
    buckets: ['Incident & Workplace Evidence', 'Compensation & Payroll', 'Employment Records'],
    themeSeed: 'End-of-employment and final compensation references',
    reviewSeed: 'Separation steps and final pay timing',
  },
  {
    id: 'support-remote',
    title: 'Supporting + Reimbursement',
    buckets: ['Additional Supporting Records', 'Compensation & Payroll'],
    themeSeed: 'Expense or reimbursement mentions',
    reviewSeed: 'Reimbursement requests and supporting receipts',
  },
];

const REVIEW_SIGNAL_DEFS: Array<{ id: string; label: string; hint: string; pattern: RegExp }> = [
  {
    id: 'payroll',
    label: 'Payroll Structure',
    hint: 'Payroll and wage records appear throughout the uploaded materials.',
    pattern: /payroll|pay period|pay stub|wage|compensation/i,
  },
  {
    id: 'exempt',
    label: 'Classification References',
    hint: 'Records include salary, overtime, or classification language.',
    pattern: /exempt|salary|overtime|flsa|classification/i,
  },
  {
    id: 'scheduling',
    label: 'Scheduling Patterns',
    hint: 'Timekeeping materials and scheduling references appear across uploaded records.',
    pattern: /schedule|shift|hours|attendance|time record/i,
  },
  {
    id: 'finalpay',
    label: 'Final Pay',
    hint: 'Separation or final-pay-related materials appear in the record set.',
    pattern: /final pay|last check|termination pay|severance/i,
  },
  {
    id: 'reimburse',
    label: 'Reimbursements',
    hint: 'Expense or reimbursement references appear in the uploaded materials.',
    pattern: /reimburse|expense|mileage|stipend/i,
  },
  {
    id: 'hrcomms',
    label: 'HR Communications',
    hint: 'Records include communications involving supervisors or Human Resources.',
    pattern: /hr\b|human resources|personnel|disciplinary/i,
  },
  {
    id: 'separation',
    label: 'Separation Timeline',
    hint: 'End-of-employment records may help clarify timing and communications.',
    pattern: /terminat|separat|resign|offboard|exit interview/i,
  },
];

const ATTORNEY_PROMPTS: AttorneyPromptChip[] = [
  { label: 'Summarize payroll concerns' },
  { label: 'Show break-related references' },
  { label: 'Find termination communications' },
  { label: 'Identify reimbursement mentions' },
  { label: 'Compare timeline inconsistencies' },
];

const BUCKET_THEME: Record<string, { theme: string; materials: string }> = {
  'Compensation & Payroll': {
    theme: 'Payroll & Compensation',
    materials: 'Pay records, wage statements',
  },
  'Employment Records': {
    theme: 'Employment & HR Paperwork',
    materials: 'Offer letters, HR documents',
  },
  'Workplace Communications': {
    theme: 'Workplace Communications',
    materials: 'Emails, memos, HR messages',
  },
  'Scheduling, Attendance & Leave': {
    theme: 'Scheduling & Attendance',
    materials: 'Time records, schedules, leave',
  },
  'Incident & Workplace Evidence': {
    theme: 'Workplace Incidents',
    materials: 'Incident or discipline records',
  },
  'Identity & Professional Verification': {
    theme: 'Identity & Verification',
    materials: 'ID or verification documents',
  },
  'Additional Supporting Records': {
    theme: 'Supporting Records',
    materials: 'Reimbursements, other uploads',
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isExtractionNoise(line: string): boolean {
  const x = line.toLowerCase();
  return (
    /source text|extracted plain|date reference|indexed text|ocr|extraction status|upload\(s\) did not have|readable text from \d+ of/i.test(
      x
    ) || /records appear to reference/i.test(x)
  );
}

function isMachineStatusParagraph(p: string): boolean {
  const x = p.toLowerCase();
  return (
    x.includes('date references(s)') ||
    x.includes('date reference(s)') ||
    /\b\d+\s+date reference/i.test(x) ||
    x.includes('we pulled readable text') ||
    x.includes('suggested category labels')
  );
}

function cleanProse(s: string, max = 480): string {
  let t = (s ?? '')
    .replace(/…+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (isMachineStatusParagraph(t)) return '';
  if (t.length > max) {
    const cut = t.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    t = sp > max * 0.4 ? cut.slice(0, sp).trim() : cut.trim();
  }
  return t;
}

function legacyCategoryToBucket(name: string): string {
  switch (name) {
    case 'Pay Records / Payroll':
    case 'Pay Records':
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
    default:
      return 'Additional Supporting Records';
  }
}

function aggregateBuckets(payload: IntakeSummaryDownloadPayload): Map<string, number> {
  const map = new Map<string, number>();
  for (const key of BUCKET_KEYS) map.set(key, 0);
  const rows = payload.categoryBreakdown?.length
    ? payload.categoryBreakdown
    : payload.categories.filter((c) => c && c !== '—').map((name) => ({ name, count: 1 }));
  for (const row of rows) {
    const b = legacyCategoryToBucket(row.name);
    map.set(b, (map.get(b) ?? 0) + (row.count ?? 1));
  }
  return map;
}

function corpusText(payload: IntakeSummaryDownloadPayload): string {
  return [
    payload.overview,
    payload.timelineSummary,
    payload.workerContext ?? '',
    ...(payload.readiness ?? []),
    ...(payload.missing ?? []),
    ...(payload.timelineEvents ?? []).map((e) => `${e.title} ${e.summary}`),
  ].join('\n');
}

function inferEmployer(payload: IntakeSummaryDownloadPayload): string {
  const followUp = extractStoryFollowUpFromOverview(payload.workerContext ?? '');
  if (followUp?.employer?.trim()) {
    const fromFollowUp = sanitizeEmployerForPacket(followUp.employer.trim());
    if (fromFollowUp !== PACKET_METADATA_FALLBACK) return fromFollowUp;
  }
  return sanitizeEmployerForPacket(payload.employerName, corpusText(payload));
}

function inferWorkerName(payload: IntakeSummaryDownloadPayload): string {
  const followUp = extractStoryFollowUpFromOverview(payload.workerContext ?? '');
  if (followUp?.employmentName?.trim()) return formatPacketMetadataValue(followUp.employmentName.trim());
  return formatPacketMetadataValue(payload.workerName);
}

function inferWorkerPhone(payload: IntakeSummaryDownloadPayload): string | null {
  return payload.workerPhone?.trim() || null;
}

function extractDatesFromPayload(payload: IntakeSummaryDownloadPayload): string[] {
  const found: string[] = [];
  const push = (s: string) => {
    const label = sanitizePacketDateLabel(s);
    if (label !== 'Date to confirm' && !found.includes(label)) found.push(label);
  };
  for (const e of payload.timelineEvents ?? []) push(e.date);
  const blob = `${payload.timelineSummary ?? ''} ${payload.overview ?? ''}`;
  const re =
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\b\d{1,2}\/\d{4}\b|\bQ[1-4]\s+\d{4}\b/gi;
  for (const m of blob.match(re) ?? []) push(m);
  return filterEmploymentDateTokens(found).slice(0, 8);
}

function buildCoreStory(payload: IntakeSummaryDownloadPayload): string {
  return buildExecutiveSummary(payload);
}

function buildChronologyLead(_payload: IntakeSummaryDownloadPayload): string {
  return '';
}

function countForModule(
  mod: (typeof SNAPSHOT_MODULES)[number],
  buckets: Map<string, number>,
  payload: IntakeSummaryDownloadPayload
): number {
  let n = 0;
  for (const b of mod.buckets) n += buckets.get(b) ?? 0;
  if (mod.key === 'separation') {
    const sep = /terminat|separat|resign|final day|offboard/i.test(corpusText(payload));
    if (sep && n === 0) n = 1;
  }
  return n;
}

function confidenceForModule(
  count: number,
  payload: IntakeSummaryDownloadPayload,
  mod: (typeof SNAPSHOT_MODULES)[number]
): PacketConfidence {
  if (count <= 0) return 'sparse';
  const events = payload.timelineEvents ?? [];
  const hit = events.some((e) => mod.buckets.includes(legacyCategoryToBucket(e.category)));
  if (hit && count > 0) return 'grounded';
  return 'partial';
}

function buildSnapshotCards(
  payload: IntakeSummaryDownloadPayload,
  buckets: Map<string, number>
): SnapshotModuleCard[] {
  const dates = extractDatesFromPayload(payload);
  const range = formatPacketDateRange(dates);
  const counts = SNAPSHOT_MODULES.map((m) => countForModule(m, buckets, payload));
  const max = Math.max(1, ...counts);

  return SNAPSHOT_MODULES.map((mod, i) => {
    const uploadCount = counts[i];
    const confidence = confidenceForModule(uploadCount, payload, mod);
    return {
      key: mod.key,
      label: mod.label,
      uploadCount,
      dateRange: uploadCount > 0 ? range : '—',
      barPercent: Math.round((uploadCount / max) * 100),
      confidence,
      layerNote: mod.layerNote,
    };
  });
}

function buildReviewSignals(payload: IntakeSummaryDownloadPayload): ReviewSignalRow[] {
  return buildReviewTopicBullets(payload).map((label, index) => ({
    id: `topic-${index}`,
    label,
    hint: '',
  }));
}

function buildChronologyEvents(payload: IntakeSummaryDownloadPayload): ChronologyRailEvent[] {
  const events = payload.timelineEvents ?? [];
  const inv = payload.uploadedFileInventory ?? [];

  const presentationPayload = {
    ...payload,
    timelineEvents: events.map((e) => ({
      date: e.date,
      title: e.title || '',
      category: e.category || '',
      summary: cleanProse(e.summary || '', 200),
      sourceDates: e.sourceDates ?? [],
    })),
    uploadedFileInventory: inv,
  };

  return buildPacketChronologyPresentation(presentationPayload).map((prepared) => ({
    date: prepared.date,
    categoryLabel: '',
    title: prepared.title,
    supportingUploads: prepared.supportingUploads,
    contextNote: '',
    linkedCount: prepared.supportingUploads.length,
    clusterLabel: '',
    reviewFocus: '',
    relationshipHint: prepared.supportingUploads.length
      ? `${prepared.supportingUploads.length} supporting record${prepared.supportingUploads.length === 1 ? '' : 's'}`
      : '',
  }));
}

function polishChronologyLine(line: string): string {
  return line
    .replace(/\bPayroll period documented\b/g, 'Employment activity documented through payroll records')
    .replace(/\bHR record documented\b/g, 'Human Resources communication documented')
    .replace(/\bWorkplace record documented\b/g, 'Workplace concern documented');
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  const patterns = [
    /\b(?:HR|Payroll)\b/g,
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Inc|LLC|Corp|Company)\b/g,
  ];
  for (const p of patterns) {
    for (const m of text.match(p) ?? []) entities.add(m.trim());
  }
  return [...entities].slice(0, 5);
}

function buildKnowledgeClusters(
  payload: IntakeSummaryDownloadPayload,
  buckets: Map<string, number>
): KnowledgeClusterBlock[] {
  const themesFromTopics = buildReviewTopicBullets(payload)
    .map((a) => cleanProse(a, 120))
    .filter(Boolean)
    .slice(0, 6);
  const periods = extractDatesFromPayload(payload);
  const entities = extractEntities(corpusText(payload));

  return CLUSTER_DEFS.map((def, idx) => {
    let uploadTotal = 0;
    const connected: string[] = [];
    for (const b of def.buckets) {
      const c = buckets.get(b) ?? 0;
      uploadTotal += c;
      if (c > 0 && BUCKET_THEME[b]) connected.push(`${BUCKET_THEME[b].theme} (${c})`);
    }

    const theme =
      themesFromTopics[idx] ??
      (uploadTotal > 0 ? def.themeSeed : def.themeSeed);

    const reviewAreas: string[] = [];
    if (def.reviewSeed) reviewAreas.push(def.reviewSeed);
    for (const line of payload.missing) {
      if (isExtractionNoise(line)) continue;
      const t = cleanProse(line, 100);
      if (t && reviewAreas.length < 3) reviewAreas.push(t);
    }

    return {
      id: def.id,
      title: def.title,
      layerScan: def.themeSeed,
      layerObserve:
        uploadTotal > 0
          ? `${uploadTotal} related upload${uploadTotal === 1 ? '' : 's'} in this area.`
          : 'No direct uploads in this area yet.',
      layerRelate: theme,
      layerReview:
        reviewAreas[0] ??
        `This may be useful for human review: ${def.reviewSeed}.`,
      connectedRecords: connected.length ? connected : ['See intake snapshot modules'],
      themes: [def.themeSeed, ...themesFromTopics.slice(0, 2)].slice(0, 4),
      periods: periods.length ? periods.slice(0, 4) : ['Date to confirm'],
      entities: entities.length ? entities : ['Employer / HR (confirm in files)'],
      reviewAreas: reviewAreas.slice(0, 4),
    };
  });
}

function buildHumanContext(payload: IntakeSummaryDownloadPayload): HumanContextBlock {
  const account = buildWorkerAccount(payload);
  const missingNotes = buildMissingRecordBullets(payload);
  const sections: HumanContextSection[] = account.sections.map((s) => ({
    label: s.heading,
    body: cleanProse(s.body, 4000),
  }));

  return {
    sections,
    narrative: account.narrative,
    concerns: [],
    contextualNotes: [],
    missingNotes,
  };
}

function buildLegacyChecklist(payload: IntakeSummaryDownloadPayload): Array<{ label: string }> {
  return buildReviewSignals(payload).map((s) => ({ label: s.label }));
}

function buildLegacyThemeRows(
  payload: IntakeSummaryDownloadPayload,
  buckets: Map<string, number>
): Array<{ theme: string; relatedMaterials: string; reviewNotes: string }> {
  const rows: Array<{ theme: string; relatedMaterials: string; reviewNotes: string }> = [];
  for (const [bucket, count] of buckets) {
    if (count <= 0 || rows.length >= 5) continue;
    const meta = BUCKET_THEME[bucket];
    if (!meta) continue;
    rows.push({
      theme: meta.theme,
      relatedMaterials: meta.materials,
      reviewNotes: `Materials in this area appear across the upload set (${count} grouped).`,
    });
  }
  return rows;
}

export function buildIntakePacketViewModel(payload: IntakeSummaryDownloadPayload): SecondBrainPacketViewModel {
  const buckets = aggregateBuckets(payload);
  const generated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const coreStory = buildCoreStory(payload);
  const caseSnapshot = buildCaseSnapshot(payload);
  const chronologyLead = buildChronologyLead(payload);
  const chronologyEvents = buildChronologyEvents(payload);
  const snapshotCards = buildSnapshotCards(payload, buckets);
  const reviewSignals = buildReviewSignals(payload);
  const knowledgeClusters = buildKnowledgeClusters(payload, buckets);
  const humanContext = buildHumanContext(payload);
  const disclaimer = (payload.disclaimer ?? '').trim();

  const metadata: PacketMetadataBar = {
    intakeId: formatPacketMetadataValue(payload.intakeNumber),
    workerName: inferWorkerName(payload),
    employer: inferEmployer(payload),
    dateGenerated: generated,
    firmCode: (payload.firmCode ?? '').trim() || '—',
    intakeStatus: formatPacketMetadataValue(payload.intakeStatus),
  };

  const timelineRows = chronologyEvents.map((e) => ({
    date: e.date,
    title: e.title,
    summary: e.reviewFocus,
    materials: e.clusterLabel,
  }));

  const supportingGroups = [...buckets.entries()]
    .filter(([, n]) => n > 0)
    .map(([bucket, count]) => ({
      label: ATTORNEY_BUCKET_CATEGORY_LABELS[bucket] ?? bucket,
      count,
    }))
    .slice(0, 8);

  return {
    metadata,
    coreStory,
    caseSnapshot,
    coreStoryParagraphs: coreStory ? [coreStory] : [],
    snapshotCards,
    reviewSignals,
    chronologyLead,
    chronologyEvents,
    knowledgeClusters,
    humanContext,
    attorneyPrompts: ATTORNEY_PROMPTS,
    footerDisclaimer: disclaimer,
    intakeNumber: payload.intakeNumber,
    generated,
    chronologySnapshot: chronologyLead,
    timelineRows,
    reviewChecklist: buildLegacyChecklist(payload),
    themeRows: buildLegacyThemeRows(payload, buckets),
    supportingGroups,
    workerContext: humanContext.narrative,
    disclaimer,
  };
}

export function buildPacketCoreStoryDisplay(payload: IntakeSummaryDownloadPayload): string {
  return buildCoreStory(payload);
}

export const INTAKE_PACKET_STYLES = `
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;margin:0;padding:20px 16px 36px;line-height:1.65;font-size:13px;background:#f8fafc;-webkit-text-size-adjust:100%}
  .packet{max-width:720px;margin:0 auto}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px}
  .packet-header{margin-bottom:22px}
  .packet-header h1{font-size:19px;font-weight:650;margin:0 0 14px;letter-spacing:-0.02em;color:#0f172a;line-height:1.3}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin:0}
  .meta-grid div{margin:0}
  .meta-grid dt{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#9AA39B;margin:0 0 3px}
  .meta-grid dd{font-size:13px;color:#20302B;margin:0;word-break:break-word;overflow-wrap:anywhere;line-height:1.45}
  .page{margin-bottom:28px;padding-bottom:22px;border-bottom:1px solid #e2e8f0;page-break-inside:avoid}
  .page:last-of-type{border-bottom:none}
  .page-title{font-size:15px;font-weight:650;color:#0f172a;margin:0 0 4px;line-height:1.35}
  .page-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#9AA39B;margin:0 0 12px}
  .section-divider{height:1px;background:#e2e8f0;margin:16px 0}
  h2.sec{font-size:14px;font-weight:650;color:#20302B;margin:0 0 10px;line-height:1.35}
  .exec-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
  .story-card p,.col-card p{margin:0;color:#384039;line-height:1.65;font-size:13px}
  .snapshot-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:6px}
  table.snapshot-table{width:100%;border-collapse:collapse;font-size:12px;min-width:280px}
  table.snapshot-table th,table.snapshot-table td{border:1px solid #e2e8f0;padding:9px 10px;text-align:left;vertical-align:top;line-height:1.45}
  table.snapshot-table thead th{background:#f8fafc;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6A6D66}
  table.snapshot-table tbody tr:nth-child(even){background:#fafbfc}
  .conf-tag{display:inline-block;font-size:9px;padding:2px 7px;border-radius:4px;background:#f1f5f9;color:#40433F;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap}
  .conf-tag.grounded{background:#ecfdf5;color:#047857}
  .conf-tag.partial{background:#fffbeb;color:#b45309}
  .conf-tag.sparse{background:#f8fafc;color:#9AA39B}
  .signals{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
  .signal{flex:1 1 148px;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fff;font-size:12px;line-height:1.5}
  .signal strong{display:block;color:#0f172a;font-size:12px;margin-bottom:4px;font-weight:600}
  .signal span{color:#6A6D66;font-size:11px}
  .timeline-rail{position:relative;padding-left:22px;margin-top:14px}
  .timeline-rail::before{content:'';position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:#e2e8f0}
  .tl-node{position:relative;margin-bottom:14px;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px}
  .tl-node::before{content:'';position:absolute;left:-20px;top:16px;width:8px;height:8px;border-radius:50%;background:#9AA39B;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1}
  .tl-date{font-size:10px;font-weight:600;color:#6A6D66;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px}
  .tl-category{font-size:11px;color:#40433F;margin-bottom:4px}
  .tl-title{font-size:14px;font-weight:600;color:#0f172a;margin:0 0 8px;line-height:1.4}
  .tl-uploads{font-size:11px;color:#40433F;margin:0 0 6px;line-height:1.55;word-break:break-word}
  .tl-uploads strong{font-weight:600;color:#6A6D66;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px}
  .tl-note{font-size:12px;color:#6A6D66;margin:0;line-height:1.55}
  .cluster{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#fff}
  .cluster h3{font-size:14px;margin:0 0 10px;font-weight:650;line-height:1.35}
  .layer{font-size:12px;color:#40433F;margin:8px 0;padding-left:10px;border-left:2px solid #e2e8f0;line-height:1.55}
  .layer strong{color:#6A6D66;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:3px}
  .chip-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
  .chip{font-size:10px;padding:4px 9px;border-radius:999px;background:#f1f5f9;color:#40433F;border:1px solid #e2e8f0;word-break:break-word}
  .human-page{background:#faf9f7;border:1px solid #e8e4df;border-radius:12px;padding:18px 20px}
  .human-section{margin-bottom:16px}
  .human-section:last-child{margin-bottom:0}
  .human-section h3{font-size:13px;font-weight:600;color:#384039;margin:0 0 8px}
  .human-section p{margin:0;font-size:13px;color:#40433F;line-height:1.65;white-space:pre-wrap;word-break:break-word}
  .human-list{margin:8px 0 0;padding:0;list-style:none}
  .human-list li{padding:10px 0;border-bottom:1px solid #ede9e3;font-size:13px;color:#40433F;line-height:1.55}
  .prompt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .prompt{border:1px dashed #cbd5e1;border-radius:8px;padding:11px 12px;font-size:12px;color:#40433F;background:#fff;line-height:1.5}
  .prompt::before{content:'→ ';color:#9AA39B}
  .muted{color:#6A6D66;font-size:12px;line-height:1.6;margin:0 0 12px}
  .footer{margin-top:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:11px;color:#6A6D66;line-height:1.6}
  .footer p{margin:0 0 8px}
  .footer p:last-child{margin-bottom:0}
  @page{margin:14mm}
  @media(max-width:640px){
    body{padding:16px 12px 28px;font-size:13px}
    .exec-grid,.meta-grid,.prompt-grid{grid-template-columns:1fr}
    .packet-header h1{font-size:17px}
  }
  @media print{body{background:#fff;padding:0;font-size:12px}.packet{max-width:none}}
`;

function extractWorkerStoryText(human: HumanContextBlock): string {
  return human.narrative?.trim() ?? '';
}

function renderEvidenceMapping(events: ChronologyRailEvent[]): string {
  if (!events.length) {
    return `<p class="muted">Supporting record links will appear as events are organized.</p>`;
  }
  const rows = events
    .map((e) => {
      const records =
        e.supportingUploads.length > 0
          ? e.supportingUploads.map((n) => escapeHtml(n)).join(', ')
          : 'Supporting records to confirm';
      return `<tr>
        <td>${escapeHtml(e.date)}</td>
        <td>${escapeHtml(e.title)}</td>
        <td>${records}</td>
      </tr>`;
    })
    .join('');
  return `<div class="snapshot-table-wrap"><table class="snapshot-table" role="presentation">
    <thead><tr><th>When</th><th>Event</th><th>Supporting records</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderCoreOverview(vm: SecondBrainPacketViewModel): string {
  const m = vm.metadata;
  const themes = vm.reviewSignals
    .slice(0, 4)
    .map((s) => s.label)
    .filter(Boolean);
  const fields: Array<[string, string]> = [
    ['Worker', m.workerName],
    ['Employer', m.employer],
    ['Intake reference', m.intakeId],
    ['Generated', m.dateGenerated],
  ];
  const meta = `<dl class="meta-grid">${fields
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('')}</dl>`;
  const themesBlock =
    themes.length > 0
      ? `<div class="human-section"><h3>Primary themes identified</h3><ul class="human-list">${themes.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div>`
      : '';
  const recordNarrative = vm.coreStory.trim()
    ? `<div class="human-section"><h3>What records mention so far</h3><p>${escapeHtml(vm.coreStory)}</p></div>`
    : '';
  return `${meta}${themesBlock}${recordNarrative}`;
}

function findHumanSection(h: HumanContextBlock, pattern: RegExp): string {
  return h.sections.find((section) => pattern.test(section.label))?.body?.trim() ?? '';
}

function renderCaseSnapshot(snapshot: PacketCaseSnapshot): string {
  const concerns = snapshot.primaryConcerns
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join('');
  return `<section class="page case-snapshot">
    <h2 class="page-title">${escapeHtml(ATTORNEY_PACKET_SECTIONS.caseSnapshot)}</h2>
    <dl class="meta-grid">
      <div><dt>Employment Period</dt><dd>${escapeHtml(snapshot.employmentPeriod)}</dd></div>
      <div><dt>Records Organized</dt><dd>${snapshot.recordsOrganized}</dd></div>
      <div><dt>Timeline Events</dt><dd>${snapshot.timelineEvents}</dd></div>
      <div><dt>Named Individuals</dt><dd>${snapshot.namedIndividuals}</dd></div>
    </dl>
    <div class="human-section">
      <h3>Primary Concerns</h3>
      <ul class="human-list">${concerns}</ul>
    </div>
  </section>`;
}

function renderStoryFirstOpening(vm: SecondBrainPacketViewModel): string {
  const story =
    vm.coreStory.trim() ||
    'The intake is being organized from the worker-provided information and uploaded records.';

  return `<section class="page story-opening">
    <h1>${escapeHtml(ATTORNEY_PACKET_SECTIONS.currentUnderstanding)}</h1>
    <div class="story-card card">
      <p>${escapeHtml(story).replace(/\n\n/g, '</p><p>')}</p>
    </div>
  </section>`;
}

function renderMissingInformation(h: HumanContextBlock): string {
  if (!h.missingNotes.length) {
    return `<p class="muted">No missing records listed yet.</p>`;
  }
  return `<ul class="human-list">${h.missingNotes.slice(0, 5).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
}

function renderReviewTopics(signals: ReviewSignalRow[]): string {
  if (!signals.length) {
    return `<p class="muted">Topics will appear as records are organized.</p>`;
  }
  return `<ul class="human-list">${signals
    .map((s) => `<li>${escapeHtml(s.label)}</li>`)
    .join('')}</ul>`;
}

function renderPacketHeader(m: PacketMetadataBar): string {
  const fields: Array<[string, string]> = [
    ['Intake ID', m.intakeId],
    ['Generated', m.dateGenerated],
    ['Worker name', m.workerName],
    ['Employer name', m.employer],
    ['Workflow status', m.intakeStatus],
  ];
  return `<header class="packet-header card">
    <h1>one3seven Intake Review Packet</h1>
    <p class="muted">What happened · How do we know · What may still be missing</p>
    <dl class="meta-grid">${fields
      .map(
        ([label, value]) =>
          `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
      )
      .join('')}</dl>
  </header>`;
}

function renderSnapshotTable(cards: SnapshotModuleCard[]): string {
  const included = cards.filter((card) => card.uploadCount > 0);
  if (!included.length) {
    return `<p class="muted">Supporting records will appear after uploads are organized.</p>`;
  }
  return `<ul class="human-list">${included
    .map((card) => `<li>${escapeHtml(card.label)}${card.uploadCount > 1 ? ` (${card.uploadCount})` : ''}</li>`)
    .join('')}</ul>`;
}

function renderSignals(signals: ReviewSignalRow[]): string {
  return renderReviewTopics(signals);
}

function renderTimelineRail(events: ChronologyRailEvent[]): string {
  if (!events.length) return `<p class="muted">Timeline phases will appear after records are organized.</p>`;
  return `<div class="timeline-rail">${events
    .map((e) => {
      const uploads =
        e.supportingUploads.length > 0
          ? `<p class="tl-uploads"><strong>Supporting uploads</strong>${e.supportingUploads.map((n) => escapeHtml(n)).join('<br/>')}</p>`
          : '';
      return `<div class="tl-node">
        <div class="tl-date">${escapeHtml(e.date)}</div>
        <div class="tl-title">${escapeHtml(e.title)}</div>
        ${uploads}
        ${e.contextNote ? `<p class="tl-note">${escapeHtml(e.contextNote)}</p>` : ''}
      </div>`;
    })
    .join('')}</div>`;
}

function renderClusters(clusters: KnowledgeClusterBlock[]): string {
  return clusters
    .map(
      (c) => `<article class="cluster">
        <h3>${escapeHtml(c.title)}</h3>
        <div class="layer"><strong>Scan</strong>${escapeHtml(c.layerScan)}</div>
        <div class="layer"><strong>Observe</strong>${escapeHtml(c.layerObserve)}</div>
        <div class="layer"><strong>Relate</strong>${escapeHtml(c.layerRelate)}</div>
        <div class="layer"><strong>Review</strong>${escapeHtml(c.layerReview)}</div>
        <div class="chip-list">${c.connectedRecords.map((r) => `<span class="chip">${escapeHtml(r)}</span>`).join('')}</div>
        <p class="muted" style="margin-top:8px">Themes: ${c.themes.map(escapeHtml).join(' · ')}</p>
        <p class="muted">Periods: ${c.periods.map(escapeHtml).join(' · ')}</p>
      </article>`
    )
    .join('');
}

function renderHuman(h: HumanContextBlock): string {
  const sectionHtml = h.sections.length
    ? h.sections
        .map(
          (s) =>
            `<div class="human-section"><h3>${escapeHtml(s.label)}</h3><p>${escapeHtml(s.body)}</p></div>`
        )
        .join('')
    : `<div class="human-section"><p>${escapeHtml(h.narrative)}</p></div>`;
  const lists = [
    h.missingNotes.length
      ? `<div class="human-section"><h3>Possible Missing Records</h3><ul class="human-list">${h.missingNotes.slice(0, 5).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`
      : '',
  ].join('');
  return `<div class="human-page">
    <h2 class="sec">Human context</h2>
    ${sectionHtml}
    ${lists}
  </div>`;
}

function renderPrompts(prompts: AttorneyPromptChip[]): string {
  return `<div class="prompt-grid">${prompts.map((p) => `<div class="prompt">${escapeHtml(p.label)}</div>`).join('')}</div>`;
}

function renderWorkerAccount(human: HumanContextBlock): string {
  if (!human.sections.length) {
    return `<p class="muted">No worker account was saved for this intake.</p>`;
  }
  return human.sections
    .map(
      (s) =>
        `<div class="human-section"><h3>${escapeHtml(s.label)}</h3><p>${escapeHtml(s.body).replace(/\n\n/g, '</p><p>')}</p></div>`
    )
    .join('');
}

export function buildIntakePacketHtml(payload: IntakeSummaryDownloadPayload): string {
  const vm = buildIntakePacketViewModel(payload);
  const hasWorkerAccount = vm.humanContext.sections.length > 0;
  const disclaimer =
    (vm.footerDisclaimer ?? '').trim() || ATTORNEY_PACKET_DISCLAIMER;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Intake Packet ${escapeHtml(vm.metadata.intakeId)}</title>
<style>${INTAKE_PACKET_STYLES}</style></head><body>
<div class="packet">
  ${renderStoryFirstOpening(vm)}
  ${renderCaseSnapshot(vm.caseSnapshot)}

  ${
    hasWorkerAccount
      ? `<section class="page">
    <h2 class="page-title">${escapeHtml(ATTORNEY_PACKET_SECTIONS.workerStory)}</h2>
    <div class="story-card card">${renderWorkerAccount(vm.humanContext)}</div>
  </section>`
      : ''
  }

  <section class="page">
    <h2 class="page-title">${escapeHtml(ATTORNEY_PACKET_SECTIONS.questionsForReview)}</h2>
    ${renderSignals(vm.reviewSignals)}
  </section>

  <section class="page">
    <h2 class="page-title">${escapeHtml(ATTORNEY_PACKET_SECTIONS.chronology)}</h2>
    ${renderTimelineRail(vm.chronologyEvents)}
  </section>

  <section class="page">
    <h2 class="page-title">${escapeHtml(ATTORNEY_PACKET_SECTIONS.missingInformation)}</h2>
    ${renderMissingInformation(vm.humanContext)}
  </section>

  <section class="page">
    <h2 class="page-title">Supporting Documents</h2>
    ${renderSnapshotTable(vm.snapshotCards)}
  </section>

  <section class="page">
    <h2 class="page-title">${escapeHtml(ATTORNEY_PACKET_SECTIONS.disclaimer)}</h2>
    <div class="footer">
      <p>${escapeHtml(disclaimer)}</p>
    </div>
  </section>
</div>
</body></html>`;
}

/** Phase 3 packet order when structured org sections are available. */
export function collectOrganizedSectionsPdfLines(
  payload: IntakeSummaryDownloadPayload
): string[] | null {
  const sections = payload.orgSections;
  if (!sections) return null;

  const lines: string[] = [];
  const push = (t: string) => {
    for (const ln of t.split(/\n+/)) {
      if (ln.trim()) lines.push(ln.trim());
    }
  };
  const blank = () => {
    if (lines.length && lines[lines.length - 1] !== '') lines.push('');
  };
  const pushList = (items: string[]) => {
    for (const item of items) push(`- ${item}`);
  };

  push('one3seven Story Packet');
  push(`Intake reference: ${payload.intakeNumber}`);
  blank();

  push(ATTORNEY_PACKET_SECTIONS.currentUnderstanding);
  push(buildExecutiveSummary(payload));
  blank();

  const snapshot = buildCaseSnapshot(payload);
  push(ATTORNEY_PACKET_SECTIONS.caseSnapshot);
  push(`Employment Period: ${snapshot.employmentPeriod}`);
  push('Primary Concerns:');
  for (const c of snapshot.primaryConcerns) push(`- ${c}`);
  push(`Records Organized: ${snapshot.recordsOrganized}`);
  push(`Timeline Events: ${snapshot.timelineEvents}`);
  push(`Named Individuals: ${snapshot.namedIndividuals}`);
  blank();

  const account = buildWorkerAccount(payload);
  if (account.narrative) {
    push(ATTORNEY_PACKET_SECTIONS.workerStory);
    for (const section of account.sections) {
      push(section.heading);
      push(section.body);
      blank();
    }
  }

  push(ATTORNEY_PACKET_SECTIONS.questionsForReview);
  const topics = buildReviewTopicBullets(payload);
  if (topics.length) pushList(topics);
  else push('Topics will appear as records are organized.');
  blank();

  push(ATTORNEY_PACKET_SECTIONS.chronology);
  if (sections.chronology.length) pushList(sections.chronology.map(polishChronologyLine));
  else push('No timeline entries are available yet.');
  blank();

  push('Supporting Documents');
  if (sections.supporting_records.length) {
    for (const r of sections.supporting_records) {
      push(`- ${r.file_name}`);
    }
  } else {
    push('No related records found yet.');
  }
  blank();

  push(ATTORNEY_PACKET_SECTIONS.missingInformation);
  const missing = buildMissingRecordBullets(payload);
  if (missing.length) pushList(missing);
  else if (sections.potential_gaps.length) pushList(sections.potential_gaps.slice(0, 5).map(normalizeMissingRecordBullet).filter(Boolean));
  else push('No missing records listed yet.');
  blank();

  push(ATTORNEY_PACKET_SECTIONS.disclaimer);
  push(sections.disclaimer || payload.disclaimer);

  return lines;
}

/**
 * Structured worker "Your organized intake" model for the prestige renderer.
 * Built from the SAME helpers as collectOrganizedSectionsPdfLines, so the
 * prestige worker PDF carries identical factual content to the worker workflow.
 */
export function buildWorkerSummaryModel(payload: IntakeSummaryDownloadPayload): WorkerPacketModel {
  const sections = payload.orgSections;
  const snapshot = buildCaseSnapshot(payload);
  const account = buildWorkerAccount(payload);

  const missingFromHelper = buildMissingRecordBullets(payload);
  const missingInformation = missingFromHelper.length
    ? missingFromHelper
    : (sections?.potential_gaps ?? []).slice(0, 5).map(normalizeMissingRecordBullet).filter(Boolean);

  const employer = inferEmployer(payload);
  const workerName = inferWorkerName(payload);

  return {
    cover: {
      workerName: workerName && workerName.trim() ? workerName.trim() : null,
      workerPhone: inferWorkerPhone(payload),
      employer: employer && employer.trim() ? employer.trim() : null,
      employmentPeriod: snapshot.employmentPeriod && snapshot.employmentPeriod.trim() ? snapshot.employmentPeriod : null,
      recordCount: Number(snapshot.recordsOrganized) || 0,
      eventCount: Number(snapshot.timelineEvents) || 0,
      preparedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    },
    intakeNumber: payload.intakeNumber,
    currentUnderstanding: buildExecutiveSummary(payload),
    caseSnapshot: {
      employmentPeriod: snapshot.employmentPeriod,
      primaryConcerns: snapshot.primaryConcerns,
      recordsOrganized: Number(snapshot.recordsOrganized) || 0,
      timelineEvents: Number(snapshot.timelineEvents) || 0,
      namedIndividuals: Number(snapshot.namedIndividuals) || 0,
    },
    workerStory: account.narrative ? account.sections.map((s) => ({ heading: s.heading, body: s.body })) : [],
    questionsForReview: buildReviewTopicBullets(payload),
    // Prefer the org-engine chronology; otherwise fall back to the live timeline events the worker
    // actually sees on screen (payload.timelineEvents). Without this the PDF printed "No timeline
    // entries are available yet" even when 15+ events existed. Same fallback for supporting records.
    chronology: sections?.chronology?.length
      ? sections.chronology.map(polishChronologyLine)
      : (payload.timelineEvents ?? [])
          .map((e) => [normalizeEventDisplayDate(e.date), e.title].filter(Boolean).join(' — ') || e.summary || e.category)
          .filter((s): s is string => Boolean(s && s.trim())),
    supportingDocuments: sections?.supporting_records?.length
      ? sections.supporting_records.map((r) => r.file_name)
      : (payload.uploadedFileInventory ?? [])
          .map((f) => f.fileName)
          .filter((s): s is string => Boolean(s && s.trim())),
    missingInformation,
    disclaimer: [sections?.disclaimer || payload.disclaimer].filter((d): d is string => Boolean(d && d.trim())),
  };
}

export function collectIntakePacketPdfLines(payload: IntakeSummaryDownloadPayload): string[] {
  const organized = collectOrganizedSectionsPdfLines(payload);
  if (organized) return organized;

  const vm = buildIntakePacketViewModel(payload);
  const lines: string[] = [];
  const push = (t: string) => {
    for (const ln of t.split(/\n+/)) {
      if (ln.trim()) lines.push(ln.trim());
    }
  };
  const blank = () => {
    if (lines.length && lines[lines.length - 1] !== '') lines.push('');
  };

  push('one3seven Story Packet');
  push(`Intake ID: ${vm.metadata.intakeId}`);
  push(`Generated: ${vm.metadata.dateGenerated}`);
  blank();

  push(ATTORNEY_PACKET_SECTIONS.currentUnderstanding);
  for (const paragraph of vm.coreStory.split(/\n\n+/)) push(paragraph);
  blank();

  push(ATTORNEY_PACKET_SECTIONS.caseSnapshot);
  push(`Employment Period: ${vm.caseSnapshot.employmentPeriod}`);
  push('Primary Concerns:');
  for (const c of vm.caseSnapshot.primaryConcerns) push(`- ${c}`);
  push(`Records Organized: ${vm.caseSnapshot.recordsOrganized}`);
  push(`Timeline Events: ${vm.caseSnapshot.timelineEvents}`);
  push(`Named Individuals: ${vm.caseSnapshot.namedIndividuals}`);
  blank();

  if (vm.humanContext.sections.length) {
    push(ATTORNEY_PACKET_SECTIONS.workerStory);
    for (const section of vm.humanContext.sections) {
      push(section.label);
      push(section.body);
      blank();
    }
  }

  push(ATTORNEY_PACKET_SECTIONS.questionsForReview);
  for (const s of vm.reviewSignals.slice(0, 7)) push(`- ${s.label}`);
  blank();

  push(ATTORNEY_PACKET_SECTIONS.chronology);
  for (const e of vm.chronologyEvents) {
    push(`${e.date} — ${e.title}`);
    if (e.supportingUploads.length) {
      push(`Supporting records: ${e.supportingUploads.join('; ')}`);
    }
    if (e.contextNote) push(e.contextNote);
    blank();
  }

  if (vm.humanContext.missingNotes.length) {
    push(ATTORNEY_PACKET_SECTIONS.missingInformation);
    for (const item of vm.humanContext.missingNotes.slice(0, 5)) push(`- ${item}`);
    blank();
  }

  push('Supporting Documents');
  for (const card of vm.snapshotCards.filter((c) => c.uploadCount > 0)) {
    push(`- ${card.label}${card.uploadCount > 1 ? ` (${card.uploadCount})` : ''}`);
  }
  blank();

  push(ATTORNEY_PACKET_SECTIONS.disclaimer);
  if (vm.footerDisclaimer) push(vm.footerDisclaimer);

  return lines;
}
