import { describe, it, expect } from 'vitest';
import { deriveStageFromActivity, deriveNextFollowup } from '../crmStageLogic';

describe('deriveStageFromActivity', () => {
  it('an explicit new stage selection always wins', () => {
    expect(deriveStageFromActivity({ newStage: 'pilot', outcome: 'Left voicemail' }, 'target')).toBe('pilot');
    expect(deriveStageFromActivity({ newStage: 'nurture' }, 'demo_booked')).toBe('nurture');
  });

  it('logging "demo booked" as the outcome auto-updates the stage to demo_booked', () => {
    expect(deriveStageFromActivity({ outcome: 'Demo booked' }, 'contacted')).toBe('demo_booked');
    expect(deriveStageFromActivity({ outcome: 'They booked a demo for Friday' }, 'convo')).toBe('demo_booked');
  });

  it('logging "pilot started" auto-updates the stage to pilot', () => {
    expect(deriveStageFromActivity({ outcome: 'Pilot started' }, 'demo_done')).toBe('pilot');
    expect(deriveStageFromActivity({ outcome: 'pilot' }, 'demo_done')).toBe('pilot');
  });

  it('maps other clear outcomes', () => {
    expect(deriveStageFromActivity({ outcome: 'Not interested' }, 'contacted')).toBe('no');
    expect(deriveStageFromActivity({ outcome: 'Paid' }, 'pilot')).toBe('paid');
    expect(deriveStageFromActivity({ outcome: 'Demo completed' }, 'demo_booked')).toBe('demo_done');
  });

  it('keeps the current stage when the outcome is neutral or empty', () => {
    expect(deriveStageFromActivity({ outcome: 'Left voicemail' }, 'contacted')).toBe('contacted');
    expect(deriveStageFromActivity({ outcome: 'No answer' }, 'target')).toBe('target');
    expect(deriveStageFromActivity({ outcome: '' }, 'convo')).toBe('convo');
    expect(deriveStageFromActivity({}, 'demo_booked')).toBe('demo_booked');
  });

  it('ignores an invalid newStage value and falls back to outcome/current', () => {
    // @ts-expect-error testing runtime guard against bad stage strings
    expect(deriveStageFromActivity({ newStage: 'bogus', outcome: 'Demo booked' }, 'target')).toBe('demo_booked');
    // @ts-expect-error testing runtime guard against bad stage strings
    expect(deriveStageFromActivity({ newStage: 'bogus' }, 'contacted')).toBe('contacted');
  });
});

describe('deriveNextFollowup', () => {
  it('propagates the activity follow-up date to the firm when set', () => {
    expect(deriveNextFollowup({ nextFollowup: '2026-07-01' }, null)).toBe('2026-07-01');
    expect(deriveNextFollowup({ nextFollowup: '2026-07-01' }, '2026-06-30')).toBe('2026-07-01');
  });

  it('leaves the firm follow-up unchanged when the activity has none', () => {
    expect(deriveNextFollowup({}, '2026-06-30')).toBe('2026-06-30');
    expect(deriveNextFollowup({ nextFollowup: '' }, '2026-06-30')).toBe('2026-06-30');
    expect(deriveNextFollowup({ nextFollowup: '   ' }, null)).toBe(null);
  });
});
