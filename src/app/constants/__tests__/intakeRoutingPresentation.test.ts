import { describe, expect, test } from 'vitest';
import {
  normalizePersistedSubmissionChannel,
  resolveFirmSubmissionTypeDisplay,
  resolveIsFirmCodeRoutedIntake,
} from '../one3sevenProduct';

describe('intake routing presentation', () => {
  test('does not infer firm code from linked firm alone', () => {
    expect(
      resolveFirmSubmissionTypeDisplay({
        submissionChannel: null,
        linkedFirmId: 'firm-abc',
        routeFirmId: 'firm-abc',
        hasFirmIntakeRoute: true,
      })
    ).toBe('Participating Firm Review');
    expect(
      resolveIsFirmCodeRoutedIntake({
        submissionChannel: null,
        linkedFirmId: 'firm-abc',
        routeFirmId: 'firm-abc',
      })
    ).toBe(false);
  });

  test('shows Firm Code only with saved firm_code channel and matching linked firm', () => {
    expect(
      resolveFirmSubmissionTypeDisplay({
        submissionChannel: 'firm_code',
        linkedFirmId: 'firm-abc',
        routeFirmId: 'firm-abc',
        hasFirmIntakeRoute: true,
      })
    ).toBe('Firm Code');
    expect(
      resolveFirmSubmissionTypeDisplay({
        submissionChannel: 'firm_code',
        linkedFirmId: 'firm-other',
        routeFirmId: 'firm-abc',
        hasFirmIntakeRoute: true,
      })
    ).toBe('Participating Firm Review');
  });

  test('participating channel uses participating firm review label', () => {
    expect(
      resolveFirmSubmissionTypeDisplay({
        submissionChannel: 'participating',
        linkedFirmId: null,
        routeFirmId: 'firm-abc',
        hasFirmIntakeRoute: true,
      })
    ).toBe('Participating Firm Review');
  });

  test('normalizePersistedSubmissionChannel does not fabricate values', () => {
    expect(normalizePersistedSubmissionChannel(null)).toBeNull();
    expect(normalizePersistedSubmissionChannel('  ')).toBeNull();
    expect(normalizePersistedSubmissionChannel('participating')).toBe('participating');
  });
});
