import { describe, it, expect } from 'vitest';
import {
  classifyEventRole,
  detectCaseTimelinePatterns,
  describeSequence,
} from '../caseTimelinePatterns';

describe('classifyEventRole', () => {
  it('classifies protected activity', () => {
    expect(classifyEventRole('Concern raised with HR')).toBe('protected_activity');
    expect(classifyEventRole('Formal HR complaint filed')).toBe('protected_activity');
    expect(classifyEventRole('Requested a reasonable accommodation')).toBe('protected_activity');
    expect(classifyEventRole('Took medical leave')).toBe('protected_activity');
  });

  it('classifies adverse action', () => {
    expect(classifyEventRole('Written warning issued')).toBe('adverse_action');
    expect(classifyEventRole('Employment terminated')).toBe('adverse_action');
    expect(classifyEventRole('Hours cut')).toBe('adverse_action');
    expect(classifyEventRole('Placed on a PIP')).toBe('adverse_action');
  });

  it('treats neutral events as neutral', () => {
    expect(classifyEventRole('Pay stub — October 2025', 'Wage Records')).toBe('neutral');
    expect(classifyEventRole('Employment begins')).toBe('neutral');
  });

  it('adverse action wins when a title mentions both (a warning ABOUT a complaint)', () => {
    expect(classifyEventRole('Written warning after complaint')).toBe('adverse_action');
  });

  it('catches stress-test misses (protected + adverse)', () => {
    // Protected — safety reporting, and present-tense "raises" (our own generated title).
    expect(classifyEventRole('Worker raises safety concerns')).toBe('protected_activity');
    expect(classifyEventRole('Safety complaint filed')).toBe('protected_activity');
    // Adverse — reversed word order and forms the old patterns missed.
    expect(classifyEventRole('Hours reduced')).toBe('adverse_action');
    expect(classifyEventRole('Removed from project')).toBe('adverse_action');
    expect(classifyEventRole('Project removal documented')).toBe('adverse_action');
    expect(classifyEventRole('Denied promotion')).toBe('adverse_action');
    expect(classifyEventRole('Written up for attitude')).toBe('adverse_action');
  });

  it('does NOT over-classify — benign events stay neutral (no false proximity)', () => {
    expect(classifyEventRole('Promotion awarded')).toBe('neutral');
    expect(classifyEventRole('Received a promotion')).toBe('neutral');
    expect(classifyEventRole('Schedule change documented')).toBe('neutral');
    expect(classifyEventRole('Performance review completed')).toBe('neutral');
  });
});

describe('detectCaseTimelinePatterns', () => {
  it('finds the Marcus Rivera proximity pattern (complaint -> warning -> termination)', () => {
    const r = detectCaseTimelinePatterns([
      { date: 'Nov 14, 2025', title: 'Formal HR complaint filed' },
      { date: 'Nov 25, 2025', title: 'Written warning issued' },
      { date: 'Dec 19, 2025', title: 'Employment terminated' },
    ]);
    expect(r.hasProximityPattern).toBe(true);
    // complaint -> next adverse action is the warning, 11 days later
    expect(r.closestIntervalDays).toBe(11);
    expect(r.sequences[0].withinNinetyDays).toBe(true);
    expect(r.protectedActivities).toHaveLength(1);
    expect(r.adverseActions).toHaveLength(2);
  });

  it('pairs each protected activity with the NEXT adverse action only', () => {
    const r = detectCaseTimelinePatterns([
      { date: 'Jan 1, 2025', title: 'Reported safety concern' },
      { date: 'Feb 1, 2025', title: 'Written warning issued' },
      { date: 'Mar 1, 2025', title: 'Employment terminated' },
    ]);
    // one activity -> its next action (the warning ~31 days later), not the termination
    expect(r.sequences).toHaveLength(1);
    expect(r.sequences[0].action.title).toBe('Written warning issued');
    expect(r.sequences[0].intervalDays).toBeGreaterThanOrEqual(30);
    expect(r.sequences[0].intervalDays).toBeLessThanOrEqual(32);
  });

  it('ignores adverse actions that came BEFORE the protected activity (no false proximity)', () => {
    const r = detectCaseTimelinePatterns([
      { date: 'Jan 1, 2025', title: 'Written warning issued' }, // before
      { date: 'Feb 1, 2025', title: 'Filed a complaint' }, // activity after the warning
    ]);
    expect(r.hasProximityPattern).toBe(false);
    expect(r.sequences).toHaveLength(0);
  });

  it('flags an interval over 90 days as not-within-window (still a fact, no conclusion)', () => {
    const r = detectCaseTimelinePatterns([
      { date: 'Jan 1, 2025', title: 'Complained to management' },
      { date: 'Jun 1, 2025', title: 'Employment terminated' }, // ~151 days
    ]);
    expect(r.hasProximityPattern).toBe(true);
    expect(r.sequences[0].withinNinetyDays).toBe(false);
    expect(r.sequences[0].intervalDays).toBeGreaterThan(90);
  });

  it('handles undated / unparseable events without crashing', () => {
    const r = detectCaseTimelinePatterns([
      { date: 'sometime last year', title: 'Complained' },
      { date: 'Dec 19, 2025', title: 'Employment terminated' },
    ]);
    // the complaint has no usable date, so no sequence can be computed
    expect(r.hasProximityPattern).toBe(false);
    expect(r.protectedActivities).toHaveLength(1); // still classified
  });

  it('no pattern when there is no protected activity at all', () => {
    const r = detectCaseTimelinePatterns([
      { date: 'Mar 2022', title: 'Employment begins' },
      { date: 'Dec 2025', title: 'Employment terminated' },
    ]);
    expect(r.hasProximityPattern).toBe(false);
  });
});

describe('describeSequence — plain facts only, never a conclusion', () => {
  it('states the two dated events and the interval', () => {
    const r = detectCaseTimelinePatterns([
      { date: 'Nov 14, 2025', title: 'Concern raised with HR' },
      { date: 'Nov 25, 2025', title: 'Written warning issued' },
    ]);
    const line = describeSequence(r.sequences[0]);
    expect(line).toContain('Concern raised with HR');
    expect(line).toContain('Written warning issued');
    expect(line).toContain('11 days later');
    // must NOT editorialize / conclude
    expect(line).not.toMatch(/retaliat|presumption|unlawful|illegal|suspicious|proves|because/i);
  });
});
