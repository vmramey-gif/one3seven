/**
 * Output-quality helpers: gap deduplication and record-type satisfaction checks.
 * Does not change organization architecture — phrasing and suppression only.
 */

import { REVIEW_TOPIC_DEFINITIONS } from './documentScanClassification';
import { formatSupportingFileList, sanitizeGenerationPhrase } from './intakeGenerationVoice';
import type { IntakeFileOrganizationRecord } from './intakeOrganizationTypes';
import { safeTrim } from './summarySaveDiagnostics';

/** Stable key for identical or near-identical organization gap lines. */
export function organizationGapDedupKey(line: string): string {
  const s = (line ?? '').toLowerCase().trim();
  if (!s) return 'gap:empty';
  if (/readable text was not available from this upload/.test(s)) return 'gap:unreadable-generic';
  if (/readable text was not available for /.test(s)) return 'gap:unreadable-named';
  if (/date may require confirmation from source records/.test(s)) return 'gap:date-cluster';
  if (/date may require confirmation for /.test(s)) return 'gap:date-file';
  if (/date may need confirmation in the source file/.test(s)) return 'gap:date-file';
  if (/no supporting record was located|no related records found yet/.test(s)) return 'gap:no-supporting';
  if (/named people or entities were not clearly indexed/.test(s)) return 'gap:no-people';
  if (/pdf text layer was empty/.test(s)) return 'gap:empty-layer';
  if (/some uploads may still need clearer copies/.test(s)) return 'gap:unclear-copies';
  return `gap:exact:${s}`;
}

function shouldSkipGapKey(key: string, present: Set<string>): boolean {
  if (present.has(key)) return true;
  if (key === 'gap:date-file' && present.has('gap:date-cluster')) return true;
  if (key === 'gap:unreadable-generic' && present.has('gap:no-supporting')) return true;
  if (key === 'gap:empty-layer' && present.has('gap:unreadable-generic')) return true;
  if (key === 'gap:unreadable-generic' && present.has('gap:empty-layer')) return true;
  return false;
}

/** Remove duplicate and near-duplicate gap lines while preserving first occurrence order. */
export function dedupeOrganizationGapLines(lines: string[]): string[] {
  const present = new Set<string>();
  const out: string[] = [];

  for (const raw of lines) {
    const line = sanitizeGenerationPhrase(raw);
    if (!line) continue;
    const key = organizationGapDedupKey(line);
    if (shouldSkipGapKey(key, present)) continue;
    present.add(key);
    out.push(line);
  }

  if (out.some((line) => organizationGapDedupKey(line) === 'gap:no-supporting')) {
    return out.filter((line) => organizationGapDedupKey(line) !== 'gap:unreadable-generic');
  }

  return out;
}

/** Merge multiple per-file unreadable gap lines into one concise summary when possible. */
export function consolidateUnreadableGapLines(lines: string[]): string[] {
  const unreadableFiles: string[] = [];
  const rest: string[] = [];

  for (const raw of lines) {
    const line = sanitizeGenerationPhrase(raw);
    if (!line) continue;
    const named = line.match(
      /^Readable text was not available for ([^;]+); (?:additional information may help clarify|a clearer copy may help complete the timeline)\.$/i
    );
    if (named?.[1]) {
      unreadableFiles.push(safeTrim(named[1], 'consolidateUnreadableGapLines.named[1]'));
      continue;
    }
    if (organizationGapDedupKey(line) === 'gap:unreadable-generic') continue;
    rest.push(line);
  }

  if (unreadableFiles.length > 1) {
    rest.push(
      sanitizeGenerationPhrase(
        `Readable text was not available for ${unreadableFiles.length} uploads (${formatSupportingFileList(unreadableFiles, 2)}); a clearer copy may help complete the timeline.`
      )
    );
  } else if (unreadableFiles.length === 1) {
    rest.push(
      sanitizeGenerationPhrase(
        `Readable text was not available for ${unreadableFiles[0]}; a clearer copy may help complete the timeline.`
      )
    );
  }

  return dedupeOrganizationGapLines(rest);
}

export function filterClarificationsAgainstGaps(
  clarifications: string[],
  gapLines: string[]
): string[] {
  const gapKeys = new Set(gapLines.map((g) => organizationGapDedupKey(g)));
  return dedupeOrganizationGapLines(clarifications).filter((line) => {
    const key = organizationGapDedupKey(line);
    return !gapKeys.has(key);
  });
}

function topicHits(corpusLower: string, terms: readonly string[], minHits: number): boolean {
  return terms.filter((term) => corpusLower.includes(term)).length >= minHits;
}

export type HelpfulRecordSatisfactionOpts = {
  corpusLower: string;
  fileNameCorpus: string;
  categoryCorpus: string;
  fileRecords: IntakeFileOrganizationRecord[];
};

export function intakeSatisfiesHelpfulRecordType(
  type:
    | 'pay'
    | 'time'
    | 'offer'
    | 'termination'
    | 'communications'
    | 'handbook'
    | 'reimbursement'
    | 'performance',
  opts: HelpfulRecordSatisfactionOpts
): boolean {
  const corpus = `${opts.corpusLower} ${opts.fileNameCorpus} ${opts.categoryCorpus}`.toLowerCase();
  const records = opts.fileRecords;

  const hasCategory = (re: RegExp) =>
    records.some((r) => re.test((r.legacy_upload_category ?? '').toLowerCase()));
  const hasTopic = (re: RegExp) =>
    records.some((r) => r.employment_topics.some((t) => re.test(t.toLowerCase())));
  const topicDefHits = (labelFragment: RegExp) =>
    REVIEW_TOPIC_DEFINITIONS.some(
      (def) =>
        labelFragment.test(def.label) &&
        topicHits(corpus, def.terms, 2)
    );

  switch (type) {
    case 'pay':
      return (
        /pay|payroll|wage|stub|paystub|pay period|gross pay|net pay/.test(corpus) ||
        hasCategory(/pay records/) ||
        hasTopic(/payroll|wage/) ||
        topicDefHits(/payroll|wage/)
      );
    case 'time':
      return (
        /time|schedule|timesheet|timecard|shift|hours worked/.test(corpus) ||
        hasCategory(/time records|scheduling|pto/) ||
        hasTopic(/scheduling|timekeeping/) ||
        topicDefHits(/scheduling|timekeeping/)
      );
    case 'offer':
      return (
        /offer letter|employment agreement|offer of employment/.test(corpus) ||
        hasCategory(/offer/) ||
        topicDefHits(/offer|pay structure/)
      );
    case 'termination':
      return (
        /terminat|separat|resign|layoff|laid off|final pay|severance/.test(corpus) ||
        hasTopic(/separation|final pay/) ||
        topicDefHits(/separation|final pay/)
      );
    case 'communications':
      return (
        /email|message|slack|memo|communicat|complaint|investigation|human resources|\bhr\b/.test(corpus) ||
        hasCategory(/workplace communications|hr review/) ||
        hasTopic(/workplace communication|communication/) ||
        topicDefHits(/workplace communication/)
      );
    case 'handbook':
      return (
        /handbook|policy|personnel manual|employee manual/.test(corpus) ||
        hasCategory(/hr review|hr documents/) ||
        topicDefHits(/policy/)
      );
    case 'reimbursement':
      return (
        /reimburs|expense report|mileage/.test(corpus) ||
        hasCategory(/reimbursement/)
      );
    case 'performance':
      return (
        /performance review|disciplinary|write-up|warning|pip\b|evaluation|appraisal|\breason:\s*performance\b|\bperformance\b/.test(
          corpus
        ) ||
        hasCategory(/performance/) ||
        topicDefHits(/performance/)
      );
    default:
      return false;
  }
}

export const HELPFUL_RECORD_SUGGESTION_LABELS = [
  'Offer letter or employment agreement',
  'Pay stubs or wage statements',
  'Time records or schedules',
  'Termination or separation records',
  'Written communications with employer or HR',
  'Policy handbook or wage policies',
  'Reimbursement records',
  'Performance reviews or discipline records',
  'Screenshots of relevant messages',
  "Worker's own timeline or context notes",
] as const;

export function resolveHelpfulRecordSuggestionLabels(opts: {
  bucketLabels: string[];
  filesMeta: Array<{ fileName: string; category: string | null }>;
  workerContext: string;
  corpusLower: string;
  fileRecords: IntakeFileOrganizationRecord[];
}): string[] {
  const lowerCats = opts.bucketLabels.join(' ').toLowerCase();
  const names = opts.filesMeta.map((f) => f.fileName.toLowerCase()).join(' ');
  const categories = opts.filesMeta.map((f) => (f.category ?? '').toLowerCase()).join(' ');
  const inventoryCorpus = `${lowerCats} ${names} ${categories} ${opts.corpusLower}`;
  const satisfactionOpts: HelpfulRecordSatisfactionOpts = {
    corpusLower: opts.corpusLower,
    fileNameCorpus: names,
    categoryCorpus: categories,
    fileRecords: opts.fileRecords,
  };

  const peopleCorpus = opts.fileRecords.flatMap((r) => r.people_or_entities).join(' ');
  const hrPerson =
    peopleCorpus.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,2})\s+\(Human Resources Representative\)/)?.[1] ??
    null;
  const supervisorPerson =
    peopleCorpus.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,2})\s+\(Supervisor\)/)?.[1] ??
    null;
  const managerPerson =
    peopleCorpus.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,2})\s+\((?:Manager|Decision Maker)\)/)?.[1] ??
    null;

  const rules: Array<{
    type: Parameters<typeof intakeSatisfiesHelpfulRecordType>[0];
    need: RegExp;
    label: string;
  }> = [
    { type: 'pay', need: /pay|payroll|wage|stub|paystub|pay period|gross pay/, label: HELPFUL_RECORD_SUGGESTION_LABELS[1] },
    { type: 'time', need: /time|schedule|timesheet|hour|shift/, label: HELPFUL_RECORD_SUGGESTION_LABELS[2] },
    { type: 'offer', need: /offer|agreement|contract/, label: HELPFUL_RECORD_SUGGESTION_LABELS[0] },
    { type: 'termination', need: /terminat|separat|resign|final|severance|layoff/, label: HELPFUL_RECORD_SUGGESTION_LABELS[3] },
    { type: 'communications', need: /email|message|slack|memo|communicat|complaint|\bhr\b/, label: HELPFUL_RECORD_SUGGESTION_LABELS[4] },
    { type: 'handbook', need: /handbook|policy/, label: HELPFUL_RECORD_SUGGESTION_LABELS[5] },
    { type: 'reimbursement', need: /reimburs|expense/, label: HELPFUL_RECORD_SUGGESTION_LABELS[6] },
    {
      type: 'performance',
      need: /performance review|disciplin|write-up|warning|pip\b|evaluation|\breason:\s*performance\b|\bperformance\b/,
      label: HELPFUL_RECORD_SUGGESTION_LABELS[7],
    },
  ];

  const specificSuggestions: Array<{ when: RegExp; unless: RegExp; label: string }> = [
    {
      when: /complaint|grievance|reported concern|\bhr\b|human resources/,
      unless: /response|investigation|follow[- ]?up|reply/,
      label: hrPerson
        ? `HR response or follow-up communication from ${hrPerson}`
        : 'HR response or follow-up communication',
    },
    {
      when: /safety|unsafe|hazard|injury/,
      unless: /incident report|safety report|manager response|supervisor response/,
      label: supervisorPerson
        ? `Supervisor response from ${supervisorPerson}`
        : managerPerson
          ? `Manager follow-up communication from ${managerPerson}`
          : 'Safety report or manager response',
    },
    {
      when: /accommodation|medical leave|\bfmla\b|modified duty|restriction/,
      unless: /medical note|doctor|provider|approval|denial|response/,
      label: 'Leave or accommodation response',
    },
    {
      when: /termination|terminated|fired|separation/,
      unless: /performance review|written warning|write-up|disciplin|pip\b|corrective action/,
      label: 'Performance history before separation',
    },
    {
      when: /written warning|write-up|disciplin|pip\b|corrective action/,
      unless: /response|explanation|meeting notes|acknowledg/,
      label: 'Communications explaining the warning',
    },
    {
      when: /schedule change|shift change|hours change|schedule|timesheet|timecard/,
      unless: /earlier schedule|prior schedule|previous schedule/,
      label: 'Earlier schedules for comparison',
    },
    {
      when: /reimburs|expense|mileage/,
      unless: /expense policy|reimbursement policy|manager response|employer response/,
      label: 'Expense policy or employer response',
    },
  ];
  const out: string[] = [];
  for (const suggestion of specificSuggestions) {
    if (suggestion.when.test(inventoryCorpus) && !suggestion.unless.test(inventoryCorpus)) {
      out.push(suggestion.label);
    }
  }
  for (const r of rules) {
    const inventoryMatch = r.need.test(inventoryCorpus);
    const contentSatisfied = intakeSatisfiesHelpfulRecordType(r.type, satisfactionOpts);
    if (contentSatisfied || inventoryMatch) continue;
    out.push(r.label);
  }

  if (!safeTrim(opts.workerContext, 'buildHelpfulRecordSuggestions.workerContext')) {
    out.push(HELPFUL_RECORD_SUGGESTION_LABELS[9]);
  }
  return [...new Set(out)].slice(0, 8);
}
