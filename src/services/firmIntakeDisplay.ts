/**
 * Firm-facing presentation helpers: strip internal artifacts, polish labels and voice.
 * Display layer only — does not change stored data or workflow behavior.
 */

import type { FirmSubmissionTypeDisplay } from '../app/constants/one3sevenProduct';
import {
  WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED,
  WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS,
  isWorkerUploadedAdditionalDocumentsWorkflow,
} from '../app/constants/one3sevenProduct';
import { FIRM_REVIEW_SECTION } from '../app/constants/firmIntakePresentation';
import { stripO3sMarkers } from './intakePacketFormatting';
import {
  buildIntakePacketViewModel,
  type SecondBrainPacketViewModel,
} from './intakePacketPresentation';
import type { IntakeSummaryDownloadPayload } from './intakeSummaryDownload';
import type { FirmLiveIntakeView } from './intakeDataService';
import {
  extractStoryFollowUpFromOverview,
  stripStoryFollowUpBlock,
} from './storyFollowUpPersistence';
import {
  partitionReadinessForDisplay,
  sanitizeReadinessDisplayLine,
  type ReadinessPresentation,
} from './readinessDiagnosticsPresentation';

export { FIRM_REVIEW_SECTION };

const O3S_BLOCK_PATTERN =
  /---\s*O3S_[A-Z0-9_]+\s*---[\s\S]*?---\s*O3S_[A-Z0-9_]+_END\s*---/gi;

const SYSTEM_MARKER_PATTERNS = [
  /\bSYSTEM_CONTEXT\b/gi,
  /\bAI_OUTPUT\b/gi,
  /\bRAW_OUTPUT\b/gi,
  /\bPROMPT_CONTEXT\b/gi,
  /\bDEBUG\b/gi,
];

const INTERNAL_FIELD_KEYS = new Set([
  'employer',
  'employee_name',
  'employee_dates',
  'employment_dates',
  'job_title',
  'department',
  'pay_type',
  'hourly_rate',
  'termination_date',
  'manager_name',
  'worker_story',
  'document_category',
  'route_type',
  'submission_channel',
  'key_people',
  'worked_remotely',
  'remote_expenses',
  'reimbursed',
  'complained_or_reported',
  'changed_afterward',
  'fulfilled',
  'note',
  'categories',
  'additional_documents_requested',
  'worker_uploaded_requested_documents',
]);

const FIELD_LABEL_MAP: Record<string, string> = {
  employer: 'Employer',
  employee_name: 'Employee Name',
  employee_dates: 'Employment Dates',
  employment_dates: 'Employment Dates',
  job_title: 'Job Title',
  department: 'Department',
  pay_type: 'Pay Type',
  hourly_rate: 'Hourly Rate',
  termination_date: 'Separation Date',
  manager_name: 'Manager / Supervisor',
  worker_story: 'Worker Story',
  document_category: 'Record Type',
  route_type: 'Submission Type',
  submission_channel: 'Submission Type',
  key_people: 'Key People Involved',
  worked_remotely: 'Remote Work',
  remote_expenses: 'Remote Work Expenses',
  reimbursed: 'Reimbursement',
  complained_or_reported: 'Complaints or Reports',
  changed_afterward: 'Changes Afterward',
  additional_documents_requested: 'Additional Documents Requested',
  worker_uploaded_requested_documents: 'Worker Uploaded Requested Documents',
};

const VOICE_REWRITES: Array<[RegExp, string | ((...args: string[]) => string)]> = [
  // Strip robotic generation prefixes from timeline event summaries
  [/\bThe chronology records\s+(\w)/gi, (_m, char) => (char as string).toUpperCase()],
  [/\bTimeline includes\s+(\w)/gi, (_m, char) => (char as string).toUpperCase()],
  [/\bThe chronology\s+(place|include|reflect|note|show)\b/gi, 'Records'],
  // Strip literal escaped newlines stored in DB text
  [/\\n\s*/g, ' '],
  // Standard voice rewrites
  [/\bpayroll record detected\b/gi, 'Payroll records on file'],
  [/\btime record detected\b/gi, 'Time records on file'],
  [/\bhr record detected\b/gi, 'HR records on file'],
  [/\brecord detected\b/gi, 'Records on file'],
  [/\bsignal detected\b/gi, 'Referenced in the records'],
  [/\breview signal\b/gi, 'Topic noted in the records'],
  [/\bmay warrant review\b/gi, 'Included in the materials for review'],
  [/\bmay need review\b/gi, 'May benefit from confirmation in source files'],
  [/\bpotential issue identified\b/gi, 'Topic appears in the uploaded materials'],
  [/\bclassification result\b/gi, 'Record grouping'],
  [/\bextracted plain text\b/gi, 'wording in the records'],
  [/\bindexed excerpt\b/gi, 'Excerpt from uploaded records'],
  [/\bsource text in\b/gi, 'Wording in'],
  [/\battorney should confirm\b/gi, 'Confirm in source records'],
  [/\bflagged for attorney review\b/gi, 'Additional Information May Help'],
  [/\bthis item may need human review because\b/gi, 'Additional Information May Help'],
  [/\bguided intake selections:\s*/gi, ''],
  [/\bworker narrative:\s*/gi, ''],
  [/\badditional worker notes:\s*/gi, ''],
  [/\breferences?:\s*/gi, 'Related records: '],
];

const RECORD_GROUP_ORDER = [
  'Pay Records',
  'Time Records',
  'HR / Employment Records',
  'Communications',
  'Separation Records',
  'Other Supporting Records',
] as const;

const CATEGORY_TO_GROUP: Record<string, (typeof RECORD_GROUP_ORDER)[number]> = {
  'Pay Records': 'Pay Records',
  'Pay Records / Payroll': 'Pay Records',
  'Pay records / paystubs': 'Pay Records',
  'Payroll': 'Pay Records',
  'Time Records': 'Time Records',
  'Time records / timecards': 'Time Records',
  'Schedules': 'Time Records',
  'Meal & Rest Period Records': 'Time Records',
  'HR / Employment Records': 'HR / Employment Records',
  'Offer letter / contract': 'HR / Employment Records',
  'Offer Letters': 'HR / Employment Records',
  'Handbook / policies': 'HR / Employment Records',
  'Performance / discipline records': 'HR / Employment Records',
  'HR Documents': 'HR / Employment Records',
  'Witness Statement': 'HR / Employment Records',
  'Communications': 'Communications',
  'HR or workplace messages': 'Communications',
  'Workplace Communications': 'Communications',
  'Separation Records': 'Separation Records',
  'Termination / final pay records': 'Separation Records',
};

export type FirmOverviewField = { label: string; value: string };

export type FirmRecordGroup = { label: string; categories: Array<{ name: string; count: number }> };

function applyVoiceRewrites(text: string): string {
  let out = text;
  for (const [pattern, replacement] of VOICE_REWRITES) {
    // Narrow the string|function union so TS can resolve a String.replace overload.
    out = typeof replacement === 'string'
      ? out.replace(pattern, replacement)
      : out.replace(pattern, replacement);
  }
  return out;
}

function fallbackDisplayLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelForMachineKey(key: string): string | null {
  const normalized = key.toLowerCase().trim().replace(/\s+/g, '_');
  if (!INTERNAL_FIELD_KEYS.has(normalized)) return null;
  return FIELD_LABEL_MAP[normalized] ?? fallbackDisplayLabel(normalized);
}

function protectExactTokens(text: string): { text: string; restore: (value: string) => string } {
  const tokens: string[] = [];
  const placeholder = (value: string) => {
    const token = `__O3S_TOKEN_${tokens.length}__`;
    tokens.push(value);
    return token;
  };
  const protectedText = text
    .replace(/\bhttps?:\/\/\S+/gi, placeholder)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, placeholder)
    .replace(/\b\S+\.(?:pdf|docx?|xlsx?|csv|png|jpe?g|txt)\b/gi, placeholder)
    .replace(/\b(?:ID|Case|Docket|No\.?)\s*[:#]?\s*[A-Z0-9-]{4,}\b/g, placeholder);
  return {
    text: protectedText,
    restore: (value: string) =>
      value.replace(/__O3S_TOKEN_(\d+)__/g, (_m, index) => tokens[Number(index)] ?? _m),
  };
}

function capitalizeKnownValue(label: string, value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (/__O3S_TOKEN_\d+__/.test(trimmed)) return trimmed;
  if (/[.!?]\s+[a-z]/.test(trimmed)) return trimmed.replace(/(^\s*[a-z])/, (m) => m.toUpperCase());

  const shouldTitleCase =
    /name|job title|department|employer|pay type|role/i.test(label) &&
    !/[{}[\]|]/.test(trimmed) &&
    trimmed.length <= 80;
  const titled = shouldTitleCase
    ? trimmed.replace(/\b([a-z])([a-z']*)\b/gi, (word, first, rest) => {
        const upper = word.toUpperCase();
        if (['HR', 'PTO', 'FMLA', 'PDF', 'EEOC', 'ADA', 'W-2'].includes(upper)) return upper;
        return `${first.toUpperCase()}${String(rest).toLowerCase()}`;
      })
    : trimmed;

  return titled
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, (m) =>
      `${m.charAt(0).toUpperCase()}${m.slice(1).toLowerCase()}`
    )
    .replace(/\s*-\s*(?=[A-Z][a-z]+\s+\d{4}\b|\d{1,2}\/\d{4}\b|\d{4}\b)/g, ' - ');
}

/**
 * Polish a person or organization name for firm-facing display. Fixes the two things people forget:
 * a name typed in all-lowercase ("rosa delgado") or ALL-CAPS ("ROSA DELGADO") → Title Case
 * ("Rosa Delgado"). Respects intentional mixed-case (e.g. "McDonald", "eBay", "DeShawn") by leaving
 * it untouched, so we polish sloppy entry without mangling correct entry.
 */
export function polishNameForDisplay(value: string | null | undefined): string {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  const needsFix =
    letters.length > 0 && (letters === letters.toLowerCase() || letters === letters.toUpperCase());
  if (!needsFix) return trimmed;
  return trimmed.replace(/\b([a-z])([a-z']*)\b/gi, (word, first, rest) => {
    const upper = word.toUpperCase();
    if (['HR', 'PTO', 'FMLA', 'PDF', 'EEOC', 'ADA'].includes(upper)) return upper;
    return `${String(first).toUpperCase()}${String(rest).toLowerCase()}`;
  });
}

function splitInlineFieldPairs(text: string): string {
  const patterns = [...INTERNAL_FIELD_KEYS]
    .flatMap((key) => [key, key.replace(/_/g, ' ')])
    .sort((a, b) => b.length - a.length)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+'));
  if (!patterns.length) return text;
  const fieldRe = new RegExp(`(^|[\\s;|,])(${patterns.join('|')})\\s*:`, 'gi');
  return text.replace(fieldRe, (match, prefix, key, offset) => {
    const label = labelForMachineKey(key);
    if (!label) return match;
    const spacer = offset === 0 || String(prefix).includes('\n') ? '' : '\n';
    return `${prefix}${spacer}${label}: `;
  });
}

function rewriteMachineFieldLines(text: string): string {
  return text
    .replace(/([^\s:]):([^\s])/g, '$1: $2')
    .split(/\n/)
    .flatMap((line) => splitInlineFieldPairs(line).split(/\n/))
    .map((line) => {
      const trimmed = line.trim();
      const m = trimmed.match(/^([A-Za-z][A-Za-z0-9_\s/()-]{1,48})\s*:\s*(.*)$/);
      if (!m) return line;
      const key = m[1].trim();
      const value = m[2]?.trim() ?? '';
      const label = labelForMachineKey(key);
      if (!label) return line;
      return value ? `${label}: ${capitalizeKnownValue(label, value)}` : label;
    })
    .join('\n');
}

export function polishHumanReadableDisplayText(text: string | null | undefined): string {
  const raw = (text ?? '').trim();
  if (!raw) return '';
  const protectedTokens = protectExactTokens(raw);
  const formatted = rewriteMachineFieldLines(protectedTokens.text)
    .replace(/\b([a-z][a-z0-9_]{2,})\b/g, (token) => {
      if (!token.includes('_')) return token;
      const label = labelForMachineKey(token);
      return label ?? token;
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return protectedTokens.restore(formatted);
}

/** Remove O3S blocks, system markers, and internal field keys from firm-visible copy. */
export function stripFirmFacingArtifacts(text: string | null | undefined): string {
  let out = (text ?? '')
    .replace(O3S_BLOCK_PATTERN, '')
    .replace(/---\s*O3S_[A-Z0-9_]+\s*---/gi, '')
    .replace(/---\s*O3S_[A-Z0-9_]+_END\s*---/gi, '');

  for (const pattern of SYSTEM_MARKER_PATTERNS) {
    out = out.replace(pattern, '');
  }

  out = stripStoryFollowUpBlock(stripO3sMarkers(out));
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Full firm-facing text polish: artifacts, labels, and intake-coordinator voice. */
export function polishFirmFacingText(text: string | null | undefined): string {
  const stripped = stripFirmFacingArtifacts(text);
  if (!stripped) return '';
  return polishHumanReadableDisplayText(applyVoiceRewrites(rewriteMachineFieldLines(stripped)))
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

/** Preserve paragraph breaks for narrative sections. */
export function polishFirmFacingProse(text: string | null | undefined): string {
  const stripped = stripFirmFacingArtifacts(text);
  if (!stripped) return '';
  return polishHumanReadableDisplayText(applyVoiceRewrites(rewriteMachineFieldLines(stripped)))
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function polishTimelineEventSummary(summary: string | null | undefined): string {
  return polishFirmFacingProse(summary);
}

const MISLEADING_EVENT_TITLE_OVERRIDES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bworker raises safety concerns?\b/i, replacement: 'Concern raised with management' },
  { pattern: /\bsafety concern(s)? raised\b/i, replacement: 'Concern raised with management' },
  { pattern: /\bsafety issue documented\b/i, replacement: 'Concern raised with management' },
];

export function polishTimelineEventTitle(title: string | null | undefined): string {
  const polished = polishFirmFacingText(title);
  for (const override of MISLEADING_EVENT_TITLE_OVERRIDES) {
    if (override.pattern.test(polished)) return override.replacement;
  }
  return polished;
}

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

export function resolveEventDisplayCategory(storedCategory: string, resolvedTitle: string): string {
  const stored = (storedCategory ?? '').trim();
  if (stored && stored !== 'Uncategorized') return stored;
  return TITLE_TO_DISPLAY_CATEGORY[resolvedTitle] ?? stored ?? 'Uncategorized';
}

export function polishMissingContextLine(line: string | null | undefined): string {
  const t = polishFirmFacingText(line);
  if (!t) return '';
  // Strip firm-entered metadata that leaked into missing_document_alerts
  if (/^firm\s+(requested|note|request)\s*:/i.test(t)) return '';
  if (/^(additional information may help|this may help complete the timeline):\s*(firm\s+)/i.test(t)) return '';
  // Already correctly prefixed — return as-is to avoid double-prefixing
  if (/^additional information may help/i.test(t)) return t;
  if (/^additional records may help/i.test(t)) return t;
  if (/^the worker may be asked/i.test(t)) return t;
  if (/^records appear incomplete/i.test(t)) return t;
  if (/^this may help (clarify|complete the timeline)/i.test(t)) {
    return t.replace(/^this may help (clarify|complete the timeline)/i, 'Additional Information May Help');
  }
  if (/^suggested additions?/i.test(t)) {
    return t.replace(/^suggested additions?:?\s*/i, 'Additional Information May Help: ');
  }
  return `Additional Information May Help: ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

export function polishRecordCategoryLabel(category: string): string {
  const t = polishFirmFacingText(category);
  return t || 'Other Supporting Records';
}

export function groupRecordCategoriesForFirmDisplay(
  categories: Array<{ name: string; count: number }>
): FirmRecordGroup[] {
  const grouped = new Map<string, Array<{ name: string; count: number }>>();

  for (const row of categories) {
    const name = polishRecordCategoryLabel(row.name);
    const group = CATEGORY_TO_GROUP[name] ?? CATEGORY_TO_GROUP[row.name] ?? 'Other Supporting Records';
    const list = grouped.get(group) ?? [];
    list.push({ name, count: row.count });
    grouped.set(group, list);
  }

  const out: FirmRecordGroup[] = [];
  for (const label of RECORD_GROUP_ORDER) {
    const cats = grouped.get(label);
    if (cats?.length) out.push({ label, categories: cats });
  }
  for (const [label, cats] of grouped.entries()) {
    if (!RECORD_GROUP_ORDER.includes(label as (typeof RECORD_GROUP_ORDER)[number])) {
      out.push({ label, categories: cats });
    }
  }
  return out;
}

const TOPIC_HEADINGS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /wage|hour|payroll|compensation|overtime|pay/i, label: 'Payroll and Compensation' },
  { pattern: /scheduling|attendance|meal|rest|timekeeping|time record/i, label: 'Scheduling or Time Records' },
  { pattern: /communication|message|email|workplace/i, label: 'Employment Communications' },
  { pattern: /termination|separation|final pay/i, label: 'Separation-Related Records' },
  { pattern: /reimbursement|expense/i, label: 'Reimbursements or Expenses' },
  { pattern: /handbook|policy|contract|offer/i, label: 'Policy or Handbook Materials' },
  { pattern: /leave|accommodation|disability|medical|pregnancy/i, label: 'Leave or Accommodation Topics' },
  { pattern: /classification|contractor|exempt/i, label: 'Classification or Pay Structure' },
];

function topicFromReadinessLine(line: string): string | null {
  const low = line.toLowerCase();
  for (const { pattern, label } of TOPIC_HEADINGS) {
    if (pattern.test(low)) return label;
  }
  return null;
}

/** Topics reflected in uploaded records — intake-coordinator phrasing. */
export function buildFirmTopicsFromReadiness(readiness: string[]): string[] {
  const topics = new Set<string>();
  for (const raw of readiness) {
    const line = sanitizeReadinessDisplayLine(raw);
    const topic = topicFromReadinessLine(line);
    if (topic) topics.add(topic);
  }
  if (!topics.size) return [];
  return [...topics].map((t) => `Records mention ${t.toLowerCase()}.`);
}

export function partitionFirmReadinessPresentation(readiness: string[]): ReadinessPresentation & {
  topics: string[];
  additionalContext: string[];
} {
  const base = partitionReadinessForDisplay(readiness);
  const topics = buildFirmTopicsFromReadiness(readiness);
  const additionalContext = [
    ...base.operationalDetail.map(polishMissingContextLine),
    ...(readiness.length ? [] : []),
  ].filter(Boolean);

  const supplementalBrief = base.supplementalBrief.map((line) => {
    const t = polishFirmFacingText(line);
    if (/payroll|wage|compensation/i.test(t)) {
      return 'Records mention payroll and compensation topics.';
    }
    if (/scheduling|timekeeping|meal|rest/i.test(t)) {
      return 'Records mention scheduling or time records.';
    }
    if (/separation|termination|final pay/i.test(t)) {
      return 'Records mention separation-related records.';
    }
    if (/communication|workplace|hr/i.test(t)) {
      return 'Records mention employment communications.';
    }
    return t;
  });

  return {
    ...base,
    supplementalBrief: [...new Set(supplementalBrief)].slice(0, 8),
    operationalSummary: base.operationalSummary.map((s) =>
      polishFirmFacingText(s).replace(/indexing|extraction|digests/gi, 'record review notes')
    ),
    topics,
    additionalContext: additionalContext.slice(0, 8),
  };
}

export function formatFirmAccessLevel(view: Pick<FirmLiveIntakeView, 'previewOnly' | 'routeStatus' | 'isFirmCodeIntake'>): string {
  if (view.isFirmCodeIntake) return 'Direct firm submission';
  if (view.previewOnly || view.routeStatus === 'preview_sent') return 'Limited preview';
  if (view.routeStatus === 'full_access') return 'Full materials';
  if (view.routeStatus === 'access_requested') return 'Full access pending approval';
  return 'Review access in progress';
}

function resolveSubmissionTypeForFirmView(view: Pick<FirmLiveIntakeView, 'isFirmCodeIntake' | 'submissionChannel' | 'routeId'>): FirmSubmissionTypeDisplay {
  if (view.isFirmCodeIntake) return 'Firm Code';
  const channel = (view.submissionChannel ?? '').trim().toLowerCase();
  if (channel === 'participating' || channel === 'participating_network') {
    return 'Participating Firm Review';
  }
  if ((view.routeId ?? '').trim()) return 'Participating Firm Review';
  return 'Not yet routed';
}

export function buildFirmIntakeOverviewFields(
  view: FirmLiveIntakeView,
  packet?: SecondBrainPacketViewModel
): FirmOverviewField[] {
  const vm = packet ?? buildIntakePacketViewModel(firmViewToDisplayPayload(view));
  const followUp = view.workerFollowUp ?? extractStoryFollowUpFromOverview(view.overview);
  const fields: FirmOverviewField[] = [];

  const workerName = vm.metadata.workerName !== 'Not yet identified' ? vm.metadata.workerName : '';
  if (workerName) fields.push({ label: 'Worker Name', value: workerName });

  const employer =
    followUp?.employer?.trim() ||
    (vm.metadata.employer !== 'Not yet identified' ? vm.metadata.employer : '');
  if (employer) fields.push({ label: 'Employer', value: polishFirmFacingText(employer) });

  if (followUp?.employmentDates?.trim()) {
    fields.push({ label: 'Employment Dates', value: polishFirmFacingText(followUp.employmentDates) });
  }

  if (followUp?.keyPeople?.trim()) {
    fields.push({ label: 'Key People Involved', value: polishFirmFacingText(followUp.keyPeople) });
  }

  if (followUp?.employmentStatus) {
    const label =
      followUp.employmentStatus === 'still_employed'
        ? 'Still employed there'
        : followUp.employmentStatus === 'employment_ended'
          ? 'Employment ended'
          : 'Not sure';
    fields.push({ label: 'Employment Status', value: label });
  }

  if (followUp?.arbitrationAgreement) {
    const label =
      followUp.arbitrationAgreement === 'yes'
        ? 'Yes'
        : followUp.arbitrationAgreement === 'no'
          ? 'No'
          : 'Not sure';
    fields.push({ label: 'Arbitration Agreement', value: label });
  }

  if (followUp?.priorAgencyFiling) {
    const label =
      followUp.priorAgencyFiling === 'yes'
        ? 'Yes'
        : followUp.priorAgencyFiling === 'no'
          ? 'No'
          : 'Not sure';
    const detail = followUp.priorAgencyFilingDetails?.trim();
    fields.push({ label: 'Prior Agency Filing', value: detail ? `${label} — ${detail}` : label });
  }

  const submissionType = resolveSubmissionTypeForFirmView(view);
  if (submissionType !== 'Not yet routed') {
    fields.push({ label: 'Submission Type', value: submissionType });
  }

  fields.push({ label: 'Access Level', value: formatFirmAccessLevel(view) });

  const status = view.intakeWorkflowStatus?.trim() || getStatusLabelFromRoute(view.routeStatus);
  if (status) fields.push({ label: 'Current Status', value: status });

  return fields;
}

function getStatusLabelFromRoute(routeStatus: string): string {
  switch (routeStatus) {
    case 'preview_sent':
      return 'Preview received';
    case 'access_requested':
      return 'Full access requested';
    case 'full_access':
      return 'Ready for firm review';
    case 'accepted':
      return 'Intake added to review queue';
    case 'under_review':
      return 'Under review';
    default:
      return 'Intake in progress';
  }
}

export function firmViewToDisplayPayload(view: FirmLiveIntakeView): IntakeSummaryDownloadPayload {
  const counts = new Map<string, number>();
  for (const f of view.files) {
    const cat = (f.category ?? '').trim() || 'Uncategorized';
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const categoryBreakdown = [...counts.entries()].map(([name, count]) => ({ name, count }));

  return {
    intakeNumber: view.intakeNumber,
    overview: view.overview,
    timelineSummary: view.timelineSummary,
    timelineEvents: view.events.map((e) => ({
      date: e.event_date,
      title: e.title,
      category: e.category,
      summary: [e.ai_summary, e.worker_context].filter(Boolean).join(' — ') || '—',
    })),
    workerContext: view.workerProvidedContext ?? '',
    categories: categoryBreakdown.map((r) => r.name),
    categoryBreakdown,
    uploadedFileInventory: view.files.map((f) => ({
      fileName: f.file_name,
      category: f.category,
    })),
    documentsUploaded: view.files.length,
    readiness: view.readiness,
    missing: view.missing,
    disclaimer: '',
    intakeStatus: view.intakeWorkflowStatus.trim() || undefined,
    orgSections: view.orgSections,
  };
}

export function buildFirmWorkerStoryDisplay(
  view: Pick<FirmLiveIntakeView, 'overview' | 'workerProvidedContext' | 'workerFollowUp'>
): string {
  // workerProvidedContext already contains the structured follow-up narrative.
  // formatStoryFollowUpForDisplay would duplicate that content, so we only use workerProvidedContext here.
  // Employment Status, Arbitration, and Prior Filing are surfaced separately in buildFirmIntakeOverviewFields.
  const context = polishFirmFacingProse(view.workerProvidedContext);
  return context.trim();
}

export type FirmPersistedWorkflowTone = 'neutral' | 'active' | 'success' | 'warning' | 'muted';

export type FirmPersistedWorkflowPresentation = {
  label: string;
  tone: FirmPersistedWorkflowTone;
  /** Where the label was derived from — for trust/debug copy only. */
  source: 'persisted' | 'demo' | 'workspace';
};

/** Tailwind classes for the Workflow Status pill (presentation only). */
export function firmPersistedWorkflowToneClass(tone: FirmPersistedWorkflowTone): string {
  switch (tone) {
    case 'success':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    case 'warning':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'active':
      return 'bg-slate-900 text-white border-slate-900';
    case 'muted':
      return 'bg-slate-100 text-slate-500 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function workflowIndicatesDocResponseComplete(
  workflow: string,
  response?: FirmLiveIntakeView['documentResponse']
): boolean {
  const wf = workflow.trim();
  if (!wf) return Boolean(response?.fulfilled?.length);
  if (isWorkerUploadedAdditionalDocumentsWorkflow(wf)) return true;
  if (wf === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS) return true;
  return Boolean(response?.fulfilled?.length);
}

/**
 * Firm Workflow Status — always from persisted route/workflow fields when live.
 * Display layer only; does not mutate intake state.
 */
export function resolveFirmPersistedWorkflowStatus(
  view: Pick<FirmLiveIntakeView, 'intakeWorkflowStatus' | 'routeStatus'> & {
    documentResponse?: FirmLiveIntakeView['documentResponse'];
    isSamplePreview?: boolean;
  }
): FirmPersistedWorkflowPresentation {
  if (view.isSamplePreview) {
    return {
      label: 'Demo preview — sample intake (not a live record)',
      tone: 'muted',
      source: 'demo',
    };
  }

  const workflow = (view.intakeWorkflowStatus ?? '').trim();
  const route = (view.routeStatus ?? '').trim();

  if (workflow === 'Accepted by Firm') {
    return { label: 'Accepted for follow-up', tone: 'success', source: 'persisted' };
  }

  if (
    workflow === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED ||
    workflow === 'Additional Documents Requested'
  ) {
    return { label: 'Additional Documents Requested', tone: 'warning', source: 'persisted' };
  }

  if (workflowIndicatesDocResponseComplete(workflow, view.documentResponse)) {
    return {
      label: 'Worker Uploaded Requested Documents',
      tone: 'success',
      source: 'persisted',
    };
  }

  if (workflow === 'Firm Interest Received' || route === 'access_requested') {
    return { label: 'Full access requested', tone: 'warning', source: 'persisted' };
  }

  if (
    route === 'full_access' ||
    workflow === 'Shared with Participating Firm' ||
    workflow === 'Shared with Firm'
  ) {
    return { label: 'Full access granted', tone: 'success', source: 'persisted' };
  }

  if (route === 'preview_sent') {
    return { label: 'Preview received — limited access', tone: 'neutral', source: 'persisted' };
  }

  if (workflow === 'Under Firm Review' || workflow === 'Under Review') {
    return { label: 'Under firm review', tone: 'active', source: 'persisted' };
  }

  if (workflow === 'Intake Summary Generated' || workflow === 'Organizing Records') {
    return { label: 'Intake summary ready for review', tone: 'neutral', source: 'persisted' };
  }

  if (workflow) {
    return { label: workflow, tone: 'neutral', source: 'persisted' };
  }

  if (route === 'accepted') {
    return { label: 'Accepted for follow-up', tone: 'success', source: 'persisted' };
  }

  return { label: 'Intake in progress', tone: 'neutral', source: 'persisted' };
}
