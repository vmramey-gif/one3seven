import { describe, expect, test } from 'vitest';
import type { WorkerTimelineItem } from '../../types/workerTimeline';
import {
  presentWorkerTimelineRow,
  presentWorkerTimelineStorySummary,
  presentWorkerTimelineStoryTitle,
} from '../workerTimelineNarrative';

function event(partial: Partial<WorkerTimelineItem>): WorkerTimelineItem {
  return {
    date: 'March 4, 2025',
    event: '',
    category: '',
    summary: '',
    relatedDocs: 0,
    ...partial,
  };
}

describe('workerTimelineNarrative', () => {
  test('maps document-category titles to story moments', () => {
    expect(presentWorkerTimelineStoryTitle(event({ event: 'Pay period record materials' }))).toBe(
      'Regular payroll activity'
    );
    expect(
      presentWorkerTimelineStoryTitle(event({ event: 'Scheduling and timekeeping materials' }))
    ).toBe('Schedule changes begin');
    expect(presentWorkerTimelineStoryTitle(event({ event: 'Policy or handbook materials' }))).toBe(
      'Policy acknowledgment'
    );
    expect(presentWorkerTimelineStoryTitle(event({ event: 'Workplace complaint materials' }))).toBe(
      'Complaint raised to management'
    );
    expect(presentWorkerTimelineStoryTitle(event({ event: 'Separation notice materials' }))).toBe(
      'Employment separation'
    );
  });

  test('preserves already human titles', () => {
    expect(presentWorkerTimelineStoryTitle(event({ event: 'Complaint raised to management' }))).toBe(
      'Complaint raised to management'
    );
  });

  test('summary is one sentence without filenames', () => {
    const row = presentWorkerTimelineRow(
      event({
        event: 'Pay period record materials',
        summary:
          'Uploaded records show pay period record materials in this part of the sequence. Available records show supporting uploads include paystub_march.pdf, hours.pdf.',
        sourceFileNames: ['paystub_march.pdf', 'hours.pdf'],
        relatedDocs: 2,
      })
    );

    expect(row.title).toBe('Regular payroll activity');
    expect(row.summary).toBe('Pay records were found for this period.');
    expect(row.summary).not.toMatch(/\.pdf/i);
    expect(row.sourceCount).toBe(2);
  });

  test('uses softened summary when it is already narrative', () => {
    const summary = presentWorkerTimelineStorySummary(
      event({
        event: 'Performance review issued',
        summary: 'A formal review was documented after prior scheduling concerns.',
      }),
      'Performance review issued'
    );
    expect(summary).toBe('A formal review was documented after prior scheduling concerns.');
  });
});
