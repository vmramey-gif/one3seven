/**
 * Core vs enriched summary persistence helpers.
 * Core save must never depend on optional enrichment succeeding.
 */

import type { PlaceholderOrganizationResult } from './intakeOrganizationTypes';
import { safeTrim } from './summarySaveDiagnostics';

export type SummaryRowPayload = {
  overview: string;
  timeline_summary: string;
  readiness_indicators: string[];
  missing_document_alerts: string[];
};

/** Coerce unknown array values to trimmed string[] — never throws. */
export function sanitizeStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const t = safeTrim(value[index], `${fieldName}[${index}]`);
    if (t) out.push(t);
  }
  return out;
}

/** Minimal safe summary row from generated org output — safe for immediate DB write. */
export function buildCoreSummaryPayload(
  org: PlaceholderOrganizationResult,
  opts?: { fileCount?: number }
): SummaryRowPayload {
  const fileCount = opts?.fileCount ?? 0;
  const overviewCandidate =
    org.overview ?? org.recordStory ?? org.firmReviewSummary ?? '';
  const overview =
    safeTrim(overviewCandidate, 'core.overview') ||
    `Uploaded materials (${fileCount} file${fileCount === 1 ? '' : 's'}) are grouped for review.`;
  const timeline_summary =
    safeTrim(org.timelineSummary, 'core.timelineSummary') ||
    'Materials are grouped for chronology review.';
  return {
    overview,
    timeline_summary,
    readiness_indicators: sanitizeStringArray(org.readinessIndicators, 'core.readinessIndicators'),
    missing_document_alerts: sanitizeStringArray(
      org.missingDocumentSuggestions,
      'core.missingDocumentAlerts'
    ),
  };
}

/** Absolute fallback when organization generators throw. */
export function buildFallbackSummaryPayload(fileCount: number): SummaryRowPayload {
  return {
    overview: `Uploaded materials (${fileCount} file${fileCount === 1 ? '' : 's'}) are saved and grouped for review.`,
    timeline_summary: 'Timeline will be refined as records are reviewed.',
    readiness_indicators: [],
    missing_document_alerts: [],
  };
}

export function payloadsEquivalent(a: SummaryRowPayload, b: SummaryRowPayload): boolean {
  return (
    a.overview === b.overview &&
    a.timeline_summary === b.timeline_summary &&
    JSON.stringify(a.readiness_indicators) === JSON.stringify(b.readiness_indicators) &&
    JSON.stringify(a.missing_document_alerts) === JSON.stringify(b.missing_document_alerts)
  );
}
