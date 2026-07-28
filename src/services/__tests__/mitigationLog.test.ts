import { describe, it, expect } from 'vitest';
import {
  extractMitigationLog,
  buildMitigationLogBlock,
  stripMitigationLogBlock,
  mergeMitigationLogIntoOverview,
  type MitigationLogEntry,
} from '../mitigationLog';
import { stripFirmFacingArtifacts } from '../firmIntakeDisplay';

const entry = (over: Partial<MitigationLogEntry> = {}): MitigationLogEntry => ({
  id: 'a1',
  date: '2026-07-20',
  employer: 'Acme Foods',
  role: 'Warehouse associate',
  outcome: 'applied',
  loggedAt: '2026-07-26T10:00:00.000Z',
  ...over,
});

describe('mitigationLog', () => {
  it('round-trips entries through the overview block', () => {
    const entries = [entry(), entry({ id: 'a2', employer: 'Bright Logistics', outcome: 'interview' })];
    const overview = mergeMitigationLogIntoOverview('Worker story here.', entries);
    expect(extractMitigationLog(overview)).toEqual(entries);
  });

  it('replaces (does not duplicate) the block on re-merge', () => {
    const one = mergeMitigationLogIntoOverview('base', [entry()]);
    const two = mergeMitigationLogIntoOverview(one, [entry(), entry({ id: 'a2' })]);
    expect((two.match(/O3S_MITIGATION_LOG ---/g) ?? []).length).toBe(1);
    expect(extractMitigationLog(two)).toHaveLength(2);
  });

  it('strips the block back out cleanly, preserving surrounding prose', () => {
    const overview = mergeMitigationLogIntoOverview('Keep this story.', [entry()]);
    expect(stripMitigationLogBlock(overview).trim()).toBe('Keep this story.');
  });

  it('ignores malformed / non-array block content without throwing', () => {
    expect(extractMitigationLog('--- O3S_MITIGATION_LOG ---\nnot json\n--- O3S_MITIGATION_LOG_END ---')).toEqual([]);
    expect(extractMitigationLog(null)).toEqual([]);
    expect(extractMitigationLog('no block at all')).toEqual([]);
  });

  it('drops entries with an invalid outcome (defends the factual-status enum)', () => {
    const bad = `--- O3S_MITIGATION_LOG ---\n${JSON.stringify([{ ...entry(), outcome: 'strong_case' }])}\n--- O3S_MITIGATION_LOG_END ---`;
    expect(extractMitigationLog(bad)).toEqual([]);
  });

  it('DOCTRINE: the entry shape carries no score/adequacy/target field', () => {
    const keys = Object.keys(entry({ notes: 'x' }));
    // Only these fields exist — nothing that scores the worker or the search.
    expect(keys.sort()).toEqual(['date', 'employer', 'id', 'loggedAt', 'notes', 'outcome', 'role']);
    for (const k of keys) {
      expect(/score|adequa|target|goal|enough|rating|rank/i.test(k)).toBe(false);
    }
  });

  it('the stored block never leaks into firm-facing prose (generic O3S stripper removes it)', () => {
    const overview = mergeMitigationLogIntoOverview('Firm reads this.', [entry({ employer: 'SecretCo' })]);
    const firmFacing = stripFirmFacingArtifacts(overview);
    expect(firmFacing).not.toMatch(/SecretCo|O3S_MITIGATION_LOG/);
    expect(firmFacing).toMatch(/Firm reads this\./);
  });

  it('empty entries produce no block', () => {
    expect(buildMitigationLogBlock([])).toBe('');
    expect(mergeMitigationLogIntoOverview('just story', [])).toBe('just story');
  });
});
