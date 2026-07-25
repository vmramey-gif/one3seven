import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { X } from 'lucide-react';
import type { SourceCitation } from '../../services/damagesCalculator';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const BRAND = '#42574E';
// The extracted quote is the AI layer — highlight it in the AI/violet brand color.
const VIOLET = '#5B21B6';

type PanelStatus = 'loading' | 'located' | 'fallback';

type Highlight = { left: number; top: number; width: number; height: number };

const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();
// Whitespace-free, lowercase form for robust snippet matching against PDF text runs.
const squash = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

/**
 * Attorney-side source viewer. Given a citation + a pre-signed PDF URL, loads the PDF with
 * pdf.js, searches each page's text layer for the verbatim source snippet (the authoritative
 * locator — F5), jumps to the matching page, and highlights the matched run.
 *
 * Never throws and never shows a blank panel: on any failure (no signed URL, scanned/image
 * PDF with no text layer, render error) it falls back to page 1 (when renderable) plus the
 * snippet shown in the header and an explicit "highlight unavailable" note for manual review.
 */
export function CitationPanel({
  citation,
  signedUrl,
  onClose,
}: {
  citation: SourceCitation | null;
  signedUrl: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [pageNum, setPageNum] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  useEffect(() => {
    if (!citation) return;
    let cancelled = false;
    setStatus('loading');
    setHighlights([]);
    setPageNum(null);

    type TextRun = { str: string; transform: number[]; width: number; height: number };

    void (async () => {
      try {
        if (!signedUrl) {
          if (!cancelled) setStatus('fallback');
          return;
        }
        const pdf = await pdfjsLib.getDocument({ url: signedUrl }).promise;
        // Compare with ALL whitespace removed: PDFs frequently split a word across text runs
        // ("employ" + "ment") or insert stray spaces, which broke a space-preserving match.
        const targetSquashed = squash(citation.sourceText);
        const probe = targetSquashed.length > 40 ? targetSquashed.slice(0, 40) : targetSquashed;

        let matchPage = 0;
        let matchItems: TextRun[] = [];

        if (probe.length >= 8) {
          for (let p = 1; p <= pdf.numPages; p += 1) {
            if (cancelled) return;
            const page = await pdf.getPage(p);
            const tc = await page.getTextContent();
            const loose = tc.items as Array<{ str?: unknown; transform?: unknown; width?: unknown; height?: unknown }>;
            const items = loose.filter(
              (i): i is TextRun => typeof i.str === 'string' && Array.isArray(i.transform),
            );
            // Build a per-item span map over the squashed concatenation, then locate the FULL quote
            // range and collect every item that overlaps it — so the whole line (across runs and
            // wrapped lines) gets highlighted, not just one word.
            let concat = '';
            const spans: Array<{ start: number; end: number; item: TextRun }> = [];
            for (const it of items) {
              const s = squash(it.str);
              if (!s) continue;
              spans.push({ start: concat.length, end: concat.length + s.length, item: it });
              concat += s;
            }
            const at = concat.indexOf(probe);
            if (at >= 0) {
              matchPage = p;
              const qStart = at;
              const qEnd = Math.min(concat.length, at + targetSquashed.length);
              matchItems = spans.filter((sp) => sp.end > qStart && sp.start < qEnd).map((sp) => sp.item);
              break;
            }
          }
        }

        const renderPage = matchPage || 1;
        const page = await pdf.getPage(renderPage);
        const scale = 1.4;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (!cancelled) setStatus('fallback');
          return;
        }
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
        setPageNum(renderPage);

        if (matchPage && matchItems.length) {
          // Store boxes as FRACTIONS of the page. The canvas is rendered at `scale` but CSS-shrunk to
          // fit the panel (max-w-full), so absolute pixel coords would land off the displayed page.
          // Percentages scale with the canvas.
          const vw = viewport.width || 1;
          const vh = viewport.height || 1;
          const raw: Highlight[] = [];
          for (const it of matchItems) {
            try {
              const m = pdfjsLib.Util.transform(viewport.transform, it.transform);
              const fontH = Math.hypot(m[2], m[3]) || it.height * scale;
              const width = Math.max((it.width || 0) * scale, 6);
              // Pad a touch vertically so the marker covers ascenders/descenders like a real highlighter.
              const padY = fontH * 0.18;
              raw.push({
                left: m[4] / vw,
                top: (m[5] - fontH - padY) / vh,
                width: width / vw,
                height: (fontH + padY * 2) / vh,
              });
            } catch {
              /* skip a run whose transform math failed */
            }
          }
          // Merge runs that share a line into ONE continuous bar (no segmented boxes).
          const boxes: Highlight[] = [];
          for (const b of raw.sort((a, z) => a.top - z.top || a.left - z.left)) {
            const last = boxes[boxes.length - 1];
            if (last && Math.abs(last.top - b.top) < last.height * 0.6) {
              const right = Math.max(last.left + last.width, b.left + b.width);
              last.left = Math.min(last.left, b.left);
              last.width = right - last.left;
              last.top = Math.min(last.top, b.top);
              last.height = Math.max(last.height, b.height);
            } else {
              boxes.push({ ...b });
            }
          }
          if (!cancelled) {
            setHighlights(boxes);
            setStatus('located');
            // Bring the first highlighted line into view (fraction → displayed canvas pixels).
            if (boxes.length && scrollRef.current && canvasRef.current) {
              const topFrac = Math.min(...boxes.map((b) => b.top));
              const displayH = canvasRef.current.clientHeight || vh;
              scrollRef.current.scrollTo({ top: Math.max(0, topFrac * displayH - 80), behavior: 'smooth' });
            }
          }
        } else {
          setStatus('fallback');
        }
      } catch {
        if (!cancelled) setStatus('fallback');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [citation, signedUrl]);

  if (!citation) return null;

  return (
    <aside
      className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl"
      style={{
        background: 'var(--o3s-surface, #ffffff)',
        color: 'var(--o3s-text, #1B2623)',
        borderColor: 'var(--o3s-border, #d3ded6)',
      }}
      aria-label="Source citation"
    >
      <header className="border-b px-4 py-3" style={{ borderColor: 'var(--o3s-border, #d3ded6)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{citation.docName}</p>
            <p className="text-xs" style={{ color: 'var(--o3s-muted, #6b7280)' }}>
              {pageNum ? `Page ${pageNum}` : 'Source document'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 transition-opacity hover:opacity-70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {citation.sourceText.trim() ? (
          <p
            className="mt-2 rounded-md px-2 py-1.5 text-xs leading-relaxed"
            style={{ background: 'var(--o3s-primary-soft, #E7EDE8)', color: 'var(--o3s-text, #1B2623)' }}
          >
            “{citation.sourceText}”
          </p>
        ) : null}
      </header>

      <div ref={scrollRef} className="relative flex-1 overflow-auto p-4">
        {status === 'loading' ? (
          <p className="text-sm" style={{ color: 'var(--o3s-muted, #6b7280)' }}>
            Loading source document…
          </p>
        ) : null}

        {status === 'fallback' ? (
          <div
            className="mb-3 rounded-md border px-3 py-2 text-xs leading-relaxed"
            style={{ borderColor: 'var(--o3s-border, #d3ded6)', color: 'var(--o3s-muted, #6b7280)' }}
          >
            {pageNum ? (
              // The page rendered — the source is right below. Keep it calm; offer a full-size view.
              <p>
                Showing the source page.{' '}
                {signedUrl ? (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline underline-offset-2"
                    style={{ color: BRAND }}
                  >
                    Open full size ↗
                  </a>
                ) : null}
              </p>
            ) : signedUrl ? (
              <>
                <p>Couldn’t render the file inline.</p>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-semibold underline underline-offset-2"
                  style={{ color: BRAND }}
                >
                  Open the full PDF ↗
                </a>
              </>
            ) : (
              <p>Source text shown above for manual verification. The file link isn’t available for this record.</p>
            )}
          </div>
        ) : null}

        {/* Canvas is always present; it holds the rendered page when one is available. */}
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="max-w-full rounded-md" />
          {highlights.map((h, i) => (
            <div
              key={i}
              className="pointer-events-none absolute rounded-[3px]"
              style={{
                left: `${h.left * 100}%`,
                top: `${h.top * 100}%`,
                width: `${h.width * 100}%`,
                height: `${h.height * 100}%`,
                // Highlighter look: translucent violet the text reads through (multiply), with a soft
                // violet glow instead of a hard outline.
                background: `${VIOLET}33`,
                mixBlendMode: 'multiply',
                boxShadow: `0 0 0 1px ${VIOLET}40, 0 1px 4px ${VIOLET}33`,
              }}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
