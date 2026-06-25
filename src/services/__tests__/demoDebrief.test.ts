import { describe, it, expect } from 'vitest';
import { toDebriefRow, summarizeSearchSignal, type DemoDebriefInput } from '../demoDebriefService';

const base: DemoDebriefInput = {
  firmName: '  Ramirez Employment Law  ',
  prospectName: '',
  painPhrase: 'My paralegal spends two hours sorting before I even look',
  leanInMoment: 'timeline',
  fellFlat: '',
  objections: '',
  featureRequest: 'wants to search across the record',
  askedForSearch: true,
  outcome: 'maybe',
  nextStep: 'send pilot link',
  nextStepDate: '2026-07-01',
  improvement: '',
};

describe('toDebriefRow', () => {
  it('trims the firm name and maps fields to the row shape', () => {
    const row = toDebriefRow(base);
    expect(row.firm_name).toBe('Ramirez Employment Law');
    expect(row.lean_in_moment).toBe('timeline');
    expect(row.asked_for_search).toBe(true);
    expect(row.outcome).toBe('maybe');
    expect(row.next_step_date).toBe('2026-07-01');
  });

  it('converts empty strings to null (so optional columns stay clean)', () => {
    const row = toDebriefRow(base);
    expect(row.prospect_name).toBeNull();
    expect(row.fell_flat).toBeNull();
    expect(row.objections).toBeNull();
    expect(row.improvement).toBeNull();
  });

  it('preserves a false search signal and null single-selects', () => {
    const row = toDebriefRow({ ...base, askedForSearch: false, leanInMoment: null, outcome: null });
    expect(row.asked_for_search).toBe(false);
    expect(row.lean_in_moment).toBeNull();
    expect(row.outcome).toBeNull();
  });
});

describe('summarizeSearchSignal', () => {
  it('counts how many demos asked to search the record', () => {
    const rows = [
      { asked_for_search: true },
      { asked_for_search: false },
      { asked_for_search: true },
    ];
    expect(summarizeSearchSignal(rows)).toEqual({ asked: 2, total: 3 });
  });

  it('handles an empty set', () => {
    expect(summarizeSearchSignal([])).toEqual({ asked: 0, total: 0 });
  });
});
