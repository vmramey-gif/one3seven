import { useEffect, useRef, useState } from 'react';
import { X, Undo2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * In-app redaction — draw black boxes over sensitive areas (SSN, account numbers, etc.) before
 * a file is uploaded. Applying a redaction RASTERIZES the page: for PDFs, each page is rendered
 * to a canvas via pdfjs-dist, the redaction boxes are burned into that same pixel buffer, and the
 * whole thing is rebuilt as a brand-new PDF from those flattened page images (pdf-lib, embedPng)
 * — never by drawing a box over the ORIGINAL page's live text layer. A box drawn on top of an
 * unmodified PDF still leaves the underlying text selectable/extractable underneath it; that is
 * the single most common way real-world redactions fail. Rebuilding from rendered pixels is what
 * makes this an actual redaction rather than a visual cover-up.
 */

type Rect = { x: number; y: number; w: number; h: number };

const MAX_PAGES = 30;

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function RedactionEditor({
  file,
  onApply,
  onCancel,
}: {
  file: File;
  onApply: (redactedFile: File) => void;
  onCancel: () => void;
}) {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourcePagesRef = useRef<HTMLCanvasElement[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [rectsByPage, setRectsByPage] = useState<Rect[][]>([]);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  const unsupported = !isPdfFile(file) && !isImageFile(file);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (unsupported) {
        setError('Redaction is only available for PDF and image files.');
        setLoading(false);
        return;
      }
      try {
        if (isPdfFile(file)) {
          const pdfjsLib = await import('pdfjs-dist');
          const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
          const data = new Uint8Array(await file.arrayBuffer());
          const pdf = await pdfjsLib.getDocument({ data }).promise;
          const total = pdf.numPages;
          const renderCount = Math.min(total, MAX_PAGES);
          if (total > MAX_PAGES && !cancelled) setTruncated(true);
          const rendered: HTMLCanvasElement[] = [];
          for (let i = 1; i <= renderCount; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            await page.render({ canvasContext: ctx, viewport }).promise;
            rendered.push(canvas);
          }
          if (!cancelled) {
            sourcePagesRef.current = rendered;
            setPageCount(rendered.length);
            setRectsByPage(rendered.map(() => []));
          }
        } else {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(bitmap, 0, 0);
          if (!cancelled) {
            sourcePagesRef.current = [canvas];
            setPageCount(1);
            setRectsByPage([[]]);
          }
        }
      } catch {
        if (!cancelled) setError('Could not open this file for redaction. It may be corrupted or password-protected.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Repaint the visible canvas whenever the page, its rects, or an in-progress rect changes.
  useEffect(() => {
    const src = sourcePagesRef.current[pageIndex];
    const target = displayCanvasRef.current;
    if (!src || !target) return;
    target.width = src.width;
    target.height = src.height;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(src, 0, 0);
    ctx.fillStyle = '#000000';
    for (const r of rectsByPage[pageIndex] ?? []) ctx.fillRect(r.x, r.y, r.w, r.h);
    if (currentRect) ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
  }, [pageIndex, rectsByPage, currentRect, pageCount]);

  const toCanvasPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toCanvasPoint(e.clientX, e.clientY);
    if (p) setDrawStart(p);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawStart) return;
    const p = toCanvasPoint(e.clientX, e.clientY);
    if (!p) return;
    setCurrentRect({
      x: Math.min(drawStart.x, p.x),
      y: Math.min(drawStart.y, p.y),
      w: Math.abs(p.x - drawStart.x),
      h: Math.abs(p.y - drawStart.y),
    });
  };
  const commitCurrentRect = () => {
    if (currentRect && currentRect.w > 4 && currentRect.h > 4) {
      const committed = currentRect;
      setRectsByPage((prev) => prev.map((rects, i) => (i === pageIndex ? [...rects, committed] : rects)));
    }
    setDrawStart(null);
    setCurrentRect(null);
  };

  const undoLast = () =>
    setRectsByPage((prev) => prev.map((rects, i) => (i === pageIndex ? rects.slice(0, -1) : rects)));
  const clearPage = () =>
    setRectsByPage((prev) => prev.map((rects, i) => (i === pageIndex ? [] : rects)));

  const totalRects = rectsByPage.reduce((n, rects) => n + rects.length, 0);

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const finalCanvases = sourcePagesRef.current.map((canvas, i) => {
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0);
          ctx.fillStyle = '#000000';
          for (const r of rectsByPage[i] ?? []) ctx.fillRect(r.x, r.y, r.w, r.h);
        }
        return out;
      });

      const canvasToPngBytes = (canvas: HTMLCanvasElement): Promise<Uint8Array> =>
        new Promise((resolve, reject) => {
          canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('toBlob failed')); return; }
            resolve(new Uint8Array(await blob.arrayBuffer()));
          }, 'image/png');
        });

      if (isImageFile(file)) {
        const pngBytes = await canvasToPngBytes(finalCanvases[0]);
        const blob = new Blob([pngBytes], { type: 'image/png' });
        const name = file.name.replace(/\.[^.]+$/, '') + '-redacted.png';
        onApply(new File([blob], name, { type: 'image/png' }));
      } else {
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.create();
        for (const canvas of finalCanvases) {
          const pngBytes = await canvasToPngBytes(canvas);
          const img = await doc.embedPng(pngBytes);
          const p = doc.addPage([canvas.width, canvas.height]);
          p.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        }
        const bytes = await doc.save();
        const name = file.name.replace(/\.pdf$/i, '') + '-redacted.pdf';
        onApply(new File([bytes], name, { type: 'application/pdf' }));
      }
    } catch {
      setError('Could not apply the redaction. Try again.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/70 p-3 sm:items-center sm:justify-center sm:p-6">
      <div className="flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-[18px] bg-white sm:flex-none sm:max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-[#E4E5DE] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[#1B2623]">Redact before uploading</p>
            <p className="mt-0.5 text-xs text-[#6A6D66]">Draw a box over anything you don&rsquo;t want to share.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-1.5 text-[#6A6D66] hover:bg-[#F5F6F1]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F2EE] p-4">
          {loading ? (
            <p className="py-16 text-center text-sm text-[#6A6D66]">Opening file&hellip;</p>
          ) : error ? (
            <p className="py-16 text-center text-sm text-[#A8512B]">{error}</p>
          ) : (
            <canvas
              ref={displayCanvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={commitCurrentRect}
              onPointerLeave={commitCurrentRect}
              className="mx-auto block max-w-full touch-none rounded-lg border border-[#D8E0CF] bg-white shadow-sm"
              style={{ cursor: 'crosshair' }}
            />
          )}
          {truncated ? (
            <p className="mt-2 text-center text-[11px] text-[#8A7A4E]">
              Only the first {MAX_PAGES} pages are shown here for redaction.
            </p>
          ) : null}
        </div>

        {!loading && !error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E5DE] px-5 py-3.5">
            <div className="flex items-center gap-2">
              {pageCount > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                    disabled={pageIndex === 0}
                    className="rounded-lg border border-[#D8E0CF] p-1.5 text-[#42574E] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-[#6A6D66]">Page {pageIndex + 1} of {pageCount}</span>
                  <button
                    type="button"
                    onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
                    disabled={pageIndex === pageCount - 1}
                    className="rounded-lg border border-[#D8E0CF] p-1.5 text-[#42574E] disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={undoLast}
                disabled={(rectsByPage[pageIndex]?.length ?? 0) === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E0CF] px-3 py-1.5 text-xs font-medium text-[#42574E] disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
              <button
                type="button"
                onClick={clearPage}
                disabled={(rectsByPage[pageIndex]?.length ?? 0) === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E0CF] px-3 py-1.5 text-xs font-medium text-[#42574E] disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear page
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#6A6D66]">{totalRects} redaction{totalRects === 1 ? '' : 's'}</span>
              <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-xs font-medium text-[#6A6D66] hover:text-[#1B2623]">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void apply()}
                disabled={applying || totalRects === 0}
                className="rounded-full bg-[var(--o3s-action)] px-5 py-2 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
              >
                {applying ? 'Applying…' : 'Apply & use this file'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
