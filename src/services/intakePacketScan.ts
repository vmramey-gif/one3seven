/**
 * Organizational intake packet model — filename and worker-text signals only unless
 * plain-text file bodies are supplied. No legal conclusions; document vs worker attribution preserved.
 */

import { inferCategoryFromFileName } from './intakeDataService';
import { truncateFileLabel, uploadedFileKey } from './employmentTimelineOrganization';

export const INTAKE_TOP_LEVEL_CATEGORIES = [
  'Compensation & Payroll',
  'Employment Records',
  'Workplace Communications',
  'Scheduling, Attendance & Leave',
  'Incident & Workplace Evidence',
  'Identity & Professional Verification',
  'Additional Supporting Records',
] as const;

export type IntakeTopLevelCategory = (typeof INTAKE_TOP_LEVEL_CATEGORIES)[number];

export type IntakeFileScan = {
  key: string;
  fileName: string;
  displayLabel: string;
  legacyCategory: string;
  topLevel: IntakeTopLevelCategory;
  subcategory: string;
  signalSource: 'content_signal' | 'filename_signal';
};

export type IntakeTimelineAnchor = {
  label: string;
  timeframe: string;
  basis: string;
};

export type IntakePacketModel = {
  files: IntakeFileScan[];
  byTopLevel: Record<IntakeTopLevelCategory, IntakeFileScan[]>;
  employmentSnapshot: Array<{ label: string; value: string }>;
  payrollPayNotes: string[];
  intakeOverviewParagraphs: string[];
  timelineAnchors: IntakeTimelineAnchor[];
  themes: string[];
  chronologyHighlights: string[];
  keyIndividuals: Array<{ name: string; role: string }>;
  supportingCategories: Array<{ name: string; description: string }>;
  completenessSignals: string[];
  additionalRecordsSuggestions: string[];
  workerContextSection: string;
  organizationNotes: string;
  appendixEntries: Array<{ label: string; topLevel: string; subcategory: string }>;
};

const DEFAULT_SOFT_RECORDS = [
  'Offer letter or compensation agreement',
  'Employee handbook acknowledgment',
  'Final wage statement or severance materials',
  'Additional performance documentation',
  'Full separation notice or restructuring communication',
  'Reimbursement-related records or expense documentation',
];

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function mapLegacyToTopLevel(legacy: string, fileName: string): IntakeTopLevelCategory {
  const n = fileName.toLowerCase();
  if (
    /\b(incident|accident|injury|safety|osha|grievance|complaint)\b/i.test(fileName) ||
    /\b(investigation|witness)\b/i.test(fileName)
  ) {
    return 'Incident & Workplace Evidence';
  }
  if (
    /\b(passport|driver|license|i-?9|identity|badge|certification|credential)\b/i.test(n) ||
    /\bcpa\b|\bpe\b|professional license/i.test(n)
  ) {
    return 'Identity & Professional Verification';
  }

  switch (legacy) {
    case 'Pay Records / Payroll':
    case 'Reimbursement Records':
      return 'Compensation & Payroll';
    case 'Time Records':
    case 'PTO Records':
      return 'Scheduling, Attendance & Leave';
    case 'Workplace Communications':
      return 'Workplace Communications';
    case 'Offer Letters':
    case 'HR Documents':
    case 'Performance Reviews':
      return 'Employment Records';
    case 'Uncategorized':
    default:
      return 'Additional Supporting Records';
  }
}

function subcategoryLabel(legacy: string, top: IntakeTopLevelCategory): string {
  if (legacy !== 'Uncategorized') return legacy;
  return `${top} (limited filename signals)`;
}

function mergeSignalCorpus(parts: (string | undefined)[]): string {
  return normalizeSpace(parts.filter(Boolean).join('\n'));
}

type ParsedDate = { raw: string; sortKey: string; source: string };

function parseDatesFromText(text: string, source: string): ParsedDate[] {
  const out: ParsedDate[] = [];
  const push = (raw: string, y: string, m: string, d: string) => {
    const sortKey = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    out.push({ raw, sortKey, source });
  };

  const reMdY = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = reMdY.exec(text)) !== null) {
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    push(m[0], y, m[1], m[2]);
  }

  const reYmd = /\b(20\d{2}|19\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g;
  while ((m = reYmd.exec(text)) !== null) {
    push(m[0], m[1], m[2], m[3]);
  }

  const reMon = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2}|19\d{2})\b/gi;
  while ((m = reMon.exec(text)) !== null) {
    push(m[0], m[3], '01', m[2]);
  }

  const reQ = /\b(Q[1-4])\s+(20\d{2}|19\d{2})\b/gi;
  while ((m = reQ.exec(text)) !== null) {
    out.push({ raw: m[0], sortKey: `${m[2]}-${m[1]}`, source });
  }

  const reYear = /\b(20\d{2}|19\d{2})\b/g;
  while ((m = reYear.exec(text)) !== null) {
    if (out.some((x) => x.raw.includes(m![0]))) continue;
    out.push({ raw: m[0], sortKey: `${m[0]}-00-00`, source });
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    const k = x.sortKey + x.raw;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function inferAnchorLabel(fileName: string, workerAndOverview: string): string {
  const blob = `${fileName} ${workerAndOverview}`.toLowerCase();
  if (/offer|onboarding|welcome/i.test(blob)) return 'Approximate offer / start-related reference';
  if (/complaint|grievance|hr\s*case|investigation/i.test(blob)) return 'Internal complaint / report-related reference';
  if (/pip|performance|review|counseling/i.test(blob)) return 'Performance documentation reference';
  if (/fmla|leave|pto|sick|medical\s*leave|parental/i.test(blob)) return 'Leave-related reference';
  if (/terminat|separat|layoff|exit|resign|last\s*day/i.test(blob)) return 'Separation-related reference';
  if (/pay|wage|stub|payroll|w-?2|1099/i.test(blob)) return 'Payroll period reference';
  return 'Date reference from uploaded materials or context';
}

function extractField(patterns: RegExp[], corpus: string): string | null {
  for (const re of patterns) {
    const m = corpus.match(re);
    if (m?.[1]) return normalizeSpace(m[1].replace(/\s+/g, ' ')).slice(0, 200);
  }
  return null;
}

function extractPayAmountHints(corpus: string): string[] {
  const hints: string[] = [];
  if (/\$\s?\d/.test(corpus)) {
    hints.push(
      'Uploaded materials or filenames include currency references; exact compensation should be confirmed from source documents.'
    );
  }
  if (/\b(1099|w-?\s*2|pay\s*stub|paystub)\b/i.test(corpus)) {
    hints.push('Records appear to include payroll tax or pay-statement naming; structure and totals should be verified in the files.');
  }
  if (/\b(hourly|overtime|salary|bonus|commission)\b/i.test(corpus)) {
    hints.push('Filenames or notes reference compensation components; details should be taken from the underlying records rather than inferred here.');
  }
  return Array.from(new Set(hints));
}

function extractIndividuals(text: string): Array<{ name: string; role: string }> {
  const raw = text.trim();
  if (!raw) return [];
  const found: Array<{ name: string; role: string }> = [];
  const lines = raw.split(/\n+/);
  for (const line of lines) {
    const m = line.match(
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s*[—\-–:]\s*(.+)$/
    );
    if (m) {
      found.push({ name: m[1].trim(), role: normalizeSpace(m[2]).slice(0, 160) });
      continue;
    }
    const p = line.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\(([^)]+)\)/);
    if (p) found.push({ name: p[1].trim(), role: normalizeSpace(p[2]).slice(0, 160) });
  }
  const dedup: typeof found = [];
  const keys = new Set<string>();
  for (const row of found) {
    const k = `${row.name.toLowerCase()}|${row.role.toLowerCase()}`;
    if (keys.has(k)) continue;
    keys.add(k);
    dedup.push(row);
  }
  return dedup.slice(0, 24);
}

function employmentStructureHint(corpus: string): string | null {
  if (/\b1099\b/i.test(corpus) && !/\bw-?\s*2\b/i.test(corpus))
    return 'Documents or notes reference contractor tax forms; employment structure should be confirmed in the records.';
  if (/\bw-?\s*2\b/i.test(corpus))
    return 'Wage tax forms are referenced in filenames or notes; employment classification should be verified in source files.';
  if (/\bindependent\s+contractor\b/i.test(corpus))
    return 'Worker notes or filenames reference independent contractor status; structure should be confirmed from agreements.';
  return null;
}

function buildThemes(
  byTop: Record<IntakeTopLevelCategory, IntakeFileScan[]>,
  anchors: ParsedDate[]
): string[] {
  const t: string[] = [];
  if (
    byTop['Incident & Workplace Evidence'].length > 0 ||
    byTop['Employment Records'].some((f) => /\bcomplaint|grievance|investigation\b/i.test(f.fileName))
  ) {
    t.push('Internal workplace complaints or investigation-related file naming');
  }
  if (
    byTop['Employment Records'].some(
      (f) => /\bperformance|pip|review|counseling\b/i.test(f.fileName)
    )
  ) {
    t.push('Performance-management activity suggested by record naming');
  }
  if (
    byTop['Employment Records'].some((f) =>
      /\bterminat|separat|layoff|exit|severance\b/i.test(f.fileName)
    ) ||
    byTop['Workplace Communications'].some((f) => /\bletter|memo|email\b/i.test(f.fileName))
  ) {
    t.push('Separation-related records or formal workplace communications');
  }
  if (byTop['Compensation & Payroll'].length > 0) {
    t.push('Payroll and compensation documentation');
  }
  if (byTop['Workplace Communications'].length > 0) {
    t.push('Workplace communications involving HR/management (based on file naming)');
  }
  const sorted = [...anchors].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  if (sorted.length >= 2 && byTop['Workplace Communications'].length && byTop['Employment Records'].length) {
    t.push('Multiple dated materials across communications and employment records (chronology may warrant cross-review)');
  }
  return Array.from(new Set(t));
}

function buildChronologyHighlights(
  anchors: ParsedDate[],
  files: IntakeFileScan[],
  workerNotes: string
): string[] {
  if (!anchors.length && !files.length) {
    return [
      'Additional dated materials may help establish a clearer chronology as uploads continue.',
    ];
  }
  const sorted = [...anchors].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(0, 12);
  const highlights: string[] = [];
  const sampleFile = files[0]?.fileName ?? '';
  const labelFor = (a: ParsedDate) => inferAnchorLabel(a.source, workerNotes);
  for (const a of sorted.slice(0, 6)) {
    highlights.push(
      `${labelFor(a)} — materials reference ${a.raw} (${a.source === 'uploaded file names' ? 'file name / label context' : 'worker-provided or summary text'}).`
    );
  }
  if (sorted.length === 0 && files.length) {
    highlights.push(
      `Uploaded materials include ${files.length} file${files.length === 1 ? '' : 's'}; specific dates were not confidently extracted from filenames or notes.`
    );
  }
  const sepHint = files.some((f) => /\bterminat|separat|exit\b/i.test(f.fileName));
  const safetyHint = files.some((f) => /\bsafety|incident|injury\b/i.test(f.fileName));
  if (sepHint && !safetyHint) {
    highlights.push(
      'Separation-related records reviewed do not appear to explicitly reference prior workplace safety communications within the uploaded materials.'
    );
  }
  if (!sampleFile) return highlights;
  return highlights.slice(0, 8);
}

export function buildIntakePacketModel(p: {
  files: File[];
  uploadedFileLabels?: Record<string, string>;
  workerMainContext?: string;
  workerAdditionalNotes?: string;
  workerIntakeNotes?: string;
  /** Document-derived overview only (worker block stripped). */
  documentDerivedOverview?: string;
  /** Optional per-file OCR/text snippets for categorization (low volume). */
  fileTextSnippets?: Record<string, string>;
}): IntakePacketModel {
  const uploadedFileLabels = p.uploadedFileLabels ?? {};
  const workerMain = (p.workerMainContext ?? '').trim();
  const workerAdd = (p.workerAdditionalNotes ?? '').trim();
  const workerStory = (p.workerIntakeNotes ?? '').trim();
  const docOverview = (p.documentDerivedOverview ?? '').trim();
  const snippets = p.fileTextSnippets ?? {};

  const fileScans: IntakeFileScan[] = p.files.map((file) => {
    const key = uploadedFileKey(file);
    const snippet = snippets[key] ?? '';
    const combined = `${file.name}\n${snippet}`;
    const fromSnippet = snippet.length > 40;
    const legacyFromName = inferCategoryFromFileName(file.name);
    const legacyFromText = snippet ? inferCategoryFromFileName(`${file.name} ${snippet.slice(0, 2000)}`) : legacyFromName;
    const legacy = fromSnippet && legacyFromText !== 'Uncategorized' ? legacyFromText : legacyFromName;
    const top = mapLegacyToTopLevel(legacy, fromSnippet ? `${file.name} ${snippet.slice(0, 500)}` : file.name);
    return {
      key,
      fileName: file.name,
      displayLabel: uploadedFileLabels[key]?.trim() || truncateFileLabel(file.name),
      legacyCategory: legacy,
      topLevel: top,
      subcategory: subcategoryLabel(legacy, top),
      signalSource: fromSnippet ? 'content_signal' : 'filename_signal',
    };
  });

  const byTopLevel = {} as Record<IntakeTopLevelCategory, IntakeFileScan[]>;
  for (const c of INTAKE_TOP_LEVEL_CATEGORIES) byTopLevel[c] = [];
  for (const f of fileScans) byTopLevel[f.topLevel].push(f);

  const corpusWorker = mergeSignalCorpus([workerMain, workerAdd, workerStory]);
  const corpusDoc = mergeSignalCorpus([docOverview]);
  const corpusFiles = fileScans.map((f) => f.fileName).join('\n');
  const fullCorpus = mergeSignalCorpus([corpusWorker, corpusDoc, corpusFiles]);

  const employer =
    extractField(
      [
        /(?:employer|company|organization)\s*[:—-]\s*([^\n]+)/i,
        /\bemployed\s+(?:at|by)\s+([A-Z0-9][^\n,.]{2,80})/i,
        /\bworked\s+for\s+([A-Z0-9][^\n,.]{2,80})/i,
      ],
      corpusWorker || corpusDoc
    ) ??
    extractField([/\b(?:at|for)\s+([A-Z][A-Za-z0-9&.,'\- ]{2,60})\s+(?:from|between|since)/i], corpusWorker);

  const hq = extractField(
    [/headquarters?\s*[:—-]\s*([^\n]+)/i, /\bHQ\b[^A-Za-z0-9]+([A-Z][^\n,.]{2,80})/i],
    corpusWorker + '\n' + corpusDoc
  );

  const workerLoc = extractField(
    [
      /(?:remote|based|located)\s+(?:in|from)\s+([^\n,.]{2,80})/i,
      /(?:state|city)\s*[:—-]\s*([^\n]+)/i,
    ],
    corpusWorker
  );

  const title = extractField(
    [
      /(?:title|position|role)\s*[:—-]\s*([^\n]+)/i,
      /\b(as|was)\s+(?:a|an)\s+([^\n,.]{2,80})/i,
    ],
    corpusWorker
  );

  const empStruct = employmentStructureHint(fullCorpus);
  const payHints = extractPayAmountHints(fullCorpus);

  const datesFromFiles = fileScans.flatMap((f) =>
    parseDatesFromText(f.fileName, 'uploaded file names')
  );
  const datesFromContext = parseDatesFromText(corpusWorker + '\n' + corpusDoc, 'worker or summary text');
  const allDates = [...datesFromFiles, ...datesFromContext].sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey)
  );

  const timelineAnchors: IntakeTimelineAnchor[] = [];
  const used = new Set<string>();
  for (const d of allDates.slice(0, 12)) {
    const k = d.sortKey + d.raw;
    if (used.has(k)) continue;
    used.add(k);
    timelineAnchors.push({
      label: inferAnchorLabel(d.source, corpusWorker),
      timeframe: d.raw,
      basis: d.source.includes('file') ? 'Inferred from file naming' : 'Referenced in worker context or overview text',
    });
  }

  if (!timelineAnchors.length && fileScans.length) {
    const y = corpusFiles.match(/(19|20)\d{2}/);
    if (y) {
      timelineAnchors.push({
        label: 'Approximate period reference',
        timeframe: y[0],
        basis: 'Year token detected in file names only',
      });
    }
  }

  const payrollPayNotes = payHints;

  const employmentSnapshot: Array<{ label: string; value: string }> = [];
  if (employer) employmentSnapshot.push({ label: 'Employer', value: employer });
  if (hq) employmentSnapshot.push({ label: 'Employer headquarters (as stated)', value: hq });
  if (workerLoc) employmentSnapshot.push({ label: 'Worker location (as stated)', value: workerLoc });
  if (title) employmentSnapshot.push({ label: 'Position / job title (as stated)', value: title });

  if (allDates.length >= 2) {
    employmentSnapshot.push({
      label: 'Employment period (approximate, from detected dates)',
      value: `Materials reference dates ranging from ${allDates[0].raw} to ${allDates[allDates.length - 1].raw}; exact employment dates should be verified in source records.`,
    });
  } else if (allDates.length === 1) {
    employmentSnapshot.push({
      label: 'Notable date reference',
      value: `Records reference ${allDates[0].raw}. Additional dated materials may help establish a fuller employment timeframe.`,
    });
  }

  if (empStruct) employmentSnapshot.push({ label: 'Employment structure (preliminary)', value: empStruct });

  if (payrollPayNotes.length) {
    employmentSnapshot.push({
      label: 'Payroll / pay structure notes',
      value: payrollPayNotes.join(' '),
    });
  }

  if (!employmentSnapshot.length && fileScans.length) {
    employmentSnapshot.push({
      label: 'Employment snapshot',
      value:
        'Specific employer, role, or payroll details were not confidently extracted from filenames and available context. Uploaded materials may still contain those details for direct review.',
    });
  }

  const n = fileScans.length;
  const topLevelsPresent = INTAKE_TOP_LEVEL_CATEGORIES.filter((c) => byTopLevel[c].length > 0);

  const intakeOverviewParagraphs: string[] = [];
  if (n === 0) {
    intakeOverviewParagraphs.push(
      'Uploaded materials were not available for this organizational pass. Adding employment-related records will allow this intake packet to summarize categories, dates, and contextual notes.'
    );
  } else {
    intakeOverviewParagraphs.push(
      `Uploaded materials include ${n} indexed file${n === 1 ? '' : 's'}. Records are grouped below using document naming patterns and any available worker-provided context.`
    );
    if (topLevelsPresent.length) {
      intakeOverviewParagraphs.push(
        `Categories detected span: ${topLevelsPresent.join(', ')}. These labels are organizational only and do not assess legal claims.`
      );
    }
    if (docOverview && docOverview !== '—') {
      intakeOverviewParagraphs.push(`Records reference the following organizational notes from prior summary text:\n${docOverview}`);
    }
    if (corpusWorker) {
      intakeOverviewParagraphs.push(
        'Worker-provided background appears in the dedicated section below and is kept separate from document-derived observations.'
      );
    }
  }

  const themes = buildThemes(byTopLevel, allDates);
  const chronologyHighlights = buildChronologyHighlights(allDates, fileScans, workerStory);

  const keyIndividuals = extractIndividuals(workerStory + '\n' + workerMain + '\n' + workerAdd);

  const supportingCategories: IntakePacketModel['supportingCategories'] = INTAKE_TOP_LEVEL_CATEGORIES.filter(
    (c) => byTopLevel[c].length
  ).map((c) => {
    const items = byTopLevel[c];
    const subMix = Array.from(new Set(items.map((i) => i.subcategory))).slice(0, 4);
    const count = items.length;
    return {
      name: c,
      description: `${count} item${count === 1 ? '' : 's'} — ${subMix.join('; ')}. Grouping reflects filename and text signals, not a review of document bodies.`,
    };
  });

  const completenessSignals: string[] = [];
  if (byTopLevel['Compensation & Payroll'].length >= 2) {
    completenessSignals.push('Payroll-related records appear to span multiple uploads; pay periods should be confirmed in the files.');
  } else if (n > 0 && byTopLevel['Compensation & Payroll'].length === 1) {
    completenessSignals.push('Payroll-related records appear limited to a small number of uploaded documents.');
  }
  if (byTopLevel['Employment Records'].some((f) => /\bperformance|pip|review\b/i.test(f.fileName))) {
    completenessSignals.push('Performance-related materials are present; scope depends on the full file set.');
  }
  if (allDates.length <= 1 && n > 1) {
    completenessSignals.push('Additional uploaded materials may further refine chronology details.');
  }
  if (!completenessSignals.length && n > 0) {
    completenessSignals.push(
      'This organizational pass reflects the current upload set; adding dated materials often improves intake clarity.'
    );
  }

  const additionalRecordsSuggestions = [...DEFAULT_SOFT_RECORDS];

  const workerParts: string[] = [];
  if (workerMain) workerParts.push(`Worker notes:\n${workerMain}`);
  if (workerAdd) workerParts.push(`Worker additional notes:\n${workerAdd}`);
  if (workerStory) workerParts.push(`Worker intake notes:\n${workerStory}`);
  const workerContextSection = workerParts.length
    ? workerParts.join('\n\n')
    : 'Worker stated no additional free-form context in the fields captured for this intake.';

  const organizationNotes =
    'This summary is organizational in nature and intended to help structure uploaded employment-related records for review. It does not evaluate legal theories, outcomes, or case strength. AI organizes facts; worker-provided context is labeled as such; an attorney determines legal theory.';

  const appendixEntries = fileScans.map((f) => ({
    label: f.displayLabel,
    topLevel: f.topLevel,
    subcategory: f.subcategory,
  }));

  return {
    files: fileScans,
    byTopLevel,
    employmentSnapshot,
    payrollPayNotes,
    intakeOverviewParagraphs,
    timelineAnchors,
    themes,
    chronologyHighlights,
    keyIndividuals,
    supportingCategories,
    completenessSignals,
    additionalRecordsSuggestions,
    workerContextSection,
    organizationNotes,
    appendixEntries,
  };
}
