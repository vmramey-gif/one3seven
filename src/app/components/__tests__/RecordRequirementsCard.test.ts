/**
 * Guardrail: RecordRequirementsCard is worker-facing and must never render a per-item statute
 * citation. The underlying engine (caEmployerRecordRequirements.ts) still computes `citation` for
 * the counsel-gated attorney-facing surfaces (Decision Card / Element Lens / firm PDF) — pairing a
 * specific statute with a specific worker's specific gap, directly to an unrepresented worker, is
 * the exact combination that reads as individualized legal advice rather than legal information.
 *
 * Source-text scan, not a render test: this codebase has no component-render test infra
 * (no @testing-library/react), matching the pattern already used by marketingCopyGuardrails.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(
  fileURLToPath(new URL('../RecordRequirementsCard.tsx', import.meta.url)),
  'utf8',
);

describe('RecordRequirementsCard — no per-item citation reaches the worker', () => {
  it('never references it.citation or coverage item citation in rendered output', () => {
    expect(SOURCE).not.toMatch(/it\.citation/);
    expect(SOURCE).not.toMatch(/\{.*\bcitation\b.*\}/);
  });

  it('does not frame the record list as a California legal requirement applied to this worker', () => {
    expect(SOURCE).not.toMatch(/california (generally )?requires/i);
  });
});
