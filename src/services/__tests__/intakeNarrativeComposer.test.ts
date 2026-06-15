import { describe, expect, test } from 'vitest';
import { composeIntakeNarrativeForDisplay } from '../intakeNarrativeComposer';
import type { IntakeSummaryDownloadPayload } from '../intakeSummaryDownload';

const BASE: IntakeSummaryDownloadPayload = {
  intakeNumber: 'INT-002',
  intakeStatus: 'Submitted',
  workerName: 'Jordan Lee',
  employerName: 'North Bay Services',
  workerContext: `--- O3S_WORKER_STORY ---
I raised concerns about unpaid overtime before my hours were cut.
--- O3S_WORKER_STORY_END ---`,
  overview: '',
  timelineSummary: '',
  categories: ['Pay Records'],
  categoryBreakdown: [{ name: 'Pay Records', count: 1 }],
  readiness: [],
  missing: ['This may help clarify mileage records.'],
  disclaimer: 'Not legal advice.',
};

describe('intakeNarrativeComposer', () => {
  test('returns story-first executive summary and attorney-friendly topic bullets', () => {
    const narrative = composeIntakeNarrativeForDisplay(BASE);
    expect(narrative.intakeAtAGlance).toMatch(/Jordan Lee|unpaid overtime/i);
    expect(narrative.intakeAtAGlance).not.toMatch(/Worker reports concerns regarding/i);
    expect(narrative.chronologyOverview).toBe('');
    expect(narrative.reviewFocusAreas).toContain('Payroll & Compensation Records');
    expect(narrative.recordCompleteness[0]).toMatch(/mileage records/i);
    expect(narrative.recordCompleteness[0]).not.toMatch(/this may help clarify/i);
  });
});
