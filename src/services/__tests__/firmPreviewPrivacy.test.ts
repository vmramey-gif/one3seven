import { describe, it, expect } from 'vitest';
import {
  mergeWorkerIntakeNotesIntoOverview,
  resolveWorkerProvidedContextForFirmView,
  stripWorkerFollowUpNarrativeForPreview,
} from '../intakeDataService';
import {
  extractStoryFollowUpFromOverview,
  mergeStoryFollowUpIntoWorkerNotesBody,
} from '../storyFollowUpPersistence';

/**
 * Loader-level privacy gate — the product promise on the worker dashboard
 * (one3sevenProduct.ts): "Firms do not see yet: your full file contents, personal narrative,
 * or private notes—unless you approve expanded review access."
 *
 * These tests exercise the EXACT calls loadFirmLiveIntakeView makes to assemble the firm view
 * model: `resolveWorkerProvidedContextForFirmView(overviewRaw, contexts, { includeTimelineContext:
 * !previewOnly, previewOnly })` and (on preview routes) `stripWorkerFollowUpNarrativeForPreview`.
 * A preview-only (pre-approval) view model must contain NONE of the private narrative strings;
 * a full-access view model must contain them.
 *
 * NOTE: this is a presentation gate, not a security boundary — the durable fix is server-side
 * (strip worker-note blocks before the intake_summaries row reaches a preview-only firm).
 */

const STORY = 'They walked me out on March 6 after I reported the payroll discrepancy to HR.';
const NOTES = 'My manager also texted me after hours about the missing paystubs.';
const COMPLAINED = 'I reported the payroll discrepancy to HR in February.';
const CHANGED = 'My schedule was cut the following week.';
const TIMELINE_CTX = 'This was the week my hours were cut.';

const PRIVATE_STRINGS = [STORY, NOTES, COMPLAINED, CHANGED, TIMELINE_CTX];

function buildOverviewRaw(): string {
  let notesBody = `--- O3S_WORKER_STORY ---\n${STORY}\n--- O3S_WORKER_STORY_END ---\n\n${NOTES}`;
  notesBody = mergeStoryFollowUpIntoWorkerNotesBody(notesBody, {
    employmentName: 'Jordan Alvarez',
    employer: 'Bluefin Logistics LLC',
    employmentStatus: 'employment_ended',
    complainedOrReported: COMPLAINED,
    changedAfterward: CHANGED,
    workState: 'CA',
  });
  return mergeWorkerIntakeNotesIntoOverview('Organized intake summary.', notesBody);
}

const containsCI = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

describe('firm preview privacy gate (loader-level)', () => {
  const overviewRaw = buildOverviewRaw();

  it('previewOnly view model carries NO worker narrative — story, notes, follow-up narrative, timeline context all withheld', () => {
    const previewCtx = resolveWorkerProvidedContextForFirmView(overviewRaw, [TIMELINE_CTX], {
      includeTimelineContext: false,
      previewOnly: true,
    });
    expect(previewCtx).toBeUndefined();
    for (const s of PRIVATE_STRINGS) {
      expect(containsCI(previewCtx ?? '', s)).toBe(false);
    }
  });

  it('full-access view model DOES carry the worker narrative', () => {
    const fullCtx =
      resolveWorkerProvidedContextForFirmView(overviewRaw, [TIMELINE_CTX], {
        includeTimelineContext: true,
        previewOnly: false,
      }) ?? '';
    for (const s of PRIVATE_STRINGS) {
      expect(containsCI(fullCtx, s)).toBe(true);
    }
  });

  it('preview follow-up strips the free-text narrative answers but keeps structured identity fields', () => {
    const followUp = extractStoryFollowUpFromOverview(overviewRaw);
    expect(followUp?.complainedOrReported).toBe(COMPLAINED); // present pre-strip
    const stripped = stripWorkerFollowUpNarrativeForPreview(followUp);
    expect(stripped?.complainedOrReported).toBe('');
    expect(stripped?.changedAfterward).toBe('');
    expect(stripped?.remoteExpenses).toBe('');
    expect(stripped?.priorAgencyFilingDetails).toBe('');
    // structured, already-surfaced preview fields survive
    expect(stripped?.employmentName).toBe('Jordan Alvarez');
    expect(stripped?.employer).toBe('Bluefin Logistics LLC');
    expect(stripped?.employmentStatus).toBe('employment_ended');
    expect(stripped?.workState).toBe('CA');
  });

  it('stripWorkerFollowUpNarrativeForPreview passes null through', () => {
    expect(stripWorkerFollowUpNarrativeForPreview(null)).toBeNull();
  });
});
