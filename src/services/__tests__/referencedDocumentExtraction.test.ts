import { describe, expect, test } from 'vitest';
import {
  MAX_REFERENCED_DOCUMENTS,
  normalizeReferencedDocuments,
} from '../referencedDocumentExtraction';

describe('normalizeReferencedDocuments (Phase 2b referenced-docs)', () => {
  test('keeps well-formed reference strings', () => {
    const out = normalizeReferencedDocuments([
      'performance improvement plan',
      'offer letter dated March 2021',
    ]);
    expect(out).toEqual(['performance improvement plan', 'offer letter dated March 2021']);
  });

  test('returns [] for non-array input', () => {
    expect(normalizeReferencedDocuments(null)).toEqual([]);
    expect(normalizeReferencedDocuments(undefined)).toEqual([]);
    expect(normalizeReferencedDocuments('offer letter')).toEqual([]);
  });

  test('drops non-strings, blanks, and overlong entries', () => {
    const out = normalizeReferencedDocuments([
      '  the attached schedule  ',
      '',
      42,
      null,
      'x'.repeat(201),
    ]);
    expect(out).toEqual(['the attached schedule']);
  });

  test('scrubs conclusory wording from a reference (organize, never conclude)', () => {
    const out = normalizeReferencedDocuments(['the illegal termination memo']);
    expect(out).toHaveLength(1);
    expect(out[0]).not.toMatch(/\billegal\b/i);
  });

  test('dedupes case-insensitively', () => {
    const out = normalizeReferencedDocuments(['Offer Letter', 'offer letter']);
    expect(out).toHaveLength(1);
  });

  test('caps the number of references returned', () => {
    const many = Array.from({ length: MAX_REFERENCED_DOCUMENTS + 4 }, (_, i) => `document ${i}`);
    expect(normalizeReferencedDocuments(many)).toHaveLength(MAX_REFERENCED_DOCUMENTS);
  });
});
