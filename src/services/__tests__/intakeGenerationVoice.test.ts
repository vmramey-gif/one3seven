import { describe, expect, test } from 'vitest';
import { buildDocumentGroundedOrganization } from '../documentGroundedOrganizationService';
import { buildPlaceholderOrganization } from '../aiOrganizationService';
import { encodeTimelineWorkerContext, parseTimelineSourceTrace } from '../timelineSourceTraceCodec';
import { defaultSourceTrace, ORGANIZATION_BANNED_OUTPUT_PATTERN, formatSupportingFileList, sanitizeGenerationPhrase } from '../intakeGenerationVoice';
import { buildPayRecordFactDigest, buildCommunicationFactDigest } from '../documentFactExtractionService';
import { assertNeutralOrganizationOutput } from '../intakeOrganizationAssertions';
import { buildPerFileOrganizationRecords } from '../perFileOrganizationService';
import { extractOrgEngineFromOverview, mergeOrgEngineIntoOverview } from '../intakeOrgEngineCodec';

const ROBOTIC =
  /\b(records appear to reference|extracted plain text in|source text in unspecified|\d+\s+date reference|indexed references:|readable file)\b/i;

const SAMPLE_TEXT = `
PAY STUB
Pay period: March 1 – March 15, 2024
Gross pay: $2,400.00
Employee: Alex Rivera
`;

describe('intake generation voice', () => {
  test('formatSupportingFileList does not throw when a file name is undefined', () => {
    expect(() =>
      formatSupportingFileList(['pay.pdf', undefined as unknown as string, 'comm.pdf'])
    ).not.toThrow();
    expect(formatSupportingFileList(['pay.pdf', undefined as unknown as string])).toContain('pay.pdf');
  });

  test('buildPayRecordFactDigest tolerates missing source.fileName from DB rows', () => {
    const digest = buildPayRecordFactDigest([
      {
        kind: 'pay_record',
        source: {
          uploadedFileId: 'f1',
          fileName: undefined as unknown as string,
          category: 'Pay Records',
        },
        employerName: 'Acme',
        employeeName: 'Alex',
        payPeriodStart: '2024-03-01',
        payPeriodEnd: '2024-03-15',
        payDate: '2024-03-20',
        payRateOrSalaryText: null,
        regularHours: '80',
        overtimeHours: null,
        grossPay: '$2,400',
        deductionsSummary: null,
        netPay: '$1,900',
        finalPayReferences: null,
        confidence: 'medium',
      },
      {
        kind: 'pay_record',
        source: {
          uploadedFileId: 'f2',
          fileName: 'stub.pdf',
          category: 'Pay Records',
        },
        employerName: 'Acme',
        employeeName: 'Alex',
        payPeriodStart: '2024-04-01',
        payPeriodEnd: '2024-04-15',
        payDate: '2024-04-20',
        payRateOrSalaryText: null,
        regularHours: '80',
        overtimeHours: null,
        grossPay: '$2,500',
        deductionsSummary: null,
        netPay: '$2,000',
        finalPayReferences: null,
        confidence: 'medium',
      },
    ]);
    expect(digest.length).toBeGreaterThan(0);
  });

  test('buildCommunicationFactDigest tolerates undefined workerConcernExcerpt', () => {
    expect(() =>
      buildCommunicationFactDigest([
        {
          kind: 'workplace_communications',
          source: {
            uploadedFileId: 'c1',
            fileName: undefined as unknown as string,
            category: 'Communications',
          },
          messageDate: '2024-05-01',
          sender: 'HR',
          recipient: 'Alex',
          peopleMentioned: [],
          employerOrCompany: null,
          subjectOrTopic: 'Schedule change',
          workerConcernExcerpt: undefined as unknown as string,
          employerOrHrResponseExcerpt: null,
          confidence: 'medium',
        },
      ])
    ).not.toThrow();
  });

  test('sanitizeGenerationPhrase neutralizes expanded banned legal phrasing', () => {
    const samples = [
      'This proves retaliation against the worker.',
      'Evidence of discrimination in the file.',
      'You have a strong case for illegal termination.',
      'Employer violated wage theft rules with high claim value.',
      'Likely to win settlement value attorney match score.',
      'Retaliation occurred and discrimination occurred.',
      'This is wrongful termination with a wage violation.',
      'The outcome likelihood is high and the case strength is obvious.',
      'You should sue and hire an attorney immediately.',
      'Recommend legal action based on settlement value.',
    ];
    for (const raw of samples) {
      const cleaned = sanitizeGenerationPhrase(raw);
      ORGANIZATION_BANNED_OUTPUT_PATTERN.lastIndex = 0;
      expect(ORGANIZATION_BANNED_OUTPUT_PATTERN.test(cleaned)).toBe(false);
    }
  });

  test('document-grounded output passes neutral organization validation', () => {
    const org = buildDocumentGroundedOrganization(
      [{ fileName: 'Pay_March.pdf', category: 'Pay Records', uploadedFileId: 'f1' }],
      [
        {
          uploadedFileId: 'f1',
          fileName: 'Pay_March.pdf',
          category: 'Pay Records',
          extractedText: SAMPLE_TEXT,
          qualityFlags: null,
        },
      ],
      null
    );
    expect(org).not.toBeNull();
    if (!org) return;

    expect(() => assertNeutralOrganizationOutput(org)).not.toThrow();
    expect(ROBOTIC.test(collectBlob(org))).toBe(false);
    expect(org.recordStory).toMatch(/taken together|records mention|current record set/i);
    expect(org.fileRecords).toHaveLength(1);
    expect(org.fileRecords[0]?.source_file_id).toBe('f1');
    expect(org.fileRecords[0]?.extraction_quality).not.toBe('unreadable');
    expect(org.timelineEvents[0]?.source.sourceFileNames).toContain('Pay_March.pdf');
  });

  test('placeholder organization passes neutral validation and emits file records', () => {
    const org = buildPlaceholderOrganization([
      { fileName: 'offer.pdf', category: 'Offer Letters', uploadedFileId: 'f-offer' },
      { fileName: 'pay.pdf', category: 'Pay Records', uploadedFileId: 'f-pay' },
    ]);
    expect(() => assertNeutralOrganizationOutput(org)).not.toThrow();
    expect(org.timelineEvents.length).toBeGreaterThan(0);
    expect(org.fileRecords).toHaveLength(2);
    expect(org.fileRecords.every((r) => r.extraction_quality === 'unreadable')).toBe(true);
    expect(org.fileRecords.every((r) => r.confidence === 'low')).toBe(true);
  });

  test('failed extraction yields unreadable per-file record', () => {
    const { fileRecords } = buildPerFileOrganizationRecords(
      [{ uploadedFileId: 'x1', fileName: 'scan.pdf', category: 'Uncategorized' }],
      [
        {
          uploadedFileId: 'x1',
          fileName: 'scan.pdf',
          category: 'Uncategorized',
          extractedText: '',
          qualityFlags: { empty_text_layer: true },
        },
      ]
    );
    expect(fileRecords[0]?.extraction_quality).toBe('unreadable');
    expect(fileRecords[0]?.confidence).toBe('low');
    expect(fileRecords[0]?.supporting_record_strength).toBe('inferred');
  });

  test('O3S_ORG_ENGINE block round-trips in overview', () => {
    const org = buildPlaceholderOrganization([{ fileName: 'a.pdf', category: 'Pay Records', uploadedFileId: 'a' }]);
    const merged = mergeOrgEngineIntoOverview('Overview prose.', {
      version: 1,
      file_records: org.fileRecords,
      people_index: org.peopleIndex,
      generated_at: '2026-05-28T12:00:00.000Z',
    });
    const parsed = extractOrgEngineFromOverview(merged);
    expect(parsed?.file_records).toHaveLength(1);
    expect(parsed?.people_index).toEqual(org.peopleIndex);
    expect(merged).toContain('--- O3S_ORG_ENGINE ---');
  });

  test('timeline source trace codec round-trips', () => {
    const source = defaultSourceTrace(
      [{ uploadedFileId: 'id-1', fileName: 'a.pdf', category: 'Pay Records' }],
      'strong'
    );
    const ctx = encodeTimelineWorkerContext('', source);
    const parsed = parseTimelineSourceTrace(ctx);
    expect(parsed?.sourceFileNames).toEqual(['a.pdf']);
    expect(parsed?.sourceStrength).toBe('strong');
  });
});

function collectBlob(org: NonNullable<ReturnType<typeof buildDocumentGroundedOrganization>>): string {
  return [
    org.recordStory,
    org.firmReviewSummary,
    org.overview,
    org.timelineSummary,
    ...org.timelineEvents.map((e) => e.aiSummary),
    ...org.readinessIndicators,
    ...org.missingDocumentSuggestions,
    ...org.reviewItems.map((r) => `${r.title} ${r.whyNeedsReview}`),
    ...org.fileRecords.flatMap((r) => [
      r.possible_timeline_event?.neutral_summary ?? '',
      ...r.missing_or_unclear_information,
    ]),
  ].join('\n');
}
