import { describe, expect, test } from 'vitest';
import {
  inferInventoryCategory,
  pickSupportingRecordsForEvent,
  prepareChronologyPresentationEvent,
  resolveChronologyEventDate,
  resolveChronologyEventTitle,
} from '../packetChronologyIntelligence';

const INVENTORY = [
  { fileName: 'Offer_Letter.pdf', category: 'Uncategorized' },
  { fileName: 'Termination_Letter.pdf', category: 'Uncategorized' },
  { fileName: 'Complaint_To_HR.pdf', category: 'Uncategorized' },
  { fileName: 'Witness_Statement_A.pdf', category: 'Uncategorized' },
  { fileName: 'Written_Warning.pdf', category: 'Uncategorized' },
  { fileName: 'Project_Removal_Notice.pdf', category: 'Uncategorized' },
  { fileName: 'paystub_march_2024.pdf', category: 'Pay Records' },
  { fileName: 'employee_handbook.pdf', category: 'HR Documents' },
];

describe('packetChronologyIntelligence', () => {
  test('infers categories from filenames when Uncategorized', () => {
    expect(inferInventoryCategory('Complaint_To_HR.pdf', 'Uncategorized')).toBe('Workplace Communications');
    expect(inferInventoryCategory('Witness_Statement_A.pdf', 'Uncategorized')).toBe('Workplace Communications');
    expect(inferInventoryCategory('Written_Warning.pdf', 'Uncategorized')).toBe('Performance Reviews');
    expect(inferInventoryCategory('Offer_Letter.pdf', 'Uncategorized')).toBe('Offer Letters');
  });

  test('resolves specific event titles and avoids generic labels', () => {
    expect(
      resolveChronologyEventTitle(
        { date: '', title: 'Workplace complaint materials', category: 'Workplace Communications', summary: 'Complaint_To_HR.pdf grievance' },
        1
      )
    ).toBe('Complaint submitted to Human Resources');

    expect(
      resolveChronologyEventTitle(
        { date: '', title: 'Witness statement materials', category: 'Uncategorized', summary: 'Witness_Statement_A' },
        2
      )
    ).toBe('Witness statement provided');

    expect(
      resolveChronologyEventTitle(
        { date: '', title: 'Random workplace materials', category: 'Pay Records', summary: '' },
        3
      )
    ).not.toBe('Event documented in uploaded records');
  });

  test('uses neutral intelligence fallbacks instead of legacy category labels', () => {
    expect(
      resolveChronologyEventTitle(
        { date: '', title: 'Payroll period documented', category: 'Pay Records', summary: '' },
        2
      )
    ).toBe('Employment activity documented through payroll records');
    expect(
      resolveChronologyEventTitle(
        { date: '', title: 'HR record documented', category: 'HR Documents', summary: '' },
        3
      )
    ).toBe('Human Resources communication documented');
    expect(
      resolveChronologyEventTitle(
        { date: '', title: 'Workplace record documented', category: 'Uncategorized', summary: '' },
        4
      )
    ).toBe('Workplace concern documented');
  });

  test('preserves concrete event-first titles before packet fallback rules run', () => {
    expect(
      resolveChronologyEventTitle(
        {
          date: 'April 2025',
          title: 'Worker raises safety concerns',
          category: 'Workplace Communications',
          summary: 'References: Safety_Concern_Email.pdf',
        },
        1
      )
    ).toBe('Worker raises safety concerns');
  });

  test('adds high-confidence HR person names when already present in event text', () => {
    expect(
      resolveChronologyEventTitle(
        {
          date: '',
          title: 'Workplace complaint materials',
          category: 'Workplace Communications',
          summary: 'Complaint submitted to HR. Ashley Kim (Human Resources Representative) received the email.',
        },
        1
      )
    ).toBe('Complaint submitted to Human Resources (Ashley Kim)');
  });

  test('employment begins excludes unrelated supporting records', () => {
    const prepared = prepareChronologyPresentationEvent(
      {
        date: 'March 2021',
        title: 'Offer letter materials',
        category: 'Offer Letters',
        summary: 'References: Offer_Letter.pdf',
      },
      0,
      INVENTORY,
      { employmentStartDate: 'March 2021' }
    );
    expect(prepared.title).toBe('Employment begins');
    expect(prepared.supportingUploads.some((n) => /offer/i.test(n))).toBe(true);
    expect(prepared.supportingUploads.some((n) => /witness|complaint|warning|project|paystub|payroll/i.test(n))).toBe(
      false
    );
  });

  test('employment ends excludes payroll and handbook records', () => {
    const picks = pickSupportingRecordsForEvent(
      'Employment ends',
      {
        date: 'January 2026',
        title: 'Separation notice materials',
        category: 'HR Documents',
        summary: 'References: Termination_Letter.pdf',
      },
      INVENTORY
    );
    expect(picks.some((n) => /termin/i.test(n))).toBe(true);
    expect(picks.some((n) => /paystub|handbook/i.test(n))).toBe(false);
  });

  test('derives dates from referenced filenames when raw date is unclear', () => {
    const date = resolveChronologyEventDate(
      'Date unclear — review source document',
      'Payroll record',
      ['paystub_march_2024.pdf']
    );
    expect(date).toMatch(/2024|March/i);
  });

  test('keeps uncertain date language when no confident date exists', () => {
    expect(
      resolveChronologyEventDate('Date unclear — review source document', 'HR complaint correspondence.', [])
    ).toBe('Date not yet clear');
  });
  test('derives dates from source trace month-year anchors when raw date is unclear', () => {
    const prepared = prepareChronologyPresentationEvent(
      {
        date: 'Date unclear',
        title: 'Pay period record materials',
        category: 'Pay Records',
        summary: 'Payroll record.',
        sourceDates: ['March 2024'],
      },
      0,
      INVENTORY
    );

    expect(prepared.date).toBe('March 2024');
  });
});
