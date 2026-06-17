import { describe, expect, test } from 'vitest';
import { renderFirmIntakePacketPdf, renderWorkerSummaryPdf, type FirmPacketModel, type WorkerPacketModel } from '../firmIntakePdfRenderer';

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
