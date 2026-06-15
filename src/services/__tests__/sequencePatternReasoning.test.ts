import { describe, expect, test } from 'vitest';
import { buildSequencePatternInsights } from '../sequencePatternReasoning';
import type { EvidenceMappedTimelineEvent } from '../intakeOrganizationTypes';

function event(overrides: Partial<EvidenceMappedTimelineEvent>): EvidenceMappedTimelineEvent {
  return {
    date: 'January 2024',
    title: 'Workplace event',
    neutral_summary: 'Event placed in chronology.',
    people_involved: [],
    supporting_file_ids: ['f1'],
    supporting_file_names: ['file.pdf'],
    related_topics: [],
    gaps_or_uncertainties: [],
    confidence: 'high',
    category: 'Workplace Communications',
    source_strength: 'strong',
    ...overrides,
  };
}

describe('sequence pattern reasoning', () => {
  const bannedLegalWording =
    /retaliation|discrimination|wrongful termination|violation|liability|strong case|weak case|likely illegal/i;

  test('identifies concern-to-response gap without legal conclusions', () => {
    const insights = buildSequencePatternInsights([
      event({
        title: 'Complaint submitted to Human Resources',
        people_involved: ['Ashley Kim (Human Resources Representative)'],
        supporting_file_names: ['Complaint_To_HR.pdf'],
      }),
      event({
        date: 'April 2024',
        title: 'Termination documented',
        supporting_file_names: ['Termination_Letter.pdf'],
      }),
    ]);

    expect(insights.summaryLines.join(' ')).toMatch(/worker-raised concerns/i);
    expect(insights.potentialGaps.join(' ')).toMatch(/employer response or follow-up/i);
    expect(insights.missingRecordSuggestions).toContain('HR response or follow-up communication');
    expect(insights.summaryLines.join(' ')).not.toMatch(/retaliation|violation|liability|strong claim/i);
  });

  test('identifies concern before later workplace action records', () => {
    const insights = buildSequencePatternInsights([
      event({ title: 'Worker raises safety concerns', date: 'January 2024' }),
      event({ title: 'Written warning issued', date: 'February 2024' }),
    ]);

    expect(insights.summaryLines.join(' ')).toMatch(/before later workplace action records/i);
    expect(insights.reviewNotes.join(' ')).toMatch(/timing between worker-raised concerns/i);
    expect(insights.potentialGaps).toContain(
      'The current file set does not yet clearly show what changed between the worker-raised concerns and later workplace action records.'
    );
    expect(insights.missingRecordSuggestions).toEqual(
      expect.arrayContaining([
        'Communications after the reported concern',
        'Records explaining schedule, discipline, performance, or separation changes',
      ])
    );
  });

  test('identifies warning before separation and payroll/timekeeping anchor without legal conclusions', () => {
    const insights = buildSequencePatternInsights([
      event({ title: 'Pay period or overtime record documented', date: 'January 2024' }),
      event({ title: 'Performance improvement plan issued', date: 'February 2024' }),
      event({ title: 'Termination documented', date: 'April 2024' }),
    ]);

    expect(insights.summaryLines).toContain(
      'The chronology includes discipline or performance records before separation documentation.'
    );
    expect(insights.reviewNotes).toContain(
      'Payroll and timekeeping records may help anchor employment dates, pay periods, hours, and schedule history.'
    );
    expect(insights.potentialGaps).toContain(
      'The file set does not yet clearly show the full sequence between discipline or performance records and separation documentation.'
    );
    expect(insights.missingRecordSuggestions).toEqual(
      expect.arrayContaining([
        'Performance history before the warning',
        'Communications explaining the warning',
        'Separation explanation or restructuring notice',
        'Additional timekeeping or schedule records for comparison',
      ])
    );
    expect(
      [
        ...insights.summaryLines,
        ...insights.potentialGaps,
        ...insights.reviewNotes,
        ...insights.missingRecordSuggestions,
      ].join(' ')
    ).not.toMatch(bannedLegalWording);
  });

  test('identifies leave or accommodation request response gap', () => {
    const insights = buildSequencePatternInsights([
      event({
        title: 'Worker requests leave or accommodation',
        related_topics: ['Leave concerns'],
      }),
    ]);

    expect(insights.summaryLines.join(' ')).toMatch(/leave or accommodation request/i);
    expect(insights.missingRecordSuggestions).toContain('Leave or accommodation response');
    expect(insights.missingRecordSuggestions).toContain(
      'Manager or HR communication about the leave or accommodation request'
    );
  });
});
