import { test, expect } from '@playwright/test';

/**
 * First real Playwright coverage (2026-08-19 hard-challenge finding). This exact flow -- the
 * public worker landing page's "Start organizing" CTA -- is the one repeatedly cited across
 * project history as "not live-browser-verified" because prior tooling (synthetic clicks via a
 * vite-node-driven harness) couldn't reliably interact with it. A real browser against the real
 * dev server has none of that limitation.
 */
test.describe('worker landing page', () => {
  test('loads with the worker-first CTA visible', async ({ page }) => {
    await page.goto('/');
    // Two "Start organizing" buttons exist on the page (hero + a secondary CTA further down) --
    // .first() is the hero one, which is what this test cares about being visible on load.
    await expect(page.getByRole('button', { name: /start organizing/i }).first()).toBeVisible();
  });

  test('"Start organizing" navigates to account creation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /start organizing/i }).first().click();
    await expect(
      page.getByText('Create your account, then choose your workspace type.')
    ).toBeVisible();
  });
});
