import { WordMark } from '../components/WordMark';
import { CheckCircle2 } from 'lucide-react';
import { useLang, LangToggle } from '../../i18n/i18n';

/**
 * Hold screen shown after a worker/firm signs up while the beta is invite-gated.
 * The signup is still captured (warm lead); the user just can't enter the product until an
 * operator sets profiles.approved = true. Founders and reps bypass this (see App gate).
 */
export function PendingApprovalScreen({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useLang();
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#14112E] px-5 py-4 text-[#E8E5F5] antialiased sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#42574E]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-40 h-[440px] w-[440px] rounded-full bg-[#42574E]/15 blur-3xl" />

      <header className="relative flex items-center justify-between">
        <div className="text-[17px] font-bold tracking-tight text-white"><WordMark /></div>
        <LangToggle tone="dark" />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center text-center">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#42574E]/15 text-[#7C8B6F]">
            <CheckCircle2 className="h-7 w-7" />
          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8B6F]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7C8B6F]" />
            {t('pending.badge')}
          </div>

          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mb-4 text-[30px] font-medium leading-[1.08] tracking-[-0.01em] text-white sm:text-[38px]">
            {t('pending.title')}
          </h1>

          <p className="mx-auto mb-3 max-w-[400px] text-[15px] leading-relaxed text-[#C9C4E6]">
            {t('pending.body')}
          </p>
          <p className="mx-auto mb-8 max-w-[400px] text-[13px] leading-relaxed text-white/45">
            {t('pending.sub')}
          </p>

          <button
            type="button"
            onClick={onSignOut}
            className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            {t('pending.signout')}
          </button>
        </div>
      </main>
    </div>
  );
}
