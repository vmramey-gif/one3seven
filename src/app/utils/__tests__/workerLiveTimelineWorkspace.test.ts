import { describe, expect, test } from 'vitest';
import type { WorkerTimelineItem } from '../../types/workerTimeline';
import { WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED } from '../../constants/one3sevenProduct';
import { buildWorkerLiveTimelineMoments } from '../workerLiveTimelineWorkspace';

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

describe('workerLiveTimelineWorkspace', () => {
  test('merges workflow status with timeline events without duplicating doc requests', () => {
    const moments = buildWorkerLiveTimelineMoments({
      events: [
        event({
          timelineEventId: 'e1',
          event: 'Pay period record materials',
          sourceFileNames: ['Payroll.pdf'],
        }),
      ],
      recordCount: 3,
      eventCount: 1,
      workflow: WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED,
      firmName: 'Smith Law',
      docRequestPending: true,
    });

    const docTitles = moments.filter((m) => m.title === 'Additional documents requested');
    expect(docTitles).toHaveLength(1);
    expect(moments.some((m) => m.title === 'Regular payroll activity')).toBe(true);
  });

  test('surfaces access approval as an action moment', () => {
    const moments = buildWorkerLiveTimelineMoments({
      events: [],
      recordCount: 2,
      eventCount: 0,
      workflow: 'Awaiting Worker Approval',
      firmName: 'River & Co.',
      accessApprovalPending: true,
    });

    expect(moments[0]?.title).toBe('Firm requested access');
    expect(moments[0]?.markerKind).toBe('action');
  });

  test('falls back to records uploaded when no events exist', () => {
    const moments = buildWorkerLiveTimelineMoments({
      events: [],
      recordCount: 5,
      eventCount: 0,
    });

    expect(moments).toHaveLength(1);
    expect(moments[0]?.title).toBe('Records uploaded');
    expect(moments[0]?.sourceCount).toBe(5);
  });
});
