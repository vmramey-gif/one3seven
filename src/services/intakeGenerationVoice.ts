/**
 * Calm intake-organizer phrasing for deterministic organization output.
 * Describes what records mention — not legal conclusions or outcomes.
 *
 * one3Seven organizes; attorneys interpret. Chronology is the primary review
 * surface, events matter more than categories, and records support events.
 * Output should identify what remains unclear and what records may help complete
 * the timeline, while avoiding legal conclusions, case scoring, value estimates,
 * outcome predictions, or recommendations to take legal action.
 */

import type { ReviewCheckItem, SourceStrength, TimelineSourceTrace } from './intakeOrganizationTypes';
import { safeTrim, trimAssemblyValue } from './summarySaveDiagnostics';

export const ORGANIZATION_BANNED_OUTPUT_PATTERN =
  /\b(AI detected|violation(s)? found|wage violation|illegal(?:ly)?|employer failed|this proves(?:\s+(?:retaliation|discrimination))?|legal issue confirmed|high[- ]value case|strong claim|weak claim|strong case|weak case|case strength|case score|case value|claim value|settlement value|smoking gun|liable|liability|damages|merit score|legal merit|FLSA violation|wage theft|at fault|fault for|guarantees?|should sue|you should sue|recommend legal action|hire an attorney immediately|legal strategy|proves the|you have a case|withheld records|employer violated|likely illegal|likely to win|likely to lose|outcome likelihood|evidence of discrimination|evidence of retaliation|retaliation occurred|discrimination occurred|illegal termination|wrongful termination|wrongful termination occurred|attorney match score|discrimination proved|retaliation proved)\b/i;

const BANNED_PATTERN = ORGANIZATION_BANNED_OUTPUT_PATTERN;

export function sanitizeGenerationPhrase(text: string): string {
  let s = safeTrim(text, 'sanitizeGenerationPhrase.text');
  if (!s) return s;
  if (BANNED_PATTERN.test(s)) {
    s = s
      .replace(/\bAI detected\b/gi, 'Records mention')
      .replace(/\bviolation(s)? found\b/gi, 'topic noted for review')
      .replace(/\bviolations?\b/gi, 'concerns described in uploaded materials')
      .replace(/\bwage violation\b/gi, 'pay practices topic noted for review')
      .replace(/\billegal(?:ly)?\b/gi, 'needs review')
      .replace(/\bemployer failed\b/gi, 'the available materials do not clearly show')
      .replace(/\bemployer violated\b/gi, 'uploaded materials describe concerns that need review')
      .replace(/\bthis proves discrimination\b/gi, 'uploaded records indicate topics noted for review')
      .replace(/\bthis proves retaliation\b/gi, 'uploaded records indicate topics noted for review')
      .replace(/\bthis proves\b/gi, 'records mention')
      .replace(/\bproves the\b/gi, 'may mention')
      .replace(/\bevidence of discrimination\b/gi, 'records appear related to topics noted for review')
      .replace(/\bevidence of retaliation\b/gi, 'records appear related to topics noted for review')
      .replace(/\bretaliation occurred\b/gi, 'the timeline includes events that need review')
      .replace(/\bdiscrimination occurred\b/gi, 'the available records include workplace concerns that need review')
      .replace(/\bstrong case\b/gi, 'topic noted for review')
      .replace(/\bweak case\b/gi, 'topic noted for review')
      .replace(/\bcase strength\b/gi, 'review preparation context')
      .replace(/\bcase score\b/gi, 'review preparation note')
      .replace(/\blikely to win\b/gi, 'may be relevant for review')
      .replace(/\blikely to lose\b/gi, 'may be relevant for review')
      .replace(/\blikely illegal\b/gi, 'needs review')
      .replace(/\boutcome likelihood\b/gi, 'review preparation context')
      .replace(/\billegal termination\b/gi, 'separation topics noted for review')
      .replace(/\bwrongful termination\b/gi, 'separation topics noted for review')
      .replace(/\bwrongful termination occurred\b/gi, 'separation topics noted for review')
      .replace(/\bwage theft\b/gi, 'pay practices topics noted for review')
      .replace(/\bclaim value\b/gi, 'compensation topics')
      .replace(/\bsettlement value\b/gi, 'compensation topics')
      .replace(/\brecommend legal action\b/gi, 'identify records that may help complete the timeline')
      .replace(/\bhire an attorney immediately\b/gi, 'organized for review preparation only')
      .replace(/\battorney match score\b/gi, 'review preparation note')
      .replace(/\blegal merit\b/gi, 'topic noted for review')
      .replace(/\blegal issue confirmed\b/gi, 'Additional Information May Help')
      .replace(/\bsmoking gun\b/gi, 'notable record')
      .replace(/\bFLSA\b/gi, 'pay practices')
      .replace(/\bliable\b/gi, 'described in uploaded materials')
      .replace(/\bliability\b/gi, 'described in uploaded materials')
      .replace(/\bdamages\b/gi, 'compensation topics')
      .replace(/\byou should sue\b/gi, 'may be useful for review preparation')
      .replace(/\bshould sue\b/gi, 'may be useful for review preparation')
      .replace(/\bguarantees?\b/gi, 'may indicate')
      .replace(/\byou have a case\b/gi, 'materials may be useful for review')
      .replace(/\bstrong claim\b/gi, 'topic noted for review')
      .replace(/\bweak claim\b/gi, 'topic noted for review')
      .replace(/\bcase value\b/gi, 'compensation topics')
      .replace(/\bmerit score\b/gi, 'review preparation note');
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Join file names for inline lists (avoids repeating long enumerations). */
export function formatSupportingFileList(names: string[], maxVisible = 3): string {
  const n = names
    .map((x, index) =>
      trimAssemblyValue(x, {
        file: 'intakeGenerationVoice.ts',
        line: 61,
        variable: `formatSupportingFileList.names[${index}]`,
      })
    )
    .filter(Boolean);
  if (!n.length) return '';
  if (n.length <= maxVisible) return n.join(', ');
  return `${n.slice(0, maxVisible - 1).join(', ')}, and ${n.length - (maxVisible - 1)} more`;
}

export function recordsSuggestPhrase(detail: string): string {
  const d = detail.replace(/^\s*(records suggest|uploaded records suggest)\s+/i, '');
  return sanitizeGenerationPhrase(`Records mention ${d}`);
}

export function availableRecordsShowPhrase(detail: string): string {
  const d = detail.replace(/^\s*(available records show|uploaded records show|records appear to reference)\s+/i, '');
  return sanitizeGenerationPhrase(`Records mention ${d}`);
}

export function materialsMayReflectPhrase(detail: string): string {
  const d = detail.replace(/^\s*(the available materials may reflect|materials may reflect)\s+/i, '');
  return sanitizeGenerationPhrase(`The available materials may reflect ${d}`);
}

export function uploadedRecordsShowPhrase(detail: string): string {
  const d = detail.replace(/^\s*uploaded records show\s+/i, '');
  return sanitizeGenerationPhrase(`Records mention ${d}`);
}

export function takenTogetherPhrase(detail: string): string {
  const d = detail.replace(/^\s*taken together,?\s*(the\s+)?/i, '');
  return sanitizeGenerationPhrase(`Taken together, ${d}`);
}

export function timelineGapPhrase(period: string): string {
  return sanitizeGenerationPhrase(
    `Timeline includes a gap between ${period}. Additional records may help complete this sequence.`
  );
}

export function mayNeedReviewPhrase(reason: string): string {
  const r = reason.replace(/^\s*this item may need human review because\s+/i, '');
  return sanitizeGenerationPhrase(`Additional Information May Help: ${r}`);
}

export function reviewingMayConfirmPhrase(detail: string | null | undefined): string {
  const d = safeTrim(detail, 'reviewingMayConfirmPhrase.detail').replace(
    /^\s*(a reviewing professional may want to confirm|attorney should confirm)\s+/i,
    ''
  );
  return sanitizeGenerationPhrase(`A reviewing professional may want to confirm ${d}`);
}

export function usefulForReviewPhrase(detail: string | null | undefined): string {
  const d = safeTrim(detail, 'usefulForReviewPhrase.detail').replace(
    /^\s*this (item )?may be useful for (attorney )?review because\s+/i,
    ''
  );
  return sanitizeGenerationPhrase(`This may be useful for human review: ${d}`);
}

export function supportingRecordsPhrase(names: string[]): string {
  const list = formatSupportingFileList(names);
  if (!list) return 'No related records found yet for this item.';
  return sanitizeGenerationPhrase(`Supporting records include ${list}.`);
}

export function documentsDoNotYetShowPhrase(gap: string): string {
  return sanitizeGenerationPhrase(`Not found in the current records: ${gap}.`);
}

export function additionalRecordsMayHelpPhrase(suggestion: string): string {
  const s = suggestion.replace(/^\s*(additional records may help (clarify|complete) |this may help clarify\s*)/i, '');
  return sanitizeGenerationPhrase(`This may help complete the timeline: ${s}`);
}

export function relatedRecordPhrase(detail: string): string {
  return sanitizeGenerationPhrase(`This appears related to ${detail}.`);
}

export function inferredConnectionPhrase(detail: string): string {
  return sanitizeGenerationPhrase(`Related record found: ${detail}.`);
}

export function sourceStrengthLabel(strength: SourceStrength): string {
  switch (strength) {
    case 'strong':
      return 'grounded in readable text from the uploads';
    case 'partial':
      return 'partially described in the uploads';
    case 'inferred':
      return 'grouped from file type and naming';
    default:
      return 'needs confirmation in source files';
  }
}

export function buildTimelineEventSummary(opts: {
  phaseTitle: string;
  dateSpan?: string | null;
  themeHint?: string | null;
  sourceStrength: SourceStrength;
}): string {
  const parts: string[] = [
    materialsMayReflectPhrase(`${opts.phaseTitle.toLowerCase()} in this part of the sequence.`),
  ];

  const span = (opts.dateSpan ?? '').trim();
  if (span) {
    const datesOnly = span
      .replace(/^Date references in the text span\s+/i, '')
      .replace(/^Date reference in the text:\s*/i, '')
      .replace(/\s*\(\d+ total\)\.\s*$/i, '.')
      .replace(/\.$/, '')
      .trim();
    if (datesOnly && !/\d+\s+date reference/i.test(datesOnly)) {
      parts.push(availableRecordsShowPhrase(`timing cues such as ${datesOnly} in this phase.`));
    }
  }

  if (opts.themeHint?.trim()) {
    parts.push(usefulForReviewPhrase(opts.themeHint.trim()));
  } else {
    parts.push(
      sanitizeGenerationPhrase(
        `Supporting records were provided for this part of the timeline (${sourceStrengthLabel(opts.sourceStrength)}).`
      )
    );
  }

  return clipSentences(parts.join(' '), 2, 280);
}

export function buildReviewItemFromTopic(opts: {
  title: string;
  termsFound: string[];
  reviewGuidance: string;
  supportingFileNames: string[];
}): ReviewCheckItem {
  const terms = opts.termsFound.slice(0, 4).join(', ');
  const files = formatSupportingFileList(opts.supportingFileNames.slice(0, 6));
  return {
    title: sanitizeGenerationPhrase(opts.title),
    whyNeedsReview: mayNeedReviewPhrase(
      `wording across the uploads touches ${terms || 'related topics'} — ${opts.reviewGuidance}`
    ),
    supportingRecords: opts.supportingFileNames.slice(0, 6),
    clarifyingRecord: additionalRecordsMayHelpPhrase(
      files ? `records from the same period (see ${files})` : 'records from the same period or topic'
    ),
  };
}

export function buildMissingRecordSuggestion(topic: string): string {
  const t = safeTrim(topic, 'buildMissingRecordSuggestion.topic');
  if (/policy|handbook/i.test(t)) {
    return additionalRecordsMayHelpPhrase('a written policy that may explain this reference');
  }
  if (/payroll|pay stub|paystub|wage statement/i.test(t)) {
    return additionalRecordsMayHelpPhrase('a payroll record for this period');
  }
  // Only collapse to the generic phrasing when the topic is *primarily* about a missing
  // communication — not when it is a specific request like "HR response or follow-up
  // communication", which should keep its precise wording.
  if (/^(a\s+)?(communicat|email|message)/i.test(t)) {
    return additionalRecordsMayHelpPhrase('a communication from this date range');
  }
  if (/time|schedule|timesheet/i.test(t)) {
    return additionalRecordsMayHelpPhrase('time or schedule records for this period');
  }
  if (/performance review|discipline|write-up|warning/i.test(t)) {
    return additionalRecordsMayHelpPhrase('performance or discipline records from this period');
  }
  return additionalRecordsMayHelpPhrase(t || 'records from this part of the timeline');
}

export function clipSentences(text: string, maxSentences: number, maxChars: number): string {
  const t = sanitizeGenerationPhrase(text);
  const sentences = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t];
  const joined = sentences.slice(0, maxSentences).join(' ').trim();
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars - 1).trim()}…`;
}

export function defaultSourceTrace(
  files: Array<{ uploadedFileId?: string; fileName: string; category: string | null }>,
  strength: SourceStrength = 'strong'
): TimelineSourceTrace {
  return {
    sourceFileIds: files.map((f) => f.uploadedFileId).filter((id): id is string => Boolean(id)),
    sourceFileNames: files.map((f) => f.fileName),
    sourceDocumentTypes: [...new Set(files.map((f) => (f.category ?? 'Uncategorized').trim() || 'Uncategorized'))],
    sourceDates: [],
    sourceStrength: strength,
    sourceExcerpt: null,
  };
}
