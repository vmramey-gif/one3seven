import { describe, expect, it } from 'vitest';
import { PERSONA_DEMOS, getPersonaDemo } from '../personaDemoData';

const VALID_COVERAGE_STATES = new Set(['on_file', 'worker_stated_missing', 'not_in_record']);

describe('personaDemoData (sales demo static data)', () => {
  it('ships exactly 5 personas with unique ids', () => {
    expect(PERSONA_DEMOS).toHaveLength(5);
    const ids = PERSONA_DEMOS.map((p) => p.personaId);
    expect(new Set(ids).size).toBe(5);
  });

  it('getPersonaDemo resolves each id and misses on an unknown one', () => {
    for (const p of PERSONA_DEMOS) {
      expect(getPersonaDemo(p.personaId)?.personaName).toBe(p.personaName);
    }
    expect(getPersonaDemo('not-a-real-persona')).toBeUndefined();
  });

  it('every persona has a non-name scenario hook and non-empty firm + worker payloads', () => {
    for (const p of PERSONA_DEMOS) {
      expect(p.scenarioLabel.length).toBeGreaterThan(0);
      expect(p.scenarioLabel.toLowerCase()).not.toContain(p.personaName.split(' ')[0].toLowerCase());

      // Firm side matches the FirmLiveIntakeView shape DemoApp.tsx already ships.
      expect(p.firm.previewOnly).toBe(false);
      expect(p.firm.routeStatus).toBe('full_access');
      expect(p.firm.events.length).toBeGreaterThan(0);
      expect(p.firm.files.length).toBeGreaterThan(0);
      expect(p.firm.overview.length).toBeGreaterThan(0);
      expect(p.firm.intelligence).toBeTruthy();

      // Worker side.
      expect(p.worker.workerName.length).toBeGreaterThan(0);
      expect(p.worker.employer.length).toBeGreaterThan(0);
      expect(p.worker.storyText.length).toBeGreaterThan(0);
      expect(p.worker.timeline.length).toBeGreaterThan(0);
      expect(p.worker.coverage.length).toBeGreaterThan(0);
    }
  });

  it('firm events never carry a fabricated worker_context (engine does not produce per-event quotes)', () => {
    for (const p of PERSONA_DEMOS) {
      for (const ev of p.firm.events) {
        expect(ev.worker_context).toBe('');
      }
    }
  });

  it('every coverage item reports a valid, doctrine-legal record state', () => {
    for (const p of PERSONA_DEMOS) {
      for (const item of p.worker.coverage) {
        expect(VALID_COVERAGE_STATES.has(item.state)).toBe(true);
      }
    }
  });

  it('firm and worker timelines are derived from the same event count per persona', () => {
    for (const p of PERSONA_DEMOS) {
      expect(p.worker.timeline.length).toBe(p.firm.events.length);
    }
  });

  it('documentRequest/documentResponse are null (no live firm workflow state in a static demo)', () => {
    for (const p of PERSONA_DEMOS) {
      expect(p.firm.documentRequest).toBeNull();
      expect(p.firm.documentResponse).toBeNull();
    }
  });
});
