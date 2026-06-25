import { describe, it, expect } from 'vitest';
import { scoreExtraction } from '../extractionEval';

describe('scoreExtraction', () => {
  it('scores a perfect match as full accuracy', () => {
    const exp = { employer_name: 'Acme Logistics', document_date: '2025-03-14', people_mentioned: ['Dana Kimura', 'Rob Pacheco'] };
    const r = scoreExtraction(exp, { ...exp });
    expect(r.score).toBe(3);
    expect(r.total).toBe(3);
    expect(r.accuracy).toBe(1);
  });

  it('normalizes case/whitespace and compares arrays as sets', () => {
    const r = scoreExtraction(
      { employer_name: 'Acme Logistics', people_mentioned: ['Dana Kimura', 'Rob Pacheco'] },
      { employer_name: '  acme logistics ', people_mentioned: ['Rob Pacheco', 'Dana Kimura'] },
    );
    expect(r.accuracy).toBe(1);
  });

  it('counts partial matches and reports per-field results', () => {
    const r = scoreExtraction(
      { employer_name: 'Acme Logistics', document_date: '2025-03-14', stated_reason: null },
      { employer_name: 'Acme Logistics', document_date: '2025-01-01', stated_reason: null },
    );
    expect(r.score).toBe(2);
    expect(r.total).toBe(3);
    expect(r.fields.find((f) => f.field === 'document_date')?.match).toBe(false);
  });

  it('treats null === null as a match', () => {
    expect(scoreExtraction({ employer_name: null }, { employer_name: null }).accuracy).toBe(1);
    expect(scoreExtraction({ employer_name: null }, { employer_name: 'Acme' }).accuracy).toBe(0);
  });
});
