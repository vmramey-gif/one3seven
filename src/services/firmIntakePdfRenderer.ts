/**
 * Prestige PDF renderer for the firm intake packet (pdf-lib).
 * PRESENTATION ONLY — it consumes a fully-built FirmPacketModel and lays it out.
 * It performs no content selection, no language generation, and no interpretation;
 * every string handed to it has already passed the dictionary/guardrail layer.
 *
 * Brand color: #42574E (sage — 2026-07-08 brand). Violet is reserved for AI UI only.
 */

import { PDFDocument, StandardFonts, rgb, PDFName, PDFArray, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { DamagesReport } from './damagesCalculator';

/**
 * A cited source document, supplied so the renderer can embed its pages as an appendix
 * and hyperlink each citation to the exact reproduced page (self-contained, forwardable).
 * docId must match SourceCitation.docId. Unsupported/undecodable files are skipped
 * gracefully (the citation then renders as plain text, as before).
 */
export type PdfSourceDoc = { docId: string; fileName: string; mime: string; bytes: Uint8Array };

// ── Brand + palette ──────────────────────────────────────────────────────────
const BRAND = rgb(0x42 / 255, 0x57 / 255, 0x4e / 255); // #42574E sage
const BRAND_SOFT = rgb(0xe7 / 255, 0xed / 255, 0xe8 / 255); // #E7EDE8 sage tint fill
const BRAND_LINE = rgb(0xd3 / 255, 0xde / 255, 0xd6 / 255); // #D3DED6 sage hairline
const INK = rgb(0.10, 0.13, 0.11); // green-ink
const SOFT = rgb(0.24, 0.28, 0.26); // sage-gray
const MUTED = rgb(0.45, 0.47, 0.55);
const WHITE = rgb(1, 1, 1);
const AMBER_FILL = rgb(1.0, 0.97, 0.9);
const AMBER_INK = rgb(0.6, 0.4, 0.05);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = MARGIN + 28; // reserve room for footer

// ── Model contract (built upstream from FirmLiveIntakeView) ───────────────────
export type FirmPacketModel = {
  cover: {
    workerName: string | null;
    /** Optional callback number. Rendered under the worker name when present. */
    workerPhone?: string | null;
    employer: string | null;
    employmentPeriod: string | null;
    recordCount: number;
    eventCount: number;
    preparedDate: string;
  };
  reviewSnapshot: string[];
  whyReview: string;
  extracted: {
    confirmedFacts: Array<{ label: string; value: string }>;
    coworkerCorroboration: string | null;
    timingIntervals: Array<{ label: string; days: number; description: string }>;
    keyQuotes: Array<{ category: string; fileName: string; quote: string }>;
    overtimeNote: string | null;
  } | null;
  overviewFields: Array<{ label: string; value: string }>;
  sequence:
    | { kind: 'preview' | 'empty'; note: string }
    | { kind: 'events'; events: Array<{ date: string; title: string; interval: string | null; sourceFile: string | null }> };
  priorityQuestions: string[];
  records:
    | { kind: 'preview' | 'empty'; note: string }
    | { kind: 'list'; priority: Array<{ name: string; category: string }>; supporting: Array<{ name: string; category: string }> };
  dvwRows: Array<{ question: string; support: string }>;
  confirmationItems: string[];
  clarificationQuestions: string[];
  workerContext: { kind: 'hidden'; } | { kind: 'text'; paragraphs: string[] } | { kind: 'none' };
  reviewOptions: {
    unresolvedCount: number;
    priorityCount: number;
    totalRecords: number;
    additionalRecords: string[];
    actions: string;
  };
  disclaimer: string[];
  documentWorkflow: Array<{ heading: string; lines: string[] }>;
  /**
   * Firm-only wage-exposure estimate (section 8B). null = not calculated / not shown.
   * Presentation-only: the report is fully computed upstream by damagesCalculator;
   * `disclaimer` is the verbatim hard-disclaimer text. NEVER populated for worker packets.
   */
  wageExposure: { report: DamagesReport; disclaimer: string[] } | null;
};

// ── Tiny layout engine over pdf-lib ───────────────────────────────────────────
class Cursor {
  page: PDFPage;
  y = PAGE_H - MARGIN;
  pageNo = 0;
  /** Citation link hot-spots captured during body render; resolved once the source
   *  appendix is embedded and the docId→page destination map is known. */
  pendingLinks: Array<{ page: PDFPage; rect: [number, number, number, number]; docId: string }> = [];
  constructor(
    private doc: PDFDocument,
    public font: PDFFont,
    public bold: PDFFont,
  ) {
    this.page = this.addPage();
  }

  get document(): PDFDocument {
    return this.doc;
  }

  /** Register a clickable rectangle on the current page to be linked to `docId`'s source page. */
  linkRect(rect: [number, number, number, number], docId: string): void {
    this.pendingLinks.push({ page: this.page, rect, docId });
  }

  private addPage(): PDFPage {
    this.pageNo += 1;
    const p = this.doc.addPage([PAGE_W, PAGE_H]);
    this.page = p;
    this.y = PAGE_H - MARGIN;
    return p;
  }

  newPage(): void {
    this.addPage();
  }

  ensure(height: number): void {
    if (this.y - height < BOTTOM) this.addPage();
  }

  gap(h: number): void {
    this.y -= h;
  }

  /** Width-aware word wrap. */
  wrap(text: string, size: number, font: PDFFont, maxWidth = CONTENT_W): string[] {
    const words = (text ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!words.length) return [''];
    const out: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
      } else {
        if (line) out.push(line);
        // hard-break a single overlong token
        if (font.widthOfTextAtSize(w, size) > maxWidth) {
          let chunk = '';
          for (const ch of w) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else {
          line = w;
        }
      }
    }
    if (line) out.push(line);
    return out;
  }

  /** Draw wrapped paragraph text. Returns nothing; advances cursor. */
  text(
    str: string,
    opts: { size?: number; font?: PDFFont; color?: RGB; x?: number; maxWidth?: number; leading?: number } = {},
  ): void {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.font;
    const color = opts.color ?? SOFT;
    const x = opts.x ?? MARGIN;
    const maxWidth = opts.maxWidth ?? CONTENT_W - (x - MARGIN);
    const leading = opts.leading ?? size * 1.45;
    for (const line of this.wrap(str, size, font, maxWidth)) {
      this.ensure(leading);
      this.page.drawText(line, { x, y: this.y - size, size, font, color });
      this.y -= leading;
    }
  }
}

function rule(c: Cursor, color = BRAND_LINE, thickness = 1): void {
  c.ensure(8);
  c.page.drawLine({ start: { x: MARGIN, y: c.y }, end: { x: PAGE_W - MARGIN, y: c.y }, thickness, color });
  c.y -= 8;
}

function sectionHeading(c: Cursor, label: string): void {
  c.gap(10);
  c.ensure(26);
  // brand tab + heading text
  c.page.drawRectangle({ x: MARGIN, y: c.y - 14, width: 3, height: 15, color: BRAND });
  c.page.drawText(label, { x: MARGIN + 10, y: c.y - 12, size: 12.5, font: c.bold, color: INK });
  c.y -= 20;
  rule(c, BRAND_LINE, 0.75);
}

function bullet(c: Cursor, text: string): void {
  c.ensure(14);
  c.page.drawText('•', { x: MARGIN + 2, y: c.y - 10, size: 10, font: c.bold, color: BRAND });
  c.text(text, { x: MARGIN + 16, size: 10, color: SOFT });
  c.gap(2);
}

// ── Section 8B: wage-exposure estimate (firm-only) ────────────────────────────
// Presentation-only arithmetic from records. Copy is constrained to neutral terms —
// no "violation", "owes", "entitled", "liable". The only damages-adjacent phrase is the
// section title "wage exposure estimate".

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

/** sectionHeading clone that appends a brand pill (e.g. "calculated from records"). */
function sectionHeadingWithPill(c: Cursor, label: string, pill: string): void {
  c.gap(10);
  c.ensure(26);
  c.page.drawRectangle({ x: MARGIN, y: c.y - 14, width: 3, height: 15, color: BRAND });
  c.page.drawText(label, { x: MARGIN + 10, y: c.y - 12, size: 12.5, font: c.bold, color: INK });
  const labelW = c.bold.widthOfTextAtSize(label, 12.5);
  const pillText = pill.toUpperCase();
  const pillSize = 7;
  const pillW = c.bold.widthOfTextAtSize(pillText, pillSize) + 12;
  const pillX = MARGIN + 10 + labelW + 12;
  c.page.drawRectangle({ x: pillX, y: c.y - 13, width: pillW, height: 13, color: BRAND_SOFT });
  c.page.drawText(pillText, { x: pillX + 6, y: c.y - 10, size: pillSize, font: c.bold, color: BRAND });
  c.y -= 20;
  rule(c, BRAND_LINE, 0.75);
}

/** Label (left) + value (right-aligned), with a muted detail line beneath. */
function wageRow(c: Cursor, label: string, value: string, detail: string, opts: { total?: boolean } = {}): void {
  const big = opts.total === true;
  const labelSize = big ? 11 : 9.5;
  const valSize = big ? 12.5 : 10;
  c.ensure(big ? 24 : 22);
  c.page.drawText(label, { x: MARGIN, y: c.y - 11, size: labelSize, font: c.bold, color: big ? BRAND : INK });
  const valW = c.bold.widthOfTextAtSize(value, valSize);
  c.page.drawText(value, { x: PAGE_W - MARGIN - valW, y: c.y - 11, size: valSize, font: c.bold, color: big ? BRAND : INK });
  c.y -= big ? 17 : 13;
  if (detail) {
    c.ensure(11);
    c.page.drawText(detail, { x: MARGIN, y: c.y - 8, size: 8, font: c.font, color: MUTED });
    c.y -= 12;
  }
}

function drawSection8B(c: Cursor, wage: { report: DamagesReport; disclaimer: string[] }): void {
  const r = wage.report;
  sectionHeadingWithPill(c, '8B.  Wage exposure estimate', 'calculated from records');

  // No base rate => do not estimate. Show neutral incomplete note only.
  if (!r.baseHourlyRate) {
    c.text(
      r.missingRecordsWarning ??
        'A base hourly rate could not be determined from the records provided, so no figures were calculated.',
      { size: 9.5, color: SOFT },
    );
    drawWageDisclaimer(c, wage.disclaimer);
    return;
  }

  wageRow(c, r.baseHourlyRate.label, fmtMoney(r.baseHourlyRate.value), r.baseHourlyRate.formula);

  // Overtime claim block
  if (r.overtimeRate && r.overtimePremiumPerHour && r.overtimeHoursUnderpaid) {
    c.gap(4);
    c.text('Overtime', { size: 9, font: c.bold, color: MUTED });
    c.gap(2);
    wageRow(c, r.overtimeRate.label, fmtMoney(r.overtimeRate.value), `${r.overtimeRate.formula} · ${r.overtimeRate.statutoryRef ?? ''}`);
    wageRow(c, r.overtimePremiumPerHour.label, fmtMoney(r.overtimePremiumPerHour.value), `${r.overtimePremiumPerHour.formula} · ${r.overtimePremiumPerHour.statutoryRef ?? ''}`);
    wageRow(c, r.overtimeHoursUnderpaid.label, `${r.overtimeHoursUnderpaid.value} hrs`, r.overtimeHoursUnderpaid.formula);
    rule(c, BRAND_LINE, 0.75);
    wageRow(c, 'Estimated overtime premium', fmtMoney(r.overtimeTotalEstimate), 'Premium per hour × hours without matching premium', { total: true });
  }

  // Meal-break claim block
  if (r.mealBreaksMissed && r.mealBreakPremiumPerBreak) {
    c.gap(4);
    c.text('Meal breaks', { size: 9, font: c.bold, color: MUTED });
    c.gap(2);
    wageRow(c, r.mealBreaksMissed.label, `${r.mealBreaksMissed.value}`, r.mealBreaksMissed.formula);
    wageRow(c, r.mealBreakPremiumPerBreak.label, fmtMoney(r.mealBreakPremiumPerBreak.value), `${r.mealBreakPremiumPerBreak.formula} · ${r.mealBreakPremiumPerBreak.statutoryRef ?? ''}`);
    rule(c, BRAND_LINE, 0.75);
    wageRow(c, 'Estimated meal-break premium', fmtMoney(r.mealBreakTotalEstimate), '1 hour × base rate × occurrences', { total: true });
  }

  // Combined
  c.gap(2);
  rule(c, BRAND, 1);
  wageRow(c, 'Combined estimate', fmtMoney(r.combinedEstimate), 'Sum of the estimates above, from records provided', { total: true });

  // Partial-data warning (amber)
  if (r.isPartialData && r.missingRecordsWarning) {
    c.gap(8);
    const lines = c.wrap(r.missingRecordsWarning, 8.5, c.font, CONTENT_W - 24);
    const boxH = 14 + lines.length * 12;
    c.ensure(boxH + 6);
    c.page.drawRectangle({ x: MARGIN, y: c.y - boxH, width: CONTENT_W, height: boxH, color: AMBER_FILL });
    let yy = c.y - 14;
    c.page.drawText('Incomplete records', { x: MARGIN + 12, y: yy, size: 8.5, font: c.bold, color: AMBER_INK });
    yy -= 12;
    for (const ln of lines) {
      c.page.drawText(ln, { x: MARGIN + 12, y: yy, size: 8.5, font: c.font, color: AMBER_INK });
      yy -= 12;
    }
    c.y -= boxH + 6;
  }

  // Citation index — field → document, page, source snippet
  const cited = [r.baseHourlyRate, r.overtimeHoursUnderpaid, r.mealBreaksMissed].filter(
    (li): li is NonNullable<typeof li> => Boolean(li && li.citation),
  );
  if (cited.length) {
    c.gap(8);
    c.text('Source citations', { size: 9, font: c.bold, color: MUTED });
    c.gap(2);
    for (const li of cited) {
      const cit = li.citation!;
      const page = cit.page > 0 ? ` (p. ${cit.page})` : '';
      drawCitationLink(c, `${li.label} -> ${cit.docName}${page}  »`, cit.docId);
      c.text(`“${cit.sourceText}”`, { size: 8.5, color: MUTED, x: MARGIN + 12 });
      c.gap(2);
    }
  }

  drawWageDisclaimer(c, wage.disclaimer);
}

function drawWageDisclaimer(c: Cursor, lines: string[]): void {
  c.gap(8);
  for (const d of lines) {
    c.text(d, { size: 8, color: MUTED });
    c.gap(2);
  }
}

// ── Source-linked citations (clickable → embedded source page) ────────────────

/** Draw a single citation as brand-colored text and register it as a link hot-spot. */
function drawCitationLink(c: Cursor, label: string, docId: string): void {
  const size = 8.5;
  const leading = size * 1.5;
  c.ensure(leading);
  const x = MARGIN;
  const yText = c.y - size;
  c.page.drawText(label, { x, y: yText, size, font: c.bold, color: BRAND });
  const w = c.bold.widthOfTextAtSize(label, size);
  c.linkRect([x - 1, yText - 2, x + w + 2, yText + size + 1], docId);
  c.y -= leading;
}

/** Low-level pdf-lib internal link annotation: a rectangle on `fromPage` that jumps to `destPage`. */
function addInternalLink(
  doc: PDFDocument,
  fromPage: PDFPage,
  rect: [number, number, number, number],
  destPage: PDFPage,
): void {
  const ctx = doc.context;
  const dest = PDFArray.withContext(ctx);
  dest.push(destPage.ref);
  dest.push(PDFName.of('Fit'));
  const annot = ctx.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: rect,
    Border: [0, 0, 0],
    Dest: dest,
  });
  const ref = ctx.register(annot);
  const existing = fromPage.node.Annots();
  if (existing) existing.push(ref);
  else fromPage.node.set(PDFName.of('Annots'), ctx.obj([ref]));
}

/** Thin brand tab drawn on top of an embedded source page so the reader sees its filename. */
function drawSourceTab(page: PDFPage, font: PDFFont, fileName: string): void {
  const h = 20;
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - h, width, height: h, color: BRAND });
  const label = `Source · ${fileName}`;
  page.drawText(label.length > 90 ? label.slice(0, 89) + '…' : label, {
    x: 10,
    y: height - h + 6,
    size: 8,
    font,
    color: WHITE,
  });
}

/**
 * Embed each cited source document's pages as an appendix. Returns a map of docId → the
 * first reproduced page (the jump destination). Unsupported/undecodable files are skipped.
 */
async function embedSourceRecords(c: Cursor, sources: PdfSourceDoc[]): Promise<Map<string, PDFPage>> {
  const doc = c.document;
  const destMap = new Map<string, PDFPage>();
  if (!sources.length) return destMap;

  c.newPage();
  sectionHeading(c, 'Source Records');
  c.text(
    'Cited documents, reproduced here for verification. Each citation above links to the exact page.',
    { size: 9, color: MUTED },
  );

  for (const src of sources) {
    const name = (src.fileName || '').toLowerCase();
    const mime = (src.mime || '').toLowerCase();
    try {
      if (mime.includes('pdf') || name.endsWith('.pdf')) {
        const srcDoc = await PDFDocument.load(src.bytes, { ignoreEncryption: true });
        const eps = await doc.embedPdf(srcDoc, srcDoc.getPageIndices());
        eps.forEach((ep, idx) => {
          const p = doc.addPage([ep.width, ep.height]);
          p.drawPage(ep, { x: 0, y: 0, width: ep.width, height: ep.height });
          drawSourceTab(p, c.font, src.fileName);
          if (idx === 0) destMap.set(src.docId, p);
        });
      } else if (mime.includes('png') || name.endsWith('.png')) {
        const img = await doc.embedPng(src.bytes);
        destMap.set(src.docId, addImagePage(doc, c.font, img.width, img.height, (p, w, h) => p.drawImage(img, { x: 0, y: 0, width: w, height: h }), src.fileName));
      } else if (mime.includes('jp') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
        const img = await doc.embedJpg(src.bytes);
        destMap.set(src.docId, addImagePage(doc, c.font, img.width, img.height, (p, w, h) => p.drawImage(img, { x: 0, y: 0, width: w, height: h }), src.fileName));
      }
      // Other types (docx, etc.) can't be embedded as pages — skipped; citation stays text.
    } catch {
      // Corrupt/undecodable file — skip; citation gracefully falls back to plain text.
    }
  }
  return destMap;
}

/** Add a full page sized to an embedded image (capped to letter width), draw it, return the page. */
function addImagePage(
  doc: PDFDocument,
  font: PDFFont,
  imgW: number,
  imgH: number,
  draw: (page: PDFPage, w: number, h: number) => void,
  fileName: string,
): PDFPage {
  const maxW = PAGE_W;
  const scale = Math.min(1, maxW / imgW);
  const w = imgW * scale;
  const h = imgH * scale;
  const p = doc.addPage([w, h]);
  draw(p, w, h);
  drawSourceTab(p, font, fileName);
  return p;
}

/** After the appendix is embedded, wire every captured citation hot-spot to its source page. */
function resolveCitationLinks(c: Cursor, destMap: Map<string, PDFPage>): void {
  for (const pl of c.pendingLinks) {
    const dest = destMap.get(pl.docId);
    if (dest) addInternalLink(c.document, pl.page, pl.rect, dest);
  }
}

// ── Cover page (shared by firm + worker; framing differs) ─────────────────────
type CoverData = FirmPacketModel['cover'];

function drawCover(c: Cursor, cover: CoverData, bandTitle: string, subtitle: string, footerNote: string): void {
  // brand band
  c.page.drawRectangle({ x: 0, y: PAGE_H - 170, width: PAGE_W, height: 170, color: BRAND });
  c.page.drawText('one3seven', { x: MARGIN, y: PAGE_H - 86, size: 26, font: c.bold, color: WHITE });
  c.page.drawText(bandTitle, { x: MARGIN, y: PAGE_H - 116, size: 12, font: c.bold, color: rgb(0.87, 0.91, 0.87) });
  c.page.drawText(subtitle, { x: MARGIN, y: PAGE_H - 138, size: 10.5, font: c.font, color: rgb(0.80, 0.86, 0.81) });

  c.y = PAGE_H - 230;

  const big = (label: string, value: string) => {
    c.page.drawText(label.toUpperCase(), { x: MARGIN, y: c.y, size: 8.5, font: c.bold, color: MUTED });
    c.y -= 16;
    for (const line of c.wrap(value, 16, c.bold, CONTENT_W)) {
      c.page.drawText(line, { x: MARGIN, y: c.y - 4, size: 16, font: c.bold, color: INK });
      c.y -= 22;
    }
    c.y -= 12;
  };

  if (cover.workerName) big('Worker', cover.workerName);
  if (cover.workerPhone) {
    // Contact line directly under the worker name — the firm's callback number, no asking required.
    c.page.drawText(`Phone: ${cover.workerPhone}`, { x: MARGIN, y: c.y + 4, size: 11, font: c.font, color: MUTED });
    c.y -= 18;
  }
  if (cover.employer) big('Employer', cover.employer);
  if (cover.employmentPeriod) big('Employment period', cover.employmentPeriod);

  // stat strip
  c.y -= 6;
  const stripY = c.y;
  c.page.drawRectangle({
    x: MARGIN,
    y: stripY - 54,
    width: CONTENT_W,
    height: 54,
    color: BRAND_SOFT,
    borderColor: BRAND_LINE,
    borderWidth: 1,
  });
  const stat = (x: number, value: string, label: string) => {
    c.page.drawText(value, { x, y: stripY - 26, size: 20, font: c.bold, color: BRAND });
    c.page.drawText(label.toUpperCase(), { x, y: stripY - 44, size: 8, font: c.bold, color: MUTED });
  };
  stat(MARGIN + 22, String(cover.recordCount), 'Records');
  stat(MARGIN + 22 + CONTENT_W / 3, String(cover.eventCount), 'Timeline events');
  stat(MARGIN + 22 + (2 * CONTENT_W) / 3, cover.preparedDate, 'Prepared');

  c.page.drawText(footerNote, { x: MARGIN, y: MARGIN + 6, size: 8.5, font: c.font, color: MUTED });
}

// ── Timing callouts (boxed) ────────────────────────────────────────────────────
function drawTimingCallouts(c: Cursor, intervals: Array<{ label: string; days: number; description: string }>): void {
  const cols = 3;
  const gapX = 12;
  const boxW = (CONTENT_W - gapX * (cols - 1)) / cols;
  const boxH = 56;
  for (let i = 0; i < intervals.length; i += cols) {
    const rowItems = intervals.slice(i, i + cols);
    c.ensure(boxH + 10);
    const rowTop = c.y;
    rowItems.forEach((it, j) => {
      const x = MARGIN + j * (boxW + gapX);
      c.page.drawRectangle({
        x,
        y: rowTop - boxH,
        width: boxW,
        height: boxH,
        color: BRAND_SOFT,
        borderColor: BRAND_LINE,
        borderWidth: 1,
      });
      c.page.drawText(`${it.days}d`, { x: x + 12, y: rowTop - 26, size: 18, font: c.bold, color: BRAND });
      const lbl = c.wrap(it.label, 8, c.bold, boxW - 24)[0] ?? it.label;
      c.page.drawText(lbl.toUpperCase(), { x: x + 12, y: rowTop - 42, size: 8, font: c.bold, color: MUTED });
    });
    c.y = rowTop - boxH - 10;
  }
}

// ── Source provenance (named by SOURCE, never by worth) ──────────────────────────
// UPL discipline: a fact either links to an embedded source page ("Source-linked"),
// names a document on file, or is worker-stated. We never label reliability/credibility
// ("unverified", "%", "strong") — evaluating evidence is the attorney's job (AB 316).
type SourceIndexEntry = { docId: string; embeddable: boolean };

function isEmbeddableSource(s: PdfSourceDoc): boolean {
  const name = (s.fileName || '').toLowerCase();
  const mime = (s.mime || '').toLowerCase();
  return (
    mime.includes('pdf') || name.endsWith('.pdf') ||
    mime.includes('png') || name.endsWith('.png') ||
    mime.includes('jp') || name.endsWith('.jpg') || name.endsWith('.jpeg')
  );
}

/** Index supplied source docs by file name so facts can link by their stored sourceFile. */
function buildSourceIndex(sources: PdfSourceDoc[]): Map<string, SourceIndexEntry> {
  const idx = new Map<string, SourceIndexEntry>();
  for (const s of sources) {
    const key = (s.fileName || '').trim().toLowerCase();
    if (key) idx.set(key, { docId: s.docId, embeddable: isEmbeddableSource(s) });
  }
  return idx;
}

function factProvenance(
  sourceFile: string | null,
  srcIndex: Map<string, SourceIndexEntry>,
): { state: 'linked' | 'on_file' | 'worker'; docId?: string; label: string } {
  const name = (sourceFile || '').trim();
  if (!name) return { state: 'worker', label: 'Worker-stated' };
  const hit = srcIndex.get(name.toLowerCase());
  if (hit && hit.embeddable) return { state: 'linked', docId: hit.docId, label: name };
  return { state: 'on_file', label: name };
}

// ── Chronology table ────────────────────────────────────────────────────────────
function drawChronologyTable(
  c: Cursor,
  events: Array<{ date: string; title: string; interval: string | null; sourceFile: string | null }>,
  srcIndex: Map<string, SourceIndexEntry>,
): void {
  const dateW = 96;
  const srcW = 150;
  const eventW = CONTENT_W - dateW - srcW;
  const xDate = MARGIN;
  const xEvent = MARGIN + dateW;
  const xSrc = MARGIN + dateW + eventW;

  // header row
  c.ensure(20);
  c.page.drawRectangle({ x: MARGIN, y: c.y - 16, width: CONTENT_W, height: 16, color: BRAND });
  c.page.drawText('DATE', { x: xDate + 6, y: c.y - 12, size: 8, font: c.bold, color: WHITE });
  c.page.drawText('EVENT', { x: xEvent + 6, y: c.y - 12, size: 8, font: c.bold, color: WHITE });
  c.page.drawText('SOURCE', { x: xSrc + 6, y: c.y - 12, size: 8, font: c.bold, color: WHITE });
  c.y -= 16;

  events.forEach((e, idx) => {
    const prov = factProvenance(e.sourceFile, srcIndex);
    const linked = prov.state === 'linked';
    const srcText = linked ? `${prov.label}  »` : prov.label;
    const srcFont = linked ? c.bold : c.font;
    const dateLines = c.wrap(e.date, 8.5, c.font, dateW - 12);
    const titleStr = e.interval ? `${e.title}  [${e.interval}]` : e.title;
    const titleLines = c.wrap(titleStr, 8.5, c.font, eventW - 12);
    const srcLines = c.wrap(srcText, 8.5, srcFont, srcW - 12);
    const rows = Math.max(dateLines.length, titleLines.length, srcLines.length);
    const rowH = rows * 11 + 8;
    c.ensure(rowH);
    const top = c.y;
    if (idx % 2 === 1) {
      c.page.drawRectangle({ x: MARGIN, y: top - rowH, width: CONTENT_W, height: rowH, color: BRAND_SOFT });
    }
    const drawCol = (lines: string[], x: number, font: PDFFont, color: RGB) => {
      let yy = top - 12;
      for (const ln of lines) {
        c.page.drawText(ln, { x: x + 6, y: yy, size: 8.5, font, color });
        yy -= 11;
      }
    };
    drawCol(dateLines, xDate, c.bold, INK);
    drawCol(titleLines, xEvent, c.font, SOFT);
    drawCol(srcLines, xSrc, srcFont, linked ? BRAND : MUTED);
    // Source-linked events become a clickable hot-spot → embedded source page.
    if (linked && prov.docId) {
      const upperY = top - 12 + 9;
      const lowerY = top - 12 - (srcLines.length - 1) * 11 - 2;
      c.linkRect([xSrc + 4, lowerY, xSrc + srcW - 4, upperY], prov.docId);
    }
    c.y = top - rowH;
    c.page.drawLine({ start: { x: MARGIN, y: c.y }, end: { x: PAGE_W - MARGIN, y: c.y }, thickness: 0.5, color: BRAND_LINE });
  });
  c.y -= 6;
}

// ── Quote block ──────────────────────────────────────────────────────────────
function drawQuote(
  c: Cursor,
  q: { category: string; fileName: string; quote: string },
  srcIndex: Map<string, SourceIndexEntry>,
): void {
  const innerX = MARGIN + 14;
  const innerW = CONTENT_W - 22;
  // Quotes always come from a document; link the source when it's embeddable.
  const prov = factProvenance(q.fileName, srcIndex);
  const linked = prov.state === 'linked';
  const headText = `${q.category} — ${q.fileName}${linked ? '  »' : ''}`;
  const headLines = c.wrap(headText, 8, c.bold, innerW);
  const quoteLines = c.wrap(`“${q.quote}”`, 9.5, c.font, innerW);
  const blockH = headLines.length * 11 + quoteLines.length * 14 + 16;
  c.ensure(blockH + 6);
  const top = c.y;
  c.page.drawRectangle({ x: MARGIN, y: top - blockH, width: CONTENT_W, height: blockH, color: BRAND_SOFT });
  c.page.drawRectangle({ x: MARGIN, y: top - blockH, width: 3, height: blockH, color: BRAND });
  let yy = top - 14;
  for (const ln of headLines) {
    c.page.drawText(ln, { x: innerX, y: yy, size: 8, font: c.bold, color: BRAND });
    yy -= 11;
  }
  if (linked && prov.docId) {
    const upperY = top - 14 + 8;
    const lowerY = top - 14 - (headLines.length - 1) * 11 - 2;
    c.linkRect([innerX - 2, lowerY, innerX + innerW, upperY], prov.docId);
  }
  yy -= 2;
  for (const ln of quoteLines) {
    c.page.drawText(ln, { x: innerX, y: yy, size: 9.5, font: c.font, color: INK });
    yy -= 14;
  }
  c.y = top - blockH - 8;
}

// ── DvW provenance rows ─────────────────────────────────────────────────────────
function drawDvwRows(c: Cursor, rows: Array<{ question: string; support: string }>): void {
  for (const r of rows) {
    c.ensure(28);
    c.text(r.question, { size: 9.5, font: c.bold, color: INK });
    c.page.drawText('->', { x: MARGIN + 14, y: c.y - 9, size: 9, font: c.bold, color: BRAND });
    c.text(r.support, { x: MARGIN + 30, size: 9, color: SOFT });
    c.gap(4);
  }
}

/**
 * Pure count of how many organized items (timeline events + document quotes) link to a
 * supplied source document. Arithmetic only — never a quality score (UPL discipline).
 */
export function countSourceCoverage(
  model: FirmPacketModel,
  sources: PdfSourceDoc[] = [],
): { linked: number; total: number } {
  const idx = buildSourceIndex(sources);
  let linked = 0;
  let total = 0;
  if (model.sequence.kind === 'events') {
    for (const e of model.sequence.events) {
      total += 1;
      if (factProvenance(e.sourceFile, idx).state === 'linked') linked += 1;
    }
  }
  if (model.extracted?.keyQuotes) {
    for (const q of model.extracted.keyQuotes) {
      total += 1;
      if (factProvenance(q.fileName, idx).state === 'linked') linked += 1;
    }
  }
  return { linked, total };
}

/** Page-1 "how to read this file" box: the three source states + a pure coverage count. */
function drawTraceabilityLegend(c: Cursor, coverage: { linked: number; total: number }): void {
  const rows: Array<[string, string]> = [
    ['Source-linked  »', 'click to open the cited document'],
    ['Document on file', 'named record, included in Source Records'],
    ['Worker-stated', "from the worker's own account"],
  ];
  const pad = 10;
  const headH = 15;
  const rowH = 12;
  const covH = coverage.total > 0 ? 13 : 0;
  const principleH = 14;
  const boxH = pad * 2 + headH + rows.length * rowH + covH + principleH;
  c.ensure(boxH + 6);
  const top = c.y;
  c.page.drawRectangle({ x: MARGIN, y: top - boxH, width: CONTENT_W, height: boxH, color: BRAND_SOFT });
  c.page.drawRectangle({ x: MARGIN, y: top - boxH, width: 3, height: boxH, color: BRAND });
  let yy = top - pad - 8;
  c.page.drawText('How to read this file', { x: MARGIN + 12, y: yy, size: 9, font: c.bold, color: INK });
  yy -= headH;
  for (const [tag, desc] of rows) {
    c.page.drawText(tag, { x: MARGIN + 12, y: yy, size: 8, font: c.bold, color: BRAND });
    c.page.drawText(desc, { x: MARGIN + 130, y: yy, size: 8, font: c.font, color: SOFT });
    yy -= rowH;
  }
  if (coverage.total > 0) {
    c.page.drawText(
      `${coverage.linked} of ${coverage.total} organized items link to a source document.`,
      { x: MARGIN + 12, y: yy, size: 8.5, font: c.bold, color: INK },
    );
    yy -= covH;
  }
  c.page.drawText('one3seven only organizes and reflects — it never concludes.', {
    x: MARGIN + 12, y: yy, size: 8.5, font: c.bold, color: BRAND,
  });
  c.y = top - boxH - 8;
}

// ── Main render ──────────────────────────────────────────────────────────────
export async function renderFirmIntakePacketPdf(
  model: FirmPacketModel,
  sources: PdfSourceDoc[] = [],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('one3seven — Firm Intake Review');
  doc.setCreator('one3seven');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const c = new Cursor(doc, font, bold);
  const srcIndex = buildSourceIndex(sources);

  // Cover (own page)
  drawCover(
    c,
    model.cover,
    'FIRM INTAKE REVIEW',
    'Organized for attorney review',
    'one3seven organizes uploaded records for firm intake review. It is not legal advice.',
  );
  c.newPage();

  // Traceability legend — how to read the source states + a pure coverage count.
  drawTraceabilityLegend(c, countSourceCoverage(model, sources));

  // 1. Review Snapshot
  sectionHeading(c, '1.  Review Snapshot');
  for (const s of model.reviewSnapshot) c.text(s, { size: 10, color: SOFT });

  // 2. Why this intake requires review
  sectionHeading(c, '2.  Why This Intake Requires Review');
  c.text(model.whyReview, { size: 10, color: SOFT });

  // 2B. Extracted from documents
  if (model.extracted) {
    sectionHeading(c, '2B.  Extracted From Documents');
    const ex = model.extracted;
    if (ex.confirmedFacts.length) {
      c.text('Confirmed from documents', { size: 9, font: bold, color: MUTED });
      c.gap(2);
      for (const f of ex.confirmedFacts) {
        c.ensure(13);
        c.page.drawText(`${f.label}:`, { x: MARGIN, y: c.y - 10, size: 9, font: bold, color: INK });
        c.text(f.value, { x: MARGIN + 110, size: 9.5, color: SOFT });
        c.gap(2);
      }
    }
    if (ex.coworkerCorroboration) {
      c.gap(4);
      c.text(`Coworker confirms: ${ex.coworkerCorroboration}`, { size: 9.5, color: SOFT });
    }
    if (ex.timingIntervals.length) {
      c.gap(6);
      c.text('Timing from complaint date', { size: 9, font: bold, color: MUTED });
      c.gap(6);
      drawTimingCallouts(c, ex.timingIntervals);
    }
    if (ex.keyQuotes.length) {
      c.gap(4);
      c.text('Key document language', { size: 9, font: bold, color: MUTED });
      c.gap(6);
      for (const q of ex.keyQuotes) drawQuote(c, q, srcIndex);
    }
    if (ex.overtimeNote) {
      c.gap(2);
      c.text(ex.overtimeNote, { size: 9, font: bold, color: AMBER_INK });
    }
  }

  // 3. Intake Overview
  if (model.overviewFields.length) {
    sectionHeading(c, '3.  Intake Overview');
    for (const f of model.overviewFields) {
      c.ensure(13);
      c.page.drawText(`${f.label}:`, { x: MARGIN, y: c.y - 10, size: 9.5, font: bold, color: INK });
      c.text(f.value, { x: MARGIN + 130, size: 9.5, color: SOFT });
      c.gap(2);
    }
  }

  // 4. Sequence for Firm Review
  sectionHeading(c, '4.  Sequence for Attorney Review');
  if (model.sequence.kind === 'events') {
    drawChronologyTable(c, model.sequence.events, srcIndex);
  } else {
    c.text(model.sequence.note, { size: 10, color: SOFT });
  }

  // 5. Priority Questions
  if (model.priorityQuestions.length) {
    sectionHeading(c, '5.  Priority Questions');
    for (const q of model.priorityQuestions) bullet(c, q);
  }

  // 6. Supporting Records
  sectionHeading(c, '6.  Supporting Records');
  if (model.records.kind === 'list') {
    if (model.records.priority.length) {
      c.text('Priority Review Records', { size: 9, font: bold, color: MUTED });
      c.gap(4);
      model.records.priority.forEach((f, i) => bullet(c, `${i + 1}.  ${f.name} — ${f.category}`));
    }
    if (model.records.supporting.length) {
      c.gap(4);
      c.text('Supporting Records', { size: 9, font: bold, color: MUTED });
      c.gap(4);
      for (const f of model.records.supporting) bullet(c, `${f.name} — ${f.category}`);
    }
  } else {
    c.text(model.records.note, { size: 10, color: SOFT });
  }

  // 7. Documented vs. Worker-Reported
  if (model.dvwRows.length) {
    sectionHeading(c, '7.  Documented vs. Worker-Reported');
    drawDvwRows(c, model.dvwRows);
  }

  // 8. Items Requiring Confirmation
  if (model.confirmationItems.length) {
    sectionHeading(c, '8.  Items Requiring Confirmation');
    for (const it of model.confirmationItems) bullet(c, it);
  }

  // 8B. Wage exposure estimate (firm-only; arithmetic from records)
  if (model.wageExposure) {
    drawSection8B(c, model.wageExposure);
  }

  // 9. Questions That May Help Complete the Intake
  if (model.clarificationQuestions.length) {
    sectionHeading(c, '9.  Questions That May Help Complete the Intake');
    for (const q of model.clarificationQuestions) bullet(c, q);
  }

  // 10. Worker Context
  if (model.workerContext.kind !== 'hidden') {
    sectionHeading(c, '10.  Worker Context');
    if (model.workerContext.kind === 'text') {
      for (const p of model.workerContext.paragraphs) {
        c.text(p, { size: 10, color: SOFT });
        c.gap(4);
      }
    } else {
      c.text('No narrative was provided with this intake.', { size: 10, color: MUTED });
    }
  }

  // 11. Firm Review Options
  sectionHeading(c, '11.  Firm Review Options');
  c.text(`Current items requiring confirmation: ${model.reviewOptions.unresolvedCount}`, { size: 9.5, color: SOFT });
  c.text(
    `Priority records available for review: ${model.reviewOptions.priorityCount} of ${model.reviewOptions.totalRecords}`,
    { size: 9.5, color: SOFT },
  );
  if (model.reviewOptions.additionalRecords.length) {
    c.gap(6);
    c.text('Additional records that may help complete this review', { size: 9, font: bold, color: MUTED });
    c.gap(4);
    for (const r of model.reviewOptions.additionalRecords) bullet(c, r);
  }
  c.gap(4);
  c.text(model.reviewOptions.actions, { size: 9, color: MUTED });

  // Document workflow supplement
  for (const block of model.documentWorkflow) {
    sectionHeading(c, block.heading);
    for (const ln of block.lines) c.text(ln, { size: 9.5, color: SOFT });
  }

  // Disclaimer (boxed, amber-neutral)
  c.gap(10);
  const discText = model.disclaimer.join('\n');
  void discText;
  c.ensure(40);
  sectionHeading(c, 'Disclaimer');
  for (const d of model.disclaimer) {
    c.text(d, { size: 8.5, color: MUTED });
    c.gap(3);
  }
  void AMBER_FILL;

  // Appendix: embed cited source pages, then wire each citation to its page.
  if (sources.length) {
    const destMap = await embedSourceRecords(c, sources);
    resolveCitationLinks(c, destMap);
  }

  return doc.save();
}

// ── Worker "Your organized intake" packet ─────────────────────────────────────
// Same prestige system, worker framing. Built from the worker Story Packet data
// (buildWorkerSummaryModel) so content matches the worker workflow exactly.
export type WorkerPacketModel = {
  cover: CoverData;
  intakeNumber: string;
  currentUnderstanding: string;
  caseSnapshot: {
    employmentPeriod: string;
    primaryConcerns: string[];
    recordsOrganized: number;
    timelineEvents: number;
    namedIndividuals: number;
  };
  workerStory: Array<{ heading: string; body: string }>;
  questionsForReview: string[];
  chronology: string[];
  supportingDocuments: string[];
  missingInformation: string[];
  disclaimer: string[];
};

export async function renderWorkerSummaryPdf(model: WorkerPacketModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('one3seven — Your Organized Intake');
  doc.setCreator('one3seven');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const c = new Cursor(doc, font, bold);

  drawCover(
    c,
    model.cover,
    'YOUR ORGANIZED INTAKE',
    'Organized for your review',
    'one3seven organizes your uploaded records. It is not legal advice. You control what you share.',
  );
  c.newPage();

  if (model.intakeNumber) {
    c.text(`Intake reference: ${model.intakeNumber}`, { size: 9, color: MUTED });
  }

  sectionHeading(c, 'Current Understanding');
  c.text(model.currentUnderstanding || 'Your organized summary will appear as records are added.', { size: 10, color: SOFT });

  sectionHeading(c, 'Case Snapshot');
  const snap = model.caseSnapshot;
  const snapRow = (label: string, value: string) => {
    c.ensure(13);
    c.page.drawText(`${label}:`, { x: MARGIN, y: c.y - 10, size: 9.5, font: bold, color: INK });
    c.text(value, { x: MARGIN + 140, size: 9.5, color: SOFT });
    c.gap(2);
  };
  snapRow('Employment Period', snap.employmentPeriod);
  if (snap.primaryConcerns.length) {
    c.gap(2);
    c.text('Primary Concerns', { size: 9, font: bold, color: MUTED });
    c.gap(2);
    for (const concern of snap.primaryConcerns) bullet(c, concern);
  }
  snapRow('Records Organized', String(snap.recordsOrganized));
  snapRow('Timeline Events', String(snap.timelineEvents));
  snapRow('Named Individuals', String(snap.namedIndividuals));

  if (model.workerStory.length) {
    sectionHeading(c, 'Your Story');
    for (const s of model.workerStory) {
      c.text(s.heading, { size: 9.5, font: bold, color: INK });
      c.gap(2);
      c.text(s.body, { size: 10, color: SOFT });
      c.gap(4);
    }
  }

  sectionHeading(c, 'Questions for Review');
  if (model.questionsForReview.length) for (const q of model.questionsForReview) bullet(c, q);
  else c.text('Topics will appear as records are organized.', { size: 10, color: MUTED });

  sectionHeading(c, 'Timeline');
  if (model.chronology.length) for (const line of model.chronology) bullet(c, line);
  else c.text('No timeline entries are available yet.', { size: 10, color: MUTED });

  sectionHeading(c, 'Supporting Records');
  if (model.supportingDocuments.length) for (const r of model.supportingDocuments) bullet(c, r);
  else c.text('No related records found yet.', { size: 10, color: MUTED });

  sectionHeading(c, 'Additional Information That May Help');
  if (model.missingInformation.length) for (const m of model.missingInformation) bullet(c, m);
  else c.text('No additional records listed yet.', { size: 10, color: MUTED });

  sectionHeading(c, 'Disclaimer');
  for (const d of model.disclaimer) {
    c.text(d, { size: 8.5, color: MUTED });
    c.gap(3);
  }

  return doc.save();
}
