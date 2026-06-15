/**
 * Persisted O3S_ORG_ENGINE block in intake_summaries.overview (app-layer beta storage).
 */

import type { IntakeOrgEnginePayload } from './intakeOrganizationTypes';
import { trimAssemblyValue } from './summarySaveDiagnostics';

const ORG_ENGINE_PATTERN =
  /\n?--- O3S_ORG_ENGINE ---\n([\s\S]*?)\n--- O3S_ORG_ENGINE_END ---\n?/;

export function buildOrgEngineBlock(payload: IntakeOrgEnginePayload): string {
  const body = JSON.stringify(payload, null, 2);
  return `--- O3S_ORG_ENGINE ---\n${body}\n--- O3S_ORG_ENGINE_END ---`;
}

export function mergeOrgEngineIntoOverview(overview: string, payload: IntakeOrgEnginePayload): string {
  const base = trimAssemblyValue(overview.replace(ORG_ENGINE_PATTERN, ''), {
    file: 'intakeOrgEngineCodec.ts',
    line: 16,
    variable: 'mergeOrgEngineIntoOverview.overview.replace(ORG_ENGINE_PATTERN)',
  });
  const block = buildOrgEngineBlock(payload);
  return base ? `${base}\n\n${block}` : block;
}

export function extractOrgEngineFromOverview(
  overview: string | null | undefined
): IntakeOrgEnginePayload | null {
  const m = (overview ?? '').match(ORG_ENGINE_PATTERN);
  if (!m?.[1]) return null;
  try {
    const parsed = JSON.parse(m[1].trim()) as Partial<IntakeOrgEnginePayload>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.file_records)) return null;
    return {
      version: 1,
      file_records: parsed.file_records,
      people_index: Array.isArray(parsed.people_index) ? parsed.people_index.map(String) : [],
      generated_at: typeof parsed.generated_at === 'string' ? parsed.generated_at : '',
      timeline_events: Array.isArray(parsed.timeline_events) ? parsed.timeline_events : undefined,
      sections:
        parsed.sections && typeof parsed.sections === 'object'
          ? (parsed.sections as IntakeOrgEnginePayload['sections'])
          : undefined,
    };
  } catch {
    return null;
  }
}

export function stripOrgEngineBlock(text: string): string {
  return text.replace(ORG_ENGINE_PATTERN, '').trim();
}
