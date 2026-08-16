import { describe, it, expect } from 'vitest';
import { resolveWorkerStatusJourney } from '../WorkerStatusJourneyCard';

describe('resolveWorkerStatusJourney — firm decline ("Not Pursuing")', () => {
  it('does not regress to step 0 for a participating-channel decline at full_access', () => {
    const result = resolveWorkerStatusJourney('Not Pursuing', 'participating', 'full_access');
    expect(result.mode).toBe('participating');
    expect(result.activeIndex).toBeGreaterThan(0);
    expect(result.currentLabel).not.toBe('You got started');
  });

  it('does not regress to step 0 for a firm-code decline at full_access', () => {
    const result = resolveWorkerStatusJourney('Not Pursuing', 'firm_code', 'full_access');
    expect(result.mode).toBe('firm-code');
    expect(result.activeIndex).toBeGreaterThan(0);
    expect(result.currentLabel).not.toBe('You got started');
  });

  it('resolves firm-code mode for a decline even though "Not Pursuing" alone is not in the firm-code workflow allowlist', () => {
    // Before the fix, resolveJourneyMode fell through to 'pre-share' for this exact case.
    const result = resolveWorkerStatusJourney('Not Pursuing', 'firm_code', 'preview_sent');
    expect(result.mode).toBe('firm-code');
  });

  it('subtitle reflects the decline instead of claiming a firm is still reviewing', () => {
    const result = resolveWorkerStatusJourney('Not Pursuing', 'firm_code', 'full_access');
    expect(result.subtitle.toLowerCase()).not.toContain('reviewing');
    expect(result.subtitle).toContain("isn't moving forward");
  });

  it('falls back to a sane mid-journey step (not step 0) when route status is unrecognized', () => {
    const result = resolveWorkerStatusJourney('Not Pursuing', 'firm_code', null);
    expect(result.activeIndex).toBeGreaterThan(0);
  });
});
