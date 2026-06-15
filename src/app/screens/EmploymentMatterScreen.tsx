import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  EMPLOYMENT_MATTER_DEFAULT_CHIPS,
  EMPLOYMENT_MATTER_EXPANDED_CHIPS,
  EMPLOYMENT_MATTER_TOPIC_HELPER,
  type EmploymentMatterTagId,
} from '../constants/employmentMatter';
import { UPLOAD_REDACTION_NOTICE } from '../constants/caseCategories';
import { INTAKE_OPENING_MICROCOPY, INTAKE_OPENING_SHELL } from '../constants/intakeOpeningPresentation';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';

type EmploymentMatterScreenProps = {
  intakeNumber?: string | null;
  initialTags?: EmploymentMatterTagId[];
  onContinue: (tags: EmploymentMatterTagId[]) => void;
  onDraftChange?: (tags: EmploymentMatterTagId[]) => void | Promise<void>;
  onBackToLanding: () => void;
};

function toggleTag(list: EmploymentMatterTagId[], id: EmploymentMatterTagId): EmploymentMatterTagId[] {
  return list.includes(id) ? list.filter((t) => t !== id) : [...list, id];
}

export function EmploymentMatterScreen({
  intakeNumber,
  initialTags = [],
  onContinue,
  onDraftChange,
  onBackToLanding,
}: EmploymentMatterScreenProps) {
  const [selected, setSelected] = useState<EmploymentMatterTagId[]>(initialTags);
  const [expanded, setExpanded] = useState(false);
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);

  useEffect(() => {
    setSelected(initialTags);
  }, [JSON.stringify(initialTags)]);

  useEffect(() => {
    if (!onDraftChange) return;
    setDraftSaveError(null);
    const handle = window.setTimeout(() => {
      setDraftSaving(true);
      void (async () => {
        try {
          await onDraftChange(selected);
          setDraftSaveMessage('Selections saved.');
          window.setTimeout(() => setDraftSaveMessage(null), 2600);
        } catch (e) {
          setDraftSaveError(
            e instanceof Error ? e.message : 'Could not save your selections. Try again.'
          );
        } finally {
          setDraftSaving(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [selected, onDraftChange]);

  const canContinue = selected.length > 0;

  const chipClass = (active: boolean) =>
    `inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-medium transition touch-manipulation min-h-[40px] ${
      active
        ? 'border-[var(--o3s-primary)] bg-[var(--o3s-primary)] text-white shadow-[var(--o3s-shadow-button)]'
        : 'border-[var(--o3s-border)] bg-[var(--o3s-surface)] text-[var(--o3s-text-soft)] hover:border-[var(--o3s-border-strong)]'
    }`;

  const visibleExpanded = useMemo(
    () => (expanded ? EMPLOYMENT_MATTER_EXPANDED_CHIPS : []),
    [expanded]
  );

  return (
    <div className="min-h-screen bg-[var(--o3s-bg)]">
      <header className="border-b border-[var(--o3s-border)] bg-[var(--o3s-surface)]/92 px-6 py-4 backdrop-blur-md">
        <div className={INTAKE_OPENING_SHELL}>
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--o3s-text-muted)] hover:text-[var(--o3s-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--o3s-text-muted)]">California beta</p>
          <h1 className="mt-1 text-xl font-semibold text-[var(--o3s-text)]">Employment Matter</h1>
          <p className="mt-2 text-sm text-[var(--o3s-text-muted)] leading-relaxed">
            What best describes your situation?
            <br />
            Select all that apply.
          </p>
          <p className="mt-3 text-xs text-[var(--o3s-text-muted)] leading-relaxed">{EMPLOYMENT_MATTER_TOPIC_HELPER}</p>
          {intakeNumber ? (
            <p className="mt-2 text-[11px] text-[var(--o3s-text-muted)]">Intake {intakeNumber}</p>
          ) : null}
        </div>
      </header>

      <main className={`${INTAKE_OPENING_SHELL} px-6 py-8`}>
        <div className="mb-8 rounded-[14px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)]/92 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-[var(--o3s-text-muted)]">{UPLOAD_REDACTION_NOTICE}</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {EMPLOYMENT_MATTER_DEFAULT_CHIPS.map((chip) => {
            const active = selected.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelected((prev) => toggleTag(prev, chip.id))}
                className={chipClass(active)}
                aria-pressed={active}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mb-6 text-sm font-medium text-[var(--o3s-text-soft)] hover:text-[var(--o3s-text)]"
          >
            + More employment topics
          </button>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {visibleExpanded.map((chip) => {
                const active = selected.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setSelected((prev) => toggleTag(prev, chip.id))}
                    className={chipClass(active)}
                    aria-pressed={active}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mb-6 text-sm font-medium text-[var(--o3s-text-muted)] hover:text-[var(--o3s-text)]"
            >
              Show fewer topics
            </button>
          </>
        )}

        <p className="text-xs text-[var(--o3s-text-muted)] leading-relaxed mb-2">
          {INTAKE_OPENING_MICROCOPY.organizesTimeline} You can update these later. Selecting &ldquo;Other / Not
          Sure&rdquo; is enough to continue.
        </p>
        {draftSaveMessage ? (
          <p className="text-xs font-medium text-emerald-700 mb-2">{draftSaveMessage}</p>
        ) : null}
        {draftSaveError ? (
          <p className="text-xs text-amber-800 mb-2">{draftSaveError}</p>
        ) : null}
        {draftSaving ? <p className="text-xs text-[var(--o3s-text-muted)] mb-2">Saving…</p> : null}

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onContinue(selected)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-[var(--o3s-primary)] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[var(--o3s-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px] mb-4"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
        <One3SevenDisclaimer variant="compact" className="mb-6" />
      </main>
    </div>
  );
}
