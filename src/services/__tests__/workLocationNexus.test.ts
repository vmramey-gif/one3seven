import { describe, it, expect } from 'vitest';
import { assessWorkLocationNexus } from '../workLocationNexus';

describe('assessWorkLocationNexus', () => {
  it('flags cross-state when work is in CA but employer is elsewhere', () => {
    const r = assessWorkLocationNexus({ workState: 'California', employerState: 'Texas' });
    expect(r.crossState).toBe(true);
    expect(r.workState).toBe('CA');
    expect(r.employerState).toBe('TX');
    expect(r.note).toContain('CA');
    expect(r.note).toContain('TX');
  });

  it('normalizes 2-letter codes and full names to the same result', () => {
    const a = assessWorkLocationNexus({ workState: 'ca', employerState: 'fl' });
    const b = assessWorkLocationNexus({ workState: 'California', employerState: 'Florida' });
    expect(a.crossState).toBe(true);
    expect(a).toEqual(b);
  });

  it('no cross-state flag when both states are the same', () => {
    const r = assessWorkLocationNexus({ workState: 'CA', employerState: 'California' });
    expect(r.crossState).toBe(false);
    expect(r.note).toBeNull();
  });

  it('does nothing when either state is missing', () => {
    expect(assessWorkLocationNexus({ workState: 'CA' }).crossState).toBe(false);
    expect(assessWorkLocationNexus({ employerState: 'TX' }).crossState).toBe(false);
    expect(assessWorkLocationNexus({}).crossState).toBe(false);
  });

  it('never concludes — the note states two facts and no legal consequence', () => {
    const r = assessWorkLocationNexus({ workState: 'CA', employerState: 'TX' });
    expect(r.note).not.toMatch(/law applies|covered|owed|entitled|violat|must comply|§/i);
  });

  it('preserves unrecognized state strings without crashing', () => {
    const r = assessWorkLocationNexus({ workState: 'Guam', employerState: 'CA' });
    expect(r.crossState).toBe(true);
    expect(r.workState).toBe('Guam');
  });
});
