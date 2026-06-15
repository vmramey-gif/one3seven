import type { TimelineSourceTrace } from './intakeOrganizationTypes';
import { safeTrim, trimAssemblyValue } from './summarySaveDiagnostics';

const SOURCE_TRACE_PATTERN =
  /\n?--- O3S_SOURCE_TRACE ---\n([\s\S]*?)\n--- O3S_SOURCE_TRACE_END ---\n?/;

const RECORD_STORY_PATTERN =
  /\n?--- O3S_RECORD_STORY ---\n([\s\S]*?)\n--- O3S_RECORD_STORY_END ---\n?/;

const FIRM_REVIEW_PATTERN =
  /\n?--- O3S_FIRM_REVIEW_SUMMARY ---\n([\s\S]*?)\n--- O3S_FIRM_REVIEW_SUMMARY_END ---\n?/;

export function encodeTimelineWorkerContext(
  humanNote: string,
  source: TimelineSourceTrace
): string {
  const note = (humanNote ?? '').trim();
  const payload = JSON.stringify({
    sourceFileIds: source.sourceFileIds,
    sourceFileNames: source.sourceFileNames,
    sourceDocumentTypes: source.sourceDocumentTypes,
    sourceDates: source.sourceDates,
    sourceStrength: source.sourceStrength,
    sourceExcerpt: source.sourceExcerpt ?? null,
  });
  const block = `--- O3S_SOURCE_TRACE ---\n${payload}\n--- O3S_SOURCE_TRACE_END ---`;
  return note ? `${note}\n\n${block}` : block;
}

export function parseTimelineSourceTrace(workerContext: string | null | undefined): TimelineSourceTrace | null {
  const raw = workerContext ?? '';
  const m = raw.match(SOURCE_TRACE_PATTERN);
  if (!m?.[1]) return null;
  try {
    const parsed = JSON.parse(m[1].trim()) as Partial<TimelineSourceTrace>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      sourceFileIds: Array.isArray(parsed.sourceFileIds) ? parsed.sourceFileIds.map(String) : [],
      sourceFileNames: Array.isArray(parsed.sourceFileNames) ? parsed.sourceFileNames.map(String) : [],
      sourceDocumentTypes: Array.isArray(parsed.sourceDocumentTypes)
        ? parsed.sourceDocumentTypes.map(String)
        : [],
      sourceDates: Array.isArray(parsed.sourceDates) ? parsed.sourceDates.map(String) : [],
      sourceStrength:
        parsed.sourceStrength === 'strong' ||
        parsed.sourceStrength === 'partial' ||
        parsed.sourceStrength === 'inferred' ||
        parsed.sourceStrength === 'needs_review'
          ? parsed.sourceStrength
          : 'needs_review',
      sourceExcerpt:
        typeof parsed.sourceExcerpt === 'string' ? parsed.sourceExcerpt : null,
    };
  } catch {
    return null;
  }
}

export function stripTimelineSourceTraceBlock(workerContext: string): string {
  return trimAssemblyValue(workerContext.replace(SOURCE_TRACE_PATTERN, ''), {
    file: 'timelineSourceTraceCodec.ts',
    line: 59,
    variable: 'stripTimelineSourceTraceBlock.workerContext.replace',
  });
}

export function mergeRecordStoryIntoOverview(overview: string, recordStory: string | null | undefined): string {
  const base = trimAssemblyValue(
    (overview ?? '').replace(RECORD_STORY_PATTERN, '').replace(FIRM_REVIEW_PATTERN, ''),
    {
      file: 'timelineSourceTraceCodec.ts',
      line: 65,
      variable: 'mergeRecordStoryIntoOverview.base',
    }
  );
  const story = safeTrim(recordStory, 'mergeRecordStoryIntoOverview.recordStory');
  if (!story) return base;
  const block = `--- O3S_RECORD_STORY ---\n${story}\n--- O3S_RECORD_STORY_END ---`;
  return `${block}\n\n${base}`;
}

export function mergeFirmReviewSummaryIntoOverview(
  overview: string,
  firmReview: string | null | undefined
): string {
  const base = trimAssemblyValue((overview ?? '').replace(FIRM_REVIEW_PATTERN, ''), {
    file: 'timelineSourceTraceCodec.ts',
    line: 76,
    variable: 'mergeFirmReviewSummaryIntoOverview.base',
  });
  const text = safeTrim(firmReview, 'mergeFirmReviewSummaryIntoOverview.firmReview');
  if (!text) return base;
  const block = `--- O3S_FIRM_REVIEW_SUMMARY ---\n${text}\n--- O3S_FIRM_REVIEW_SUMMARY_END ---`;
  return `${base}\n\n${block}`;
}

export function extractRecordStoryFromOverview(overview: string | null | undefined): string | null {
  const m = (overview ?? '').match(RECORD_STORY_PATTERN);
  return m?.[1]?.trim() || null;
}

export function extractFirmReviewSummaryFromOverview(overview: string | null | undefined): string | null {
  const m = (overview ?? '').match(FIRM_REVIEW_PATTERN);
  return m?.[1]?.trim() || null;
}
