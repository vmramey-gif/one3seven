import { describe, it, expect } from 'vitest';
import {
  extractReminders,
  buildRemindersBlock,
  stripRemindersBlock,
  mergeRemindersIntoOverview,
  buildRemindersIcs,
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

describe('buildRemindersIcs', () => {
  it('includes only open reminders that have a dueDate', () => {
    const mixed: WorkerReminder[] = [
      { id: '1', text: 'No date', source: 'worker', done: false, createdAt: '2026-07-27T10:00:00Z' },
      { id: '2', text: 'Dated but done', dueDate: '2026-08-12', source: 'worker', done: true, createdAt: '2026-07-27T10:00:00Z' },
      { id: '3', text: 'Open and dated', dueDate: '2026-08-20', source: 'firm', done: false, createdAt: '2026-07-27T10:00:00Z' },
    ];
    const ics = buildRemindersIcs(mixed);
    expect(ics).not.toContain('No date');
    expect(ics).not.toContain('Dated but done');
    expect(ics).toContain('Open and dated');
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  });

  it('DOCTRINE: exports the date exactly as typed — never a computed value', () => {
    const r: WorkerReminder = { id: '1', text: 'Send signed forms', dueDate: '2026-09-03', source: 'worker', done: false, createdAt: '2026-07-27T10:00:00Z' };
    const ics = buildRemindersIcs([r]);
    // 2026-09-03 -> 20260903, a direct re-format of the typed string, not a calculation.
    expect(ics).toContain('DTSTART;VALUE=DATE:20260903');
  });

  it('escapes commas, semicolons, and backslashes in the reminder text', () => {
    const r: WorkerReminder = { id: '1', text: 'Call HR; bring pay stubs, W-2s, and notes', source: 'worker', dueDate: '2026-08-15', done: false, createdAt: '2026-07-27T10:00:00Z' };
    const ics = buildRemindersIcs([r]);
    expect(ics).toContain('Call HR\\; bring pay stubs\\, W-2s\\, and notes');
  });

  it('labels firm-authored reminders distinctly from worker-authored ones', () => {
    const firm: WorkerReminder = { id: '1', text: 'Send additional documents', dueDate: '2026-08-15', source: 'firm', done: false, createdAt: '2026-07-27T10:00:00Z' };
    const worker: WorkerReminder = { id: '2', text: 'Upload pay stubs', dueDate: '2026-08-16', source: 'worker', done: false, createdAt: '2026-07-27T10:00:00Z' };
    const ics = buildRemindersIcs([firm, worker]);
    expect(ics).toContain('DESCRIPTION:Added by your firm via one3seven');
    expect(ics).toContain('DESCRIPTION:Added by you via one3seven');
  });

  it('produces a valid empty calendar when nothing qualifies', () => {
    const ics = buildRemindersIcs([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
