/**
 * Verifies the sales demo's citation-highlighting fix actually works end to end: every
 * generated static source PDF (public/sales-demo-sources/*.pdf) genuinely contains its
 * persona's cited quote as extractable text, findable by the SAME normalization CitationPanel
 * uses (`squash`: lowercase, whitespace-stripped, substring match). A PDF that "looks right"
 * but isn't text-searchable would make the CitationPanel silently fall back — this test is the
 * guard against that regression.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PERSONA_DEMOS } from '../../app/demo/personaDemoData';
import { getDemoSourceUrl } from '../../app/demo/demoSourceFiles';

// Mirrors CitationPanel.tsx's `squash` exactly (whitespace-free, lowercase form used for
// PDF text-layer matching).
const squash = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');

async function extractSquashedText(pdfPath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let concat = '';
  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    for (const item of tc.items) {
      if (typeof (item as { str?: unknown }).str === 'string') {
        concat += squash((item as { str: string }).str);
      }
    }
  }
  return concat;
}

describe('sales demo source PDFs (public/sales-demo-sources)', () => {
  const allCitedQuotes = PERSONA_DEMOS.flatMap((entry) =>
    (entry.firm.intelligence?.keyQuotes ?? []).map((q) => ({
      personaId: entry.personaId,
      fileName: q.file_name,
      quote: q.quote,
    })),
  );

  it('has 30 cited quotes across the 5 personas (6 each)', () => {
    expect(allCitedQuotes.length).toBe(30);
  });

  it('resolves a static PDF URL for every cited quote', () => {
    for (const { personaId, fileName } of allCitedQuotes) {
      const url = getDemoSourceUrl(personaId, fileName);
      expect(url, `no static source for ${personaId} / ${fileName}`).toMatch(
        /^\/sales-demo-sources\/[a-z0-9-]+\.pdf$/,
      );
    }
  });

  it('every generated PDF genuinely contains its exact cited quote as extractable text', async () => {
    for (const { personaId, fileName, quote } of allCitedQuotes) {
      const url = getDemoSourceUrl(personaId, fileName)!;
      const pdfPath = path.join(PUBLIC_DIR, url);
      expect(fs.existsSync(pdfPath), `missing file on disk: ${pdfPath}`).toBe(true);

      const concat = await extractSquashedText(pdfPath);
      const targetSquashed = squash(quote);
      // Same probe CitationPanel uses: first 40 squashed chars (or the whole thing if shorter).
      const probe = targetSquashed.length > 40 ? targetSquashed.slice(0, 40) : targetSquashed;

      expect(concat.indexOf(probe), `probe not found in ${fileName} (${personaId})`).toBeGreaterThanOrEqual(0);
      expect(
        concat.indexOf(targetSquashed),
        `full quote not found verbatim in ${fileName} (${personaId})`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles the Spanish-language document (p5 Reporte de Horas) correctly', async () => {
    const entry = allCitedQuotes.find((q) => q.fileName === 'Reporte de Horas 16-31 mayo 2025.pdf');
    expect(entry).toBeTruthy();
    const url = getDemoSourceUrl(entry!.personaId, entry!.fileName)!;
    const pdfPath = path.join(PUBLIC_DIR, url);
    const concat = await extractSquashedText(pdfPath);
    expect(concat.indexOf(squash(entry!.quote))).toBeGreaterThanOrEqual(0);
  });
});
