import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  buildCoreSummaryPayload,
  buildFallbackSummaryPayload,
  payloadsEquivalent,
  sanitizeStringArray,
} from '../organizationCoreSave';
import type { PlaceholderOrganizationResult } from '../intakeOrganizationTypes';

function minimalOrg(overrides: Partial<PlaceholderOrganizationResult> = {}): PlaceholderOrganizationResult {
  return {
    recordStory: 'Record story text.',
    firmReviewSummary: 'Firm review text.',
    timelineSummary: 'Timeline summary text.',
    timelineEvents: [],
    documentCategories: [],
    readinessIndicators: ['Ready line'],
    missingDocumentSuggestions: ['Missing line'],
    overview: 'Overview text.',
    reviewItems: [],
    fileRecords: [],
    peopleIndex: [],
    evidenceTimeline: [],
    sections: {
      executive_summary: '',
      chronology: [],
      people_and_entities: [],
      supporting_records: [],
      potential_gaps: [],
      clarification_items: [],
      review_notes: [],
      disclaimer: '',
    },
    ...overrides,
  };
}

describe('organizationCoreSave', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('sanitizeStringArray tolerates undefined entries', () => {
    const out = sanitizeStringArray(['a', undefined, null, '  b  '], 'test.arr');
    expect(out).toEqual(['a', 'b']);
  });

  test('buildCoreSummaryPayload tolerates undefined overview and arrays', () => {
    const payload = buildCoreSummaryPayload(
      minimalOrg({
        overview: undefined as unknown as string,
        timelineSummary: undefined as unknown as string,
        readinessIndicators: undefined as unknown as string[],
        missingDocumentSuggestions: [undefined as unknown as string, ' alert '],
      }),
      { fileCount: 15 }
    );
    expect(payload.overview).toBe('Record story text.');
    expect(payload.timeline_summary.length).toBeGreaterThan(0);
    expect(payload.readiness_indicators).toEqual([]);
    expect(payload.missing_document_alerts).toEqual(['alert']);
  });

  test('buildFallbackSummaryPayload returns empty optional arrays', () => {
    const payload = buildFallbackSummaryPayload(3);
    expect(payload.readiness_indicators).toEqual([]);
    expect(payload.missing_document_alerts).toEqual([]);
    expect(payload.overview).toContain('3 files');
  });

  test('payloadsEquivalent compares normalized arrays', () => {
    const a = buildFallbackSummaryPayload(1);
    const b = buildFallbackSummaryPayload(1);
    expect(payloadsEquivalent(a, b)).toBe(true);
  });
});

describe('persist contract', () => {
  test('persistPlaceholderOrganizationForIntake uses core save before enrichment and no summary delete', async () => {
    const source = await import('../intakeDataService?raw');
    const raw = String(source.default ?? source);
    expect(raw).not.toMatch(/from\('intake_summaries'\)\.delete\(\)/);
    expect(raw).toContain('core summary saved');
    expect(raw).toContain('assembleEnrichedSummaryPayload');
    expect(raw).toContain('upsertIntakeSummaryRow');
    expect(raw).toContain('waitForWorkerSummaryRow');
  });
});
