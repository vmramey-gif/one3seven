import { describe, it, expect } from 'vitest';
import {
  extractRecordsRequests,
  buildRecordsRequestBlock,
  stripRecordsRequestBlock,
  mergeRecordsRequestsIntoOverview,
  type RecordsRequestEntry,
} from '../recordsRequest';
import { stripFirmFacingArtifacts } from '../firmIntakeDisplay';

const entry = (over: Partial<RecordsRequestEntry> = {}): RecordsRequestEntry => ({
  id: 'r1',
  recordTypes: ['personnel_file', 'pay_records'],
  recipient: 'hr@acme.com',
  sentAt: '2026-07-26T10:00:00.000Z',
  ...over,
});

describe('recordsRequest', () => {
  it('round-trips entries (with sent + received timestamps) through the overview block', () => {
    const entries = [entry(), entry({ id: 'r2', recipient: 'hr@bright.com', responseReceivedAt: '2026-08-10T09:00:00.000Z' })];
    const overview = mergeRecordsRequestsIntoOverview('Worker story.', entries);
    const back = extractRecordsRequests(overview);
    expect(back).toEqual(entries);
    expect(back[1].responseReceivedAt).toBe('2026-08-10T09:00:00.000Z');
  });

  it('replaces (does not duplicate) the block on re-merge', () => {
    const one = mergeRecordsRequestsIntoOverview('base', [entry()]);
    const two = mergeRecordsRequestsIntoOverview(one, [entry(), entry({ id: 'r2' })]);
    expect((two.match(/O3S_RECORDS_REQUEST_LOG ---/g) ?? []).length).toBe(1);
    expect(extractRecordsRequests(two)).toHaveLength(2);
  });

  it('strips the block cleanly, preserving surrounding prose', () => {
    const overview = mergeRecordsRequestsIntoOverview('Keep this.', [entry()]);
    expect(stripRecordsRequestBlock(overview).trim()).toBe('Keep this.');
  });

  it('drops entries with an unknown record type', () => {
    const bad = `--- O3S_RECORDS_REQUEST_LOG ---\n${JSON.stringify([{ ...entry(), recordTypes: ['bank_statements'] }])}\n--- O3S_RECORDS_REQUEST_LOG_END ---`;
    expect(extractRecordsRequests(bad)).toEqual([]);
  });

  it('ignores malformed content without throwing', () => {
    expect(extractRecordsRequests('--- O3S_RECORDS_REQUEST_LOG ---\nnope\n--- O3S_RECORDS_REQUEST_LOG_END ---')).toEqual([]);
    expect(extractRecordsRequests(null)).toEqual([]);
  });

  it('DOCTRINE: entry carries no legal-conclusion / status-judgment fields — only what/who/when', () => {
    const keys = Object.keys(entry({ responseReceivedAt: 'x' })).sort();
    expect(keys).toEqual(['id', 'recipient', 'recordTypes', 'responseReceivedAt', 'sentAt']);
  });

  it('the stored block never leaks into firm-facing prose', () => {
    const overview = mergeRecordsRequestsIntoOverview('Firm reads this.', [entry({ recipient: 'secret@hr.com' })]);
    const firmFacing = stripFirmFacingArtifacts(overview);
    expect(firmFacing).not.toMatch(/secret@hr\.com|O3S_RECORDS_REQUEST/);
    expect(firmFacing).toMatch(/Firm reads this\./);
  });

  it('empty entries produce no block', () => {
    expect(buildRecordsRequestBlock([])).toBe('');
    expect(mergeRecordsRequestsIntoOverview('just story', [])).toBe('just story');
  });
});
