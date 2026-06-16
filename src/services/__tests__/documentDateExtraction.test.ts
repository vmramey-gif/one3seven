import { describe, expect, test } from 'vitest';
import { MAX_DOCUMENT_DATES, normalizeDocumentDates } from '../documentDateExtraction';

describe('normalizeDocumentDates (Phase 2b multi-date capture)', () => {
  test('keeps well-formed dated entries with their context labels', () => {
    const out = normalizeDocumentDates([
      { date: 'March 4, 2025', context: 'complaint filed' },
      { date: 'December 7, 2025', context: 'warning issued' },
    ]);
    expect(out).toEqual([
      { date: 'March 4, 2025', context: 'complaint filed' },
      { date: 'December 7, 2025', context: 'warning issued' },
    ]);
  });

  test('returns [] for non-array input', () => {
    expect(normalizeDocumentDates(null)).toEqual([]);
    expect(normalizeDocumentDates(undefined)).toEqual([]);
    expect(normalizeDocumentDates('March 2025')).toEqual([]);
    expect(normalizeDocumentDates({ date: 'March 2025' })).toEqual([]);
  });

  test('drops entries without an explicit date and skips non-objects', () => {
    const out = normalizeDocumentDates([
      { date: '', context: 'no date' },
      { context: 'missing date field' },
      'October 2024',
      null,
      { date: '  January 10, 2026  ', context: 'termination' },
    ]);
    expect(out).toEqual([{ date: 'January 10, 2026', context: 'termination' }]);
  });

  test('scrubs conclusory context labels but retains the date (organize, never conclude)', () => {
    const out = normalizeDocumentDates([
      { date: 'January 10, 2026', context: 'wrongful termination occurred' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('January 10, 2026');
    expect(out[0].context).not.toMatch(/wrongful termination/i);
  });

  test('dedupes identical date+context pairs', () => {
    const out = normalizeDocumentDates([
      { date: 'March 4, 2025', context: 'complaint filed' },
      { date: 'March 4, 2025', context: 'complaint filed' },
    ]);
    expect(out).toHaveLength(1);
  });

  test('caps the number of dates returned', () => {
    const many = Array.from({ length: MAX_DOCUMENT_DATES + 5 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      context: `event ${i}`,
    }));
    expect(normalizeDocumentDates(many)).toHaveLength(MAX_DOCUMENT_DATES);
  });
});
