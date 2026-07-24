import { describe, it, expect } from 'vitest';
import {
  assessEmployerRecordCoverage,
  CA_EMPLOYER_RECORD_REQUIREMENTS,
} from '../caEmployerRecordRequirements';

describe('assessEmployerRecordCoverage', () => {
  it('marks a requirement on_file when a matching document is present', () => {
    const r = assessEmployerRecordCoverage([
      { fileName: 'PayStub_Oct2025.pdf', category: 'Wage Records' },
    ]);
    const wage = r.items.find((i) => i.key === 'wage_statements');
    expect(wage?.state).toBe('on_file');
    expect(r.onFileCount).toBeGreaterThanOrEqual(1);
  });

  it('matches across underscore/hyphen/dot separators in filenames', () => {
    const r = assessEmployerRecordCoverage([
      { fileName: 'Final_Paycheck.pdf', category: '' },
      { fileName: 'offer-letter-2022.pdf', category: '' },
    ]);
    expect(r.items.find((i) => i.key === 'final_pay')?.state).toBe('on_file');
    expect(r.items.find((i) => i.key === 'offer_or_agreement')?.state).toBe('on_file');
  });

  it('matches on category alone when the filename is opaque', () => {
    const r = assessEmployerRecordCoverage([{ fileName: 'IMG_4821.jpg', category: 'Time Records' }]);
    expect(r.items.find((i) => i.key === 'time_records')?.state).toBe('on_file');
  });

  it('defaults an absent requirement to not_in_record (never "violated")', () => {
    const r = assessEmployerRecordCoverage([{ fileName: 'PayStub.pdf', category: 'Wage Records' }]);
    const personnel = r.items.find((i) => i.key === 'personnel_file');
    expect(personnel?.state).toBe('not_in_record');
    expect(personnel?.describeMissing).toMatch(/not in your file/i);
    expect(personnel?.describeMissing).not.toMatch(/violat|illegal|broke the law/i);
  });

  it('honors worker-stated missing as its own state, distinct from not_in_record', () => {
    const r = assessEmployerRecordCoverage([], { workerStatedMissingKeys: ['wtpa_notice'] });
    expect(r.items.find((i) => i.key === 'wtpa_notice')?.state).toBe('worker_stated_missing');
    expect(r.items.find((i) => i.key === 'personnel_file')?.state).toBe('not_in_record');
  });

  it('drops separation-only items for a still-employed worker', () => {
    const still = assessEmployerRecordCoverage([], { stillEmployed: true });
    expect(still.items.find((i) => i.key === 'final_pay')).toBeUndefined();
    const ended = assessEmployerRecordCoverage([]);
    expect(ended.items.find((i) => i.key === 'final_pay')).toBeDefined();
  });

  it('produces the attorney discovery list (the flip side of the gaps)', () => {
    const r = assessEmployerRecordCoverage([
      { fileName: 'PayStub.pdf', category: 'Wage Records' },
    ]);
    // everything absent + worker-obtainable becomes a "to obtain" item
    expect(r.toObtain.length).toBeGreaterThan(0);
    expect(r.toObtain.every((i) => i.state !== 'on_file' && i.workerObtainable)).toBe(true);
    // the present wage statement is NOT in the to-obtain list
    expect(r.toObtain.find((i) => i.key === 'wage_statements')).toBeUndefined();
  });

  it('empty folder → nothing on file, full discovery list (the document-poor worker)', () => {
    const r = assessEmployerRecordCoverage([]);
    expect(r.onFileCount).toBe(0);
    expect(r.toObtain.length).toBe(r.items.filter((i) => i.workerObtainable).length);
  });

  it('never emits accusatory language in any requirement', () => {
    for (const req of CA_EMPLOYER_RECORD_REQUIREMENTS) {
      expect(req.describeMissing).not.toMatch(/violat|illegal|broke the law|unlawful|failed to comply/i);
      expect(req.citation).toMatch(/Labor Code|Gov\. Code|§/);
    }
  });
});
