import type { SecondBrainPacketViewModel } from '../../services/intakePacketPresentation';
import { ATTORNEY_PACKET_SECTIONS } from '../constants/workerStoryIntake';
import { polishHumanReadableDisplayText } from '../../services/firmIntakeDisplay';

export type IntakePacketPreviewProps = {
  model: SecondBrainPacketViewModel;
  generatedLabel?: string;
  /** Dark editorial skin for worker mobile summary. */
  darkPresentation?: boolean;
};

export function IntakePacketPreview({ model, generatedLabel, darkPresentation = false }: IntakePacketPreviewProps) {
  const dateLabel = generatedLabel ?? model.metadata.dateGenerated;
  const shell = darkPresentation
    ? 'bg-white/[0.02] rounded-xl border border-[var(--o3s-border)] overflow-hidden sm:bg-white sm:border-slate-200 sm:shadow-sm'
    : 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden';
  const header = darkPresentation
    ? 'px-5 py-4 border-b border-[var(--o3s-border)] bg-white/[0.02] sm:border-slate-100 sm:bg-slate-50/80'
    : 'px-5 py-4 border-b border-slate-100 bg-slate-50/80';
  const kicker = darkPresentation
    ? 'text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--o3s-subtle)] mb-1 sm:font-semibold sm:tracking-wider sm:text-slate-500'
    : 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1';
  const title = darkPresentation
    ? 'font-display text-base font-medium text-[var(--o3s-ivory)] sm:font-semibold sm:text-slate-900 sm:font-sans'
    : 'text-base font-semibold text-slate-900';
  const meta = darkPresentation
    ? 'text-xs text-[var(--o3s-subtle)] mt-0.5 sm:text-slate-500'
    : 'text-xs text-slate-500 mt-0.5';
  const sectionTitle = darkPresentation
    ? 'font-display text-xs font-medium text-[var(--o3s-ivory)]/90 mb-2 sm:font-semibold sm:text-slate-800 sm:font-sans'
    : 'text-xs font-semibold text-slate-800 mb-2';
  const body = darkPresentation
    ? 'text-[11px] text-[var(--o3s-muted)] leading-relaxed sm:text-sm sm:text-slate-700'
    : 'text-sm text-slate-700 leading-relaxed';
  const recordsIncluded = model.snapshotCards.filter((card) => card.uploadCount > 0);
  const missingRecords = model.humanContext.missingNotes.slice(0, 5);
  const snapshot = model.caseSnapshot;

  return (
    <div className={shell}>
      <div className={header}>
        <p className={kicker}>Story packet preview</p>
        <h3 className={title}>one3Seven Story Packet</h3>
        <p className={meta}>
          {model.metadata.intakeId} / {dateLabel}
        </p>
        <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] ${darkPresentation ? 'text-[var(--o3s-subtle)] sm:text-slate-500' : 'text-slate-500'}`}>
          <span>{polishHumanReadableDisplayText(model.metadata.workerName) || model.metadata.workerName}</span>
          <span>/</span>
          <span className="break-words">
            {polishHumanReadableDisplayText(model.metadata.employer) || model.metadata.employer}
          </span>
        </div>
      </div>

      <div className="max-h-[min(70vh,680px)] space-y-6 overflow-y-auto p-5">
        <section>
          <h4 className={sectionTitle}>{ATTORNEY_PACKET_SECTIONS.currentUnderstanding}</h4>
          <p className={`${body} whitespace-pre-wrap`}>
            {polishHumanReadableDisplayText(model.coreStory) || model.coreStory}
          </p>
        </section>

        <section>
          <h4 className={sectionTitle}>{ATTORNEY_PACKET_SECTIONS.caseSnapshot}</h4>
          <dl className={`grid gap-2 text-xs ${darkPresentation ? 'text-[var(--o3s-muted)] sm:text-slate-700' : 'text-slate-700'}`}>
            <div>
              <dt className="font-semibold text-slate-800">Employment Period</dt>
              <dd>{snapshot.employmentPeriod}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">Primary Concerns</dt>
              <dd>
                <ul className="mt-1 list-none space-y-0.5">
                  {snapshot.primaryConcerns.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Records Organized: {snapshot.recordsOrganized}</span>
              <span>Timeline Events: {snapshot.timelineEvents}</span>
              <span>Named Individuals: {snapshot.namedIndividuals}</span>
            </div>
          </dl>
        </section>

        {model.humanContext.sections.length > 0 ? (
          <section>
            <h4 className={sectionTitle}>{ATTORNEY_PACKET_SECTIONS.workerStory}</h4>
            <div className="space-y-3">
              {model.humanContext.sections.map((section) => (
                <div key={section.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>
                  <p className={`${body} mt-1 whitespace-pre-wrap`}>
                    {polishHumanReadableDisplayText(section.body) || section.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {model.reviewSignals.length > 0 ? (
          <section>
            <h4 className={sectionTitle}>{ATTORNEY_PACKET_SECTIONS.questionsForReview}</h4>
            <ul className="space-y-1 text-xs leading-relaxed text-slate-700">
              {model.reviewSignals.slice(0, 8).map((s) => (
                <li key={s.id}>- {polishHumanReadableDisplayText(s.label) || s.label}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {model.chronologyEvents.length > 0 ? (
          <section>
            <h4 className={sectionTitle}>{ATTORNEY_PACKET_SECTIONS.chronology}</h4>
            <ul className="ml-1 space-y-3 border-l-2 border-slate-200 pl-3">
              {model.chronologyEvents.slice(0, 6).map((row, i) => (
                <li key={i}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {polishHumanReadableDisplayText(row.date) || row.date}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900">
                    {polishHumanReadableDisplayText(row.title) || row.title}
                  </p>
                  {row.supportingUploads.length > 0 ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Supporting records: {row.supportingUploads.join(', ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {missingRecords.length > 0 ? (
          <section>
            <h4 className={sectionTitle}>{ATTORNEY_PACKET_SECTIONS.missingInformation}</h4>
            <ul className="space-y-1 text-xs leading-relaxed text-slate-700">
              {missingRecords.map((item) => (
                <li key={item}>- {polishHumanReadableDisplayText(item) || item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {recordsIncluded.length > 0 ? (
          <section>
            <h4 className={sectionTitle}>Uploaded Record Categories</h4>
            <ul className="space-y-1 text-xs leading-relaxed text-slate-700">
              {recordsIncluded.slice(0, 8).map((card) => (
                <li key={card.key}>
                  - {polishHumanReadableDisplayText(card.label) || card.label}
                  {card.uploadCount > 1 ? ` (${card.uploadCount})` : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
