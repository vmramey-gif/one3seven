/**
 * The company's primary sales tool — a no-login, obscured-URL, fully interactive demo built on 5
 * FICTIONAL synthetic personas (gauntlet-verified, see src/app/demo/personaDemoData.ts). A prospect
 * picks a legal scenario, sees the worker's organized record, then flips to the firm's side of the
 * SAME case using the real production `IntakeReviewScreen` component in `demoMode`.
 *
 * Accessible only via /sales-demo-7k2m9x4p — deliberately not linked from any in-product nav.
 *
 * HARD ISOLATION: this route and everything it imports from ./  or ../demo render from static
 * bundled data only. Zero Supabase/Stripe/email/network calls. No real auth. Nothing here can
 * create a database row, send an email, or reach a payment flow.
 */
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Sparkles,
} from 'lucide-react';
import { IntakeReviewScreen } from './IntakeReviewScreen';
import { IntakeReviewErrorBoundary } from '../components/IntakeReviewErrorBoundary';
import { WorkerRecordStoryBlock } from '../components/WorkerRecordStoryBlock';
import { WorkerTimelineEventCard } from '../components/WorkerTimelineEventCard';
import { EmploymentMatterChipList } from '../components/EmploymentMatterTagsLine';
import { WordMark } from '../components/WordMark';
import { PERSONA_DEMOS, type PersonaDemoEntry, type PersonaWorkerTimelineItem } from '../demo/personaDemoData';
import { isWorkerTimelineKeyStoryMoment } from '../utils/workerTimelineNarrative';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import type { SourceStrength } from '../../services/intakeOrganizationTypes';

type View = 'picker' | 'worker' | 'firm';

function toWorkerTimelineItem(item: PersonaWorkerTimelineItem): WorkerTimelineItem {
  return {
    date: item.date,
    event: item.event,
    category: item.category,
    summary: item.summary,
    relatedDocs: item.relatedDocs,
    sourceFileNames: item.sourceFileNames,
    sourceDates: item.sourceDates,
    sourceStrength: (item.sourceStrength as SourceStrength | null) ?? null,
  };
}

/** Always-visible isolation + provenance label — same doctrine as every other demo surface. */
function SampleDataBanner({
  view,
  onBackToPicker,
  onSwitchPersona,
  activePersonaId,
}: {
  view: View;
  onBackToPicker: () => void;
  onSwitchPersona: (id: string) => void;
  activePersonaId: string | null;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] bg-[#1B2623]/95 backdrop-blur text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10">
      <p className="text-xs text-white/55 truncate">
        one3seven · Illustrative sample data — 5 fictional cases, not real clients
      </p>
      <div className="flex items-center gap-2 shrink-0">
        {view !== 'picker' ? (
          <button
            type="button"
            onClick={onBackToPicker}
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition-colors"
          >
            All cases
          </button>
        ) : null}
        {view !== 'picker' && activePersonaId ? (
          <select
            aria-label="Switch case"
            value={activePersonaId}
            onChange={(e) => onSwitchPersona(e.target.value)}
            className="rounded-full border border-white/20 bg-transparent px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition-colors"
          >
            {PERSONA_DEMOS.map((p) => (
              <option key={p.personaId} value={p.personaId} className="text-[#1B2623]">
                {p.personaName}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={() => { window.location.href = '/'; }}
          className="shrink-0 rounded-full bg-[#42574E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#374A42] transition-colors"
        >
          Get your firm intake link →
        </button>
      </div>
    </div>
  );
}

function PersonaPicker({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-24">
      <nav className="border-b border-[#E4E5DE] bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
          <span className="text-[15px] font-bold tracking-tight text-[#1B2623]">
            <WordMark />
          </span>
          <span className="text-xs text-[#1B2623]/50">Interactive sample cases</span>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-14">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E4E5DE] bg-white px-3 py-1.5 text-xs font-semibold text-[#42574E]">
          <Sparkles className="h-3.5 w-3.5" />
          5 fictional sample cases
        </div>
        <h1
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          className="text-[30px] sm:text-[38px] font-medium leading-tight tracking-[-0.01em] text-[#1B2623] max-w-2xl"
        >
          See the record, organized — from both sides of the same case.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#1B2623]/60">
          Pick a scenario. You&rsquo;ll see the worker&rsquo;s organized record first, then flip to
          the firm&rsquo;s review of the exact same intake. Every case below is entirely fictional —
          built for testing, safe to explore.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PERSONA_DEMOS.map((p) => (
            <button
              key={p.personaId}
              type="button"
              onClick={() => onSelect(p.personaId)}
              className="group text-left rounded-[20px] border border-[#E4E5DE] bg-white p-6 transition-all hover:border-[#42574E]/40 hover:shadow-[0_16px_40px_rgba(66,87,78,0.10)]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#F2F4EC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#42574E]">
                  Sample case
                </span>
                <ArrowRight className="h-4 w-4 text-[#1B2623]/25 transition-transform group-hover:translate-x-1 group-hover:text-[#42574E]" />
              </div>
              <h2
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                className="mt-4 text-[19px] font-medium leading-snug text-[#1B2623]"
              >
                {p.scenarioLabel}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#1B2623]/55">
                {p.worker.docCount} records organized into a {p.worker.timeline.length}-event
                timeline · {p.worker.employer}
              </p>
            </button>
          ))}
        </div>

        <p className="mt-10 text-[11px] leading-relaxed text-[#1B2623]/40 max-w-xl">
          Illustrative / sample data. These five people are entirely fictional, invented for
          product testing. No real worker, firm, or case is represented here.
        </p>
      </div>
    </div>
  );
}

function WorkerCaseView({
  entry,
  onSeeFirmSide,
}: {
  entry: PersonaDemoEntry;
  onSeeFirmSide: () => void;
}) {
  const { worker } = entry;
  const timelineItems = useMemo(() => worker.timeline.map(toWorkerTimelineItem), [worker.timeline]);
  const onFile = worker.coverage.filter((c) => c.state === 'on_file');
  const notOnFile = worker.coverage.filter((c) => c.state !== 'on_file');

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-28">
      <nav className="border-b border-[#E4E5DE] bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-2xl px-5 py-4 flex items-center justify-between gap-3">
          <span className="text-[15px] font-bold tracking-tight text-[#1B2623]">
            <WordMark />
          </span>
          <span className="text-xs text-[#1B2623]/50 truncate">Worker view · sample case</span>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#42574E]">
          {worker.scenarioLabel}
        </div>
        <h1
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          className="text-[26px] sm:text-[30px] font-medium leading-tight tracking-[-0.01em] text-[#1B2623]"
        >
          {worker.workerName}
        </h1>
        <p className="mt-1.5 text-[13px] text-[#1B2623]/55">
          {worker.employer}
          {worker.employmentDates ? ` · ${worker.employmentDates}` : ''}
        </p>

        {worker.employmentMatterTags.length ? (
          <div className="mt-4">
            <EmploymentMatterChipList tags={worker.employmentMatterTags} />
          </div>
        ) : null}

        {worker.storyText ? (
          <section className="mt-6 rounded-[18px] border border-[#E4E5DE] bg-white p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#1B2623]/45">
              In their own words
            </p>
            <p className="text-[14px] leading-relaxed text-[#1B2623] whitespace-pre-wrap">
              {worker.storyText}
            </p>
          </section>
        ) : null}

        <div className="mt-6 rounded-[18px] border border-[#E4E5DE] bg-white px-5">
          <WorkerRecordStoryBlock
            excerpt={worker.organizedSummary}
            docCount={worker.docCount}
            eventCount={worker.timeline.length}
          />
        </div>

        <section className="mt-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#1B2623]/45">
            Timeline
          </p>
          <div className="rounded-[18px] border border-[#E4E5DE] bg-white px-5">
            {timelineItems.map((item, idx) => (
              <WorkerTimelineEventCard
                key={`${item.date}-${idx}`}
                event={item}
                defaultOpen={idx === 0}
                isKeyEvent={isWorkerTimelineKeyStoryMoment(item.event, idx)}
              />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#1B2623]/45">
            What&rsquo;s on file — California employer-record coverage
          </p>
          <div className="rounded-[18px] border border-[#E4E5DE] bg-white p-5">
            <div className="flex flex-wrap gap-1.5">
              {onFile.map((c) => (
                <span
                  key={c.key}
                  className="rounded-full border border-[#CBD6CF] bg-[#EEF2EE] px-2.5 py-1 text-[11px] font-medium text-[#374A42]"
                  title={c.citation}
                >
                  {c.label}
                </span>
              ))}
            </div>
            {notOnFile.length ? (
              <>
                <p className="mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#A8512B]">
                  Not yet in the file
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {notOnFile.map((c) => (
                    <span
                      key={c.key}
                      className="rounded-full border border-[#EBD9CD] bg-[#FBF4EF] px-2.5 py-1 text-[11px] text-[#8B4A2B]"
                      title={c.citation}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            <p className="mt-4 text-[10px] leading-relaxed text-[#1B2623]/40">
              Describes what the record contains, not what it proves. Requirement citations are
              illustrative and counsel-reviewed before use with a real firm.
            </p>
          </div>
        </section>

        <button
          type="button"
          onClick={onSeeFirmSide}
          className="mt-10 flex w-full items-center justify-between gap-3 rounded-2xl bg-[#1B2623] px-5 py-4 text-left text-white transition hover:bg-[#0F1512]"
        >
          <span className="flex items-center gap-3">
            <Building2 className="h-5 w-5 flex-none text-[#95AB9B]" />
            <span>
              <span className="block text-[14.5px] font-semibold">
                See this case from the firm&rsquo;s side
              </span>
              <span className="block text-[12px] text-white/60">
                Same intake, the way a reviewing attorney sees it
              </span>
            </span>
          </span>
          <ArrowRight className="h-5 w-5 flex-none" />
        </button>
      </div>
    </div>
  );
}

function FirmCaseView({ entry, onBackToWorker }: { entry: PersonaDemoEntry; onBackToWorker: () => void }) {
  return (
    <div className="relative">
      <div className="fixed top-3 left-3 z-[1000]">
        <button
          type="button"
          onClick={onBackToWorker}
          className="flex items-center gap-1.5 rounded-full border border-[#E4E5DE] bg-white/95 backdrop-blur px-3.5 py-2 text-xs font-semibold text-[#1B2623] shadow-sm hover:bg-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Worker view
        </button>
      </div>
      <div className="pb-14">
        <IntakeReviewErrorBoundary onBackToDashboard={() => {}}>
          <IntakeReviewScreen
            onNavigate={() => {}}
            intakeId={`sample-${entry.personaId}-demo`}
            onUpdateWorkspace={() => {}}
            firmLiveView={entry.firm}
            firmLiveViewLoading={false}
            firmDisplayName="Demo Law Firm"
            firmBellNotifications={[]}
            demoMode
            onRequestFullAccess={undefined}
            onAcceptIntake={async () => ({})}
            onDeclineIntake={async () => ({})}
            onRequestAdditionalDocuments={undefined}
            onReloadFirmLiveView={undefined}
          />
        </IntakeReviewErrorBoundary>
      </div>
    </div>
  );
}

export function SalesDemoPage() {
  const [view, setView] = useState<View>('picker');
  const [personaId, setPersonaId] = useState<string | null>(null);

  const entry = useMemo(
    () => (personaId ? PERSONA_DEMOS.find((p) => p.personaId === personaId) ?? null : null),
    [personaId]
  );

  const selectPersona = (id: string) => {
    setPersonaId(id);
    setView('worker');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const switchPersona = (id: string) => {
    setPersonaId(id);
    setView('worker');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const backToPicker = () => {
    setView('picker');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="relative">
      {view === 'picker' || !entry ? (
        <PersonaPicker onSelect={selectPersona} />
      ) : view === 'worker' ? (
        <WorkerCaseView entry={entry} onSeeFirmSide={() => { setView('firm'); window.scrollTo({ top: 0, behavior: 'instant' }); }} />
      ) : (
        <FirmCaseView entry={entry} onBackToWorker={() => { setView('worker'); window.scrollTo({ top: 0, behavior: 'instant' }); }} />
      )}
      <SampleDataBanner
        view={view}
        onBackToPicker={backToPicker}
        onSwitchPersona={switchPersona}
        activePersonaId={personaId}
      />
    </div>
  );
}
