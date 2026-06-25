import { describe, it, expect } from 'vitest';
import { scanBannedVocabulary, containsBannedVocabulary } from '../bannedVocabulary';

describe('bannedVocabulary', () => {
  it('flags legal-conclusion and outcome-promise language', () => {
    expect(containsBannedVocabulary('This is a clear violation of the law')).toBe(true);
    expect(containsBannedVocabulary('You have a strong case here')).toBe(true);
    expect(containsBannedVocabulary('They owed you overtime')).toBe(true);
    expect(containsBannedVocabulary('You are entitled to damages')).toBe(true);
    expect(containsBannedVocabulary('The employer is liable')).toBe(true);
    expect(containsBannedVocabulary('We guarantee a result')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(scanBannedVocabulary('VIOLATION')).toContain('violation');
  });

  it('passes clean, compliant copy', () => {
    expect(containsBannedVocabulary(
      'one3seven organizes your records into a timeline for attorney review. It does not draw conclusions.'
    )).toBe(false);
  });

  it('does not false-positive on substrings (reliable, validate, knowledge)', () => {
    expect(containsBannedVocabulary('Our reliable process can validate your knowledge')).toBe(false);
  });

  it('returns the distinct terms found', () => {
    const hits = scanBannedVocabulary('a violation and they owed and entitled');
    expect(hits).toEqual(expect.arrayContaining(['violation', 'owed', 'entitled']));
  });
});
