import { describe, expect, test } from 'vitest';
import { buildDocumentGroundedOrganization } from '../documentGroundedOrganizationService';
import {
  buildEvidenceMappedTimelineEvents,
  formatEvidenceTimelineChronologyLine,
} from '../evidenceMappedTimelineService';
import { applyEvidenceMappedOrganization } from '../intakeOrganizationEngine';
import {
  consolidateUnreadableGapLines,
  dedupeOrganizationGapLines,
  intakeSatisfiesHelpfulRecordType,
  resolveHelpfulRecordSuggestionLabels,
} from '../organizationOutputQuality';
import type { IntakeFileOrganizationRecord } from '../intakeOrganizationTypes';

const HR_COMPLAINT = `
From: Alex Rivera
To: HR Department
Date: January 12, 2024
Subject: Formal complaint
I am reporting harassment by my supervisor and request HR review.
`;

const TERM_NOTICE = `
TERMINATION NOTICE
Date: March 1, 2024
Employee: Alex Rivera
Your employment is terminated effective March 1, 2024.
Reason: performance
`;

const PAY_STUB = `
PAY STUB
Pay period: February 1 - February 15, 2024
Gross pay: 2400.00
Employee: Alex Rivera
`;

function sampleFileRecord(overrides: Partial<IntakeFileOrganizationRecord>): IntakeFileOrganizationRecord {
  return {
    source_file_id: 'f1',
    file_name: 'file.pdf',
    document_type: 'Workplace Communications',
    legacy_upload_category: 'Workplace Communications',
    likely_date: 'January 12, 2024',
    people_or_entities: ['Alex Rivera'],
    employment_topics: ['Workplace communications'],
    possible_timeline_event: {
      title: 'Workplace communications',
      date: 'January 12, 2024',
      neutral_summary: 'Materials may reflect workplace communications.',
    },
    supporting_record_strength: 'strong',
    missing_or_unclear_information: [],
    confidence: 'high',
    extraction_quality: 'high',
    ...overrides,
  };
}

describe('organization output quality', () => {
  test('dedupeOrganizationGapLines removes near-duplicate date and unreadable gaps', () => {
    const out = dedupeOrganizationGapLines([
      'Date may require confirmation from source records.',
      'Date may need confirmation in the source file.',
      'Date may require confirmation for scan.png in source records.',
      'Readable text was not available from this upload.',
      'No related records found yet.',
    ]);
    expect(out).toContain('Date may require confirmation from source records.');
    expect(out).not.toContain('Date may need confirmation in the source file.');
    expect(out).not.toContain('Date may require confirmation for scan.png in source records.');
    expect(out).not.toContain('Readable text was not available from this upload.');
  });

  test('consolidateUnreadableGapLines merges per-file unreadable messages', () => {
    const out = consolidateUnreadableGapLines([
      'Readable text was not available for IMG_001.png; a clearer copy may help complete the timeline.',
      'Readable text was not available for IMG_002.png; a clearer copy may help complete the timeline.',
      'Date may require confirmation from source records.',
    ]);
    expect(out.some((l) => /2 uploads/i.test(l))).toBe(true);
    expect(out.filter((l) => /Readable text was not available for IMG_/i.test(l))).toHaveLength(0);
  });

  test('formatEvidenceTimelineChronologyLine truncates supporting file lists', () => {
    const names = Array.from({ length: 20 }, (_, i) => `Email_${i}.pdf`);
    const line = formatEvidenceTimelineChronologyLine({
      date: 'January 15, 2024',
      title: 'Workplace communication materials',
      neutral_summary: 'Records mention materials in this part of the sequence.',
      people_involved: [],
      supporting_file_ids: names.map((_, i) => `id-${i}`),
      supporting_file_names: names,
      related_topics: ['Workplace communications'],
      gaps_or_uncertainties: [],
      confidence: 'high',
      category: 'Workplace Communications',
      source_strength: 'strong',
    });
    expect(line).toMatch(/Email_0\.pdf, and 19 more/);
    expect(line).not.toMatch(/Email_19\.pdf/);
  });

  test('complaint filename yields specific timeline title', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'c1',
          file_name: 'HR_Complaint_Jan2024.pdf',
          employment_topics: ['Workplace communications'],
        }),
      ],
    });
    expect(events[0]?.title).toBe('Complaint submitted to Human Resources');
  });

  test('intakeSatisfiesHelpfulRecordType detects termination performance context', () => {
    expect(
      intakeSatisfiesHelpfulRecordType('performance', {
        corpusLower: TERM_NOTICE.toLowerCase(),
        fileNameCorpus: 'termination_notice.pdf',
        categoryCorpus: 'employment status',
        fileRecords: [],
      })
    ).toBe(true);
  });

  test('resolveHelpfulRecordSuggestionLabels suppresses covered dispute materials', () => {
    const corpus = `${HR_COMPLAINT}\n${TERM_NOTICE}\n${PAY_STUB}`.toLowerCase();
    const labels = resolveHelpfulRecordSuggestionLabels({
      bucketLabels: ['compensation & Payroll', 'workplace communications', 'employment status'],
      filesMeta: [
        { fileName: 'HR_Complaint_Jan2024.pdf', category: 'Workplace Communications' },
        { fileName: 'Termination_Notice.pdf', category: 'Employment Status' },
        { fileName: 'Pay_Feb2024.pdf', category: 'Pay Records' },
      ],
      workerContext: '',
      corpusLower: corpus,
      fileRecords: [],
    });
    expect(labels).not.toContain('Pay stubs or wage statements');
    expect(labels).not.toContain('Termination or separation records');
    expect(labels).not.toContain('Written communications with employer or HR');
    expect(labels).not.toContain('Performance reviews or discipline records');
  });

  test('resolveHelpfulRecordSuggestionLabels prioritizes specific next records from story signals', () => {
    const labels = resolveHelpfulRecordSuggestionLabels({
      bucketLabels: ['workplace communications', 'employment status'],
      filesMeta: [
        { fileName: 'Complaint_To_HR.pdf', category: 'Workplace Communications' },
        { fileName: 'Termination_Letter.pdf', category: 'Employment Status' },
      ],
      workerContext: 'I complained to HR and was terminated months later.',
      corpusLower: 'complaint human resources termination',
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'c1',
          file_name: 'Complaint_To_HR.pdf',
          employment_topics: ['Workplace communications', 'Complaint'],
        }),
        sampleFileRecord({
          source_file_id: 't1',
          file_name: 'Termination_Letter.pdf',
          employment_topics: ['Separation'],
        }),
      ],
    });

    expect(labels.slice(0, 2)).toEqual([
      'HR response or follow-up communication',
      'Performance history before separation',
    ]);
  });

  test('resolveHelpfulRecordSuggestionLabels adds sequence-specific record requests', () => {
    const labels = resolveHelpfulRecordSuggestionLabels({
      bucketLabels: ['employment status', 'time records', 'reimbursement records'],
      filesMeta: [
        { fileName: 'Written_Warning.pdf', category: 'Performance Reviews' },
        { fileName: 'Termination_Letter.pdf', category: 'Employment Status' },
        { fileName: 'Schedule_Change.pdf', category: 'Time Records' },
        { fileName: 'Mileage_Expense_Request.pdf', category: 'Reimbursement Records' },
      ],
      workerContext: '',
      corpusLower:
        'written warning termination schedule change reimbursement mileage expense',
      fileRecords: [],
    });

    expect(labels).toEqual(
      expect.arrayContaining([
        'Communications explaining the warning',
        'Earlier schedules for comparison',
        'Expense policy or employer response',
      ])
    );
  });

  test('grounded organization suppresses false-positive helpful record gaps', () => {
    const org = buildDocumentGroundedOrganization(
      [
        { fileName: 'HR_Complaint_Jan2024.pdf', category: 'Workplace Communications', uploadedFileId: 'c1' },
        { fileName: 'Termination_Notice.pdf', category: 'Employment Status', uploadedFileId: 't1' },
        { fileName: 'Pay_Feb2024.pdf', category: 'Pay Records', uploadedFileId: 'p1' },
      ],
      [
        {
          uploadedFileId: 'c1',
          fileName: 'HR_Complaint_Jan2024.pdf',
          category: 'Workplace Communications',
          extractedText: HR_COMPLAINT,
          qualityFlags: null,
        },
        {
          uploadedFileId: 't1',
          fileName: 'Termination_Notice.pdf',
          category: 'Employment Status',
          extractedText: TERM_NOTICE,
          qualityFlags: null,
        },
        {
          uploadedFileId: 'p1',
          fileName: 'Pay_Feb2024.pdf',
          category: 'Pay Records',
          extractedText: PAY_STUB,
          qualityFlags: null,
        },
      ],
      null
    );
    expect(org).not.toBeNull();
    if (!org) return;
    expect(org.missingDocumentSuggestions.join('\n')).not.toMatch(
      /This may help complete the timeline: a payroll record for this period/i
    );
    const gaps = org.sections.potential_gaps.join('\n');
    expect(gaps).not.toMatch(/This may help complete the timeline: Termination or separation records/i);
    expect(gaps).not.toMatch(/This may help complete the timeline: a payroll record for this period/i);
    expect(gaps).not.toMatch(/This may help complete the timeline: a communication from this date range/i);
    expect(gaps).not.toMatch(/This may help complete the timeline: Performance reviews or discipline records/i);
  });

  test('intakeSatisfiesHelpfulRecordType detects payroll in extracted corpus', () => {
    expect(
      intakeSatisfiesHelpfulRecordType('pay', {
        corpusLower: 'pay stub gross pay pay period february 2024',
        fileNameCorpus: 'pay_feb.pdf',
        categoryCorpus: 'pay records',
        fileRecords: [],
      })
    ).toBe(true);
  });

  test('clarification items omit gaps already listed in potential gaps', () => {
    const org = applyEvidenceMappedOrganization({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'u1',
          file_name: 'scan.png',
          likely_date: null,
          extraction_quality: 'unreadable',
          confidence: 'low',
          supporting_record_strength: 'inferred',
          missing_or_unclear_information: ['Readable text was not available from this upload.'],
        }),
      ],
      peopleIndex: [],
      executiveLead: 'Summary.',
      missingDocumentSuggestions: [],
      readinessIndicators: [],
      reviewItems: [],
      docTotal: 1,
    });
    const gaps = org.sections.potential_gaps.join('\n');
    const clar = org.sections.clarification_items.join('\n');
    expect(gaps).toMatch(/Readable text was not available|No related records found yet/i);
    expect(clar).not.toMatch(/No related records found yet/i);
  });
});
