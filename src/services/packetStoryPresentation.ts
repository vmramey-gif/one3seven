/**
 * Story-first intake packet presentation â€” executive summary, case snapshot, chronology.
 * Presentation only; does not alter generation, storage, or routing.
 */

import type { IntakeSummaryDownloadPayload } from './intakeSummaryDownload';
import {
  parseHumanContextSections,
  sanitizeEmployerForPacket,
  sanitizePacketDateLabel,
  formatPacketFileName,
  PACKET_METADATA_FALLBACK,
} from './intakePacketFormatting';
import { extractStoryFollowUpFromOverview } from './storyFollowUpPersistence';
import {
  inferInventoryCategory,
  pickSupportingRecordsForEvent,
  prepareChronologyPresentationEvents,
  resolveChronologyEventDate,
  resolveChronologyEventTitle,
  type ChronologyPresentationContext,
  type InventoryRow,
  type PacketTimelineEventInput,
  type PreparedChronologyEvent,
} from './packetChronologyIntelligence';

export type { PacketTimelineEventInput };

/** Attorney-friendly record category labels for packet exports. */
export const ATTORNEY_RECORD_CATEGORY_LABELS: Record<string, string> = {
  'Pay Records / Payroll': 'Payroll & Compensation Records',
  'Pay Records': 'Payroll & Compensation Records',
  'Reimbursement Records': 'Reimbursement-Related Records',
  'Time Records': 'Timekeeping & Scheduling Records',
  'PTO Records': 'Timekeeping & Scheduling Records',
  'Workplace Communications': 'HR Complaints & Responses',
  'Offer Letters': 'Employment Documents',
  'HR Documents': 'HR Complaints & Responses',
  'Performance Reviews': 'Performance Reviews',
  Uncategorized: 'Employment Documents',
};

export const ATTORNEY_BUCKET_CATEGORY_LABELS: Record<string, string> = {
  'Compensation & Payroll': 'Payroll & Compensation Records',
  'Employment Records': 'Employment Documents',
  'Workplace Communications': 'HR Complaints & Responses',
  'Scheduling, Attendance & Leave': 'Timekeeping & Scheduling Records',
  'Incident & Workplace Evidence': 'Disciplinary Materials',
  'Identity & Professional Verification': 'Employment Documents',
  'Additional Supporting Records': 'Reimbursement-Related Records',
};

const AI_NARRATION_RE =
  /\b(available records show|uploaded records show|according to uploaded records|communication wording across|review source document|record materials|may warrant review|materials grouped for review|confirm details in source files|in this part of the sequence|supporting uploads include|worker reports concerns regarding|regarding)\b/i;

const AWKWARD_OPENERS =
  /^(worker reports concerns regarding|the worker reports concerns regarding|regarding|according to uploaded records)\b/i;

export type PacketCaseSnapshot = {
  employmentPeriod: string;
  primaryConcerns: string[];
  recordsOrganized: number;
  timelineEvents: number;
  namedIndividuals: number;
};

export type WorkerAccountSection = {
  heading: string;
  body: string;
};

type InventoryRow = { fileName: string; category: string };

function clipProse(s: string, max: number): string {
  const x = sanitizeProse(s);
  if (x.length <= max) return x;
  const cut = x.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return sp > max * 0.45 ? cut.slice(0, sp).trim() : cut.trim();
}

function sanitizeProse(s: string): string {
  return (s ?? '')
    .replace(/â€¦+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

const DANGLING_END_RE =
  /\b(before|after|that|which|they|the|a|an|and|or|but|if|when|while|because|since|as|with|for|to|into|of|from|by)\s*$/i;

function isIncompleteProse(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return DANGLING_END_RE.test(t);
}

function englishList(items: string[]): string {
  const t = items.map((x) => x.trim()).filter(Boolean);
  if (!t.length) return '';
  if (t.length === 1) return t[0];
  if (t.length === 2) return `${t[0]} and ${t[1]}`;
  return `${t.slice(0, -1).join(', ')}, and ${t[t.length - 1]}`;
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

export function attorneyCategoryLabel(category: string, fileName?: string): string {
  const file = (fileName ?? '').toLowerCase();
  if (/witness_statement|witness.?statement/i.test(file)) return 'Witness Statements';
  if (/written_warning|write_?up|disciplinary/i.test(file)) return 'Disciplinary Materials';
  if (/termination_letter|terminat/i.test(file) && !/terminat.*review/i.test(file)) return 'Separation Documents';
  if (/complaint_to_hr|complaint.?hr|\bhr.?complaint/i.test(file)) return 'HR Complaints & Responses';
  if (/complaint_to_supervisor|complaint.?supervisor/i.test(file)) return 'HR Complaints & Responses';
  if (/project_removal/i.test(file)) return 'Disciplinary Materials';
  if (/coaching_memo|coaching.?memo/i.test(file)) return 'Disciplinary Materials';
  if (/separation_benefits|separation.?benefits/i.test(file)) return 'Separation Documents';

  const raw = inferInventoryCategory(fileName ?? '', category ?? '').trim();
  if (!raw) return 'Employment Documents';
  return (
    ATTORNEY_RECORD_CATEGORY_LABELS[raw] ??
    ATTORNEY_BUCKET_CATEGORY_LABELS[legacyCategoryToBucket(raw)] ??
    raw
  );
}

function aggregateBucketCounts(payload: IntakeSummaryDownloadPayload): Map<string, number> {
  const map = new Map<string, number>();
  const rows = payload.categoryBreakdown?.length
    ? payload.categoryBreakdown
    : payload.categories.filter((c) => c && c !== 'â€”').map((name) => ({ name, count: 1 }));
  for (const row of rows) {
    const b = legacyCategoryToBucket(row.name);
    map.set(b, (map.get(b) ?? 0) + (row.count ?? 1));
  }
  return map;
}

function documentCount(payload: IntakeSummaryDownloadPayload): number {
  if (payload.documentsUploaded && payload.documentsUploaded > 0) return payload.documentsUploaded;
  if (payload.uploadedFileInventory?.length) return payload.uploadedFileInventory.length;
  let n = 0;
  for (const [, count] of aggregateBucketCounts(payload)) n += count;
  return n;
}

function inferEmployerName(payload: IntakeSummaryDownloadPayload, followUpEmployer?: string): string {
  if (followUpEmployer?.trim()) {
    const cleaned = sanitizeEmployerForPacket(followUpEmployer.trim());
    if (cleaned !== PACKET_METADATA_FALLBACK) return cleaned;
  }
  const corpus = [payload.overview, payload.workerContext, payload.timelineSummary].join('\n');
  return sanitizeEmployerForPacket(payload.employerName, corpus);
}

function possessivePronoun(name: string): string {
  return name.trim() ? 'their' : 'the workerâ€™s';
}

function subjectPronoun(name: string): string {
  return name.trim() ? 'They' : 'The worker';
}

function extractConcernThemes(...chunks: string[]): string[] {
  const corpus = chunks.join('\n').toLowerCase();
  const themes: string[] = [];
  const add = (label: string, pattern: RegExp) => {
    if (pattern.test(corpus) && !themes.includes(label)) themes.push(label);
  };

  add('unpaid overtime', /\b(unpaid overtime|overtime pay|overtime hours|time and a half)\b/);
  add('off-the-clock work', /\b(off[- ]the[- ]clock|after hours|outside (of )?work hours|unpaid hours)\b/);
  add(
    'after-hours communication expectations',
    /\b(after[- ]hours (messages|email|text|communication)|respond.*outside.*hours|work communications outside)\b/
  );
  add('wage or pay practices', /\b(wage theft|missed pay|paycheck|pay stub|payroll error|underpaid)\b/);
  add('missed breaks', /\b(missed break|meal break|rest break|worked through (lunch|break)|breaks?)\b/);
  add('safety or staffing concerns', /\b(safety|unsafe|staffing|short[- ]staffed|understaffed)\b/);
  add('reimbursement issues', /\b(reimbursement|mileage|expense report|unreimbursed|phone|internet)\b/);
  add('retaliation concerns', /\bretaliat/i);
  add('harassment or mistreatment', /\b(harass|hostile|mistreat|discriminat|unfair treatment)\b/);
  add('scheduling or hours disputes', /\b(schedule change|shift change|hours cut|meal break|rest break)\b/);
  add('discipline or performance review changes', /\b(written warning|write[- ]?up|disciplin|performance review|pip|performance improvement plan)\b/);
  add('termination or separation', /\b(terminat|fired|laid off|forced out|separation)\b/);

  return themes.slice(0, 8);
}

function extractConcernBullets(...chunks: string[]): string[] {
  return extractConcernThemes(...chunks).map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

function inferReportingTimeframe(text: string): string {
  const year = text.match(/\b(20\d{2}|19\d{2})\b/);
  if (year) return ` during ${year[1]}`;
  if (/management and human resources|management and hr/i.test(text)) return '';
  return '';
}

function paraphraseFollowUpEvents(text: string): string | null {
  const t = text.toLowerCase();
  const events: string[] = [];
  if (/complain|report|raised concern|human resources|\bhr\b|management/i.test(t)) {
    events.push('concerns were raised with management and Human Resources');
  }
  if (/removed from project|project removal|taken off project/i.test(t)) events.push('removal from projects');
  if (/excluded from meeting|left out of meeting|meeting exclusion/i.test(t)) events.push('exclusion from meetings');
  if (/scrutin|monitor|micromanag/i.test(t)) events.push('increased scrutiny');
  if (/pip|performance improvement plan/i.test(t)) events.push('a performance improvement plan');
  if (/disciplin|write[- ]?up|written warning|corrective action/i.test(t)) events.push('disciplinary actions');
  if (/terminat|fired|let go|employment ended/i.test(t)) events.push('eventual termination');
  if (/responsibilit|additional duties|more work|took on/i.test(t)) events.push('additional responsibilities');
  if (/pay cut|salary reduced|hours cut|reduced hours/i.test(t)) events.push('changes to pay or hours');
  if (/transfer|reassign|moved to/i.test(t)) events.push('a reassignment or transfer');

  if (events.length >= 2) {
    const tail = events.pop()!;
    return `${events.join(', ')}, and ${tail}`;
  }
  if (events.length === 1) return events[0];
  // Cannot produce a clean structured summary — caller should use a safe generic instead
  return null;
}

function countNamedIndividuals(keyPeople?: string): number {
  if (!keyPeople?.trim()) return 0;
  const parts = keyPeople
    .split(/[,;\n]+/)
    .map((p) => p.replace(/^[\s\-â€¢*]+/, '').trim())
    .filter((p) => p.length > 1);
  return parts.length;
}

function countNamedPeopleOrRoleReferences(payload: IntakeSummaryDownloadPayload, keyPeople?: string): number {
  const structuredCount = countNamedIndividuals(keyPeople);
  if (structuredCount > 0) return structuredCount;

  const orgPeople = payload.orgSections?.people_and_entities?.join('\n') ?? '';
  const orgPeopleCount = countNamedIndividuals(orgPeople);
  if (orgPeopleCount > 0) return orgPeopleCount;

  const corpus = packetSearchCorpus(payload);
  const roles = new Set<string>();
  if (hasSignal(corpus, /\b(human resources|\bhr\b)\b/)) roles.add('Human Resources');
  if (hasSignal(corpus, /\b(manager|management|operations manager)\b/)) roles.add('Management');
  if (hasSignal(corpus, /\b(supervisor|lead)\b/)) roles.add('Supervisor');
  if (hasSignal(corpus, /\b(coworker|co-worker|witness statement|witness)\b/)) roles.add('Coworker/Witness');
  return roles.size;
}

function formatEmploymentPeriod(dates: string): string {
  const d = dates.trim();
  if (!d) return 'Not yet confirmed';
  return d.replace(/\s+through\s+/i, ' â€“ ').replace(/\s+to\s+/i, ' â€“ ');
}

function pickSequenceAwareSummary(payload: IntakeSummaryDownloadPayload): string {
  const candidates = [
    payload.orgSections?.executive_summary,
    ...(payload.orgSections?.review_notes ?? []),
    payload.timelineSummary,
  ];
  for (const candidate of candidates) {
    const cleaned = clipProse(candidate ?? '', 520);
    if (!cleaned || AI_NARRATION_RE.test(cleaned)) continue;
    if (
      /\b(chronology currently reflects|worker-raised concerns|later workplace records|later records include|file set does not yet clearly show|response records|timing details|before separation|followed by later)\b/i.test(
        cleaned
      )
    ) {
      return cleaned;
    }
  }
  return '';
}

function packetSearchCorpus(payload: IntakeSummaryDownloadPayload): string {
  return [
    payload.overview,
    payload.workerContext,
    payload.timelineSummary,
    ...(payload.timelineEvents ?? []).flatMap((event) => [
      event.date,
      event.title,
      event.category,
      event.summary,
      ...(event.sourceDates ?? []),
    ]),
    ...(payload.uploadedFileInventory ?? []).flatMap((row) => [row.fileName, row.category]),
    ...(payload.categories ?? []),
    ...(payload.categoryBreakdown ?? []).map((row) => row.name),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function hasSignal(corpus: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(corpus);
}

function buildRecordSupportSummary(payload: IntakeSummaryDownloadPayload): string {
  const corpus = packetSearchCorpus(payload);
  const recordTypes: string[] = [];
  const add = (label: string, pattern: RegExp) => {
    if (hasSignal(corpus, pattern) && !recordTypes.includes(label)) recordTypes.push(label);
  };

  add('complaints or communications with management and Human Resources', /\b(complaint|reported|human resources|\bhr\b|manager|management|supervisor)\b/);
  add('payroll and timekeeping records', /\b(payroll|pay records?|paystub|pay stub|timecard|timekeeping|timesheet|hours|overtime)\b/);
  add('scheduling records', /\b(schedule|shift|hours cut|staffing)\b/);
  add('disciplinary records', /\b(written warning|write[-_ ]?up|disciplin|corrective action)\b/);
  add('performance-related records', /\b(performance review|performance improvement plan|\bpip\b|coaching memo)\b/);
  add('witness statements', /\b(witness statement|witness)\b/);
  add('reimbursement-related records', /\b(reimbursement|expense|mileage|phone|internet)\b/);
  add('separation documents', /\b(termination|separation|final pay|employment ends|terminated)\b/);

  const count = documentCount(payload);
  if (recordTypes.length) {
    const suffix = count > 0 ? ` across ${count} record${count === 1 ? '' : 's'}` : '';
    return `Records currently reflect ${englishList(recordTypes.slice(0, 8))}${suffix}.`;
  }
  if (count > 0) {
    return `Records currently reflect ${count} record${count === 1 ? '' : 's'} organized for review preparation only.`;
  }
  return '';
}

function buildDerivedSequenceSummary(payload: IntakeSummaryDownloadPayload): string {
  const corpus = packetSearchCorpus(payload);
  const hasConcern = hasSignal(corpus, /\b(complaint|complained|reported|raised concern|human resources|\bhr\b|safety concern|staffing concern|missed break|off[- ]the[- ]clock|reimbursement)\b/);
  const laterActions: string[] = [];
  const add = (label: string, pattern: RegExp) => {
    if (hasSignal(corpus, pattern) && !laterActions.includes(label)) laterActions.push(label);
  };

  add('schedule changes', /\b(schedule change|shift change|hours cut|schedule|staffing)\b/);
  add('written warning materials', /\b(written warning|write[-_ ]?up|disciplin|corrective action)\b/);
  add('performance-related documents', /\b(performance review|performance improvement plan|\bpip\b|coaching memo)\b/);
  add('separation documentation', /\b(termination|terminated|separation|employment ends|final pay)\b/);

  if (hasConcern && laterActions.length) {
    return `The timeline currently places worker-raised concerns before later workplace action records, including ${englishList(laterActions.slice(0, 4))}. Some dates and employer-response details may need confirmation against the source files.`;
  }
  if (hasConcern) {
    return "The records currently identify worker-raised concerns, but the file set does not yet clearly show the employer's response.";
  }
  if (laterActions.length) {
    return `The timeline currently includes ${englishList(laterActions.slice(0, 4))}. Review against source files may help clarify timing and context.`;
  }
  return '';
}

function extractYears(text: string): number[] {
  const years = new Set<number>();
  for (const match of text.matchAll(/\b(19\d{2}|20\d{2})\b/g)) {
    years.add(Number(match[1]));
  }
  return [...years].sort((a, b) => a - b);
}

function employmentDateRangeYears(dates: string): { min: number; max: number } | null {
  const years = extractYears(dates);
  if (!years.length) return null;
  return { min: years[0], max: years[years.length - 1] };
}

function hasEmploymentDateConflict(payload: IntakeSummaryDownloadPayload, dates: string): boolean {
  const range = employmentDateRangeYears(dates);
  if (!range) return false;
  const eventDateText = [
    ...(payload.timelineEvents ?? []).flatMap((event) => [event.date, ...(event.sourceDates ?? [])]),
  ].join('\n');
  const years = extractYears(eventDateText);
  return years.some((year) => year < range.min || year > range.max);
}

function cleanPersonName(raw: string): string {
  return raw
    .replace(/\(\s*([^)]+?)\s*\)\s*\)+/g, '($1)')
    .replace(/\(\s*([^)]+?)\s*\)/g, (_, inner) => `(${inner.replace(/\s*\/\s*/g, '/')})`)
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPeopleSummary(payload: IntakeSummaryDownloadPayload, keyPeople?: string): string {
  const rawPeople = [
    ...(keyPeople ?? '')
      .split(/[,;\n]+/)
      .map((p) => cleanPersonName(p.replace(/^[\s\-Ã¢â‚¬Â¢*]+/, '').trim())),
    ...(payload.orgSections?.people_and_entities ?? []).map((p) => cleanPersonName(p.trim())),
  ]
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 2 && !/^none\b|^unknown\b|^n\/a$/i.test(p));

  const seen = new Set<string>();
  const people = rawPeople.filter((person) => {
    const key = person.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (people.length) {
    return `People referenced in the worker's account and uploaded records include ${englishList(people.slice(0, 5))}.`;
  }

  const corpus = packetSearchCorpus(payload);
  const roles: string[] = [];
  const add = (label: string, pattern: RegExp) => {
    if (hasSignal(corpus, pattern) && !roles.includes(label)) roles.push(label);
  };
  add('Human Resources', /\b(human resources|\bhr\b)\b/);
  add('management', /\b(manager|management|operations manager)\b/);
  add('supervisors', /\b(supervisor|lead)\b/);
  add('coworker/witness references', /\b(coworker|co-worker|witness statement|witness)\b/);

  return roles.length ? `People and roles referenced in the uploaded records include ${englishList(roles)}.` : '';
}

/** First token from employment_dates follow-up for chronology anchoring. */
export function parseEmploymentStartFromDatesField(dates: string | undefined | null): string {
  const d = (dates ?? '').trim();
  if (!d) return '';
  const split = d.split(/\s+through\s+|\s+to\s+|\s*[â€“-]\s*/i);
  return (split[0] ?? d).trim();
}

export function buildChronologyPresentationContext(
  payload: IntakeSummaryDownloadPayload
): ChronologyPresentationContext {
  const followUp = extractStoryFollowUpFromOverview(payload.workerContext ?? '');
  return {
    employmentStartDate: parseEmploymentStartFromDatesField(followUp?.employmentDates),
  };
}

export type WorkerDashboardTimelineRow = {
  date: string;
  event: string;
  category: string;
  summary: string;
  relatedDocs: number;
  sourceFileNames?: string[];
  sourceDates?: string[];
  timelineEventId?: string;
  packetPresentationApplied: true;
};

/** Map intake payload to dashboard timeline rows using packet chronology presentation. */
export function mapWorkerDashboardTimelineRows(
  payload: IntakeSummaryDownloadPayload
): WorkerDashboardTimelineRow[] {
  return buildPacketChronologyPresentation(payload).map((row, index) => ({
    date: row.date,
    event: row.title,
    category: '',
    summary: row.supportingUploads.length ? `References: ${row.supportingUploads.join(', ')}` : '',
    relatedDocs: row.supportingUploads.length,
    sourceFileNames: row.supportingUploads,
    timelineEventId: `presentation-${index}`,
    packetPresentationApplied: true,
  }));
}

export function buildPacketChronologyPresentation(
  payload: IntakeSummaryDownloadPayload
): PreparedChronologyEvent[] {
  const events = (payload.timelineEvents ?? []).map((e) => ({
    date: e.date,
    title: e.title || '',
    category: e.category || '',
    summary: e.summary || '',
    sourceDates: e.sourceDates ?? [],
  }));
  const inventory = payload.uploadedFileInventory ?? [];
  return prepareChronologyPresentationEvents(events, inventory, buildChronologyPresentationContext(payload));
}

/** Confidence-aware date label for chronology presentation. */
export function presentPacketEventDate(rawDate: string, summary?: string, referenceNames: string[] = []): string {
  return resolveChronologyEventDate(rawDate, summary ?? '', referenceNames);
}

/** Human case-note titles for chronology events. */
export function presentPacketTimelineStoryTitle(
  event: PacketTimelineEventInput,
  index = 0,
  ctx?: ChronologyPresentationContext,
  inventory: InventoryRow[] = []
): string {
  return resolveChronologyEventTitle(event, index, ctx, inventory);
}

export {
  pickSupportingRecordsForEvent,
  prepareChronologyPresentationEvents as preparePacketChronologyEvents,
  resolveChronologyEventDate,
  resolveChronologyEventTitle,
};
export type { PacketTimelineEventInput };

export function buildCaseSnapshot(payload: IntakeSummaryDownloadPayload): PacketCaseSnapshot {
  const followUp = extractStoryFollowUpFromOverview(payload.workerContext ?? '');
  const parsed = parseHumanContextSections((payload.workerContext ?? '').trim());
  const workerStory = parsed.workerStory?.trim() ?? '';

  const concerns = extractConcernBullets(
    workerStory,
    followUp?.complainedOrReported ?? '',
    followUp?.changedAfterward ?? ''
  );
  const primaryConcerns = concerns.length ? concerns : ['Workplace concerns noted in worker account'];
  if (
    hasEmploymentDateConflict(payload, followUp?.employmentDates ?? '') &&
    !primaryConcerns.some((concern) => /date details may require confirmation/i.test(concern))
  ) {
    primaryConcerns.push('Date details may require confirmation');
  }

  return {
    employmentPeriod: formatEmploymentPeriod(followUp?.employmentDates ?? ''),
    primaryConcerns,
    recordsOrganized: documentCount(payload),
    timelineEvents: payload.timelineEvents?.length ?? 0,
    namedIndividuals: countNamedPeopleOrRoleReferences(payload, followUp?.keyPeople),
  };
}

/** Four-paragraph executive summary for Current Understanding. */
export function buildExecutiveSummary(payload: IntakeSummaryDownloadPayload): string {
  const rawContext = (payload.workerContext ?? '').trim();
  const parsed = parseHumanContextSections(rawContext);
  const followUp = extractStoryFollowUpFromOverview(rawContext);
  const workerStory = parsed.workerStory?.trim() ?? '';

  const workerName =
    followUp?.employmentName?.trim() ||
    (payload.workerName?.trim() && payload.workerName !== 'Worker' ? payload.workerName.trim() : '');
  const employer = inferEmployerName(payload, followUp?.employer);
  const dates = followUp?.employmentDates?.trim() ?? '';

  const paragraphs: string[] = [];

  const themes = extractConcernThemes(
    workerStory,
    followUp?.complainedOrReported ?? '',
    followUp?.changedAfterward ?? ''
  );
  let opening = '';
  if (employer !== PACKET_METADATA_FALLBACK && dates) {
    opening = `Worker reports employment with ${employer} from ${dates}`;
  } else if (employer !== PACKET_METADATA_FALLBACK) {
    opening = `Worker reports employment with ${employer}`;
  } else if (dates) {
    opening = `Worker reports employment for the period ${dates}`;
  }

  if (opening && themes.length) {
    paragraphs.push(`${opening} and describes concerns involving ${englishList(themes)}.`);
  } else if (opening) {
    paragraphs.push(`${opening}.`);
  } else if (workerStory && !AI_NARRATION_RE.test(workerStory)) {
    const softened = clipProse(
      workerStory.replace(/^(i|we)\s+/i, '').replace(/\.$/, ''),
      280
    );
    if (softened && !AWKWARD_OPENERS.test(softened)) {
      paragraphs.push(
        workerName
          ? `${workerName} describes workplace concerns reflected in the uploaded account and records.`
          : 'Workplace concerns are reflected in the worker-provided account and uploaded records.'
      );
    }
  }

  const eventParts: string[] = [];
  const reporting = followUp?.complainedOrReported?.trim() ?? '';
  const changed = followUp?.changedAfterward?.trim() ?? '';
  if (reporting) {
    const timeframe = inferReportingTimeframe(reporting);
    if (changed) {
      const effects = paraphraseFollowUpEvents(changed);
      if (effects !== null && !/concerns were raised with management/i.test(effects)) {
        // Merge both clauses into one attribution sentence
        eventParts.push(
          `According to ${possessivePronoun(workerName)} account, concerns were raised with management and Human Resources${timeframe}, and following those concerns they experienced ${effects}.`
        );
      } else {
        // effects null or duplicates reporting — just emit the reporting sentence
        eventParts.push(
          `According to ${possessivePronoun(workerName)} account, concerns were raised with management and Human Resources${timeframe}.`
        );
      }
    } else {
      eventParts.push(
        `According to ${possessivePronoun(workerName)} account, concerns were raised with management and Human Resources${timeframe}.`
      );
    }
  } else if (changed) {
    const effects = paraphraseFollowUpEvents(changed);
    if (effects === null) {
      eventParts.push(
        `According to ${possessivePronoun(workerName)} account, workplace conditions and responsibilities changed after concerns were raised.`
      );
    } else if (/concerns were raised with management/i.test(effects)) {
      eventParts.push(`According to ${possessivePronoun(workerName)} account, ${effects}.`);
    } else {
      eventParts.push(
        `According to ${possessivePronoun(workerName)} account, following those concerns they experienced ${effects}.`
      );
    }
  }
  if (eventParts.length) {
    paragraphs.push(clipProse(eventParts.join(' '), 520));
  }

  const recordSupportSummary = buildRecordSupportSummary(payload);
  if (recordSupportSummary) paragraphs.push(recordSupportSummary);

  const sequenceSummary = pickSequenceAwareSummary(payload) || buildDerivedSequenceSummary(payload);
  if (sequenceSummary) {
    paragraphs.push(sequenceSummary);
  }

  const finalNotes: string[] = [];
  const peopleSummary = buildPeopleSummary(payload, followUp?.keyPeople);
  if (peopleSummary) finalNotes.push(peopleSummary);
  const unclearNotes: string[] = [];
  if (dates && hasEmploymentDateConflict(payload, dates)) {
    unclearNotes.push(
      'Some date details may require confirmation because worker-provided dates and document dates do not fully align.'
    );
  } else if (sequenceSummary && /source files|timing/i.test(sequenceSummary)) {
    unclearNotes.push('Exact dates and timing may need confirmation against source files.');
  }
  const missingNotes: string[] = [];
  for (const line of payload.missing ?? []) {
    const note = normalizeMissingRecordBullet(line);
    if (note && !missingNotes.some((n) => n.toLowerCase() === note.toLowerCase())) {
      missingNotes.push(note);
    }
    if (missingNotes.length >= 3) break;
  }
  if (missingNotes.length === 1) {
    unclearNotes.push(`${missingNotes[0]} may help complete the timeline.`);
  } else if (missingNotes.length > 1) {
    unclearNotes.push(`${englishList(missingNotes)} may help complete the timeline.`);
  }
  if (unclearNotes.length) {
    finalNotes.push(`What remains unclear: ${unclearNotes.join(' ')}`);
  }
  if (finalNotes.length) {
    paragraphs.push(finalNotes.join(' '));
  }

  const joined = paragraphs
    .map((p) => sanitizeProse(p))
    .filter((p) => p && !AWKWARD_OPENERS.test(p) && !isIncompleteProse(p))
    .join('\n\n');

  if (joined) return joined;
  return 'Worker reports and available records are organized for review preparation only.';
}

/** Worker Account â€” worker voice, structured sections. */
export function buildWorkerAccount(payload: IntakeSummaryDownloadPayload): {
  sections: WorkerAccountSection[];
  narrative: string;
} {
  const raw = (payload.workerContext ?? '').trim();
  const parsed = parseHumanContextSections(raw);
  const followUp = extractStoryFollowUpFromOverview(raw);
  const story = parsed.workerStory?.trim() ?? '';
  const sections: WorkerAccountSection[] = [];

  if (followUp?.complainedOrReported?.trim()) {
    sections.push({ heading: 'Concerns Reported', body: followUp.complainedOrReported.trim() });
  } else if (story) {
    sections.push({ heading: 'Concerns Reported', body: story });
  }

  if (followUp?.changedAfterward?.trim()) {
    sections.push({
      heading: 'Events After Concerns Were Raised',
      body: followUp.changedAfterward.trim(),
    });
  }

  if (followUp?.keyPeople?.trim()) {
    const cleanedPeople = followUp.keyPeople
      .split(/[,;\n]+/)
      .map((p) => cleanPersonName(p.trim()))
      .filter(Boolean)
      .join(', ');
    sections.push({
      heading: 'People Identified By Worker',
      body: cleanedPeople,
    });
  }

  if (followUp?.employmentStatus) {
    const label =
      followUp.employmentStatus === 'still_employed'
        ? 'Still employed there'
        : followUp.employmentStatus === 'employment_ended'
          ? 'Employment ended'
          : 'Not sure';
    sections.push({ heading: 'Employment Status', body: label });
  }

  if (followUp?.arbitrationAgreement) {
    const label =
      followUp.arbitrationAgreement === 'yes'
        ? 'Yes'
        : followUp.arbitrationAgreement === 'no'
          ? 'No'
          : 'Not sure';
    sections.push({ heading: 'Arbitration Agreement on File', body: label });
  }

  if (followUp?.priorAgencyFiling) {
    const label =
      followUp.priorAgencyFiling === 'yes'
        ? 'Yes'
        : followUp.priorAgencyFiling === 'no'
          ? 'No'
          : 'Not sure';
    const detail = followUp.priorAgencyFilingDetails?.trim();
    sections.push({
      heading: 'Prior Agency Filing',
      body: detail ? `${label} — ${detail}` : label,
    });
  }

  if (!sections.length && story) {
    sections.push({ heading: 'Concerns Reported', body: story });
  }

  const narrative = sections.map((s) => `${s.heading}\n${s.body}`).join('\n\n');
  return { sections, narrative };
}

/** @deprecated Use buildWorkerAccount().narrative */
export function extractWorkerNarrative(payload: IntakeSummaryDownloadPayload): string {
  return buildWorkerAccount(payload).narrative;
}

export function buildReviewTopicBullets(payload: IntakeSummaryDownloadPayload): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (label: string) => {
    const t = label.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  for (const row of payload.categoryBreakdown ?? []) {
    if ((row.count ?? 0) <= 0) continue;
    push(attorneyCategoryLabel(row.name));
  }

  if (payload.uploadedFileInventory?.length) {
    for (const row of payload.uploadedFileInventory) {
      push(attorneyCategoryLabel(row.category, row.fileName));
    }
  }

  if (!out.length) {
    for (const [bucket, count] of aggregateBucketCounts(payload)) {
      if (count <= 0) continue;
      const topic = ATTORNEY_BUCKET_CATEGORY_LABELS[bucket];
      if (topic) push(topic);
    }
  }

  return out.slice(0, 8);
}

export function normalizeMissingRecordBullet(raw: string): string {
  let s = sanitizeProse(raw)
    .replace(/^this may help (complete the timeline|clarify)[:\s-]*/i, '')
    .replace(/^follow-up record that may help[:\s-]*/i, '')
    .replace(/^additional records? that may help[:\s-]*/i, '')
    .replace(/^additional records? may help[:\s-]*/i, '')
    .replace(/^missing or unclear records[:\s-]*/i, '')
    .replace(/^gap[:\s-]*/i, '')
    .replace(/\.\s*confirm in source records\.?/gi, '')
    .replace(/\.\s*originals should control the details\.?/gi, '');

  if (AI_NARRATION_RE.test(s)) return '';

  s = s.replace(/^[â€¢\-*]\s*/, '').trim();
  if (!s) return '';
  if (s.length > 72) s = clipProse(s, 72);
  s = s.replace(/\.$/, '');
  if (isIncompleteProse(s)) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildMissingRecordBullets(payload: IntakeSummaryDownloadPayload): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of payload.missing ?? []) {
    const bullet = normalizeMissingRecordBullet(line);
    if (!bullet || seen.has(bullet.toLowerCase())) continue;
    seen.add(bullet.toLowerCase());
    out.push(bullet);
    if (out.length >= 5) break;
  }

  return out;
}

export function presentPacketTimelineContextNote(_summary: string, _storyTitle: string): string {
  return '';
}
