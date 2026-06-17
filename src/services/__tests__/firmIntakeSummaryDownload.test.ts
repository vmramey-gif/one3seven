import { describe, expect, test } from 'vitest';
import {
  buildFirmIntakeReviewPdfLines,
  linkEventsToFiles,
  resolveFirmExportAccessTier,
} from '../firmIntakeSummaryDownload';
import type { FirmLiveIntakeView } from '../intakeDataService';

function baseView(overrides: Partial<FirmLiveIntakeView> = {}): FirmLiveIntakeView {
  return {
    previewOnly: false,
    routeId: 'route-1',
    routeStatus: 'full_access',
    intakeNumber: 'INT-FIRM-001',
    overview: `--- O3S_RECORD_STORY ---
Taken together, payroll and HR materials appear to span multiple periods.
--- O3S_RECORD_STORY_END ---`,
    timelineSummary: 'Available records show activity between March 2024 and April 2024.',
    events: [
      {
        id: 'e1',
        event_date: 'March 2024',
        title: 'Compensation period',
        category: 'Pay Records',
        ai_summary: 'Payroll materials may warrant review alongside later communications.',
        worker_context: 'Worker noted a concern about final pay timing.',
      },
    ],
    files: [
      { file_name: 'confidential-paystub.pdf', category: 'Pay Records', file_path: '/x' } as FirmLiveIntakeView['files'][0],
    ],
    readiness: ['This may be useful for human review: Pay periods may need confirmation.'],
    missing: ['This may help clarify a communication from this date range.'],
    documentRequest: null,
    documentResponse: null,
    intakeWorkflowStatus: 'Submitted',
    submissionChannel: 'participating_network',
    isFirmCodeIntake: false,
    workerProvidedContext: 'Worker narrative that must stay hidden in preview.',
    ...overrides,
  };
}

describe('firm intake summary download', () => {
  test('resolveFirmExportAccessTier respects preview and firm-code routes', () => {
    expect(resolveFirmExportAccessTier(baseView({ previewOnly: true }))).toBe('limited_preview');
    expect(resolveFirmExportAccessTier(baseView({ previewOnly: false }))).toBe('full_access');
    expect(
      resolveFirmExportAccessTier(
        baseView({ previewOnly: true, isFirmCodeIntake: true, submissionChannel: 'firm_code' })
      )
    ).toBe('direct_firm_code');
  });

  test('limited preview hides restricted details and uses polished section names', () => {
    const lines = buildFirmIntakeReviewPdfLines(baseView({ previewOnly: true, routeStatus: 'preview_sent' }));
    const text = lines.join('\n');

    expect(text).toContain('Access Level: Limited preview');
    expect(text).toContain('1. Review Snapshot');
    expect(text).toContain('3. Intake Overview');
    expect(text).toContain('4. Sequence for Attorney Review');
    expect(text).toContain('6. Supporting Records');

    expect(text).not.toContain('O3S_RECORD_STORY');
    expect(text).not.toContain('Review signals');
    expect(text).not.toContain('Chronology hints');
    expect(text).not.toContain('Category inventory');
    expect(text).not.toContain('EXECUTIVE SNAPSHOT');
    expect(text).not.toContain('confidential-paystub.pdf');
    expect(text).not.toContain('Worker narrative that must stay hidden');
  });

  test('full access export uses polished firm packet sections', () => {
    const lines = buildFirmIntakeReviewPdfLines(baseView({ previewOnly: false }));
    const text = lines.join('\n');

    expect(text).toContain('10. Worker Context');
    expect(text).toContain('6. Supporting Records');
    expect(text).toContain('Worker narrative that must stay hidden');
    expect(text).not.toContain('PAGE 3 — KNOWLEDGE CLUSTERS');
    expect(text).not.toContain('PAGE 5 — SUGGESTED REVIEW PROMPTS');
    expect(text).not.toContain('O3S_');
  });

  test('direct firm-code export uses full polished packet', () => {
    const lines = buildFirmIntakeReviewPdfLines(
      baseView({
        previewOnly: true,
        isFirmCodeIntake: true,
        submissionChannel: 'firm_code',
        routeStatus: 'preview_sent',
      })
    );
    const text = lines.join('\n');

    expect(text).toContain('10. Worker Context');
    expect(text).not.toContain('EXECUTIVE SNAPSHOT');
  });

  // Regression: a supporting file whose filename year clearly conflicts with the event
  // year must never be attributed to that event (Oct 2024 event ↮ Nov 2023 schedule notice).
  test('date-consistency guard: a 2023 file is not attributed to a 2024 event', () => {
    const linked = linkEventsToFiles(
      [{ date: 'October 2, 2024', title: 'Schedule change documented', category: 'Schedules' }],
      [{ file_name: 'Schedule_Change_Notice_November_2023.pdf', category: 'Schedules' }]
    );
    expect(linked[0].sourceFile).toBeNull();
  });

  test('date-consistency guard is narrow: a same-year file still links', () => {
    const linked = linkEventsToFiles(
      [{ date: 'October 2, 2024', title: 'Schedule change documented', category: 'Schedules' }],
      [{ file_name: 'Schedule_Change_Notice_October_2024.pdf', category: 'Schedules' }]
    );
    expect(linked[0].sourceFile).toBe('Schedule Change Notice October 2024');
  });
});
