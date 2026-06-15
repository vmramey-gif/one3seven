import { describe, expect, test } from 'vitest';
import {
  buildChronologySummary,
  buildCrossRecordConnections,
  buildOrganizerRecordStory,
  buildRecordSetProfile,
  filterTextForOrganizerMining,
} from '../intakeOrganizerReasoning';

describe('intake organizer reasoning', () => {
  test('filterTextForOrganizerMining drops boilerplate and page noise', () => {
    const raw = `
Page 1 of 12
CONFIDENTIAL
Pay period: March 1 – March 15, 2024
Gross pay: $2,400.00
!!!
Copyright 2020 All rights reserved
`;
    const filtered = filterTextForOrganizerMining(raw);
    expect(filtered).toContain('Pay period');
    expect(filtered).toContain('Gross pay');
    expect(filtered.toLowerCase()).not.toContain('confidential');
    expect(filtered).not.toMatch(/page 1 of 12/i);
  });

  test('buildCrossRecordConnections synthesizes payroll and communications', () => {
    const lines = buildCrossRecordConnections({
      hasPayroll: true,
      hasCommunications: true,
      hasScheduling: false,
      hasEmploymentRecords: false,
      hasSeparationSignals: false,
      dates: [],
      topicPhrase: null,
    });
    expect(lines[0]).toMatch(/taken together/i);
    expect(lines[0]).toMatch(/payroll.*communication/i);
    expect(lines.join(' ')).not.toMatch(/violation|proves|illegal/i);
  });

  test('buildOrganizerRecordStory prefers connection over per-file lists', () => {
    const profile = buildRecordSetProfile({
      docTotal: 3,
      extractedN: 3,
      withoutExtractionCount: 0,
      files: [
        {
          uploadedFileId: '1',
          fileName: 'pay.pdf',
          category: 'Pay Records',
          extractedText: 'Pay period March 2024 gross pay $2400 overtime 4 hours',
          scanBucket: 'Compensation & Payroll',
        },
        {
          uploadedFileId: '2',
          fileName: 'email.pdf',
          category: 'Workplace Communications',
          extractedText: 'From HR regarding pay complaint supervisor review March 2024',
          scanBucket: 'Workplace Communications',
        },
        {
          uploadedFileId: '3',
          fileName: 'stub2.pdf',
          category: 'Pay Records',
          extractedText: 'Pay period April 2024 gross pay $2500',
          scanBucket: 'Compensation & Payroll',
        },
      ],
      bucketLabels: ['compensation & payroll', 'workplace communications'],
      dates: ['March 2024', 'April 2024'],
      topicPhrase: 'wage or payroll topics',
      corpusLower: 'payroll hr complaint pay period',
    });

    const story = buildOrganizerRecordStory(profile, {
      workerMining: '',
      anyTruncated: false,
      corpusLower: 'payroll hr complaint pay period',
      withoutExtractionCount: 0,
    });
    expect(story).toMatch(/taken together/i);
    expect(story).not.toMatch(/records appear to reference|date reference|indexed text/i);
    expect(story).not.toMatch(/\d+\s+readable file/i);
  });

  test('buildChronologySummary avoids date-reference counts', () => {
    const profile = buildRecordSetProfile({
      docTotal: 2,
      extractedN: 2,
      withoutExtractionCount: 0,
      files: [],
      bucketLabels: [],
      dates: ['March 2024', 'April 2024'],
      topicPhrase: null,
      corpusLower: '',
    });
    const s = buildChronologySummary(profile);
    expect(s).toMatch(/span multiple periods/i);
    expect(s).not.toMatch(/date reference/i);
  });
});
