import { describe, expect, test, vi, beforeEach } from 'vitest';

/**
 * Documents safe summary save behavior: update existing row or insert — never delete-first.
 * Full integration is covered by organization pipeline + Supabase in manual QA.
 */
describe('intake summary save contract', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('persistPlaceholderOrganizationForIntake does not reference delete on intake_summaries', async () => {
    const source = await import('../intakeDataService?raw');
    const raw = String(source.default ?? source);
    expect(raw).not.toMatch(/from\('intake_summaries'\)\.delete\(\)/);
    expect(raw).toContain('upsertIntakeSummaryRow');
    expect(raw).toContain("operation: 'update'");
    expect(raw).toContain("operation: 'insert'");
  });
});
