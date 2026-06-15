/**
 * Phase 3: structured organizational sections for review-ready summaries.
 */

import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import { ONE3SEVEN_NOTICES } from '../app/constants/one3sevenProduct';
import { formatEvidenceTimelineChronologyLine } from './evidenceMappedTimelineService';
import { buildMatterAwareGuidance } from './matterAwareOrganizationService';
import {
  consolidateUnreadableGapLines,
  filterClarificationsAgainstGaps,
  organizationGapDedupKey,
} from './organizationOutputQuality';
import {
  clipSentences,
  formatSupportingFileList,
  sanitizeGenerationPhrase,
  takenTogetherPhrase,
} from './intakeGenerationVoice';
import { buildSequencePatternInsights, type SequencePatternInsights } from './sequencePatternReasoning';
import type {
  EvidenceMappedTimelineEvent,
  IntakeFileOrganizationRecord,
  IntakeOrganizationSections,
  ReviewCheckItem,
  SourceStrength,
} from './intakeOrganizationTypes';

export type BuildOrganizationSectionsOpts = {
  fileRecords: IntakeFileOrganizationRecord[];
  peopleIndex: string[];
  evidenceTimeline: EvidenceMappedTimelineEvent[];
  executiveLead: string;
  missingDocumentSuggestions: string[];
  readinessIndicators: string[];
  reviewItems: ReviewCheckItem[];
  docTotal: number;
  employmentMatterTags?: EmploymentMatterTagId[];
};

function strengthRank(s: SourceStrength): number {
  switch (s) {
    case 'strong':
      return 4;
    case 'partial':
      return 3;
    case 'inferred':
      return 2;
    default:
      return 1;
  }
}

function buildSupportingRecords(
  fileRecords: IntakeFileOrganizationRecord[]
): IntakeOrganizationSections['supporting_records'] {
  return [...fileRecords]
    .sort(
      (a, b) =>
        strengthRank(b.supporting_record_strength) - strengthRank(a.supporting_record_strength)
    )
    .slice(0, 12)
    .map((r) => ({
      file_id: r.source_file_id,
      file_name: r.file_name,
      strength: r.supporting_record_strength,
      note: sanitizeGenerationPhrase(
        r.extraction_quality === 'unreadable'
          ? 'Readable text was not available; grouped from file name and category.'
          : `Uploaded documents include ${r.document_type.toLowerCase()} content that may be relevant for review.`
      ),
    }));
}

function buildPotentialGaps(
  opts: BuildOrganizationSectionsOpts,
  matterGuidance?: ReturnType<typeof buildMatterAwareGuidance>,
  sequenceInsights?: SequencePatternInsights
): string[] {
  const raw: string[] = [
    ...opts.missingDocumentSuggestions.map((g) => sanitizeGenerationPhrase(g)),
  ];
  const seenKeys = new Set<string>();

  const pushGap = (line: string) => {
    const t = sanitizeGenerationPhrase(line);
    if (!t) return;
    const key = organizationGapDedupKey(t);
    if (seenKeys.has(key)) return;
    if (key === 'gap:date-file' && seenKeys.has('gap:date-cluster')) return;
    seenKeys.add(key);
    raw.push(t);
  };

  for (const f of opts.fileRecords) {
    if (f.extraction_quality === 'unreadable') {
      pushGap(
        `Readable text was not available for ${f.file_name}; a clearer copy may help complete the timeline.`
      );
    } else if (!f.likely_date) {
      pushGap(`Date may require confirmation for ${f.file_name} in source records.`);
    }
    for (const line of f.missing_or_unclear_information) {
      const key = organizationGapDedupKey(line);
      if (key === 'gap:date-file' && seenKeys.has('gap:date-cluster')) continue;
      if (key === 'gap:unreadable-generic' && seenKeys.has('gap:unreadable-named')) continue;
      pushGap(line);
    }
  }

  for (const e of opts.evidenceTimeline) {
    for (const g of e.gaps_or_uncertainties) {
      pushGap(g);
    }
  }

  if (opts.docTotal === 0 && !(opts.employmentMatterTags?.includes('other_not_sure') ?? false)) {
    pushGap('No related records found yet.');
  }

  if (matterGuidance) {
    for (const line of matterGuidance.potentialGaps) pushGap(line);
  }
  if (sequenceInsights) {
    for (const line of sequenceInsights.potentialGaps) pushGap(line);
  }

  return consolidateUnreadableGapLines(raw).slice(0, 12);
}

function buildClarificationItems(
  opts: BuildOrganizationSectionsOpts,
  matterGuidance: ReturnType<typeof buildMatterAwareGuidance> | undefined,
  potentialGaps: string[]
): string[] {
  const raw: string[] = [];

  for (const e of opts.evidenceTimeline) {
    for (const g of e.gaps_or_uncertainties) {
      if (/date|unclear|confirmation|not located/i.test(g)) {
        raw.push(sanitizeGenerationPhrase(g));
      }
    }
    if (e.related_topics.length >= 2 && e.supporting_file_names.length >= 2) {
      const listed = formatSupportingFileList(e.supporting_file_names, 2);
      raw.push(
        sanitizeGenerationPhrase(
          `Review ${listed} together with the source records.`
        )
      );
    }
  }

  for (const item of opts.reviewItems) {
    if (item.clarifyingRecord) raw.push(sanitizeGenerationPhrase(item.clarifyingRecord));
    raw.push(sanitizeGenerationPhrase(item.whyNeedsReview));
  }

  if (matterGuidance) {
    for (const line of matterGuidance.clarificationItems) raw.push(line);
  }

  return filterClarificationsAgainstGaps(raw, potentialGaps).slice(0, 10);
}

function buildReviewNotes(opts: BuildOrganizationSectionsOpts): string[] {
  const notes = new Set<string>(
    opts.readinessIndicators.map((line) => sanitizeGenerationPhrase(line))
  );

  for (const item of opts.reviewItems.slice(0, 6)) {
    notes.add(
      sanitizeGenerationPhrase(
        `${item.title}: organized for review. Check details in source files.`
      )
    );
  }

  if (!notes.size) {
    notes.add(
      sanitizeGenerationPhrase(
        'Materials are organized for review; originals should be checked when details matter.'
      )
    );
  }

  return [...notes].slice(0, 10);
}

export function buildIntakeOrganizationSections(
  opts: BuildOrganizationSectionsOpts
): IntakeOrganizationSections {
  const executive = clipSentences(
    opts.executiveLead.trim() ||
      takenTogetherPhrase(
        'uploaded employment-related materials are organized for timeline and record review.'
      ),
    3,
    420
  );

  const chronology =
    opts.evidenceTimeline.length > 0
      ? opts.evidenceTimeline.map((e) => formatEvidenceTimelineChronologyLine(e))
      : [
          sanitizeGenerationPhrase(
            'Timeline will become clearer as dated records are added and readable text becomes available.'
          ),
        ];

  const matterGuidance = opts.employmentMatterTags?.length
    ? buildMatterAwareGuidance({
        matterTags: opts.employmentMatterTags,
        fileRecords: opts.fileRecords,
        evidenceTimeline: opts.evidenceTimeline,
      })
    : undefined;

  const sequenceInsights = buildSequencePatternInsights(opts.evidenceTimeline);
  const executiveWithSequence = clipSentences(
    [executive, ...sequenceInsights.summaryLines.slice(0, 2)].filter(Boolean).join(' '),
    5,
    560
  );
  const potential_gaps = buildPotentialGaps(opts, matterGuidance, sequenceInsights);
  const review_notes = [
    ...buildReviewNotes(opts),
    ...sequenceInsights.reviewNotes,
  ].slice(0, 10);

  return {
    executive_summary: executiveWithSequence,
    chronology,
    people_and_entities: opts.peopleIndex.slice(0, 24),
    supporting_records: buildSupportingRecords(opts.fileRecords),
    potential_gaps,
    clarification_items: buildClarificationItems(opts, matterGuidance, potential_gaps),
    review_notes,
    disclaimer: ONE3SEVEN_NOTICES.positioning,
  };
}

/** Rebuild review_notes after final readiness_indicators are assembled at persist time. */
export function refreshSectionsReviewNotes(
  sections: IntakeOrganizationSections,
  readinessIndicators: string[],
  reviewItems: ReviewCheckItem[]
): IntakeOrganizationSections {
  return {
    ...sections,
    review_notes: buildReviewNotes({
      fileRecords: [],
      peopleIndex: [],
      evidenceTimeline: [],
      executiveLead: '',
      missingDocumentSuggestions: [],
      readinessIndicators,
      reviewItems,
      docTotal: 0,
    }),
  };
}

export function buildTimelineSummaryFromSections(sections: IntakeOrganizationSections): string {
  if (!sections.chronology.length) {
    return takenTogetherPhrase('materials are organized for timeline review.');
  }
  const lead = sections.chronology[0];
  if (sections.chronology.length === 1) return lead;
  return clipSentences(
    `${lead} ${sections.chronology.length - 1} additional timeline entries are listed below for review.`,
    2,
    320
  );
}
