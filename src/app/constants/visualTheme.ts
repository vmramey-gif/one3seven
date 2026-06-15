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

export const O3S_DIVIDER = 'border-t border-[var(--o3s-border)]';

export const O3S_SURFACE_QUIET = 'rounded-xl bg-white/[0.02]';

export const O3S_SURFACE_SOFT =
  'rounded-xl border border-[var(--o3s-border)] bg-white/[0.02]';

export const O3S_BTN_PRIMARY =
  'rounded-xl bg-white/[0.08] text-[var(--o3s-fg)] border border-[var(--o3s-border)] hover:bg-white/[0.12] transition-colors font-medium';

export const O3S_BTN_GHOST =
  'rounded-xl text-[var(--o3s-muted)] border border-transparent hover:border-[var(--o3s-border)] hover:text-[var(--o3s-fg)] hover:bg-white/[0.03] transition-colors font-medium';

export const O3S_STATUS_PILL =
  'inline-flex items-center rounded-full border border-[var(--o3s-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--o3s-muted)]';

export const O3S_CYAN_TEXT = 'text-[var(--o3s-cyan)]';

export const O3S_GOLD_TEXT = 'text-[var(--o3s-gold)]';

export const O3S_GOLD_DOT = 'h-1.5 w-1.5 rounded-full bg-[var(--o3s-gold)] shrink-0';

export const O3S_CYAN_RAIL = 'bg-[var(--o3s-cyan)]/70';

export const O3S_UPLOAD_ZONE =
  'rounded-xl border border-dashed border-[var(--o3s-border)] bg-white/[0.015] hover:border-[var(--o3s-cyan)]/25 hover:bg-[var(--o3s-cyan-muted)] transition-colors';

/** Worker mobile timeline home — editorial / magazine typography (presentation only). */
export const O3S_MOBILE_EDITORIAL_HERO =
  'font-display text-[clamp(2.5rem,7.55vw,3rem)] leading-[1.05] tracking-[-0.018em] text-[var(--o3s-ivory)] font-medium';

export const O3S_MOBILE_EDITORIAL_DECK =
  'font-editorial text-[13px] leading-[1.5] text-[var(--o3s-ivory-muted)]';

export const O3S_MOBILE_EDITORIAL_SECTION =
  'font-display text-[1.0625rem] font-medium leading-[1.2] text-[var(--o3s-ivory)]/92 tracking-[0.01em]';

export const O3S_MOBILE_EDITORIAL_EVENT_TITLE =
  'font-display text-[0.9375rem] font-medium leading-[1.32] text-[var(--o3s-ivory)] tracking-[0.008em]';

export const O3S_MOBILE_EDITORIAL_BODY =
  'text-[11px] leading-[1.45] text-[var(--o3s-subtle)]';

export const O3S_MOBILE_EDITORIAL_CAPTION =
  'text-[10px] leading-[1.35] text-[var(--o3s-subtle)]/85';

export const O3S_MOBILE_EDITORIAL_META =
  'text-[10px] leading-[1.3] text-[var(--o3s-subtle)]/80 tabular-nums';
