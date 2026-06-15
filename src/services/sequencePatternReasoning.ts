/**
 * Neutral sequence/pattern reasoning for the intelligence layer.
 * Deterministic only: no legal conclusions, no schema changes, no service-shape changes.
 */

import { compareEmploymentChronologyDates, DATE_UNCLEAR_LABEL } from './contextualDateClassification';
import { sanitizeGenerationPhrase } from './intakeGenerationVoice';
import type { EvidenceMappedTimelineEvent } from './intakeOrganizationTypes';

export type SequencePatternInsights = {
  summaryLines: string[];
  potentialGaps: string[];
  reviewNotes: string[];
  missingRecordSuggestions: string[];
};

const EMPTY_INSIGHTS: SequencePatternInsights = {
  summaryLines: [],
  potentialGaps: [],
  reviewNotes: [],
  missingRecordSuggestions: [],
};

function eventText(event: EvidenceMappedTimelineEvent): string {
  return [
    event.title,
    event.neutral_summary,
    event.category,
    event.related_topics.join(' '),
    event.people_involved.join(' '),
    event.supporting_file_names.join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

function hasConcern(event: EvidenceMappedTimelineEvent): boolean {
  return /concern|complaint|grievance|safety|unsafe|hazard|reported/i.test(eventText(event));
}

function hasResponse(event: EvidenceMappedTimelineEvent): boolean {
  return /response|reply|follow[- ]?up|investigation|manager response|supervisor response|hr response/i.test(
    eventText(event)
  );
}

function hasLeaveOrAccommodationRequest(event: EvidenceMappedTimelineEvent): boolean {
  return /accommodation|medical leave|\bfmla\b|leave request|modified duty|restriction/i.test(
    eventText(event)
  );
}

function hasLaterAction(event: EvidenceMappedTimelineEvent): boolean {
  return /written warning|warning|discipline|performance review|performance improvement|pip|schedule change|project removal|termination|separation|employment ends/i.test(
    eventText(event)
  );
}

function hasWarningOrPerformance(event: EvidenceMappedTimelineEvent): boolean {
  return /written warning|warning|discipline|performance review|performance improvement|pip|corrective action/i.test(
    eventText(event)
  );
}

function hasSeparation(event: EvidenceMappedTimelineEvent): boolean {
  return /termination|separation|employment ends|final pay|resign|layoff/i.test(eventText(event));
}

function hasPayrollOrTimekeeping(event: EvidenceMappedTimelineEvent): boolean {
  return /payroll|pay period|pay stub|wage|overtime|timekeeping|timecard|timesheet|schedule|hours/i.test(
    eventText(event)
  );
}

function hasRole(event: EvidenceMappedTimelineEvent, role: RegExp): boolean {
  return event.people_involved.some((person) => role.test(person));
}

function pushUnique(list: string[], line: string): void {
  const clean = sanitizeGenerationPhrase(line);
  if (!clean) return;
  if (list.some((existing) => existing.toLowerCase() === clean.toLowerCase())) return;
  list.push(clean);
}

function firstIndex(events: EvidenceMappedTimelineEvent[], predicate: (event: EvidenceMappedTimelineEvent) => boolean): number {
  return events.findIndex(predicate);
}

function hasEventAfter(
  events: EvidenceMappedTimelineEvent[],
  index: number,
  predicate: (event: EvidenceMappedTimelineEvent) => boolean
): boolean {
  return events.slice(index + 1).some(predicate);
}

export function buildSequencePatternInsights(
  timelineEvents: EvidenceMappedTimelineEvent[]
): SequencePatternInsights {
  if (!timelineEvents.length) return EMPTY_INSIGHTS;

  const events = [...timelineEvents].sort((a, b) => compareEmploymentChronologyDates(a.date, b.date));
  const insights: SequencePatternInsights = {
    summaryLines: [],
    potentialGaps: [],
    reviewNotes: [],
    missingRecordSuggestions: [],
  };

  const concernIndex = firstIndex(events, hasConcern);
  const responseIndex = firstIndex(events, hasResponse);
  const leaveIndex = firstIndex(events, hasLeaveOrAccommodationRequest);
  const warningIndex = firstIndex(events, hasWarningOrPerformance);
  const separationIndex = firstIndex(events, hasSeparation);
  const payrollOrTimeIndex = firstIndex(events, hasPayrollOrTimekeeping);

  if (concernIndex >= 0 && responseIndex < 0) {
    pushUnique(
      insights.summaryLines,
      'The records currently identify worker-raised concerns, but the file set does not yet clearly show the employer response or follow-up.'
    );
    pushUnique(
      insights.potentialGaps,
      'The file set does not yet clearly show the employer response or follow-up to the worker-raised concerns.'
    );
    pushUnique(insights.missingRecordSuggestions, 'HR response or follow-up communication');
    pushUnique(insights.missingRecordSuggestions, 'Manager response to reported concern');
  }

  if (concernIndex >= 0 && hasEventAfter(events, concernIndex, hasLaterAction)) {
    pushUnique(
      insights.summaryLines,
      'The chronology places worker-raised concerns before later workplace action records. Review against source files may help clarify timing and context.'
    );
    pushUnique(
      insights.reviewNotes,
      'Review the timing between worker-raised concerns and later workplace action records against source files.'
    );
    pushUnique(
      insights.potentialGaps,
      'The current file set does not yet clearly show what changed between the worker-raised concerns and later workplace action records.'
    );
    pushUnique(insights.missingRecordSuggestions, 'Communications after the reported concern');
    pushUnique(
      insights.missingRecordSuggestions,
      'Records explaining schedule, discipline, performance, or separation changes'
    );
  }

  if (leaveIndex >= 0 && !events.some(hasResponse)) {
    pushUnique(
      insights.summaryLines,
      'The file set references a leave or accommodation request but does not yet clearly include the employer response or follow-up.'
    );
    pushUnique(
      insights.potentialGaps,
      'The file set references a leave or accommodation request but does not yet clearly include the employer response or follow-up.'
    );
    pushUnique(insights.missingRecordSuggestions, 'Leave or accommodation response');
    pushUnique(
      insights.missingRecordSuggestions,
      'Manager or HR communication about the leave or accommodation request'
    );
  }

  if (warningIndex >= 0 && separationIndex > warningIndex) {
    pushUnique(
      insights.summaryLines,
      'The chronology includes discipline or performance records before separation documentation.'
    );
    pushUnique(insights.reviewNotes, 'Review discipline or performance records before separation documentation.');
    pushUnique(
      insights.potentialGaps,
      'The file set does not yet clearly show the full sequence between discipline or performance records and separation documentation.'
    );
    pushUnique(insights.missingRecordSuggestions, 'Performance history before the warning');
    pushUnique(insights.missingRecordSuggestions, 'Communications explaining the warning');
    pushUnique(insights.missingRecordSuggestions, 'Separation explanation or restructuring notice');
  }

  if (payrollOrTimeIndex >= 0) {
    pushUnique(
      insights.reviewNotes,
      'Payroll and timekeeping records may help anchor employment dates, pay periods, hours, and schedule history.'
    );
    pushUnique(insights.missingRecordSuggestions, 'Additional timekeeping or schedule records for comparison');
  }

  if (
    concernIndex >= 0 &&
    events.some((event) => hasRole(event, /Human Resources Representative|Manager|Supervisor/))
  ) {
    pushUnique(
      insights.summaryLines,
      'The chronology includes communications involving Human Resources or management before later workplace records.'
    );
  }

  const datedEvents = events.filter((event) => event.date && event.date !== DATE_UNCLEAR_LABEL);
  if (datedEvents.length >= 2 && insights.summaryLines.length === 0) {
    pushUnique(
      insights.summaryLines,
      `The chronology currently spans from ${datedEvents[0].date} to ${datedEvents[datedEvents.length - 1].date}.`
    );
  }

  return {
    summaryLines: insights.summaryLines.slice(0, 3),
    potentialGaps: insights.potentialGaps.slice(0, 4),
    reviewNotes: insights.reviewNotes.slice(0, 4),
    missingRecordSuggestions: insights.missingRecordSuggestions.slice(0, 6),
  };
}
