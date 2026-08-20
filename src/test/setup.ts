import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Global vitest setup (2026-08-19). Vite's `?url` asset imports (used by
 * firmIntakePdfRenderer.ts's embedBrandFonts, and pdf.worker.min.mjs?url in
 * fileTextExtractionService.ts) resolve to a dev-server-relative path string like
 * "/src/assets/fonts/DejaVuSans.ttf" -- meaningful to a real browser fetching from a running
 * Vite server, but not a valid URL to Node's native `fetch` in vitest (no server exists). Rather
 * than mock fetch per test file (every test exercising the real PDF renderer would need it),
 * wrap it once globally: any fetch of a root-relative path under src/ is served from disk; every
 * other request goes to the real fetch unchanged.
 */
const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
const realFetch = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/src/') || url.startsWith('/@fs/')) {
    const relative = url.startsWith('/@fs/') ? url.slice(4) : url.slice(1);
    const filePath = path.join(projectRoot, relative.startsWith('/') ? relative.slice(1) : relative);
    const bytes = readFileSync(filePath);
    return Promise.resolve(
      new Response(new Uint8Array(bytes), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })
    );
  }
  return realFetch(input, init);
}) as typeof fetch;
