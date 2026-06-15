import { describe, expect, test } from 'vitest';
import {
  polishFirmFacingProse,
  polishFirmFacingText,
  polishMissingContextLine,
  resolveFirmPersistedWorkflowStatus,
  stripFirmFacingArtifacts,
} from '../firmIntakeDisplay';

describe('firmIntakeDisplay', () => {
  test('stripFirmFacingArtifacts removes O3S blocks and system markers', () => {
    const raw = `--- O3S_RECORD_STORY ---
Taken together, payroll materials span multiple periods.
--- O3S_RECORD_STORY_END ---

--- O3S_STORY_FOLLOWUP ---
employer:Acme Logistics
employment_dates:2023-2024
--- O3S_STORY_FOLLOWUP_END ---

SYSTEM_CONTEXT should not appear.`;

    const out = stripFirmFacingArtifacts(raw);
    expect(out).not.toMatch(/O3S_/);
    expect(out).not.toContain('SYSTEM_CONTEXT');
    expect(out).not.toContain('employer:Acme');
  });

  test('polishFirmFacingText rewrites snake_case field labels', () => {
    expect(polishFirmFacingText('employer: Acme Corp')).toBe('Employer: Acme Corp');
    expect(polishFirmFacingText('termination_date: March 2024')).toBe('Separation Date: March 2024');
  });

  test('polishFirmFacingProse softens extraction terminology', () => {
    const out = polishFirmFacingProse('Payroll record detected for March 2024. Signal detected in HR files.');
    expect(out.toLowerCase()).not.toContain('signal detected');
    expect(out.toLowerCase()).not.toContain('record detected');
  });

  test('resolveFirmPersistedWorkflowStatus maps live workflow states', () => {
    expect(
      resolveFirmPersistedWorkflowStatus({
        intakeWorkflowStatus: 'Additional Documents Requested',
        routeStatus: 'full_access',
      }).label
    ).toBe('Additional Documents Requested');

    expect(
      resolveFirmPersistedWorkflowStatus({
        intakeWorkflowStatus: 'Worker Uploaded Requested Documents',
        routeStatus: 'full_access',
        documentResponse: { fulfilled: ['Pay records / paystubs'], note: '' },
      }).label
    ).toBe('Worker Uploaded Requested Documents');

    expect(
      resolveFirmPersistedWorkflowStatus({
        intakeWorkflowStatus: 'Shared with Participating Firm',
        routeStatus: 'full_access',
      }).label
    ).toBe('Full access granted');

    expect(
      resolveFirmPersistedWorkflowStatus({
        intakeWorkflowStatus: 'Firm Interest Received',
        routeStatus: 'access_requested',
      }).label
    ).toBe('Full access requested');

    expect(
      resolveFirmPersistedWorkflowStatus({
        intakeWorkflowStatus: 'Under Firm Review',
        routeStatus: 'full_access',
      }).label
    ).toBe('Full access granted');

    expect(
      resolveFirmPersistedWorkflowStatus({
        intakeWorkflowStatus: 'Intake Summary Generated',
        routeStatus: 'preview_sent',
        isSamplePreview: true,
      }).label
    ).toMatch(/Demo preview/);
  });
});
