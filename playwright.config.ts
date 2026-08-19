import { defineConfig, devices } from '@playwright/test';

/**
 * Real browser E2E tests against a genuine running dev server (2026-08-19 hard-challenge
 * finding). Distinct from vitest's unit/integration suite: several fixes this project has shipped
 * were marked "not live-browser-verified" specifically because the prior tooling (vite-node,
 * synthetic-click browser automation) repeatedly failed to get past the landing page or run
 * client-side pdf.js text extraction. A real Playwright browser against the actual Vite dev
 * server sidesteps both limitations.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // --host 127.0.0.1 scoped to this Playwright run only (not vite.config.ts's shared server
    // settings, which stay untouched for the normal `npm run dev` workflow): on this machine
    // Vite's unspecified-host default binds IPv6 loopback (::1) only, while Chromium's own
    // "localhost" resolution doesn't reliably match it -- explicit IPv4 on both sides removes
    // the ambiguity entirely.
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
