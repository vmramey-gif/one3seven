import { describe, expect, test } from 'vitest';
import {
  MAX_COMMUNICATION_PARTIES,
  normalizeCommunicationParties,
} from '../communicationPartyExtraction';

describe('normalizeCommunicationParties (Phase 2b comm-parties)', () => {
  test('keeps well-formed { name, role } entries', () => {
    const out = normalizeCommunicationParties([
      { name: 'Sandra Fitch', role: 'HR representative' },
      { name: 'Marcus Rivera', role: 'sender' },
    ]);
    expect(out).toEqual([
      { name: 'Sandra Fitch', role: 'HR representative' },
      { name: 'Marcus Rivera', role: 'sender' },
    ]);
  });

  test('returns [] for non-array input', () => {
    expect(normalizeCommunicationParties(null)).toEqual([]);
    expect(normalizeCommunicationParties('Sandra')).toEqual([]);
  });

  test('drops entries with no name, non-objects, and overlong names', () => {
    const out = normalizeCommunicationParties([
      { name: '  Derek Howell  ', role: 'supervisor' },
      { role: 'recipient' },
      'not an object',
      { name: 'x'.repeat(121), role: 'sender' },
      null,
    ]);
    expect(out).toEqual([{ name: 'Derek Howell', role: 'supervisor' }]);
  });

  test('keeps the name but clears an overlong role', () => {
    const out = normalizeCommunicationParties([{ name: 'Jane Doe', role: 'y'.repeat(81) }]);
    expect(out).toEqual([{ name: 'Jane Doe', role: '' }]);
  });

  test('runs name and role through the banned-vocabulary scrubber (organize, never conclude)', () => {
    // "wrongful termination" is a neutralized phrase in the shared scrubber.
    const out = normalizeCommunicationParties([{ name: 'wrongful termination notice sender', role: 'wrongful termination claimant' }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).not.toMatch(/\bwrongful termination\b/i);
    expect(out[0].role).not.toMatch(/\bwrongful termination\b/i);
  });

  test('dedupes by name (case-insensitive) and caps the count', () => {
    expect(normalizeCommunicationParties([
      { name: 'Sandra Fitch', role: 'sender' },
      { name: 'sandra fitch', role: 'recipient' },
    ])).toHaveLength(1);

    const many = Array.from({ length: MAX_COMMUNICATION_PARTIES + 5 }, (_, i) => ({ name: `Person ${i}`, role: 'sender' }));
    expect(normalizeCommunicationParties(many)).toHaveLength(MAX_COMMUNICATION_PARTIES);
  });
});
