/** Mobile Summary tab presentation helpers (worker shell only). Desktop keeps light report styling. */
export function workerMobileSummarySkin(shellMode: boolean) {
  if (!shellMode) {
    return {
      root: 'min-h-screen bg-white',
      content: (fullReview: boolean) => (fullReview ? 'pb-28' : 'pb-16'),
      skin: '',
      back: 'flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500 hover:text-slate-700 transition-colors duration-200 font-normal',
      pageTitle:
        'text-xl leading-tight font-medium text-[var(--o3s-fg)] tracking-tight',
      nextHeading: 'text-base font-semibold text-slate-900 mb-4',
      btnDownload:
        'w-full bg-slate-900 text-white py-4 px-6 rounded-[14px] hover:bg-slate-800 transition-all shadow-sm hover:shadow-md font-medium flex items-center justify-center gap-2',
      btnSecondary:
        'w-full bg-slate-100 text-slate-900 py-4 px-6 rounded-[14px] hover:bg-slate-200 transition-colors font-medium flex items-center justify-center gap-2',
      btnSecondaryDisabled:
        'w-full bg-slate-100 text-slate-400 py-4 px-6 rounded-[14px] cursor-not-allowed font-medium flex items-center justify-center gap-2',
      btnPrimaryDark:
        'w-full bg-slate-900 text-white py-4 px-6 rounded-[14px] hover:bg-slate-800 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50',
      fullReviewBtn:
        'w-full mb-3 text-sm font-medium px-4 py-2.5 rounded-[12px] border border-slate-200 text-slate-800 hover:bg-slate-50',
      footer: 'px-6 py-10 bg-white border-t border-slate-100',
      betaSection: 'px-6 pb-10 bg-slate-50 py-10',
      intakeMeta: 'text-[11px] text-[var(--o3s-subtle)] font-mono mt-0.5',
      statusWrap: '',
      timelineHero: '',
      packetPreviewDark: false,
      expandableTitle: '',
      deck: '',
    };
  }

  return {
    root:
      'min-h-screen bg-[var(--o3s-obsidian)] text-[var(--o3s-fg)] sm:bg-white sm:text-slate-900',
    content: () => 'pb-20 sm:pb-16',
    skin: 'worker-mobile-summary-skin',
    back:
      'flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--o3s-subtle)] hover:text-[var(--o3s-ivory)] transition-colors sm:text-xs sm:text-slate-500 sm:hover:text-slate-700 sm:tracking-wide sm:font-normal',
    pageTitle:
      'font-display text-[clamp(1.75rem,7vw,2.25rem)] leading-[1.05] tracking-[-0.02em] text-[var(--o3s-ivory)] font-medium sm:text-xl sm:font-sans sm:tracking-tight sm:text-[var(--o3s-fg)] sm:leading-tight',
    nextHeading:
      'font-display text-lg font-medium text-[var(--o3s-ivory)] mb-4 sm:text-base sm:font-semibold sm:text-slate-900 sm:font-sans',
    btnDownload:
      'w-full rounded-xl bg-[var(--o3s-gold)] text-[var(--o3s-obsidian)] py-3.5 px-5 font-medium flex items-center justify-center gap-2 shadow-lg shadow-black/25 hover:opacity-95 transition-opacity sm:bg-slate-900 sm:text-white sm:py-4 sm:px-6 sm:rounded-[14px] sm:shadow-sm sm:hover:bg-slate-800 sm:hover:opacity-100',
    btnSecondary:
      'w-full rounded-xl border border-[var(--o3s-border)] bg-white/[0.03] text-[var(--o3s-ivory)]/90 py-3.5 px-5 font-medium flex items-center justify-center gap-2 hover:bg-white/[0.06] transition-colors sm:bg-slate-100 sm:text-slate-900 sm:border-transparent sm:py-4 sm:px-6 sm:rounded-[14px] sm:hover:bg-slate-200',
    btnSecondaryDisabled:
      'w-full rounded-xl border border-[var(--o3s-border)]/60 bg-white/[0.02] text-[var(--o3s-subtle)] py-3.5 px-5 font-medium flex items-center justify-center gap-2 cursor-not-allowed sm:bg-slate-100 sm:text-slate-400 sm:py-4 sm:px-6 sm:rounded-[14px]',
    btnPrimaryDark:
      'w-full rounded-xl bg-white/[0.08] border border-[var(--o3s-border)] text-[var(--o3s-ivory)] py-3.5 px-5 font-medium flex items-center justify-center gap-2 hover:bg-white/[0.12] disabled:opacity-50 sm:bg-slate-900 sm:text-white sm:py-4 sm:px-6 sm:rounded-[14px] sm:border-transparent sm:hover:bg-slate-800',
    fullReviewBtn:
      'w-full mb-3 text-sm font-medium px-4 py-2.5 rounded-xl border border-[var(--o3s-border)] text-[var(--o3s-cyan)]/90 hover:bg-white/[0.04] sm:rounded-[12px] sm:border-slate-200 sm:text-slate-800 sm:hover:bg-slate-50',
    footer: 'hidden sm:block px-6 py-10 bg-white border-t border-slate-100',
    betaSection: 'hidden sm:block px-6 pb-10 bg-slate-50 py-10',
    intakeMeta: 'hidden sm:block text-[11px] text-[var(--o3s-subtle)] font-mono mt-0.5',
    statusWrap: 'shrink-0 sm:shrink',
    timelineHero: 'hidden sm:block mb-8 px-1',
    packetPreviewDark: true,
    expandableTitle:
      'font-display text-[1.0625rem] font-medium text-[var(--o3s-ivory)]/92 sm:font-sans sm:text-sm sm:text-[var(--o3s-fg)]',
    deck: 'font-editorial text-[13px] leading-relaxed text-[var(--o3s-ivory-muted)] sm:font-sans sm:text-sm sm:text-slate-600',
  };
}
