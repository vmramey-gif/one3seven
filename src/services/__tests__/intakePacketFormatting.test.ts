import { describe, expect, test } from 'vitest';
import {
  formatPacketFileName,
  isPlausibleEmploymentDateToken,
  parseHumanContextSections,
  sanitizeEmployerForPacket,
  sanitizePacketDateLabel,
} from '../intakePacketFormatting';

describe('intakePacketFormatting', () => {
  test('rejects placeholder and legal-reference years', () => {
    expect(sanitizePacketDateLabel('1986')).toBe('Date to confirm');
    expect(sanitizePacketDateLabel('Immigration Reform and Control Act of 1986')).toBe(
      'Date to confirm'
    );
    expect(sanitizePacketDateLabel('April 12, 1986')).toBe('Date to confirm');
    expect(isPlausibleEmploymentDateToken('March 2024')).toBe(true);
    expect(sanitizePacketDateLabel('March 2024')).toBe('March 2024');
  });

  test('sanitizes employer without merging title noise', () => {
    expect(
      sanitizeEmployerForPacket(
        undefined,
        'Employee name labeled as Jane Doe; employer or company line labeled as Acme Logistics Inc.'
      )
    ).toMatch(/Acme Logistics Inc\.?/);
    expect(sanitizeEmployerForPacket('Offer letter for Senior Analyst role', undefined)).toBe(
      'Not yet identified'
    );
  });

  test('formats long filenames and strips hash suffixes', () => {
    const raw =
      'Paystub_March_2024_scan_final_version_very_long_description_here_abcdef1234567890abcdef12.pdf';
    const out = formatPacketFileName(raw, 40);
    expect(out.length).toBeLessThanOrEqual(44);
    expect(out).toContain('.pdf');
    expect(out).not.toMatch(/abcdef1234567890/);
  });

  test('parses worker context markers into labeled sections', () => {
    const parsed = parseHumanContextSections(`--- O3S_GUIDED_INTAKE ---
Topics: final pay, scheduling
--- O3S_GUIDED_INTAKE_END ---
--- O3S_WORKER_STORY ---
I was let go after reporting overtime.
--- O3S_WORKER_STORY_END ---`);
    expect(parsed.guidedIntake).toContain('final pay');
    expect(parsed.workerStory).toContain('let go');
    expect(parsed.guidedIntake).not.toContain('O3S_');
  });
});
