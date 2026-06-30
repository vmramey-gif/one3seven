import { describe, expect, test } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { renderFirmIntakePacketPdf, renderWorkerSummaryPdf, countSourceCoverage, type FirmPacketModel, type PdfSourceDoc, type WorkerPacketModel } from '../firmIntakePdfRenderer';

function sampleModel(overrides: Partial<FirmPacketModel> = {}): FirmPacketModel {
  return {
    cover: {
      workerName: 'Marcus Reyes',
      employer: 'Pacific Ridge Distribution LLC',
      employmentPeriod: 'March 2022 - January 2026',
      recordCount: 11,
      eventCount: 6,
      preparedDate: 'Jun 16, 2026',
    },
    reviewSnapshot: ['The worker reports an employment matter with the records described below.'],
    whyReview: 'Records document a sequence of events that require attorney review to assess.',
    extracted: {
      confirmedFacts: [{ label: 'Complaint date', value: 'November 26, 2025' }],
      coworkerCorroboration: null,
      timingIntervals: [
        { label: 'Written warning', days: 11, description: 'Written warning: 11 days after complaint' },
        { label: 'Termination', days: 34, description: 'Termination: 34 days after complaint' },
      ],
      keyQuotes: [{ category: 'HR Communications', fileName: 'HR Complaint Nov2025', quote: 'I am formally requesting a payroll audit.' }],
      overtimeNote: 'Overtime hours recorded without matching overtime rate — payroll review required.',
    },
    overviewFields: [{ label: 'Employer', value: 'Pacific Ridge Distribution LLC' }],
    sequence: {
      kind: 'events',
      events: [
        { date: 'November 26, 2025', title: 'Formal HR complaint filed', interval: null, sourceFile: 'Rivera HR Complaint Nov2025' },
        { date: 'January 10, 2026', title: 'Employment terminated', interval: '1 month after complaint', sourceFile: 'Rivera FinalPayStub Jan2026' },
      ],
    },
    priorityQuestions: ['What reason does the termination letter provide?'],
    records: {
      kind: 'list',
      priority: [{ name: 'Rivera HR Complaint Nov2025', category: 'HR Communications' }],
      supporting: [{ name: 'Rivera PayStub Oct2022', category: 'Payroll Records' }],
    },
    dvwRows: [{ question: 'HR complaint occurred', support: 'Document available' }],
    confirmationItems: ['Employer-stated reason for termination not yet extracted.'],
    clarificationQuestions: ['The records show more than one employer name. Which appears on your paystub?'],
    workerContext: { kind: 'text', paragraphs: ['Marcus raised the overtime issue informally in early 2023.'] },
    reviewOptions: {
      unresolvedCount: 1,
      priorityCount: 1,
      totalRecords: 11,
      additionalRecords: ['Timecards or time records for the full employment period'],
      actions: 'Actions available: Review priority documents · Accept intake · Decline intake',
    },
    disclaimer: ['one3seven is not a law firm and does not provide legal advice.'],
    documentWorkflow: [],
    wageExposure: null,
    ...overrides,
  };
}

describe('renderFirmIntakePacketPdf', () => {
  test('emits a valid, non-trivial PDF for a full model', async () => {
    const bytes = await renderFirmIntakePacketPdf(sampleModel());
    expect(bytes.length).toBeGreaterThan(1000);
    // PDF magic header "%PDF"
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  test('renders without throwing on a sparse limited-preview model', async () => {
    const bytes = await renderFirmIntakePacketPdf(
      sampleModel({
        extracted: null,
        sequence: { kind: 'preview', note: 'Full timeline available upon approval.' },
        priorityQuestions: [],
        records: { kind: 'preview', note: 'Individual file titles are withheld in limited preview exports.' },
        dvwRows: [],
        clarificationQuestions: [],
        workerContext: { kind: 'hidden' },
        documentWorkflow: [],
      }),
    );
    expect(bytes.length).toBeGreaterThan(800);
    expect(bytes[0]).toBe(0x25);
  });
});

// ── Source-linked citations (clickable → embedded source page) ────────────────

async function makeSourcePdf(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const p = d.addPage([300, 400]);
  p.drawText('PAYSTUB SOURCE', { x: 20, y: 350, size: 14 });
  return d.save();
}

function citedLineItem(label: string, value: number, docId: string | null) {
  return {
    label,
    formula: 'from record',
    value,
    isStatutory: false,
    citation: docId
      ? { docId, docName: 'Paystub.pdf', page: 1, charStart: 0, charEnd: 10, sourceText: 'rate $30/hr' }
      : null,
  };
}

function wageModelWithCitation(): FirmPacketModel {
  const report = {
    baseHourlyRate: citedLineItem('Base hourly rate', 30, 'doc-1'),
    overtimeRate: null,
    overtimeHoursUnderpaid: citedLineItem('Overtime hours without matching premium', 30, 'doc-1'),
    overtimePremiumPerHour: null,
    overtimeTotalEstimate: 0,
    mealBreaksMissed: null,
    mealBreakPremiumPerBreak: null,
    mealBreakTotalEstimate: 0,
    combinedEstimate: 900,
    isPartialData: false,
    missingRecordsWarning: null,
    calculatedAt: '2026-06-25',
  };
  return sampleModel({
    wageExposure: { report, disclaimer: ['Estimate from records only; not a legal conclusion.'] },
  } as Partial<FirmPacketModel>);
}

function countLinkAnnotations(doc: PDFDocument): number {
  let links = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i) as { get?: (n: PDFName) => unknown } | undefined;
      const sub = a?.get?.(PDFName.of('Subtype'));
      if (sub?.toString() === '/Link') links += 1;
    }
  }
  return links;
}

describe('source-linked citations', () => {
  test('embeds cited source pages and links citations to them', async () => {
    const model = wageModelWithCitation();
    const sources: PdfSourceDoc[] = [
      { docId: 'doc-1', fileName: 'Paystub.pdf', mime: 'application/pdf', bytes: await makeSourcePdf() },
    ];

    const withoutSources = await PDFDocument.load(await renderFirmIntakePacketPdf(model));
    const withSources = await PDFDocument.load(await renderFirmIntakePacketPdf(model, sources));

    // Appendix added pages (Source Records heading + embedded source page).
    expect(withSources.getPageCount()).toBeGreaterThan(withoutSources.getPageCount());
    // Citations became clickable link annotations.
    expect(countLinkAnnotations(withSources)).toBeGreaterThan(0);
    // No sources supplied → graceful text-only fallback, no link annotations.
    expect(countLinkAnnotations(withoutSources)).toBe(0);
  });

  test('links chronology events whose source file matches a supplied document', async () => {
    // sampleModel has wageExposure: null, so any link annotation must come from the
    // chronology section — proving the chronology slice wires links on its own.
    const model = sampleModel();
    const sources: PdfSourceDoc[] = [
      { docId: 'evt-1', fileName: 'Rivera HR Complaint Nov2025', mime: 'application/pdf', bytes: await makeSourcePdf() },
    ];
    const withSources = await PDFDocument.load(await renderFirmIntakePacketPdf(model, sources));
    expect(countLinkAnnotations(withSources)).toBeGreaterThan(0);
    // No sources → chronology renders as plain text, no link annotations.
    const withoutSources = await PDFDocument.load(await renderFirmIntakePacketPdf(model));
    expect(countLinkAnnotations(withoutSources)).toBe(0);
  });

  test('links a key quote to its source document by file name', async () => {
    // Isolate the quote link: events have no matching source, wageExposure is null,
    // so the only possible link annotation comes from the key-quote block.
    const model = sampleModel({
      sequence: { kind: 'events', events: [{ date: 'March 2022', title: 'Employment begins', interval: null, sourceFile: null }] },
      extracted: {
        confirmedFacts: [],
        coworkerCorroboration: null,
        timingIntervals: [],
        keyQuotes: [{ category: 'HR Communications', fileName: 'HR Complaint Nov2025', quote: 'I am formally requesting a payroll audit.' }],
        overtimeNote: null,
      },
    } as Partial<FirmPacketModel>);
    const sources: PdfSourceDoc[] = [
      { docId: 'q-1', fileName: 'HR Complaint Nov2025', mime: 'application/pdf', bytes: await makeSourcePdf() },
    ];
    const withSources = await PDFDocument.load(await renderFirmIntakePacketPdf(model, sources));
    expect(countLinkAnnotations(withSources)).toBeGreaterThan(0);
    const withoutSources = await PDFDocument.load(await renderFirmIntakePacketPdf(model));
    expect(countLinkAnnotations(withoutSources)).toBe(0);
  });

  test('worker-stated events (no source file) render without links or throwing', async () => {
    const model = sampleModel({
      sequence: {
        kind: 'events',
        events: [{ date: 'March 2022', title: 'Employment begins', interval: null, sourceFile: null }],
      },
    });
    const doc = await PDFDocument.load(await renderFirmIntakePacketPdf(model));
    expect(countLinkAnnotations(doc)).toBe(0);
  });

  test('skips unembeddable source types without throwing (citation stays text)', async () => {
    const model = wageModelWithCitation();
    const sources: PdfSourceDoc[] = [
      { docId: 'doc-1', fileName: 'notes.docx', mime: 'application/vnd.openxmlformats', bytes: new Uint8Array([1, 2, 3]) },
    ];
    const bytes = await renderFirmIntakePacketPdf(model, sources);
    expect(bytes[0]).toBe(0x25); // still a valid PDF
    const doc = await PDFDocument.load(bytes);
    expect(countLinkAnnotations(doc)).toBe(0); // nothing to link to
  });
});

describe('countSourceCoverage', () => {
  test('counts linked items vs total across events and quotes (arithmetic only)', () => {
    // 2 events + 1 quote = 3 total. Supply docs matching event #1 and the quote = 2 linked.
    const model = sampleModel({
      extracted: {
        confirmedFacts: [],
        coworkerCorroboration: null,
        timingIntervals: [],
        keyQuotes: [{ category: 'HR Communications', fileName: 'HR Complaint Nov2025', quote: 'audit please' }],
        overtimeNote: null,
      },
    } as Partial<FirmPacketModel>);
    const sources: PdfSourceDoc[] = [
      { docId: 'a', fileName: 'Rivera HR Complaint Nov2025', mime: 'application/pdf', bytes: new Uint8Array() },
      { docId: 'b', fileName: 'HR Complaint Nov2025', mime: 'application/pdf', bytes: new Uint8Array() },
    ];
    expect(countSourceCoverage(model, sources)).toEqual({ linked: 2, total: 3 });
    // No sources → nothing linked, total unchanged.
    expect(countSourceCoverage(model)).toEqual({ linked: 0, total: 3 });
  });
});

function workerModel(overrides: Partial<WorkerPacketModel> = {}): WorkerPacketModel {
  return {
    cover: { workerName: 'Marcus Reyes', employer: 'Pacific Ridge Distribution LLC', employmentPeriod: 'March 2022 - January 2026', recordCount: 11, eventCount: 6, preparedDate: 'Jun 16, 2026' },
    intakeNumber: 'INT-137',
    currentUnderstanding: 'Here is what one3seven organized from your records and story so far.',
    caseSnapshot: { employmentPeriod: 'March 2022 - January 2026', primaryConcerns: ['Unpaid overtime', 'Missed meal breaks'], recordsOrganized: 11, timelineEvents: 6, namedIndividuals: 2 },
    workerStory: [{ heading: 'Concerns Reported', body: 'I raised the overtime issue with my supervisor in early 2023.' }],
    questionsForReview: ['What records show the overtime hours worked?'],
    chronology: ['November 26, 2025 — HR complaint filed', 'January 10, 2026 — employment ended'],
    supportingDocuments: ['Rivera HR Complaint Nov2025', 'Rivera FinalPayStub Jan2026'],
    missingInformation: ['Time records for the full employment period may help complete the timeline.'],
    disclaimer: ['one3seven is not a law firm and does not provide legal advice. You control what you share.'],
    ...overrides,
  };
}

describe('renderWorkerSummaryPdf', () => {
  test('emits a valid PDF for a full worker model', async () => {
    const bytes = await renderWorkerSummaryPdf(workerModel());
    expect(bytes.length).toBeGreaterThan(800);
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  test('renders without throwing on a sparse worker model', async () => {
    const bytes = await renderWorkerSummaryPdf(
      workerModel({ workerStory: [], questionsForReview: [], chronology: [], supportingDocuments: [], missingInformation: [] }),
    );
    expect(bytes[0]).toBe(0x25);
  });
});
