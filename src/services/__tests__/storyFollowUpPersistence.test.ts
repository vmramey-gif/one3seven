import { describe, it, expect } from 'vitest';
import {
  extractStoryFollowUpFromOverview,
  mergeStoryFollowUpIntoWorkerNotesBody,
  formatStoryFollowUpForDisplay,
} from '../storyFollowUpPersistence';
import type { StoryFollowUpAnswers } from '../../app/constants/workerStoryIntake';

describe('storyFollowUpPersistence — work/employer state round-trip', () => {
  it('persists and re-parses employerState alongside workState', () => {
    const answers: StoryFollowUpAnswers = {
      employer: 'Pacific Ridge',
      workState: 'CA',
      employerState: 'TX',
    };
    const overview = mergeStoryFollowUpIntoWorkerNotesBody('', answers);
    const parsed = extractStoryFollowUpFromOverview(overview);
    expect(parsed?.workState).toBe('CA');
    expect(parsed?.employerState).toBe('TX');
  });

  it('employerState alone is enough content to persist and re-parse', () => {
    const overview = mergeStoryFollowUpIntoWorkerNotesBody('', { employerState: 'NY' });
    expect(extractStoryFollowUpFromOverview(overview)?.employerState).toBe('NY');
  });

  it('omits the employer-state line entirely when not provided', () => {
    const overview = mergeStoryFollowUpIntoWorkerNotesBody('', { workState: 'CA' });
    expect(overview).not.toMatch(/employer_state:/);
    expect(extractStoryFollowUpFromOverview(overview)?.employerState).toBe('');
  });

  it('shows both states in the human-readable display', () => {
    const display = formatStoryFollowUpForDisplay({ workState: 'CA', employerState: 'TX' });
    expect(display).toMatch(/work was performed: CA/i);
    expect(display).toMatch(/employer is based: TX/i);
  });
});
