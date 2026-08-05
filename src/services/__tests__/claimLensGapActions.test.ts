import { describe, it, expect } from 'vitest';
import {
  suggestedRecordType,
  cartRecordTypes,
  buildWorkerGatherList,
  buildFirmWorklist,
  buildCartOutput,
  type GapItem,
} from '../claimLensGapActions';
import { scanBannedVocabulary } from '../bannedVocabulary';

const gaps: GapItem[] = [
  { key: 'Wage statements on file', element: 'Wage statements on file', note: 'no material on file' },
  { key: 'Time records for the period', element: 'Time records for the period', note: 'no material on file' },
  { key: 'Employer awareness material', element: 'Employer awareness material', note: 'no material on file' },
];

describe('suggestedRecordType', () => {
  it('maps wage/time/signed/personnel elements to the right record type', () => {
    expect(suggestedRecordType('Wage statements on file')).toBe('pay_records');
    expect(suggestedRecordType('Time records for the period')).toBe('time_records');
    expect(suggestedRecordType('Signed arbitration agreement')).toBe('signed_documents');
    expect(suggestedRecordType('Written warning in personnel file')).toBe('personnel_file');
  });

  it('returns null when nothing corresponds (never a wrong type)', () => {
    expect(suggestedRecordType('Employer awareness material')).toBeNull();
    expect(suggestedRecordType('Causal sequence and interval')).toBeNull();
  });
});

describe('cartRecordTypes', () => {
  it('collects the distinct mapped types in a stable order', () => {
    expect(cartRecordTypes(gaps)).toEqual(['pay_records', 'time_records']);
  });
});

describe('buildWorkerGatherList (prospect)', () => {
  it('frames gaps as the worker gathering their OWN records, with a request-type per mapped gap', () => {
    const out = buildWorkerGatherList(gaps);
    expect(out).toMatch(/your own employment records/i);
    expect(out).toMatch(/request your pay records/i);
    expect(out).toMatch(/request your time records/i);
    // unmapped gap still lists, without a wrong record type
    expect(out).toMatch(/• Employer awareness material$/m);
    expect(out).not.toMatch(/Employer awareness material — request/);
  });

  it('is empty for no gaps', () => {
    expect(buildWorkerGatherList([])).toBe('');
  });
});

describe('buildFirmWorklist (client)', () => {
  it('is a discovery worklist carrying the theory, gated on representation', () => {
    const out = buildFirmWorklist(gaps, 'Labor Code §226 — Wage Statements');
    expect(out).toMatch(/Follow-up worklist — Labor Code §226/);
    expect(out).toMatch(/no material on file/i);
    expect(out).toMatch(/Confirm the client is represented/i);
  });
});

describe('buildCartOutput', () => {
  it('switches output by client status', () => {
    expect(buildCartOutput(gaps, 'prospect', 'X')).toMatch(/your own employment records/i);
    expect(buildCartOutput(gaps, 'client', 'X')).toMatch(/Follow-up worklist/);
  });
});

describe('doctrine — outputs draw no conclusion', () => {
  it('neither output contains banned conclusion vocabulary', () => {
    for (const status of ['prospect', 'client'] as const) {
      const out = buildCartOutput(gaps, status, 'Labor Code §226 — Wage Statements');
      expect(scanBannedVocabulary(out), `${status} output`).toEqual([]);
    }
  });
});
