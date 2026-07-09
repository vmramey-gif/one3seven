import { useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { SourceCitation } from '../../services/damagesCalculator';

// Brand purple is the one intentional hardcoded color (per spec). Everything else themes
// via CSS variables so the components read correctly in light and dark mode.
const BRAND = '#42574E';

/**
 * Wraps a wage-exposure figure that has a source document. Renders as underlined brand
 * text with a small ↗; clicking opens the CitationPanel for that source.
 */
export function CitationLink({
  citation,
  onOpen,
  children,
}: {
  citation: SourceCitation;
  onOpen: (citation: SourceCitation) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(citation)}
      title={`Source: ${citation.docName}`}
      className="inline-flex items-center gap-0.5 font-medium underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={{ color: BRAND }}
    >
      {children}
      <ArrowUpRight className="h-3 w-3" aria-hidden />
    </button>
  );
}

const STATUTE_TEXT: Record<string, string> = {
  'Cal. Lab. Code §510(a)':
    'Cal. Lab. Code §510(a): overtime is one-and-one-half times the regular rate for hours worked over 8 in a day or 40 in a week.',
  'Cal. Lab. Code §226.7':
    'Cal. Lab. Code §226.7: one additional hour of pay at the regular rate for each workday a required meal or rest period is not provided.',
};

/**
 * A Labor Code reference. There is no source document to open, so it shows the statute
 * text in a small tooltip on hover/focus — never a CitationPanel.
 */
export function StatutoryRef({ refText, children }: { refText: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const statute = STATUTE_TEXT[refText] ?? refText;
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={statute}
        className="font-medium underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:ring-2"
        style={{ color: BRAND }}
      >
        {children}
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-lg border px-3 py-2 text-xs leading-relaxed shadow-lg"
          style={{
            background: 'var(--o3s-surface, #fff)',
            color: 'var(--o3s-text, #1e1b4b)',
            borderColor: 'var(--o3s-border, #d3ded6)',
          }}
        >
          {statute}
        </span>
      ) : null}
    </span>
  );
}
