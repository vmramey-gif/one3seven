/**
 * Phase 2: build timeline events from per-file organization records and extracted facts.
 * Evidence-mapped clustering — no legal conclusions.
 */

import {
  DATE_UNCLEAR_LABEL,
  compareEmploymentChronologyDates,
} from './contextualDateClassification';
import type {
  CommunicationFacts,
  PayRecordFacts,
} from './documentFactExtractionService';
import {
  dedupeOrganizationGapLines,
  organizationGapDedupKey,
} from './organizationOutputQuality';
import {
  defaultSourceTrace,
  formatSupportingFileList,
  sanitizeGenerationPhrase,
} from './intakeGenerationVoice';
import type {
  EvidenceMappedTimelineEvent,
  IntakeFileOrganizationRecord,
  OrganizationTimelineEvent,
  SourceStrength,
} from './intakeOrganizationTypes';
import { sanitizePacketDateLabel } from './intakePacketFormatting';
import {
  formatPersonWithRole,
  inferRolesForPeople,
  type InferredPersonRole,
  type InferredRoleLabel,
} from './peopleRoleInference';
import { extractFilenameDateToken } from './packetChronologyIntelligence';

const GAP_NO_SUPPORTING = 'No related records found yet.';
const GAP_DATE_UNCERTAIN = 'Date may require confirmation from source records.';

export type BuildEvidenceTimelineOpts = {
  fileRecords: IntakeFileOrganizationRecord[];
  payFacts?: PayRecordFacts[];
  commFacts?: CommunicationFacts[];
};

type TimelineCluster = {
  dateKey: string;
  topicKey: string;
  files: IntakeFileOrganizationRecord[];
  eventTitle?: string;
};

type EventCandidate = {
  title: string;
  key: string;
  rank: number;
};

function normalizeDateKey(likelyDate: string | null | undefined): string {
  const d = (likelyDate ?? '').trim();
  if (!d || d === DATE_UNCLEAR_LABEL) return 'undated';
  return d.toLowerCase();
}

function topicKeyForRecord(record: IntakeFileOrganizationRecord): string {
  if (record.employment_topics.length) {
    return record.employment_topics[0].toLowerCase();
  }
  return (record.document_type ?? 'general').toLowerCase();
}

function topicsOverlap(a: string[], b: string[]): boolean {
  const setA = new Set(a.map((t) => t.toLowerCase()));
  return b.some((t) => setA.has(t.toLowerCase()));
}

function candidate(title: string, rank: number): EventCandidate {
  return { title, rank, key: title.toLowerCase() };
}

function eventCandidateFromFilename(record: IntakeFileOrganizationRecord): EventCandidate | null {
  const name = record.file_name.toLowerCase();
  if (/safety_concern|safety.?complaint|unsafe|hazard/.test(name)) {
    return candidate('Worker raises safety concerns', 104);
  }
  if (/accommodation_request|ada_request|medical_leave|fmla_request|leave_request/.test(name)) {
    return candidate('Worker requests leave or accommodation', 102);
  }
  if (/complaint_to_hr|complaint.?hr|hr.?complaint|grievance.*hr/.test(name)) {
    return candidate('Complaint submitted to Human Resources', 100);
  }
  if (/complaint_to_supervisor|complaint.?supervisor|complaint.?manager|supervisor.?complaint/.test(name)) {
    return candidate('Complaint submitted to supervisor', 96);
  }
  if (/hr.response|response_to_complaint|complaint_response|investigation_response/.test(name)) {
    return candidate('HR response received', 94);
  }
  if (/written_warning|write[-_]?up|disciplin|corrective_action/.test(name)) {
    return candidate('Written warning issued', 92);
  }
  if (/\bpip\b|performance_improvement/.test(name)) {
    return candidate('Performance improvement plan issued', 91);
  }
  if (/project_removal|removed_from_project/.test(name)) {
    return candidate('Project removal documented', 90);
  }
  if (/performance_review|evaluation|appraisal/.test(name)) {
    return candidate('Performance review completed', 89);
  }
  if (/termination_letter|termination_notice|terminat/.test(name)) {
    return candidate('Termination documented', 98);
  }
  if (/separation|severance|final_pay|resign|layoff/.test(name)) {
    return candidate('Employment ends', 88);
  }
  if (/witness_statement|witness.?statement/.test(name)) {
    return candidate('Witness statement provided', 86);
  }
  if (/offer_letter|employment_agreement|onboard|hire/.test(name)) {
    return candidate('Employment begins', 84);
  }
  if (/schedule_change|shift_change|hours_change|schedule|timesheet|timecard/.test(name)) {
    return candidate('Schedule change documented', 80);
  }
  if (/paystub|pay_stub|payroll|wage_statement|overtime/.test(name)) {
    return candidate('Pay period or overtime record documented', 78);
  }
  return null;
}

function eventCandidateFromTopics(record: IntakeFileOrganizationRecord): EventCandidate | null {
  const hay = `${record.employment_topics.join(' ')} ${record.document_type}`.toLowerCase();
  if (/safety|unsafe|hazard/.test(hay)) {
    return candidate('Worker raises safety concerns', 84);
  }
  if (/accommodation|medical leave|fmla|leave request/.test(hay)) {
    return candidate('Worker requests leave or accommodation', 84);
  }
  if (/complaint|grievance|reported concern/.test(hay) && /\bhr\b|human resources/.test(hay)) {
    return candidate('Complaint submitted to Human Resources', 82);
  }
  if (/complaint|grievance|reported concern/.test(hay)) {
    if (/supervisor|manager|management/.test(hay)) {
      return candidate('Complaint submitted to supervisor', 76);
    }
    return candidate('Workplace concern documented', 74);
  }
  if (/termination|separation|final pay|resignation|layoff/.test(hay)) {
    return candidate('Termination documented', 78);
  }
  if (/written warning|write[- ]?up|disciplin|corrective action/.test(hay)) {
    return candidate('Written warning issued', 76);
  }
  if (/\bpip\b|performance improvement/.test(hay)) {
    return candidate('Performance improvement plan issued', 76);
  }
  if (/performance review|evaluation|appraisal/.test(hay)) {
    return candidate('Performance review completed', 74);
  }
  if (/schedule|timekeeping|shift|hours/.test(hay)) {
    return candidate('Schedule change documented', 70);
  }
  if (/payroll|wage|overtime|pay period/.test(hay)) {
    return candidate('Pay period or overtime record documented', 68);
  }
  return null;
}

function eventCandidateFromPossibleTimelineEvent(record: IntakeFileOrganizationRecord): EventCandidate | null {
  const title = sanitizeGenerationPhrase(record.possible_timeline_event?.title ?? '');
  if (!title || isGenericTimelineTitle(title)) return null;
  const signals = `${title} ${record.file_name} ${record.employment_topics.join(' ')} ${
    record.possible_timeline_event?.neutral_summary ?? ''
  }`.toLowerCase();
  if (/complaint.*human resources|complaint.*\bhr\b|\bhr\b.*complaint/i.test(title)) {
    return candidate('Complaint submitted to Human Resources', 74);
  }
  if (/complaint|grievance|workplace concern/i.test(title)) {
    if (/supervisor|manager|management/i.test(signals)) {
      return candidate('Complaint submitted to supervisor', 68);
    }
    return candidate('Workplace concern documented', 66);
  }
  if (/safety concern|unsafe|hazard/i.test(title)) return candidate('Worker raises safety concerns', 74);
  if (/accommodation|medical leave|fmla|leave request/i.test(title)) {
    return candidate('Worker requests leave or accommodation', 74);
  }
  if (/hr response|human resources response|response.*\bhr\b|\bhr\b.*response|investigation response/i.test(title)) {
    return candidate('HR response received', 73);
  }
  if (/terminat|separation|employment ends/i.test(title)) {
    return candidate('Termination documented', 72);
  }
  if (/written warning|write[- ]?up/i.test(title)) return candidate('Written warning issued', 70);
  if (/\bpip\b|performance improvement/i.test(title)) return candidate('Performance improvement plan issued', 70);
  if (/project removal|removed from project/i.test(title)) return candidate('Project removal documented', 70);
  if (/performance review|evaluation|appraisal/i.test(title)) return candidate('Performance review completed', 70);
  if (/witness statement/i.test(title)) return candidate('Witness statement provided', 68);
  if (/schedule|shift|hours/i.test(title)) return candidate('Schedule change documented', 64);
  if (/pay|payroll|overtime|wage/i.test(title)) return candidate('Pay period or overtime record documented', 62);
  return candidate(title, 50);
}

function eventCandidateFromCommunication(record: IntakeFileOrganizationRecord, commFact: CommunicationFacts | null): EventCandidate | null {
  const hay = `${commFact?.subjectOrTopic ?? ''} ${commFact?.workerConcernExcerpt ?? ''} ${record.file_name}`.toLowerCase();
  if (/safety|unsafe|hazard/.test(hay)) {
    return candidate('Worker raises safety concerns', 90);
  }
  if (/accommodation|medical leave|\bfmla\b|leave request/.test(hay)) {
    return candidate('Worker requests leave or accommodation', 90);
  }
  if (/complaint|grievance|workplace concern/.test(hay) && /\bhr\b|human resources/.test(hay)) {
    return candidate('Complaint submitted to Human Resources', 88);
  }
  if (/response|investigation/.test(hay) && /complaint|grievance|concern|\bhr\b|human resources/.test(hay)) {
    return candidate('HR response received', 84);
  }
  return null;
}

function bestEventCandidateForRecord(
  record: IntakeFileOrganizationRecord,
  commFact: CommunicationFacts | null
): EventCandidate | null {
  const candidates = [
    eventCandidateFromFilename(record),
    eventCandidateFromCommunication(record, commFact),
    eventCandidateFromTopics(record),
    eventCandidateFromPossibleTimelineEvent(record),
  ].filter(Boolean) as EventCandidate[];
  candidates.sort((a, b) => b.rank - a.rank);
  return candidates[0] ?? null;
}

function buildEventFirstClusters(
  fileRecords: IntakeFileOrganizationRecord[],
  commFacts: CommunicationFacts[]
): TimelineCluster[] {
  const clusters: TimelineCluster[] = [];
  const clusteredIds = new Set<string>();

  for (const record of fileRecords) {
    const event = bestEventCandidateForRecord(record, commFactForFile(record, commFacts));
    if (!event) continue;

    const dateKey = normalizeDateKey(record.likely_date);
    const topicKey = event.key;
    let target =
      clusters.find((c) => c.topicKey === topicKey && c.dateKey === dateKey) ??
      (dateKey !== 'undated'
        ? clusters.find((c) => c.topicKey === topicKey && c.dateKey !== 'undated')
        : null);

    if (!target) {
      target = { dateKey, topicKey, files: [], eventTitle: event.title };
      clusters.push(target);
    }
    target.files.push(record);
    if (record.source_file_id) clusteredIds.add(record.source_file_id);
  }

  for (const record of fileRecords) {
    if (record.source_file_id && clusteredIds.has(record.source_file_id)) continue;
    const dateKey = normalizeDateKey(record.likely_date);
    const target = clusters.find(
      (c) =>
        c.dateKey === dateKey &&
        (topicsOverlap(
          c.files.flatMap((f) => f.employment_topics),
          record.employment_topics
        ) ||
          c.files.some((f) => f.document_type === record.document_type))
    );
    if (!target) continue;
    target.files.push(record);
    if (record.source_file_id) clusteredIds.add(record.source_file_id);
  }

  return clusters;
}

function clusterRecords(fileRecords: IntakeFileOrganizationRecord[]): TimelineCluster[] {
  const clusters: TimelineCluster[] = [];

  for (const record of fileRecords) {
    const dateKey = normalizeDateKey(record.likely_date);
    const topicKey = topicKeyForRecord(record);
    let target =
      clusters.find(
        (c) =>
          c.dateKey === dateKey &&
          (c.topicKey === topicKey ||
            topicsOverlap(
              c.files.flatMap((f) => f.employment_topics),
              record.employment_topics
            ) ||
            c.files.some((f) => f.document_type === record.document_type))
      ) ?? null;

    if (!target && dateKey !== 'undated') {
      target = clusters.find(
        (c) =>
          c.dateKey === dateKey &&
          c.files.some((f) => f.document_type === record.document_type)
      ) ?? null;
    }

    if (!target) {
      target = { dateKey, topicKey, files: [] };
      clusters.push(target);
    }
    target.files.push(record);
  }

  return clusters;
}

function strengthRank(s: SourceStrength): number {
  switch (s) {
    case 'strong':
      return 4;
    case 'partial':
      return 3;
    case 'inferred':
      return 2;
    default:
      return 1;
  }
}

function clusterConfidence(files: IntakeFileOrganizationRecord[]): 'high' | 'medium' | 'low' {
  const readable = files.filter((f) => f.extraction_quality !== 'unreadable');
  if (!readable.length) return 'low';
  const levels = readable.map((f) => f.confidence);
  if (levels.every((c) => c === 'high')) return 'high';
  if (levels.some((c) => c === 'high' || c === 'medium')) return 'medium';
  return 'low';
}

function clusterSourceStrength(files: IntakeFileOrganizationRecord[]): SourceStrength {
  let best: SourceStrength = 'needs_review';
  for (const f of files) {
    if (strengthRank(f.supporting_record_strength) > strengthRank(best)) {
      best = f.supporting_record_strength;
    }
  }
  return best;
}

const GENERIC_TIMELINE_TITLES =
  /^(workplace communications|compensation and pay periods|employment and hr paperwork|scheduling and timekeeping|supporting employment records|employment-related activity|workplace incident or discipline materials|identity or verification materials)$/i;

function isGenericTimelineTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (GENERIC_TIMELINE_TITLES.test(t)) return true;
  if (
    t === 'workplace complaint materials' ||
    t === 'separation notice materials' ||
    t === 'pay period record materials' ||
    t === 'hr response materials' ||
    t === 'policy or handbook materials'
  ) {
    return false;
  }
  return (
    (/^workplace communication/.test(t) ||
      /^compensation and pay/.test(t) ||
      /^separation-related/.test(t) ||
      /^scheduling and timekeeping/.test(t) ||
      /^supporting employment/.test(t)) &&
    /\b(materials|records|communications)\b/.test(t)
  );
}

function normalizeMaterialTimelineTitle(
  title: string | null | undefined,
  files: IntakeFileOrganizationRecord[],
  commFacts: CommunicationFacts[] = []
): string | null {
  const raw = sanitizeGenerationPhrase(title ?? '');
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();
  const fileNames = files.map((f) => f.file_name).join(' ').toLowerCase();
  const topics = files.flatMap((f) => f.employment_topics).join(' ').toLowerCase();
  const docTypes = files
    .map((f) => `${f.document_type ?? ''} ${f.legacy_upload_category ?? ''}`)
    .join(' ')
    .toLowerCase();
  const eventText = files
    .map((f) => `${f.possible_timeline_event?.title ?? ''} ${f.possible_timeline_event?.neutral_summary ?? ''}`)
    .join(' ')
    .toLowerCase();
  const commText = commFacts
    .map((fact) => `${fact.subjectOrTopic ?? ''} ${fact.workerConcernExcerpt ?? ''}`)
    .join(' ')
    .toLowerCase();
  const signals = `${normalized} ${fileNames} ${topics} ${docTypes} ${eventText} ${commText}`;

  if (/^pay period record materials$/.test(normalized) && /pay|payroll|wage|overtime|paystub|pay stub/.test(signals)) {
    return 'Pay period or overtime record documented';
  }
  if (/^hr response materials$/.test(normalized) && /\bhr\b|human resources|response|investigation|follow.?up/.test(signals)) {
    return 'HR response received';
  }
  if (
    /^separation notice materials$/.test(normalized) &&
    /terminat|separat|layoff|resign|final pay|severance/.test(signals)
  ) {
    return /terminat/.test(signals) ? 'Termination documented' : 'Employment ends';
  }
  if (/^workplace complaint materials$/.test(normalized) && /complaint|grievance|concern/.test(signals)) {
    if (/\bhr\b|human resources/.test(signals)) {
      return 'Complaint submitted to Human Resources';
    }
    return 'Workplace concern documented';
  }

  return raw;
}

function commFactForFile(
  record: IntakeFileOrganizationRecord,
  commFacts: CommunicationFacts[]
): CommunicationFacts | null {
  return commFacts.find((c) => c.source.uploadedFileId === record.source_file_id) ?? null;
}

function titleFromCommunicationSubject(subject: string | null | undefined): string | null {
  const raw = (subject ?? '').replace(/^subject:\s*/i, '').trim();
  if (raw.length < 4 || raw.length > 72) return null;
  if (/^(re:|fw:|fwd:)/i.test(raw)) {
    const inner = raw.replace(/^(re:|fw:|fwd:)\s*/i, '').trim();
    if (inner.length >= 4) return sanitizeGenerationPhrase(inner);
  }
  return sanitizeGenerationPhrase(raw);
}

function specificTitleFromRecord(
  record: IntakeFileOrganizationRecord,
  commFact: CommunicationFacts | null
): string | null {
  const subjectTitle = titleFromCommunicationSubject(commFact?.subjectOrTopic);
  if (subjectTitle && !isGenericTimelineTitle(subjectTitle)) return subjectTitle;

  const name = record.file_name.toLowerCase();
  const topics = record.employment_topics.join(' ').toLowerCase();
  const hay = `${name} ${topics} ${commFact?.subjectOrTopic ?? ''} ${commFact?.workerConcernExcerpt ?? ''}`.toLowerCase();

  if (/safety|unsafe|hazard/.test(hay)) {
    return 'Worker raises safety concerns';
  }
  if (/accommodation|medical leave|\bfmla\b|leave request/.test(hay)) {
    return 'Worker requests leave or accommodation';
  }
  if (/complaint|grievance/.test(name) || /complaint|grievance|formal complaint/.test(topics)) {
    if (/\bhr\b|human resources/.test(hay)) {
      return 'Complaint submitted to Human Resources';
    }
    if (/supervisor|manager|management/.test(hay)) {
      return 'Complaint submitted to supervisor';
    }
    return 'Workplace concern documented';
  }
  if (/terminat|separat|layoff|resign/.test(name) || /separation|final pay/.test(topics)) {
    return 'Termination documented';
  }
  if (/paystub|pay.stub|payroll|wage.statement/.test(name) || /payroll|wage/.test(topics)) {
    return 'Pay period or overtime record documented';
  }
  if (/timesheet|timecard|schedule/.test(name) || /scheduling|timekeeping/.test(topics)) {
    return 'Schedule change documented';
  }
  if (/handbook|policy.manual/.test(name)) {
    return 'Policy or handbook materials';
  }
  if (/hr.response|response.pdf|re_.*\.pdf/.test(name) || (commFact && /response|investigation/i.test(commFact.subjectOrTopic ?? ''))) {
    return 'HR response received';
  }

  const eventTitle = record.possible_timeline_event?.title?.trim();
  if (eventTitle && !isGenericTimelineTitle(eventTitle)) {
    return normalizeMaterialTimelineTitle(eventTitle, [record], commFact ? [commFact] : []);
  }

  return null;
}

function neutralClusterTitle(
  files: IntakeFileOrganizationRecord[],
  commFacts: CommunicationFacts[]
): string {
  const readable = readableSupportingFiles(files);
  const ordered = [...readable, ...files.filter((f) => f.extraction_quality === 'unreadable')];

  const bestEvent = ordered
    .map((record) => bestEventCandidateForRecord(record, commFactForFile(record, commFacts)))
    .filter((event): event is EventCandidate => Boolean(event))
    .sort((a, b) => b.rank - a.rank)[0];
  if (bestEvent) return bestEvent.title;

  for (const record of ordered) {
    const specific = specificTitleFromRecord(record, commFactForFile(record, commFacts));
    if (specific) return specific;
  }

  const topics = [...new Set(files.flatMap((f) => f.employment_topics))];
  const names = files.map((f) => f.file_name.toLowerCase()).join(' ');

  if (/complaint|grievance/.test(names)) {
    if (/\bhr\b|human resources/.test(names) || topics.some((t) => /\bhr\b|human resources/i.test(t))) {
      return 'Complaint submitted to Human Resources';
    }
    if (/supervisor|manager|management/.test(names) || topics.some((t) => /supervisor|manager|management/i.test(t))) {
      return 'Complaint submitted to supervisor';
    }
    return 'Workplace concern documented';
  }
  if (/safety|unsafe|hazard/.test(names) || topics.some((t) => /safety|unsafe|hazard/i.test(t))) {
    return 'Worker raises safety concerns';
  }
  if (
    /accommodation|medical leave|fmla|leave request/.test(names) ||
    topics.some((t) => /accommodation|medical leave|fmla|leave request/i.test(t))
  ) {
    return 'Worker requests leave or accommodation';
  }
  if (topics.some((t) => /separation|final pay/i.test(t)) || /terminat|separation|resign/.test(names)) {
    return 'Termination documented';
  }
  if (topics.some((t) => /payroll|wage/i.test(t)) || /paystub|pay stub|payroll/.test(names)) {
    return 'Pay period or overtime record documented';
  }
  if (topics.some((t) => /scheduling|timekeeping/i.test(t)) || /timesheet|schedule|timecard/.test(names)) {
    return 'Schedule change documented';
  }
  if (topics.some((t) => /workplace communication/i.test(t)) || /hr email|memo|email/.test(names)) {
    return 'Workplace communication documented';
  }

  const eventTitle = files.find((f) => f.possible_timeline_event?.title)?.possible_timeline_event?.title;
  if (eventTitle) return normalizeMaterialTimelineTitle(eventTitle, files, commFacts) ?? sanitizeGenerationPhrase(eventTitle);

  const docType = files[0]?.document_type ?? 'Employment-related materials';
  return normalizeMaterialTimelineTitle(docType, files, commFacts) ?? sanitizeGenerationPhrase(docType);
}

function clusterDateFromFilenames(files: IntakeFileOrganizationRecord[]): string {
  for (const f of files) {
    const token = extractFilenameDateToken(f.file_name);
    if (!token) continue;
    const label = sanitizePacketDateLabel(token);
    if (label && label !== 'Date to confirm') return label;
  }
  return '';
}

function clusterDate(files: IntakeFileOrganizationRecord[]): string {
  for (const f of files) {
    const d = (f.likely_date ?? '').trim();
    if (d && d !== DATE_UNCLEAR_LABEL) return d;
  }
  for (const f of files) {
    const d = f.possible_timeline_event?.date?.trim();
    if (d && d !== DATE_UNCLEAR_LABEL) return d;
  }
  return clusterDateFromFilenames(files);
}

function readableSupportingFiles(files: IntakeFileOrganizationRecord[]): IntakeFileOrganizationRecord[] {
  return files.filter((f) => f.extraction_quality !== 'unreadable');
}

function buildClusterGaps(
  files: IntakeFileOrganizationRecord[],
  date: string,
  supportingReadable: IntakeFileOrganizationRecord[]
): string[] {
  const gaps: string[] = [];
  const gapKeys = new Set<string>();

  const addGap = (line: string) => {
    const t = sanitizeGenerationPhrase(line);
    if (!t) return;
    const key = organizationGapDedupKey(t);
    if (gapKeys.has(key)) return;
    if (key === 'gap:date-file' && gapKeys.has('gap:date-cluster')) return;
    if (
      (key === 'gap:unreadable-generic' || key === 'gap:empty-layer') &&
      gapKeys.has('gap:no-supporting')
    ) {
      return;
    }
    gapKeys.add(key);
    gaps.push(t);
  };

  if (!date) addGap(GAP_DATE_UNCERTAIN);
  if (!supportingReadable.length) addGap(GAP_NO_SUPPORTING);

  for (const f of files) {
    for (const line of f.missing_or_unclear_information) {
      const key = organizationGapDedupKey(line);
      if (!date && key === 'gap:date-file') continue;
      if (!supportingReadable.length && (key === 'gap:unreadable-generic' || key === 'gap:empty-layer')) {
        continue;
      }
      addGap(line);
    }
  }

  return dedupeOrganizationGapLines(gaps).slice(0, 6);
}

function buildClusterSummary(
  title: string,
  supportingNames: string[],
  topics: string[]
): string {
  const list = formatSupportingFileList(supportingNames, 4);
  const parts: string[] = [];
  if (list) {
    parts.push(`Supported by ${list}.`);
  }
  if (topics.length) {
    parts.push(
      sanitizeGenerationPhrase(
        `Related pattern${topics.length === 1 ? '' : 's'}: ${topics.slice(0, 3).join(', ')}.`
      )
    );
  }
  return parts.length ? sanitizeGenerationPhrase(parts.join(' ')) : '';
}

function enrichPeopleFromFacts(
  files: IntakeFileOrganizationRecord[],
  payFacts: PayRecordFacts[],
  commFacts: CommunicationFacts[]
): string[] {
  const people = new Set<string>(files.flatMap((f) => f.people_or_entities));
  const fileIds = new Set(files.map((f) => f.source_file_id));

  for (const pf of payFacts) {
    if (!fileIds.has(pf.source.uploadedFileId)) continue;
    if (pf.employeeName) people.add(pf.employeeName);
    if (pf.employerName) people.add(pf.employerName);
  }
  for (const cf of commFacts) {
    if (!fileIds.has(cf.source.uploadedFileId)) continue;
    if (cf.sender) people.add(cf.sender);
    if (cf.recipient) people.add(cf.recipient);
    if (cf.employerOrCompany) people.add(cf.employerOrCompany);
    for (const p of cf.peopleMentioned) people.add(p);
  }

  return [...people].slice(0, 12);
}

function roleContextsForEvent(
  files: IntakeFileOrganizationRecord[],
  commFacts: CommunicationFacts[]
): string[] {
  const fileIds = new Set(files.map((f) => f.source_file_id));
  const contexts = files.map((f) =>
    [
      f.file_name,
      f.document_type,
      f.legacy_upload_category ?? '',
      f.employment_topics.join(' '),
      f.possible_timeline_event?.title ?? '',
      f.possible_timeline_event?.neutral_summary ?? '',
      f.people_or_entities.join(' '),
    ].join('\n')
  );
  for (const fact of commFacts) {
    if (!fileIds.has(fact.source.uploadedFileId)) continue;
    contexts.push(
      [
        fact.source.fileName,
        fact.sender ?? '',
        fact.recipient ?? '',
        fact.subjectOrTopic ?? '',
        fact.workerConcernExcerpt ?? '',
        fact.employerOrHrResponseExcerpt ?? '',
        fact.peopleMentioned.join(' '),
      ].join('\n')
    );
  }
  return contexts;
}

function inferEventRoles(
  people: string[],
  files: IntakeFileOrganizationRecord[],
  commFacts: CommunicationFacts[]
): InferredPersonRole[] {
  return inferRolesForPeople({
    names: people,
    contexts: roleContextsForEvent(files, commFacts),
  });
}

function roleAwarePeopleList(
  people: string[],
  files: IntakeFileOrganizationRecord[],
  commFacts: CommunicationFacts[]
): string[] {
  const roles = new Map(
    inferEventRoles(people, files, commFacts).map((role) => [role.name.toLowerCase(), role])
  );
  return people.map((person) => formatPersonWithRole(person, roles.get(person.toLowerCase()), 'medium'));
}

function firstConfidentPersonForRole(
  roles: InferredPersonRole[],
  acceptedRoles: InferredRoleLabel[]
): InferredPersonRole | null {
  return (
    roles.find(
      (role) =>
        role.confidence === 'high' &&
        acceptedRoles.includes(role.role) &&
        !/^(hr|human resources|payroll|management|manager|supervisor|employee|worker|company|employer|department)$/i.test(
          role.name
        )
    ) ?? null
  );
}

function roleAwareTitle(
  title: string,
  people: string[],
  files: IntakeFileOrganizationRecord[],
  commFacts: CommunicationFacts[]
): string {
  const roles = inferEventRoles(people, files, commFacts);
  const hr = firstConfidentPersonForRole(roles, ['Human Resources Representative']);
  if (hr && /human resources|\bhr\b/i.test(title)) return `${title} (${hr.name})`;

  const supervisor = firstConfidentPersonForRole(roles, ['Supervisor']);
  if (supervisor && /safety|schedule|performance review/i.test(title)) return `${title} (${supervisor.name})`;

  const manager = firstConfidentPersonForRole(roles, ['Manager', 'Decision Maker']);
  if (manager && /warning|performance|termination|project removal/i.test(title)) {
    return `${title} (${manager.name})`;
  }
  return title;
}

function clusterToEvent(
  cluster: TimelineCluster,
  payFacts: PayRecordFacts[],
  commFacts: CommunicationFacts[]
): EvidenceMappedTimelineEvent {
  const { files } = cluster;
  const date = clusterDate(files);
  const baseTitle = cluster.eventTitle ?? neutralClusterTitle(files, commFacts);
  const supportingReadable = readableSupportingFiles(files);
  const supportingAll = files;
  const supportingIds = supportingAll.map((f) => f.source_file_id).filter(Boolean);
  const supportingNames = supportingAll.map((f) => f.file_name);
  const readableNames = supportingReadable.map((f) => f.file_name);
  const topics = [...new Set(files.flatMap((f) => f.employment_topics))].slice(0, 6);
  const people = enrichPeopleFromFacts(files, payFacts, commFacts);
  const title = roleAwareTitle(baseTitle, people, files, commFacts);
  const gaps = buildClusterGaps(files, date, supportingReadable);

  const summaryNames = readableNames.length ? readableNames : supportingNames;
  const neutral_summary = buildClusterSummary(title, summaryNames, topics);

  const primaryCategory =
    files.find((f) => f.legacy_upload_category)?.legacy_upload_category ??
    files[0]?.document_type ??
    'Uncategorized';

  return {
    date: date || DATE_UNCLEAR_LABEL,
    title,
    neutral_summary,
    people_involved: roleAwarePeopleList(people, files, commFacts),
    supporting_file_ids: supportingIds,
    supporting_file_names: supportingNames,
    related_topics: topics,
    gaps_or_uncertainties: gaps,
    confidence: clusterConfidence(files),
    category: primaryCategory,
    source_strength: clusterSourceStrength(files),
  };
}

export function buildEvidenceMappedTimelineEvents(
  opts: BuildEvidenceTimelineOpts
): EvidenceMappedTimelineEvent[] {
  const { fileRecords, payFacts = [], commFacts = [] } = opts;
  if (!fileRecords.length) return [];

  const eventFirstClusters = buildEventFirstClusters(fileRecords, commFacts);
  const clusteredIds = new Set(eventFirstClusters.flatMap((c) => c.files.map((f) => f.source_file_id)));
  const fallbackRecords = fileRecords.filter((record) => !clusteredIds.has(record.source_file_id));
  const clusters = [...eventFirstClusters, ...clusterRecords(fallbackRecords)];
  const events = clusters.map((c) => clusterToEvent(c, payFacts, commFacts));

  events.sort((a, b) => compareEmploymentChronologyDates(a.date, b.date));
  return events.slice(0, 16);
}

export function evidenceTimelineToOrganizationEvents(
  events: EvidenceMappedTimelineEvent[]
): OrganizationTimelineEvent[] {
  return events.map((e) => {
    const source = defaultSourceTrace(
      e.supporting_file_names.map((fileName, i) => ({
        uploadedFileId: e.supporting_file_ids[i],
        fileName,
        category: e.category,
      })),
      e.source_strength
    );
    if (e.date && e.date !== DATE_UNCLEAR_LABEL) {
      source.sourceDates = [e.date];
    }

    return {
      eventDate: e.date,
      title: e.title,
      category: e.category,
      aiSummary: e.neutral_summary,
      source,
      unresolvedQuestions: e.gaps_or_uncertainties.length ? e.gaps_or_uncertainties : undefined,
    };
  });
}

export function formatEvidenceTimelineChronologyLine(event: EvidenceMappedTimelineEvent): string {
  const dateLabel =
    event.date && event.date !== DATE_UNCLEAR_LABEL ? event.date : 'Date unclear';
  const files =
    event.supporting_file_names.length > 0
      ? formatSupportingFileList(event.supporting_file_names, 2)
      : GAP_NO_SUPPORTING;
  const people =
    event.people_involved.length > 0
      ? ` People noted: ${event.people_involved.slice(0, 4).join(', ')}.`
      : '';
  const topics =
    event.related_topics.length > 0
      ? ` Topics: ${event.related_topics.slice(0, 3).join(', ')}.`
      : '';
  return sanitizeGenerationPhrase(
    `${dateLabel} — ${event.title}. ${event.neutral_summary} Supporting files: ${files}.${people}${topics} Confidence: ${event.confidence}.`
  );
}
