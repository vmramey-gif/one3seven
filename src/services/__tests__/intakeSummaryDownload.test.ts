import { describe, expect, test } from 'vitest';
import { buildTimelineCsvContent } from '../intakeSummaryDownload';
import type { IntakeSummaryDownloadPayload } from '../intakeSummaryDownload';

function payloadWithEvents(
  events: NonNullable<IntakeSummaryDownloadPayload['timelineEvents']>
): IntakeSummaryDownloadPayload {
  return {
    intakeNumber: 'INT-001',
    firmCode: null,
    intakeStatus: 'Submitted',
    workerName: 'Alex Rivera',
    employerName: 'Central Valley Logistics',
    workerContext: '',
    overview: '',
    timelineSummary: '',
    timelineEvents: events,
    categories: [],
    categoryBreakdown: [],
  } as unknown as IntakeSummaryDownloadPayload;
}

describe('buildTimelineCsvContent (2026-08-18, no CSV export existed anywhere — hard-challenge finding)', () => {
  test('produces a UTF-8 BOM + CRLF-terminated CSV with a header row and one row per event', () => {
    const csv = buildTimelineCsvContent(
      payloadWithEvents([
        {
          date: 'June 9, 2026',
          title: 'Complaint submitted to Human Resources',
          category: 'Workplace Communications',
          summary: 'Worker raised a concern about unpaid overtime.',
          sourceFileNames: ['overtime_pay_concern_email.pdf'],
        },
      ])
    );
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Date,Event,Category,Summary,Supporting files');
    // The date field itself contains a comma ("June 9, 2026"), so it must be quoted too --
    // RFC 4180 quoting applies per-field, not just to the fields expected to need it.
    expect(lines[1]).toBe(
      '"June 9, 2026",Complaint submitted to Human Resources,Workplace Communications,Worker raised a concern about unpaid overtime.,overtime_pay_concern_email.pdf'
    );
  });

  test('quotes and escapes a field containing a comma, quote, or newline (RFC 4180)', () => {
    const csv = buildTimelineCsvContent(
      payloadWithEvents([
        {
          date: 'July 2, 2026',
          title: 'Written warning issued',
          category: 'Performance / discipline records',
          summary: 'The warning cites "repeated tardiness, and schedule adherence".',
          sourceFileNames: [],
        },
      ])
    );
    expect(csv).toContain('"The warning cites ""repeated tardiness, and schedule adherence"".",');
  });

  test('an intake with no timeline events still produces just the header row', () => {
    const csv = buildTimelineCsvContent(payloadWithEvents([]));
    const lines = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);
    expect(lines).toEqual(['Date,Event,Category,Summary,Supporting files']);
  });

  test('multiple supporting files are joined, not truncated to one', () => {
    const csv = buildTimelineCsvContent(
      payloadWithEvents([
        {
          date: 'Date unclear — review source document',
          title: 'Pay period or overtime record documented',
          category: 'Compensation & Payroll',
          summary: 'Time records show hours worked.',
          sourceFileNames: ['paystub_1.pdf', 'paystub_2.pdf', 'timecard.pdf'],
        },
      ])
    );
    expect(csv).toContain('paystub_1.pdf; paystub_2.pdf; timecard.pdf');
  });
});
