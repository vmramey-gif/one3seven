/**
 * Narrative-hierarchy organization: story → themes → synthesis → chronology → quiet uncertainty.
 * Source trace stays in structured fields; prose synthesizes upward, not extraction-down.
 */

import {
  availableRecordsShowPhrase,
  clipSentences,
  documentsDoNotYetShowPhrase,
  reviewingMayConfirmPhrase,
  sanitizeGenerationPhrase,
  takenTogetherPhrase,
} from './intakeGenerationVoice';
import { safeTrim } from './summarySaveDiagnostics';

export type OrganizerFileInput = {
  uploadedFileId: string;
  fileName: string;
  category: string | null;
  extractedText: string;
  scanBucket: string;
  qualityFlags?: Record<string, unknown> | null;
};

export type RecordSetProfile = {
  docTotal: number;
  extractedN: number;
  withoutExtractionCount: number;
  bucketLabels: string[];
  dates: string[];
  topicPhrase: string | null;
  centralFileNames: string[];
  supportingFileNames: string[];
  unclearFileNames: string[];
  hasPayroll: boolean;
  hasCommunications: boolean;
  hasScheduling: boolean;
  hasEmploymentRecords: boolean;
  hasSeparationSignals: boolean;
  connectionInsights: string[];
};

export type OperationalTheme = {
  id: string;
  observation: string;
};

export type NarrativeHierarchy = {
  coreStory: string;
  themes: OperationalTheme[];
  synthesisLines: string[];
  chronologySummary: string;
  uncertaintyLines: string[];
  recordStory: string;
  firmReviewLead: string;
  narrativeOverview: string;
};

const NOISE_LINE =
  /^(page\s+\d+\s+of\s+\d+|\d+\s+of\s+\d+|confidential|proprietary|all rights reserved|this\s+(page|document)\s+intentionally|table of contents|\d{1,3})$/i;

const BOILERPLATE_LINE =
  /^(copyright|©|printed in|form\s+no\.|rev\.|version\s+\d|instructions:)/i;

const OCR_JUNK_LINE = /^[^a-zA-Z0-9]{0,2}[^a-zA-Z]{0,3}$|(.)\1{6,}/;

export function filterTextForOrganizerMining(text: string): string {
  const lines = text.split(/\n+/);
  const kept: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 6) continue;
    if (line.length > 400) {
      kept.push(line.slice(0, 400));
      continue;
    }
    if (NOISE_LINE.test(line)) continue;
    if (BOILERPLATE_LINE.test(line)) continue;
    if (OCR_JUNK_LINE.test(line)) continue;
    const letters = (line.match(/[a-zA-Z]/g) ?? []).length;
    if (letters / line.length < 0.35) continue;
    kept.push(line);
  }
  return kept.join('\n');
}

function fileIsUnclear(f: OrganizerFileInput): boolean {
  const t = f.extractedText.trim();
  if (t.length < 80) return true;
  const q = f.qualityFlags;
  if (!q || typeof q !== 'object') return false;
  if (q.truncated === true) return true;
  if (q.empty_text_layer === true) return true;
  if (q.skipped_reason) return true;
  return false;
}

function scoreFileCentrality(f: OrganizerFileInput): number {
  const len = Math.min(f.extractedText.length, 8000);
  const lower = f.extractedText.toLowerCase();
  let score = len / 200;
  if (/pay\s+period|payroll|pay stub|gross|net pay/.test(lower)) score += 4;
  if (/termination|separation|resign|final pay/.test(lower)) score += 3;
  if (/offer letter|employment agreement/.test(lower)) score += 3;
  if (/\b(hr|human resources|complaint|investigation)\b/.test(lower)) score += 2;
  if (/timesheet|schedule|hours worked/.test(lower)) score += 2;
  if (fileIsUnclear(f)) score *= 0.35;
  return score;
}

function englishListJoin(items: string[]): string {
  const t = items.filter(Boolean);
  if (!t.length) return '';
  if (t.length === 1) return t[0];
  if (t.length === 2) return `${t[0]} and ${t[1]}`;
  return `${t.slice(0, -1).join(', ')}, and ${t[t.length - 1]}`;
}

/** Human material types — not scan bucket labels. */
export function describeMaterialTypes(profile: RecordSetProfile): string {
  const parts: string[] = [];
  if (profile.hasPayroll) parts.push('payroll records');
  if (profile.hasScheduling) parts.push('timekeeping materials');
  if (profile.hasCommunications) parts.push('workplace communications');
  if (profile.hasEmploymentRecords) parts.push('employment and HR paperwork');
  if (profile.hasSeparationSignals) parts.push('separation-related materials');
  return parts.length ? englishListJoin(parts) : 'the uploaded materials';
}

/** Layer 2 — operational themes from wording patterns (not categories or filenames). */
export function detectOperationalThemes(
  corpusLower: string,
  profile: RecordSetProfile
): OperationalTheme[] {
  const themes: OperationalTheme[] = [];
  const push = (id: string, observation: string) => {
    if (themes.some((t) => t.id === id)) return;
    themes.push({ id, observation: sanitizeGenerationPhrase(observation) });
  };

  if (/overtime|overtime hours/.test(corpusLower) && /exempt|salary|hourly/.test(corpusLower)) {
    push(
      'pay_time_alignment',
      'Several records reference pay formatting and detailed timekeeping that may need side-by-side review for the same periods.'
    );
  }
  if (profile.hasPayroll && /pay period|paystub|pay stub/.test(corpusLower)) {
    push(
      'pay_periods',
      'Pay period boundaries recur across the payroll materials and may anchor how compensation activity is read over time.'
    );
  }
  if (profile.hasCommunications && /complaint|investigation|write-up|warning|hr\b|human resources/.test(corpusLower)) {
    push(
      'hr_comms',
      'Workplace communications and HR-related wording appear alongside other records and may help show how issues were discussed.'
    );
  }
  if (/safety|unsafe|hazard|injury|incident report/.test(corpusLower)) {
    push(
      'safety_concerns',
      'Safety-related wording recurs in the materials and may help anchor how workplace concerns were raised and handled.'
    );
  }
  if (/accommodation|medical leave|\bfmla\b|disability|restriction|modified duty/.test(corpusLower)) {
    push(
      'leave_accommodation',
      'Leave or accommodation wording appears in the materials and may help clarify requests, responses, and timing.'
    );
  }
  if (profile.hasSeparationSignals) {
    push(
      'separation',
      'Separation or final-pay wording appears in the set and may mark a transition point in the chronology.'
    );
  }
  if (/exempt|non-exempt|1099|independent contractor|classification/.test(corpusLower)) {
    push(
      'classification',
      'Classification or pay-structure language appears in the materials and may need comparison with pay records.'
    );
  }
  if (profile.hasScheduling && profile.hasPayroll) {
    push(
      'schedule_pay',
      'Scheduling or attendance materials sit alongside payroll records, which may help clarify hours versus pay.'
    );
  }
  if (/performance review|written warning|write-up|disciplin|pip\b|corrective action/.test(corpusLower)) {
    push(
      'performance_discipline',
      'Performance or discipline wording appears in the materials and may help clarify the sequence of workplace actions.'
    );
  }
  if (profile.topicPhrase && themes.length < 2) {
    push(
      'recurring_topics',
      `Recurring topics across the set may relate to ${profile.topicPhrase.replace(/topics?$/i, '').trim() || 'employment activity'}.`
    );
  }

  return themes.slice(0, 4);
}

export function buildCrossRecordConnections(opts: {
  hasPayroll: boolean;
  hasCommunications: boolean;
  hasScheduling: boolean;
  hasEmploymentRecords: boolean;
  hasSeparationSignals: boolean;
  dates: string[];
  topicPhrase: string | null;
}): string[] {
  const out: string[] = [];

  if (opts.hasPayroll && opts.hasCommunications) {
    out.push(
      takenTogetherPhrase(
        'payroll materials and related workplace communications may help clarify how compensation and workplace discussions lined up over time.'
      )
    );
  }
  if (opts.hasPayroll && opts.hasScheduling) {
    out.push(
      takenTogetherPhrase(
        'pay records and timekeeping materials may be read together to see how hours and pay periods relate.'
      )
    );
  }
  if (opts.hasSeparationSignals && opts.hasPayroll) {
    out.push(
      takenTogetherPhrase(
        'separation-related materials and payroll records may help clarify final-pay timing near the end of the sequence.'
      )
    );
  }
  if (opts.hasEmploymentRecords && opts.hasPayroll) {
    out.push(
      takenTogetherPhrase(
        'offer or HR paperwork and pay records may help compare described pay structure with what pay documents show.'
      )
    );
  }

  return out.slice(0, 2);
}

/** Layer 4 — chronology as reconstructed span, not date-reference counts. */
export function buildChronologySummary(profile: RecordSetProfile): string {
  const { dates } = profile;
  if (dates.length >= 2) {
    return availableRecordsShowPhrase(
      `materials that span multiple periods between ${dates[0]} and ${dates[dates.length - 1]} and may help reconstruct payroll, scheduling, and employment-related events over time.`
    );
  }
  if (dates.length === 1) {
    return availableRecordsShowPhrase(
      `materials anchored around ${dates[0]}; additional dated records may help show what came before or after.`
    );
  }
  return documentsDoNotYetShowPhrase(
    'a continuous dated sequence; reviewing records in order may help clarify timing'
  );
}

/** Layer 1 — core operational story. */
export function buildCoreStory(profile: RecordSetProfile): string {
  const materials = describeMaterialTypes(profile);
  const storySignals: string[] = [];
  if (profile.hasCommunications) storySignals.push('workplace communications');
  if (profile.hasScheduling) storySignals.push('schedule or timekeeping records');
  if (profile.hasPayroll) storySignals.push('pay records');
  if (profile.hasSeparationSignals) storySignals.push('separation records');
  const signalPhrase = englishListJoin(storySignals);
  let lead = `The current record set includes ${materials}.`;
  if (profile.dates.length >= 2) {
    lead = `The current record set follows employment activity between ${profile.dates[0]} and ${profile.dates[profile.dates.length - 1]}.`;
  } else if (profile.dates.length === 1) {
    lead = `The current record set includes dated activity around ${profile.dates[0]}.`;
  }
  if (signalPhrase) {
    lead += ` It is organized around ${signalPhrase}.`;
  }
  return sanitizeGenerationPhrase(lead);
}

/** Layer 5 — quiet uncertainty (no OCR/indexing language). */
export function buildUncertaintyLines(
  profile: RecordSetProfile,
  opts: { anyTruncated: boolean; withoutExtractionCount: number }
): string[] {
  const lines: string[] = [];
  if (profile.dates.length >= 2 && profile.connectionInsights.some((c) => /timeline gap/i.test(c))) {
    lines.push(
      sanitizeGenerationPhrase(
        'Some portions of the timeline remain incomplete until additional records from intervening periods are added.'
      )
    );
  } else if (profile.dates.length < 2) {
    lines.push(
      sanitizeGenerationPhrase('Some portions of the timeline may remain incomplete without additional dated records.')
    );
  }
  if (opts.withoutExtractionCount > 0) {
    lines.push(
      sanitizeGenerationPhrase(
        'Some uploaded records may still require clearer copies or manual review before they fit cleanly into the sequence.'
      )
    );
  }
  if (profile.unclearFileNames.length && !opts.withoutExtractionCount) {
    lines.push(
      reviewingMayConfirmPhrase(
        'a few uploads where readable text was limited, using the original files when details matter.'
      )
    );
  }
  if (opts.anyTruncated) {
    lines.push(
      reviewingMayConfirmPhrase('specific figures or lines where only partial text was available in the upload copy.')
    );
  }
  return lines.slice(0, 2);
}

/** Compose all narrative layers for downstream fields. */
export function buildNarrativeHierarchy(
  profile: RecordSetProfile,
  opts: {
    corpusLower: string;
    workerMining: string;
    anyTruncated: boolean;
    withoutExtractionCount: number;
  }
): NarrativeHierarchy {
  const themes = detectOperationalThemes(opts.corpusLower, profile);
  const synthesisLines = profile.connectionInsights.length
    ? profile.connectionInsights
    : buildCrossRecordConnections({
        hasPayroll: profile.hasPayroll,
        hasCommunications: profile.hasCommunications,
        hasScheduling: profile.hasScheduling,
        hasEmploymentRecords: profile.hasEmploymentRecords,
        hasSeparationSignals: profile.hasSeparationSignals,
        dates: profile.dates,
        topicPhrase: profile.topicPhrase,
      });

  const coreStory = buildCoreStory(profile);
  const chronologySummary = buildChronologySummary(profile);
  const uncertaintyLines = buildUncertaintyLines(profile, {
    anyTruncated: opts.anyTruncated,
    withoutExtractionCount: opts.withoutExtractionCount,
  });

  const storyParts: string[] = [coreStory];
  if (synthesisLines[0]) storyParts.push(synthesisLines[0]);
  for (const theme of themes.slice(0, 2)) {
    storyParts.push(theme.observation);
  }
  storyParts.push(chronologySummary);
  if (uncertaintyLines[0]) storyParts.push(uncertaintyLines[0]);
  if (safeTrim(opts.workerMining, 'buildNarrativeHierarchy.workerMining')) {
    storyParts.push('Worker notes are kept separately and are not treated as verified facts in this summary.');
  }

  const recordStory = clipSentences(storyParts.join(' '), 6, 560);

  const firmParts = [coreStory, chronologySummary];
  if (synthesisLines[0] && !firmParts.includes(synthesisLines[0])) firmParts.push(synthesisLines[0]);
  if (themes.length) {
    firmParts.push(
      `${themes.length} recurring pattern${themes.length === 1 ? '' : 's'} ${themes.length === 1 ? 'is' : 'are'} flagged for review.`
    );
  }
  firmParts.push(
    'This packet organizes materials for human review; it does not assess legal merit or predict outcomes.'
  );
  const firmReviewLead = clipSentences(firmParts.join(' '), 4, 480);

  const overviewParts = [coreStory];
  for (const theme of themes.slice(0, 3)) {
    overviewParts.push(theme.observation);
  }
  if (synthesisLines[1]) overviewParts.push(synthesisLines[1]);
  overviewParts.push(chronologySummary);
  overviewParts.push(
    sanitizeGenerationPhrase('Organized for review preparation only — not legal advice or outcome prediction.')
  );
  const narrativeOverview = overviewParts.join('\n\n');

  return {
    coreStory,
    themes,
    synthesisLines,
    chronologySummary,
    uncertaintyLines,
    recordStory,
    firmReviewLead,
    narrativeOverview,
  };
}

export function buildRecordSetProfile(opts: {
  docTotal: number;
  extractedN: number;
  withoutExtractionCount: number;
  files: OrganizerFileInput[];
  bucketLabels: string[];
  dates: string[];
  topicPhrase: string | null;
  corpusLower: string;
}): RecordSetProfile {
  const scored = [...opts.files]
    .map((f) => ({ f, score: scoreFileCentrality(f) }))
    .sort((a, b) => b.score - a.score);

  const central = scored.filter((s) => !fileIsUnclear(s.f)).slice(0, 3).map((s) => s.f.fileName);
  const unclear = opts.files.filter(fileIsUnclear).map((f) => f.fileName);
  const centralSet = new Set(central);
  const supporting = scored
    .map((s) => s.f.fileName)
    .filter((n) => !centralSet.has(n) && !unclear.includes(n))
    .slice(0, 4);

  const buckets = new Set(opts.files.map((f) => f.scanBucket));
  const lower = opts.corpusLower;
  const hasSeparationSignals =
    /termination|separated|resignation|final pay|severance|laid off/.test(lower);

  const connectionInsights = buildCrossRecordConnections({
    hasPayroll: buckets.has('Compensation & Payroll'),
    hasCommunications: buckets.has('Workplace Communications'),
    hasScheduling: buckets.has('Scheduling, Attendance & Leave'),
    hasEmploymentRecords: buckets.has('Employment Records'),
    hasSeparationSignals,
    dates: opts.dates,
    topicPhrase: opts.topicPhrase,
  });

  return {
    docTotal: opts.docTotal,
    extractedN: opts.extractedN,
    withoutExtractionCount: opts.withoutExtractionCount,
    bucketLabels: opts.bucketLabels,
    dates: opts.dates,
    topicPhrase: opts.topicPhrase,
    centralFileNames: central,
    supportingFileNames: supporting,
    unclearFileNames: unclear.slice(0, 4),
    hasPayroll: buckets.has('Compensation & Payroll'),
    hasCommunications: buckets.has('Workplace Communications'),
    hasScheduling: buckets.has('Scheduling, Attendance & Leave'),
    hasEmploymentRecords: buckets.has('Employment Records'),
    hasSeparationSignals,
    connectionInsights,
  };
}

/** Worker-facing record story (narrative hierarchy). */
export function buildOrganizerRecordStory(
  profile: RecordSetProfile,
  opts: { workerMining: string; anyTruncated: boolean; corpusLower: string; withoutExtractionCount: number }
): string {
  return buildNarrativeHierarchy(profile, opts).recordStory;
}

export function buildOrganizerTimelineLead(profile: RecordSetProfile): string {
  return buildChronologySummary(profile);
}

function normalizeBucketLabel(label: string): string {
  const c = label.toLowerCase();
  if (/pay|payroll|wage|pay stub/.test(c)) return 'Compensation & Payroll';
  if (/time|schedule|pto|attendance/.test(c)) return 'Scheduling, Attendance & Leave';
  if (/communicat|email|memo|slack/.test(c)) return 'Workplace Communications';
  if (/offer|hr document|performance|employment/.test(c)) return 'Employment Records';
  if (/incident|disciplin|warning/.test(c)) return 'Incident & Workplace Evidence';
  return label;
}

/** Chronology phase title — reconstructed event, not filename catalog. */
export function chronologyPhaseTitle(
  scanBucket: string,
  dates: string[]
): string {
  const bucket = normalizeBucketLabel(scanBucket);
  const labels: Record<string, string> = {
    'Compensation & Payroll': 'Compensation and pay periods',
    'Employment Records': 'Employment and HR paperwork',
    'Workplace Communications': 'Workplace communications',
    'Scheduling, Attendance & Leave': 'Scheduling and timekeeping',
    'Incident & Workplace Evidence': 'Workplace incident or discipline materials',
    'Identity & Professional Verification': 'Identity or verification materials',
    'Additional Supporting Records': 'Supporting employment records',
  };
  let title = labels[bucket] ?? 'Employment-related activity';
  if (dates.length >= 2) {
    title += ` (${dates[0]} – ${dates[dates.length - 1]})`;
  } else if (dates.length === 1) {
    title += ` (around ${dates[0]})`;
  }
  return title;
}
