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
  /**
   * uploadedFileId → document_facts.document_date as stored by the Claude extraction
   * (e.g. "March 6, 2025", "1/31/25", "12/02/2025 08:46:46 AM CST"). When usable, it is
   * authoritative for that file's event date; otherwise the text-mined date stands.
   */
  documentDates?: Record<string, string | null | undefined>;
  /**
   * uploadedFileIds whose extraction facts identify the file as a tax form (see
   * TAX_FORM_FILENAME_RE / TAX_FORM_FACTS_RE); merged with filename detection.
   */
  taxFormFileIds?: ReadonlySet<string>;
};

/**
 * HARD GUARD — tax forms (W-2 / W-2c / 1099 family). A tax form is TAX-YEAR PAYROLL CONTEXT,
 * not a dated workplace occurrence: its filename year is the tax year and its facts carry no
 * document_date. Live Francis bug: the two W2s fell into a bare "2023" filename-year cluster
 * that inherited "Schedule change documented" from unrelated topic keywords ("hours" wording
 * inside the form's boilerplate). Tax forms never seed or support timeline events — they stay
 * in file records, the inventory, and the coverage rail, where their tax-year context lives.
 */
export const TAX_FORM_FILENAME_RE =
  /\bw-?2c?\b|\b1099(?:[-_ ]?[a-z]{1,4})?\b|wage and tax statement/i;
/** Facts-side signal (document type / key quote): explicit form phrasing only. */
export const TAX_FORM_FACTS_RE =
  /\bform\s+w-?2c?\b|\bform\s+1099\b|wage and tax statement/i;

/** Titles whose keyword-map origin makes a bare filename-year an untrustworthy anchor. */
const BARE_YEAR_DATE_RE = /^(19|20)\d{2}$/;

type TimelineCluster = {
  dateKey: string;
  topicKey: string;
  files: IntakeFileOrganizationRecord[];
  eventTitle?: string;
  eventTitleSource?: EventCandidateSource;
};

/** Where a cluster title candidate came from — filename/communication candidates are anchored
 *  to a specific document signal; topics/inferred candidates are keyword-derived. */
type EventCandidateSource = 'filename' | 'communication' | 'topics' | 'inferred';

type EventCandidate = {
  title: string;
  key: string;
  rank: number;
  source?: EventCandidateSource;
};

function normalizeDateKey(likelyDate: string | null | undefined): string {
  const d = (likelyDate ?? '').trim();
  if (!d || d === DATE_UNCLEAR_LABEL) return 'undated';
  return d.toLowerCase();
}

/**
 * Validates an extraction-stored document_facts.document_date before it may override a
 * file's text-mined date. The value is treated as an opaque display string; a time-of-day
 * suffix ("08:46:46 AM CST") is trimmed off for display, and the result must contain a
 * 4-digit year or parse via Date.parse. Returns null when the value is not usable.
 * Exported: perFileOrganizationService applies the same validation so a file record's
 * likely_date prefers the extraction-stored date over text-mined candidates.
 */
export function usableDocumentDateLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  let label = raw.trim();
  if (!label || label === DATE_UNCLEAR_LABEL) return null;
  // "12/02/2025 08:46:46 AM CST" → "12/02/2025"
  label = label
    .replace(/[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?(?:\s+[a-z]{2,5})?\s*$/i, '')
    .trim();
  if (!label) return null;
  if (!/\b\d{4}\b/.test(label) && Number.isNaN(Date.parse(label))) return null;
  return label;
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
  // Normalize CamelCase + separators to the underscore form the patterns below expect, so
  // "Rosa_WrittenWarning_2026-03-13.pdf" matches /written_warning/ (it did not before — the
  // warning fell through to "Schedule change"). Splits camelCase, then collapses spaces/dots/
  // hyphens to underscores.
  const name = record.file_name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s.\-]+/g, '_');
  // Excludes an obvious reply/response filename ("re_safety_concern_response.pdf") -- without
  // this, HR's OWN reply was titled "Worker raises safety concerns" purely because the reply's
  // filename still carries the original topic word (2026-08-18 fresh-accuracy hard-challenge).
  // This filename-level match is checked FIRST and outranks every other candidate source (104 is
  // the highest rank of any filename pattern), so it silently overrode the direction-aware fixes
  // already made to eventCandidateFromCommunication / eventCandidateFromPossibleTimelineEvent for
  // this exact bug class. Returning null here (rather than trying to positively detect "this is a
  // reply" from the filename alone) is the safe fallback -- those other two candidate sources
  // already resolve a genuine reply correctly using the file's actual extracted facts.
  if (/safety_concern|safety.?complaint|unsafe|hazard/.test(name) && !/response|reply|\bre_/.test(name)) {
    return candidate('Worker raises safety concerns', 104);
  }
  if (
    /accommodation_request|ada_request|medical_leave|fmla_request|leave_request/.test(name) &&
    !/response|reply|\bre_/.test(name)
  ) {
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
  // A worker's OWN statement / narrative account. A narrative touches many topics; without this the
  // topic inference promoted one of them into a fabricated "documented" event — Rosa's statement was
  // titled "Schedule change documented" though no schedule change is documented. Title it for what
  // the record IS. Excludes wage/earnings/pay/bank statements (real financial records).
  if (
    /(^|_)(statement|declaration|affidavit)(_|$)/.test(name) &&
    !/wage|earnings|pay|bank|financial|income|witness/.test(name)
  ) {
    return candidate('Worker statement provided', 85);
  }
  if (/offer_letter|employment_agreement|onboard|hire/.test(name)) {
    return candidate('Employment begins', 84);
  }
  // "timesheet"/"timecard" moved out of the schedule-change match below (2026-08-18 founder
  // review): a plain timecard or timesheet records hours worked in a period -- it's evidence of
  // pay/time records, not evidence a schedule CHANGED. Grouping it with genuine schedule-change
  // filenames asserted a change the file itself never establishes (matches the same bug class
  // fixed above for worker statements -- title the record for what it IS).
  if (/schedule_change|shift_change|hours_change|schedule/.test(name)) {
    return candidate('Schedule change documented', 80);
  }
  // "overtime" alone is ambiguous -- it's a strong payroll-document signal on its own
  // ("Overtime_Report.pdf"), but also just as likely to mean "an email or complaint ABOUT
  // overtime" ("email-overtime-complaint.pdf" isn't a pay record; it's a communication whose
  // subject happens to be overtime). paystub/pay_stub/payroll/wage_statement/timesheet/timecard
  // don't have that ambiguity -- a file isn't usually named that unless it IS one. Only let
  // "overtime" alone win here when the filename doesn't also carry a clear communication signal;
  // in that case a real communication-specific candidate (eventCandidateFromCommunication /
  // eventCandidateFromPossibleTimelineEvent, using the actual extracted document_facts) should
  // decide the title instead.
  if (/paystub|pay_stub|payroll|wage_statement|timesheet|timecard/.test(name)) {
    return candidate('Pay period or overtime record documented', 78);
  }
  if (/overtime/.test(name) && !/email|e_?mail|complaint|reply|response|message|memo|letter/.test(name)) {
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
  // Structural checks (complaint-to-HR / HR-response) run BEFORE the generic topic-keyword
  // checks below (safety/accommodation/etc.) -- 2026-08-18 fresh-accuracy hard-challenge: a
  // topic-suffixed title like "HR response received regarding Safety concern in warehouse"
  // (communicationTitleFromFacts) matched the generic "safety concern" keyword check FIRST in the
  // old ordering, overriding the already-correct "HR response" classification the title itself
  // states. A specific, well-formed structural match must win over a bare keyword-anywhere match.
  if (/complaint.*human resources|complaint.*\bhr\b|\bhr\b.*complaint/i.test(title)) {
    return candidate('Complaint submitted to Human Resources', 74);
  }
  if (/hr response|human resources response|response.*\bhr\b|\bhr\b.*response|investigation response/i.test(title)) {
    return candidate('HR response received', 73);
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
  // Complaint-direction signal: the worker's own subject/words, plus WHO the message went TO --
  // an email addressed to a confirmed HR party is a complaint even when the recipient name never
  // appears in the subject line itself (semantic-event gauntlet, 2026-08-18: "Formal complaint -
  // harassment" addressed To: Human Resources went unrecognized because the old hay never
  // included the recipient field at all).
  const complaintHay = `${commFact?.subjectOrTopic ?? ''} ${commFact?.workerConcernExcerpt ?? ''} ${
    commFact?.recipient ?? ''
  } ${record.file_name}`.toLowerCase();
  // Response-direction signal: subject + an actual reply excerpt + WHO SENT the message.
  // Deliberately excludes workerConcernExcerpt -- the worker's OWN words asking for "a response"
  // or that something be "investigated" are not evidence a response WAS GIVEN. That exact
  // collision mistitled a worker's own outgoing complaint email "HR response received" (same
  // gauntlet run: "I'm submitting this to HR for review and would appreciate a response" tripped
  // the old response-direction match on the worker's own outbound message).
  const responseHay = `${commFact?.subjectOrTopic ?? ''} ${commFact?.employerOrHrResponseExcerpt ?? ''} ${
    commFact?.sender ?? ''
  }`.toLowerCase();
  // A reply-direction signal: an actual quoted-reply excerpt, or a "RE:"/"FW:" subject prefix.
  // Without this, the topic-keyword shortcuts just below (safety/accommodation) fire on the
  // REPLY side of a thread too, since a reply's subject line still carries the original topic
  // word ("RE: Safety concern..."). 2026-08-18 fresh-accuracy hard-challenge: HR's own reply to a
  // safety complaint was titled "Worker raises safety concerns" -- the worker's own title,
  // applied to HR's message.
  const looksLikeReply =
    Boolean(commFact?.employerOrHrResponseExcerpt) || /^(re|fw|fwd):/i.test(commFact?.subjectOrTopic?.trim() ?? '');

  if (!looksLikeReply && /safety|unsafe|hazard/.test(complaintHay)) {
    return candidate('Worker raises safety concerns', 90);
  }
  if (!looksLikeReply && /accommodation|medical leave|\bfmla\b|leave request/.test(complaintHay)) {
    return candidate('Worker requests leave or accommodation', 90);
  }
  // An EXPLICIT worker-concern excerpt (commFact.workerConcernIsExplicit -- true only when
  // findWorkerConcernExcerpt matched genuine concern-language: "I'm concerned...", "not sure...",
  // "please advise..." -- see documentFactExtractionService.ts) directed at a confirmed HR
  // recipient IS a complaint, even when the subject/body never spell out the literal word
  // "complaint" or "grievance" (real subject lines say things like "Overtime pay concern", not
  // "Formal Complaint"; 2026-08-18 gauntlet finding). Deliberately does NOT trust a bare
  // workerConcernExcerpt presence -- that field is ALSO populated by a much weaker fallback
  // (excerptAroundFirstTopic) that grabs any sentence near any topic keyword regardless of
  // whether it expresses a concern at all. That looser signal previously mislabeled a routine
  // "just a quick question about scheduling, thanks" email to HR as a formal complaint
  // (2026-08-18 fresh-accuracy hard-challenge finding).
  const hasExplicitWorkerConcern = Boolean(commFact?.workerConcernIsExplicit);
  if (
    (/complaint|grievance|workplace concern/.test(complaintHay) || hasExplicitWorkerConcern) &&
    /\bhr\b|human resources/.test(complaintHay)
  ) {
    return candidate('Complaint submitted to Human Resources', 88);
  }
  if (/response|investigation/.test(responseHay) && /\bhr\b|human resources/.test(responseHay)) {
    return candidate('HR response received', 84);
  }
  return null;
}

function bestEventCandidateForRecord(
  record: IntakeFileOrganizationRecord,
  commFact: CommunicationFacts | null
): EventCandidate | null {
  // HARD GUARD (dominates every candidate below): a witness/coworker statement is a THIRD PARTY'S
  // account that RECOUNTS events — usually the worker's HR complaint. It must never be titled from
  // that recounted content. Marquez production bug: the communication candidate scored its subject
  // "complaint to HR" at 88, beating the witness filename's 86, so the witness statement was titled
  // "Complaint submitted to Human Resources." A witness statement is always titled for what it IS.
  // "witness" in the filename or topics is the reliable third-party signal (docType 'Witness Statement'
  // alone is ambiguous — a worker's own statement is sometimes mis-tagged with it, so we don't key on it).
  const wName = record.file_name.toLowerCase();
  const wTopics = record.employment_topics.join(' ').toLowerCase();
  if (/(^|_|\s)witness(es)?(_|\s|\.|$)/.test(wName) || /\bwitness\b/.test(wTopics)) {
    return { ...candidate('Witness statement provided', 200), source: 'filename' };
  }
  const tagged = (c: EventCandidate | null, source: EventCandidateSource): EventCandidate | null =>
    c ? { ...c, source } : null;
  const candidates = [
    tagged(eventCandidateFromFilename(record), 'filename'),
    tagged(eventCandidateFromCommunication(record, commFact), 'communication'),
    tagged(eventCandidateFromTopics(record), 'topics'),
    tagged(eventCandidateFromPossibleTimelineEvent(record), 'inferred'),
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
    // Same topic + same date → same event. A dated record may also enrich an
    // existing UNDATED same-topic cluster (giving it a date). It must NOT merge
    // into a same-topic cluster that already carries a DIFFERENT concrete date —
    // distinct dates are distinct events, even when cross-referenced.
    let target =
      clusters.find((c) => c.topicKey === topicKey && c.dateKey === dateKey) ??
      (dateKey !== 'undated'
        ? clusters.find((c) => c.topicKey === topicKey && c.dateKey === 'undated')
        : null);

    if (!target) {
      target = { dateKey, topicKey, files: [], eventTitle: event.title, eventTitleSource: event.source };
      clusters.push(target);
    }
    target.files.push(record);
    if (record.source_file_id) clusteredIds.add(record.source_file_id);
  }

  for (const record of fileRecords) {
    if (record.source_file_id && clusteredIds.has(record.source_file_id)) continue;
    // HARD GUARD (2026-08-19 rough-edge cleanup): an unreadable/zero-content record has nothing
    // real to contribute -- a whitespace-only scan and an unrelated photo previously ended up in
    // the SAME cluster purely because both fell back to the same generic document_type bucket,
    // and the resulting event's "Supported by" line credited the unreadable file with supporting
    // something it never actually said anything about. Weak topic/doctype overlap is not a
    // reliable enough signal to attach a record that offers no real evidence either way; it stays
    // out of this fallback merge and gets its own cluster below instead.
    if (record.extraction_quality === 'unreadable') continue;
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
    // Same guard as buildEventFirstClusters' fallback pass (2026-08-19 rough-edge cleanup): an
    // unreadable/zero-content record's topicKey/document_type are generic fallback values, not a
    // real signal -- matching one to an existing cluster credits that cluster's event with
    // "support" the record never actually provides. Unreadable records always get their own
    // cluster here rather than attach to one via a weak/generic match. Symmetric in BOTH
    // directions: an unreadable record never reaches into an existing cluster (isUnreadable
    // check below), AND a cluster that is unreadable-only never receives a later READABLE
    // record either (hasReadableFile check) -- without the second half, processing order alone
    // decided whether a whitespace-only scan and an unrelated photo ended up merged: if the scan
    // happened to be processed first, it created its own lonely cluster, but the very next
    // readable record could still weak-match INTO that cluster since nothing stopped it.
    const isUnreadable = record.extraction_quality === 'unreadable';
    const hasReadableFile = (c: TimelineCluster) =>
      c.files.some((f) => f.extraction_quality !== 'unreadable');
    let target =
      isUnreadable
        ? null
        : clusters.find(
            (c) =>
              c.dateKey === dateKey &&
              hasReadableFile(c) &&
              (c.topicKey === topicKey ||
                topicsOverlap(
                  c.files.flatMap((f) => f.employment_topics),
                  record.employment_topics
                ) ||
                c.files.some((f) => f.document_type === record.document_type))
          ) ?? null;

    if (!target && dateKey !== 'undated' && !isUnreadable) {
      target = clusters.find(
        (c) =>
          c.dateKey === dateKey &&
          hasReadableFile(c) &&
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
  const name = record.file_name.toLowerCase();
  const topics = record.employment_topics.join(' ').toLowerCase();

  // HARD GUARD — must run BEFORE the communication-subject titler below. A witness/coworker statement
  // is a THIRD PARTY'S account: it RECOUNTS the worker's complaint, it is not itself a complaint.
  // Previously the subject-titler ran first and titled a witness statement "Complaint submitted to
  // Human Resources" (real Marquez intake bug). Keyed on filename/topics (not the ambiguous docType).
  if (/(^|_|\s)witness(es)?(_|\s|\.|$)/.test(name) || /\bwitness\b/.test(topics)) {
    return 'Witness statement provided';
  }

  const subjectTitle = titleFromCommunicationSubject(commFact?.subjectOrTopic);
  if (subjectTitle && !isGenericTimelineTitle(subjectTitle)) return subjectTitle;
  // Defense in depth: a worker's own statement is a narrative, not a specific documented event —
  // never let its topics infer one (e.g. "Schedule change documented"). Matches the filename guard
  // in eventCandidateFromFilename.
  if (/(^|_|\s)(statement|declaration|affidavit)(_|\s|\.|$)/.test(name) && !/wage|earnings|pay|bank|financial|income|witness/.test(name)) {
    return 'Worker statement provided';
  }
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

/** Deterministic pick: earliest parseable date first; comparator tie-breaks lexicographically. */
function pickClusterDateLabel(labels: string[]): string {
  return [...labels].sort(compareEmploymentChronologyDates)[0] ?? '';
}

function clusterDateFromFilenames(files: IntakeFileOrganizationRecord[]): string {
  const labels = files
    .map((f) => extractFilenameDateToken(f.file_name))
    .filter((token): token is string => Boolean(token))
    .map((token) => sanitizePacketDateLabel(token))
    .filter((label) => label && label !== 'Date to confirm');
  return pickClusterDateLabel(labels);
}

/**
 * Deterministic regardless of upload order (shuffle regression: first-file-wins let the
 * W2 cluster's year flip with input order). Preference: any authoritative extraction-stored
 * document date carried by a cluster member; otherwise the earliest parseable likely_date;
 * then per-file event dates; then filename tokens. Ties break lexicographically.
 */
function clusterDate(
  files: IntakeFileOrganizationRecord[],
  authoritativeDateIds: ReadonlySet<string> = new Set()
): { label: string; source: 'authoritative' | 'likely' | 'event' | 'filename' | 'none' } {
  const validLikely = (f: IntakeFileOrganizationRecord) => {
    const d = (f.likely_date ?? '').trim();
    return d && d !== DATE_UNCLEAR_LABEL ? d : null;
  };

  const authoritative = files
    .filter((f) => authoritativeDateIds.has(f.source_file_id))
    .map(validLikely)
    .filter((d): d is string => Boolean(d));
  if (authoritative.length) {
    return { label: pickClusterDateLabel(authoritative), source: 'authoritative' };
  }

  const likely = files.map(validLikely).filter((d): d is string => Boolean(d));
  if (likely.length) return { label: pickClusterDateLabel(likely), source: 'likely' };

  const eventDates = files
    .map((f) => f.possible_timeline_event?.date?.trim())
    .filter((d): d is string => Boolean(d && d !== DATE_UNCLEAR_LABEL));
  if (eventDates.length) return { label: pickClusterDateLabel(eventDates), source: 'event' };

  const fromFilenames = clusterDateFromFilenames(files);
  return { label: fromFilenames, source: fromFilenames ? 'filename' : 'none' };
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

// An email header with no display name ("From: marcus.delgado@personal-email.com", no angle
// brackets) leaves humanizeAddressField() nothing to extract but the raw address -- confirmed via
// documentFactExtractionService.ts:168-179, which falls through to returning the bare string when
// neither the `"Name" <email>` nor `<email>` patterns match. Same filter already applied in
// collectPeopleFromDocumentFacts (perFileOrganizationService.ts); needed here too so a bare email
// can never enter the people set an event title's parenthetical name-suffix is chosen from
// (2026-08-19 rough-edge cleanup — was live on the Marcus/Renee case: "...Human Resources
// (marcus.delgado@personal-email.com)" instead of his name).
function isEmailOrUrlLike(value: string): boolean {
  return value.includes('@') || /^https?:|^www\./i.test(value);
}

function enrichPeopleFromFacts(
  files: IntakeFileOrganizationRecord[],
  payFacts: PayRecordFacts[],
  commFacts: CommunicationFacts[]
): string[] {
  const fileIds = new Set(files.map((f) => f.source_file_id));
  const people = new Set<string>();
  const add = (name: string | null | undefined) => {
    if (name && !isEmailOrUrlLike(name)) people.add(name);
  };
  // people_or_entities is already filtered upstream (collectPeopleFromDocumentFacts) -- routed
  // through the same guard here too rather than trusted, so this function stays safe regardless
  // of what a caller passes in.
  for (const f of files) {
    for (const person of f.people_or_entities) add(person);
  }

  for (const pf of payFacts) {
    if (!fileIds.has(pf.source.uploadedFileId)) continue;
    add(pf.employeeName);
    add(pf.employerName);
  }
  for (const cf of commFacts) {
    if (!fileIds.has(cf.source.uploadedFileId)) continue;
    add(cf.sender);
    add(cf.recipient);
    add(cf.employerOrCompany);
    for (const p of cf.peopleMentioned) add(p);
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
      // '\n', not ' ' -- contextsNearName() keeps whole LINES that mention a given name, so
      // joining multiple different people's names onto ONE shared line lets a role phrase meant
      // for one bleed onto another. Real bug: a worker's own complaint email has
      // peopleMentioned = [worker name, "Human Resources"] (sender + recipient); joined with a
      // space that produced one line "Marcus Delgado Human Resources", and the worker himself got
      // classified "Human Resources Representative" (2026-08-18, found while adding cross-document
      // relationship notes). Same fix class as the issued_by/relationship_to_worker line-merge fix
      // earlier tonight, opposite direction: that one needed two related fields COMBINED onto one
      // line; this one needs unrelated people's names kept apart.
      f.people_or_entities.join('\n'),
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
        fact.peopleMentioned.join('\n'),
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

/**
 * HARD GUARD (title-selection chokepoint — every cluster title flows through here): an event may
 * be titled "Termination documented" / "Employment ends" ONLY when a source file in the cluster is
 * itself separation-categorized (stored category, or a filename classified as a separation/
 * termination document). Separation WORDING inside other documents — an EDD unemployment pamphlet,
 * post-employment benefits info, a time report — must never produce a termination-titled row
 * (real Francis bug: a phantom "Termination documented" appeared nine months off the true date,
 * clustered from exactly those files). Fallback title is neutral and deliberately CONCRETE so the
 * packet-presentation re-titler keeps it verbatim instead of re-deriving a termination title from
 * summary keywords.
 */
const TERMINATION_FLAVORED_TITLE_RE = /^(termination documented|employment ends)$/i;
const SEPARATION_SOURCE_CATEGORY_RE = /separation|terminat|severance/i;
// Filenames that ARE a separation/termination document. Deliberately excludes separation-ADJACENT
// material (EDD/unemployment pamphlets, "post-employment" benefits info, time reports).
const SEPARATION_SOURCE_FILENAME_RE =
  /terminat|separation|severance|resign|layoff|employment[ _-]?end|final[ _-]?day|offboard/i;
const NEUTRAL_SEPARATION_FALLBACK_TITLE = 'Supporting employment documentation';

function clusterHasSeparationCategorizedSource(files: IntakeFileOrganizationRecord[]): boolean {
  return files.some(
    (f) =>
      SEPARATION_SOURCE_CATEGORY_RE.test(f.legacy_upload_category ?? '') ||
      SEPARATION_SOURCE_FILENAME_RE.test(f.file_name)
  );
}

function guardTerminationTitle(title: string, files: IntakeFileOrganizationRecord[]): string {
  if (!TERMINATION_FLAVORED_TITLE_RE.test(title.trim())) return title;
  return clusterHasSeparationCategorizedSource(files) ? title : NEUTRAL_SEPARATION_FALLBACK_TITLE;
}

/**
 * HARD GUARD (title-selection chokepoint, sibling of guardTerminationTitle above): "Schedule
 * change documented" may win ONLY when a file in the cluster actually names a schedule-type
 * document. Without this, an exit/offboarding checklist can inherit the title purely from an
 * upstream bucket/topic false positive — live bug: an "Exit Checklist" whose text mentions
 * returning a "laptop" scored the "Scheduling, Attendance & Leave" bucket because the topic
 * keyword list includes the substring "pto" (Paid Time Off), which is also a substring of
 * "laptop" — a false positive with nothing to do with schedules. That bucket/topic match then
 * outranked the file's own "Separation Records" category and produced "Schedule change
 * documented" on a routine departure-paperwork document, which in turn fed adverse-flavored claim
 * lens elements ("Employment actions after the report", "Changes to work conditions afterward").
 * When both signals are weakly present — a topic/bucket "schedule" match with no real schedule
 * content, and a real exit/separation category — the category wins and the title falls back to
 * the same neutral, concrete label used above, so it isn't re-derived from summary keywords later.
 */
const SCHEDULE_CHANGE_TITLE_RE = /^schedule change documented$/i;
// A file's OWN name actually naming a schedule/timekeeping document — the reliable signal that
// "Schedule change documented" is warranted rather than inherited from an unrelated bucket/topic
// collision.
const SCHEDULE_SOURCE_FILENAME_RE =
  /time.?sheet|time.?card|\bschedule\b|shift.?(change|swap)|clock.?(in|out)/i;

function clusterHasScheduleFilenameSource(files: IntakeFileOrganizationRecord[]): boolean {
  return files.some((f) => SCHEDULE_SOURCE_FILENAME_RE.test(f.file_name));
}

function guardScheduleChangeTitle(title: string, files: IntakeFileOrganizationRecord[]): string {
  if (!SCHEDULE_CHANGE_TITLE_RE.test(title.trim())) return title;
  if (clusterHasScheduleFilenameSource(files)) return title;
  return clusterHasSeparationCategorizedSource(files) ? NEUTRAL_SEPARATION_FALLBACK_TITLE : title;
}

/**
 * Cross-document relationship prose (2026-08-18, founder request following the semantic-event
 * gauntlet — "before adding cross-document relationship prose, build a gauntlet" was done first;
 * this is the follow-up). SCOPE, deliberately narrow per the founder's own confirmed choice:
 * connect two records ONLY when the connection is stated by the documents themselves — here, a
 * complaint and its response sharing the SAME extracted complaint_topic (the same signal already
 * used for event TITLING, see communicationTitleFromFacts in perFileOrganizationService.ts).
 * Phrasing is provenance-only ("this record responds to X, dated Y") — never causal/sequence
 * language toward a LATER, topically-unrelated event (no complaint→termination chaining). That
 * broader pattern was explicitly tried and reverted before: the 2026-08-04 Francis audit flagged
 * a generated sentence essentially saying "concerns placed before later workplace action records"
 * as a prohibited causal-juxtaposition — and it was factually backwards for that record. See
 * project_describe_record_not_case / feedback_public_surface_no_conclude memory.
 */
type ComplaintResponseSignal = { kind: 'complaint' | 'response'; topic: string };

const COMPLAINT_TITLE = 'Complaint submitted to Human Resources';
const RESPONSE_TITLE = 'HR response received';

/** Normalizes a mined topic string for exact-match comparison — under-match is the safe failure
 *  mode here (no note), so no fuzzy/partial matching is attempted. */
function normalizeTopicForMatch(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
}

/**
 * Reads document_facts.complaint_topic directly off the cluster's file records (carried through
 * unconditionally by perFileOrganizationService.ts, see IntakeFileOrganizationRecord.complaint_topic)
 * rather than mining it back out of possible_timeline_event.title — that title only carries the
 * topic-suffixed vocabulary when communicationTitleFromFacts already resolved ITS OWN recipient as
 * confirmed HR (via cross-document deriveNamedPeopleForIntake), which the ORIGINAL, outgoing side
 * of a complaint/response pair frequently does NOT have (a worker emailing "Human Resources" by
 * generic name, not a specific confirmed person) even though the response side does. Reading the
 * raw field directly makes topic-matching independent of that unrelated, already-shipped titling
 * mechanism. Only fires for a cluster whose FINAL, guarded title is exactly the complaint or
 * response vocabulary string — so this never contradicts what the title itself already says the
 * record is.
 */
function complaintResponseSignalFromFiles(
  files: IntakeFileOrganizationRecord[],
  finalTitle: string
): ComplaintResponseSignal | null {
  if (finalTitle !== COMPLAINT_TITLE && finalTitle !== RESPONSE_TITLE) return null;
  const kind = finalTitle === COMPLAINT_TITLE ? 'complaint' : 'response';
  for (const f of files) {
    const topic = normalizeTopicForMatch(f.complaint_topic ?? '');
    if (topic.length >= 4) return { kind, topic };
  }
  return null;
}

/**
 * Second pass over the already-dated, already-sorted events: for each complaint/response pair
 * sharing the same mined topic, attach a grounded note to BOTH sides naming the OTHER record's
 * date. Nearest correct-directional match wins (a response looks backward for its nearest earlier
 * matching complaint; a complaint looks forward for its nearest later matching response) so a
 * long intake with several distinct complaint threads doesn't cross-wire them.
 */
function attachComplaintResponseRelationshipNotes(
  built: Array<{ event: EvidenceMappedTimelineEvent; signal: ComplaintResponseSignal | null }>
): void {
  for (let i = 0; i < built.length; i++) {
    const { event, signal } = built[i];
    if (!signal) continue;
    if (signal.kind === 'response') {
      for (let j = i - 1; j >= 0; j--) {
        const other = built[j];
        if (other.signal?.kind === 'complaint' && other.signal.topic === signal.topic) {
          if (other.event.date && other.event.date !== DATE_UNCLEAR_LABEL) {
            event.related_record_note = `This record responds to the complaint dated ${other.event.date}.`;
          }
          break;
        }
      }
    } else {
      for (let j = i + 1; j < built.length; j++) {
        const other = built[j];
        if (other.signal?.kind === 'response' && other.signal.topic === signal.topic) {
          if (other.event.date && other.event.date !== DATE_UNCLEAR_LABEL) {
            event.related_record_note = `A response to this complaint is on file, dated ${other.event.date}.`;
          }
          break;
        }
      }
    }
  }
}

function clusterToEvent(
  cluster: TimelineCluster,
  payFacts: PayRecordFacts[],
  commFacts: CommunicationFacts[],
  authoritativeDateIds: ReadonlySet<string> = new Set()
): { event: EvidenceMappedTimelineEvent; signal: ComplaintResponseSignal | null } {
  const { files } = cluster;
  const dateInfo = clusterDate(files, authoritativeDateIds);
  const date = dateInfo.label;
  let baseTitle = guardScheduleChangeTitle(
    guardTerminationTitle(cluster.eventTitle ?? neutralClusterTitle(files, commFacts), files),
    files
  );
  // HARD GUARD — a bare filename-year ("2023") is period context, not a dated occurrence: it
  // must not anchor a keyword-inferred title (topic keywords or fallback inference). Titles
  // anchored to a document signal (filename event patterns, communication subjects) keep their
  // title. Live Francis bug: a filename-year cluster was titled "Schedule change documented"
  // from unrelated category keywords.
  const titleSource: EventCandidateSource = cluster.eventTitle
    ? cluster.eventTitleSource ?? 'inferred'
    : 'inferred';
  if (
    dateInfo.source === 'filename' &&
    BARE_YEAR_DATE_RE.test(date) &&
    (titleSource === 'topics' || titleSource === 'inferred')
  ) {
    baseTitle = NEUTRAL_SEPARATION_FALLBACK_TITLE;
  }
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

  const event: EvidenceMappedTimelineEvent = {
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
    related_record_note: null,
  };
  // Match on baseTitle (the guarded vocabulary string BEFORE roleAwareTitle's optional "(Name)"
  // suffix), not the final display title — the suffix would otherwise break the exact-string
  // match against COMPLAINT_TITLE/RESPONSE_TITLE.
  return { event, signal: complaintResponseSignalFromFiles(files, baseTitle) };
}

export function buildEvidenceMappedTimelineEvents(
  opts: BuildEvidenceTimelineOpts
): EvidenceMappedTimelineEvent[] {
  const { fileRecords, payFacts = [], commFacts = [], documentDates = {} } = opts;
  if (!fileRecords.length) return [];

  // Date sourcing only: when extraction stored a usable document_facts.document_date for a
  // file, it overrides the text-mined likely_date (live bug: a separation letter whose
  // extraction read "March 6, 2025" was still dated 01/01/2025 by the naive candidate).
  // Titles, guards, and clustering logic are untouched; files without a usable extracted
  // date keep the existing candidate-date behavior. Overridden ids are remembered so
  // clusterDate can prefer the authoritative date deterministically.
  const authoritativeDateIds = new Set<string>();
  const records = fileRecords.map((record) => {
    const docDate = usableDocumentDateLabel(documentDates[record.source_file_id]);
    if (!docDate) return record;
    authoritativeDateIds.add(record.source_file_id);
    return { ...record, likely_date: docDate };
  });

  // Tax forms never seed or support timeline events (see TAX_FORM_FILENAME_RE). Their
  // filename year is a tax year, so any cluster they anchored would carry a phantom date
  // and an unrelated keyword title (live Francis bug: "2023 — Schedule change documented"
  // supported only by the two W2s). They remain in file records/inventory/coverage.
  const factsTaxIds = opts.taxFormFileIds ?? new Set<string>();
  const timelineRecords = records.filter(
    (record) =>
      !factsTaxIds.has(record.source_file_id) && !TAX_FORM_FILENAME_RE.test(record.file_name)
  );
  if (!timelineRecords.length) return [];

  const eventFirstClusters = buildEventFirstClusters(timelineRecords, commFacts);
  const clusteredIds = new Set(eventFirstClusters.flatMap((c) => c.files.map((f) => f.source_file_id)));
  const fallbackRecords = timelineRecords.filter((record) => !clusteredIds.has(record.source_file_id));
  const clusters = [...eventFirstClusters, ...clusterRecords(fallbackRecords)];
  const built = clusters.map((c) => clusterToEvent(c, payFacts, commFacts, authoritativeDateIds));

  built.sort((a, b) => compareEmploymentChronologyDates(a.event.date, b.event.date));
  attachComplaintResponseRelationshipNotes(built);
  const events = built.map((b) => b.event);
  // No hard cap here: this is the data-computation layer, and truncating would silently
  // discard real history on long/high-volume records (a 3.5-year, 107-file case previously
  // lost every event past month six, including the termination itself). Any display-side
  // pagination/preview limit belongs at the UI layer (see WorkerTimelineHero's previewLimit),
  // not here, where it would be indistinguishable from data loss.
  return events;
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
  const relatedNote = event.related_record_note ? ` ${event.related_record_note}` : '';
  return sanitizeGenerationPhrase(
    `${dateLabel} — ${event.title}. ${event.neutral_summary}${relatedNote} Supporting files: ${files}.${people}${topics} Confidence: ${event.confidence}.`
  );
}
