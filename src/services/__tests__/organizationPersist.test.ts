import { describe, expect, test } from 'vitest';
import {
  extractWorkerIntakeNotesFromOverview,
  mergeWorkerIntakeNotesIntoOverview,
  parseWorkerIntakeNotesContent,
  preserveOverviewSidecarBlocks,
  rebuildWorkerIntakeNotesBody,
  stripWorkerIntakeNotesBlockForStorage,
} from '../intakeDataService';

const ORG_ENGINE_BLOCK =
  '--- O3S_ORG_ENGINE ---\n{"version":1,"file_records":[]}\n--- O3S_ORG_ENGINE_END ---';
const WORKER_CONTACT_BLOCK =
  '--- O3S_WORKER_CONTACT ---\nname:Jordan Lee\nphone:555-0100\n--- O3S_WORKER_CONTACT_END ---';
const MITIGATION_BLOCK =
  '--- O3S_MITIGATION_LOG ---\n[{"id":"m1"}]\n--- O3S_MITIGATION_LOG_END ---';

describe('Re-organize must not destroy embedded overview blocks', () => {
  test('notes reader survives a trimmed overview (safeTrim regression)', () => {
    const overview = mergeWorkerIntakeNotesIntoOverview('Narrative overview.', 'worker notes body');
    // upsert path runs safeTrim on the stored overview, removing the trailing newline the
    // old strict pattern required — the block must still parse afterwards.
    expect(extractWorkerIntakeNotesFromOverview(overview.trim())).toBe('worker notes body');
    // and a leading-edge trim (block at start of overview) must parse too
    const onlyNotes = mergeWorkerIntakeNotesIntoOverview('', 'worker notes body');
    expect(extractWorkerIntakeNotesFromOverview(onlyNotes.trim())).toBe('worker notes body');
  });

  test('merge preserves O3S_ORG_ENGINE and O3S_WORKER_CONTACT blocks in the base overview', () => {
    const base = `Narrative overview.\n${ORG_ENGINE_BLOCK}\n${WORKER_CONTACT_BLOCK}\n`;
    const merged = mergeWorkerIntakeNotesIntoOverview(base, 'worker notes body');
    expect(merged).toContain(ORG_ENGINE_BLOCK);
    expect(merged).toContain(WORKER_CONTACT_BLOCK);
    expect(extractWorkerIntakeNotesFromOverview(merged)).toBe('worker notes body');

    // repeated rebuild cycles (the compounding-loss scenario) keep every block intact
    const again = mergeWorkerIntakeNotesIntoOverview(merged.trim(), 'worker notes body v2');
    expect(again).toContain(ORG_ENGINE_BLOCK);
    expect(again).toContain(WORKER_CONTACT_BLOCK);
    expect(extractWorkerIntakeNotesFromOverview(again)).toBe('worker notes body v2');
    expect(again.match(/--- O3S_WORKER_INTAKE_NOTES ---/g) ?? []).toHaveLength(1);
  });

  test('storage-safe strip removes only the notes block', () => {
    const base = `Narrative overview.\n${ORG_ENGINE_BLOCK}\n${WORKER_CONTACT_BLOCK}\n`;
    const merged = mergeWorkerIntakeNotesIntoOverview(base, 'worker notes body');
    const stripped = stripWorkerIntakeNotesBlockForStorage(merged);
    expect(stripped).not.toContain('O3S_WORKER_INTAKE_NOTES');
    expect(stripped).toContain(ORG_ENGINE_BLOCK);
    expect(stripped).toContain(WORKER_CONTACT_BLOCK);
    expect(stripped).toContain('Narrative overview.');
  });

  test('preserveOverviewSidecarBlocks copies a missing mitigation log forward, never duplicates', () => {
    const previous = `Old overview.\n${MITIGATION_BLOCK}\n${WORKER_CONTACT_BLOCK}\n`;
    const rebuilt = 'Fresh rebuilt overview.';
    const preserved = preserveOverviewSidecarBlocks(previous, rebuilt);
    expect(preserved).toContain(MITIGATION_BLOCK);
    expect(preserved).toContain(WORKER_CONTACT_BLOCK);
    expect(preserved).toContain('Fresh rebuilt overview.');

    // block already present in the rebuilt overview must not be duplicated
    const withExisting = `Fresh rebuilt overview.\n${MITIGATION_BLOCK}\n`;
    const preserved2 = preserveOverviewSidecarBlocks(previous, withExisting);
    expect(preserved2.match(/--- O3S_MITIGATION_LOG ---/g) ?? []).toHaveLength(1);

    // no previous overview → unchanged
    expect(preserveOverviewSidecarBlocks('', rebuilt)).toBe(rebuilt);
    expect(preserveOverviewSidecarBlocks(null, rebuilt)).toBe(rebuilt);
  });

  test('rebuildWorkerIntakeNotesBody round-trips story follow-up and category scaffold markers', () => {
    const notesBody = [
      '--- O3S_GUIDED_INTAKE ---\nTopics: Overtime\n--- O3S_GUIDED_INTAKE_END ---',
      '--- O3S_WORKER_STORY ---\nI worked overtime without pay.\n--- O3S_WORKER_STORY_END ---',
      '--- O3S_CATEGORY_SCAFFOLD ---\nHow often?: Weekly\n--- O3S_CATEGORY_SCAFFOLD_END ---',
      'Extra note from the worker.',
      '--- O3S_STORY_FOLLOWUP ---\nemployer:Acme Corp\nwork_state:CA\n--- O3S_STORY_FOLLOWUP_END ---',
    ].join('\n\n');

    const parsed = parseWorkerIntakeNotesContent(notesBody);
    expect(parsed.workerStory).toBe('I worked overtime without pay.');
    expect(parsed.storyFollowUp).toContain('employer:Acme Corp');
    expect(parsed.categoryScaffold).toContain('How often?: Weekly');

    const rebuilt = rebuildWorkerIntakeNotesBody(parsed);
    expect(rebuilt).toContain('--- O3S_STORY_FOLLOWUP ---');
    expect(rebuilt).toContain('--- O3S_CATEGORY_SCAFFOLD ---');

    const reparsed = parseWorkerIntakeNotesContent(rebuilt);
    expect(reparsed.guidedSummary).toBe(parsed.guidedSummary);
    expect(reparsed.workerStory).toBe(parsed.workerStory);
    expect(reparsed.additionalNotes).toBe(parsed.additionalNotes);
    expect(reparsed.storyFollowUp).toBe(parsed.storyFollowUp);
    expect(reparsed.categoryScaffold).toBe(parsed.categoryScaffold);

    // a notes edit (replacing additionalNotes) keeps the follow-up answers
    const edited = rebuildWorkerIntakeNotesBody({ ...parsed, additionalNotes: 'Edited note.' });
    expect(edited).toContain('employer:Acme Corp');
    expect(edited).toContain('Edited note.');
  });
});
