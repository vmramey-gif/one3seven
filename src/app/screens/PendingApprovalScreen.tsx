import { CheckCircle2 } from 'lucide-react';
import { WordMark } from '../components/WordMark';
import { useLang, LangToggle } from '../../i18n/i18n';

/**
 * Hold screen shown after a worker/firm signs up while the beta is invite-gated.
 * The signup is still captured (warm lead); the user just can't enter the product until an
 * operator sets profiles.approved = true. Founders and reps bypass this (see App gate).
 * Sage brand (2026-07-08): light off-white + ink + cool sage.
 */
const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

export function PendingApprovalScreen({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useLang();
  return (
    <div style={BODY} className="relative flex min-h-screen flex-col overflow-hidden bg-[#F1F3EF] px-5 py-4 text-[#17181C] antialiased sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#42574E]/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-40 h-[440px] w-[440px] rounded-full bg-[#728179]/8 blur-3xl" />

      <header className="relative flex items-center justify-between">
        <div style={SERIF} className="text-[19px] font-semibold tracking-[-0.01em] text-[#17181C]"><WordMark /></div>
        <LangToggle tone="light" />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center text-center">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#E7EDE8] text-[#42574E]">
            <CheckCircle2 className="h-7 w-7" />
          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#CBD6CF] bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#42574E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#42574E]" />
            {t('pending.badge')}
          </div>

          <h1 style={SERIF} className="mb-4 text-[30px] font-semibold leading-[1.08] tracking-[-0.015em] text-[#17181C] sm:text-[38px]">
            {t('pending.title')}
          </h1>

          <p className="mx-auto mb-3 max-w-[400px] text-[15px] leading-relaxed text-[#40433f]">
            {t('pending.body')}
          </p>
          <p className="mx-auto mb-8 max-w-[400px] text-[13px] leading-relaxed text-[#6a6d66]">
            {t('pending.sub')}
          </p>

          <button
            type="button"
            onClick={onSignOut}
            className="rounded-full border border-[#CBD6CF] bg-white px-6 py-2.5 text-sm font-semibold text-[#2c332e] transition hover:border-[#8f958b]"
          >
            {t('pending.signout')}
          </button>
        </div>
      </main>
    </div>
  );
}
