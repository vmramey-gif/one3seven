import { describe, it, expect } from 'vitest';
import {
  extractReminders,
  buildRemindersBlock,
  stripRemindersBlock,
  mergeRemindersIntoOverview,
  type WorkerReminder,
} from '../workerReminders';

const reminders: WorkerReminder[] = [
  { id: '1', text: 'Upload my pay records', source: 'worker', done: false, createdAt: '2026-07-27T10:00:00Z' },
  { id: '2', text: 'Expert examination appointment', dueDate: '2026-08-12', source: 'firm', done: false, createdAt: '2026-07-27T10:01:00Z' },
];

describe('workerReminders', () => {
  it('round-trips reminders through the O3S block', () => {
    const overview = mergeRemindersIntoOverview('Worker story here.', reminders);
    expect(overview).toContain('--- O3S_WORKER_REMINDERS ---');
    expect(extractReminders(overview)).toEqual(reminders);
  });

  it('strips the block from prose (so it never leaks to a firm surface)', () => {
    const overview = mergeRemindersIntoOverview('Worker story here.', reminders);
    const stripped = stripRemindersBlock(overview);
    expect(stripped).not.toContain('O3S_WORKER_REMINDERS');
    expect(stripped).toContain('Worker story here.');
  });

  it('preserves who set each reminder (worker vs firm-authored)', () => {
    const out = extractReminders(mergeRemindersIntoOverview('', reminders));
    expect(out.find((r) => r.id === '1')?.source).toBe('worker');
    expect(out.find((r) => r.id === '2')?.source).toBe('firm');
  });

  it('DOCTRINE: a reminder carries no computed-deadline / adequacy field — dates are plain values only', () => {
    // The persisted shape must never gain a field 137 computes (e.g. daysLeft, statuteDeadline,
    // isLate, adequacy). dueDate, when present, is a plain string the worker typed or a firm set.
    const roundTripped = extractReminders(buildRemindersBlock(reminders));
    for (const r of roundTripped) {
      const keys = Object.keys(r);
      expect(keys).not.toContain('daysLeft');
      expect(keys).not.toContain('statuteDeadline');
      expect(keys).not.toContain('isLate');
      expect(keys).not.toContain('adequacy');
      if (r.dueDate !== undefined) expect(typeof r.dueDate).toBe('string');
    }
  });

  it('empty list produces no block', () => {
    expect(buildRemindersBlock([])).toBe('');
  });
});
