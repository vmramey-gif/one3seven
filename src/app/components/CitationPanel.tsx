import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { X } from 'lucide-react';
import type { SourceCitation } from '../../services/damagesCalculator';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const BRAND = '#42574E';

type PanelStatus = 'loading' | 'located' | 'fallback';

type Highlight = { left: number; top: number; width: number; height: number };

const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

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
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [pageNum, setPageNum] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
    if (!citation) return;
    let cancelled = false;
    setStatus('loading');
    setHighlight(null);
    setPageNum(null);

    void (async () => {
      try {
        if (!signedUrl) {
          if (!cancelled) setStatus('fallback');
          return;
        }
        const pdf = await pdfjsLib.getDocument({ url: signedUrl }).promise;
        const target = normalize(citation.sourceText);
        const probe = target.length > 40 ? target.slice(0, 40) : target;

        let matchPage = 0;
        let matchItem: { transform: number[]; width: number; height: number } | null = null;

        for (let p = 1; p <= pdf.numPages; p += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const tc = await page.getTextContent();
          const items = tc.items.filter(
            (i): i is { str: string; transform: number[]; width: number; height: number } => 'str' in i,
          );
          const joined = normalize(items.map((i) => i.str).join(' '));
          if (joined.includes(probe)) {
            matchPage = p;
            // Best-effort: highlight the first non-trivial text run that overlaps the snippet.
            matchItem =
              items.find((i) => {
                const s = normalize(i.str);
                return s.length > 3 && target.includes(s);
              }) ?? null;
            break;
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

        if (matchPage && matchItem) {
          try {
            const m = pdfjsLib.Util.transform(viewport.transform, matchItem.transform);
            const fontH = Math.hypot(m[2], m[3]) || matchItem.height * scale;
            const width = (matchItem.width || 0) * scale;
            setHighlight({ left: m[4], top: m[5] - fontH, width: Math.max(width, 12), height: fontH });
          } catch {
            // position math failed — page still rendered; treat as located without box
            setHighlight(null);
          }
          setStatus('located');
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
        <p
          className="mt-2 rounded-md px-2 py-1.5 text-xs leading-relaxed"
          style={{ background: 'var(--o3s-primary-soft, #f3efff)', color: 'var(--o3s-text, #1B2623)' }}
        >
          “{citation.sourceText}”
        </p>
      </header>

      <div className="relative flex-1 overflow-auto p-4">
        {status === 'loading' ? (
          <p className="text-sm" style={{ color: 'var(--o3s-muted, #6b7280)' }}>
            Loading source document…
          </p>
        ) : null}

        {status === 'fallback' ? (
          <p
            className="mb-3 rounded-md border px-3 py-2 text-xs leading-relaxed"
            style={{ borderColor: 'var(--o3s-border, #d3ded6)', color: 'var(--o3s-muted, #6b7280)' }}
          >
            Highlight unavailable — source text shown above for manual verification.
          </p>
        ) : null}

        {/* Canvas is always present; it holds the rendered page when one is available. */}
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="max-w-full rounded-md" />
          {highlight ? (
            <div
              className="pointer-events-none absolute rounded-sm"
              style={{
                left: highlight.left,
                top: highlight.top,
                width: highlight.width,
                height: highlight.height,
                background: `${BRAND}33`,
                outline: `1.5px solid ${BRAND}`,
              }}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
