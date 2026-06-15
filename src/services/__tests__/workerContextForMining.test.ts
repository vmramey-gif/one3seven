import { describe, expect, test } from 'vitest';
import { buildWorkerContextForMining } from '../intakeDataService';

describe('buildWorkerContextForMining', () => {
  test('returns preserved worker notes when metadata is empty', () => {
    const notes = '--- O3S_GUIDED ---\nPrior guided context\n--- O3S_GUIDED_END ---';
    expect(buildWorkerContextForMining(notes, null)).toBe(notes);
  });

  test('combines metadata workerStory and Story Details on first organize', () => {
    const out = buildWorkerContextForMining('', {
      workerStory:
        'I complained to HR in April 2024. My manager Sarah Johnson became hostile afterward.',
      storyFollowUp: {
        employmentName: '',
        employer: 'Acme Corp',
        employmentDates: '2022–2024',
        keyPeople: 'Manager: Sarah Johnson; HR: Michael Chen',
        workedRemotely: '',
        remoteExpenses: '',
        reimbursed: '',
        complainedOrReported:
          'I complained to HR in April 2024. HR rep Michael Chen received my complaint.',
        changedAfterward: 'Written warning in August 2024; terminated November 2024.',
      },
    });

    expect(out).toContain('Sarah Johnson');
    expect(out).toContain('Michael Chen');
    expect(out).toContain('complained to HR in April 2024');
    expect(out).toContain('Key people involved:');
    expect(out).toContain('Complaints/reports:');
  });

  test('does not duplicate workerStory already present in preserved notes', () => {
    const story = 'Worker narrative about termination in November 2024.';
    const notes = `--- O3S_WORKER_STORY ---\n${story}\n--- O3S_WORKER_STORY_END ---`;
    const out = buildWorkerContextForMining(notes, { workerStory: story });
    expect(out).toBe(notes);
  });

  test('falls back to preserved notes when metadata is malformed', () => {
    const notes = 'Existing notes block';
    expect(buildWorkerContextForMining(notes, 'not-an-object')).toBe(notes);
  });

  test('returns empty string when no worker context exists', () => {
    expect(buildWorkerContextForMining('', null)).toBe('');
    expect(buildWorkerContextForMining(undefined, undefined)).toBe('');
  });
});
