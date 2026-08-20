/**
 * Premium dark “timeline-first” surface classes (visual only).
 * Pair with `.dark` on `<html>` and `--o3s-*` tokens in `theme.css`.
 */

export const O3S_PAGE = 'min-h-screen bg-[var(--o3s-obsidian)] text-[var(--o3s-fg)]';

export const O3S_SHELL_MAIN = 'flex-1 min-w-0 flex flex-col';

export const O3S_NAV_TOP =
  'sticky top-0 z-50 border-b border-[var(--o3s-border)] bg-[var(--o3s-obsidian)]/90 backdrop-blur-md';

export const O3S_NAV_BRAND =
  'text-lg font-medium tracking-tight text-[var(--o3s-fg)] hover:opacity-80 transition-opacity';

export const O3S_NAV_ACTION =
  'text-sm text-[var(--o3s-muted)] hover:text-[var(--o3s-fg)] px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors';

export const O3S_HEADLINE =
  'font-medium tracking-tight text-[var(--o3s-fg)] leading-[1.25]';

export const O3S_HEADLINE_HERO = `${O3S_HEADLINE} text-[1.65rem] sm:text-[1.85rem]`;

export const O3S_SUBLINE = 'text-sm text-[var(--o3s-muted)] leading-relaxed';

export const O3S_LABEL = 'text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--o3s-subtle)]';

export const O3S_BTN_PRIMARY =
  'rounded-xl bg-white/[0.08] text-[var(--o3s-fg)] border border-[var(--o3s-border)] hover:bg-white/[0.12] transition-colors font-medium';

export const O3S_BTN_GHOST =
  'rounded-xl text-[var(--o3s-muted)] border border-transparent hover:border-[var(--o3s-border)] hover:text-[var(--o3s-fg)] hover:bg-white/[0.03] transition-colors font-medium';

export const O3S_STATUS_PILL =
  'inline-flex items-center rounded-full border border-[var(--o3s-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--o3s-muted)]';

export const O3S_CYAN_TEXT = 'text-[var(--o3s-cyan)]';

export const O3S_GOLD_DOT = 'h-1.5 w-1.5 rounded-full bg-[var(--o3s-gold)] shrink-0';
