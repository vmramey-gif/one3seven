import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  STORY_FIRST_STEP_LABELS,
  WORKER_STORY_EXAMPLES,
  WORKER_STORY_HEADING,
  WORKER_STORY_INTRO,
  WORKER_STORY_PLACEHOLDER,
  WORKER_STORY_REASSURANCE,
} from '../constants/workerStoryIntake';
import { INTAKE_OPENING_SHELL } from '../constants/intakeOpeningPresentation';

type WorkerStoryIntakeScreenProps = {
  intakeNumber?: string | null;
  initialStory?: string;
  onContinue: (story: string) => void;
  onSkip: () => void;
  onBackToLanding: () => void;
};

export function WorkerStoryIntakeScreen({
  intakeNumber,
  initialStory = '',
  onContinue,
  onSkip,
  onBackToLanding,
}: WorkerStoryIntakeScreenProps) {
  const [story, setStory] = useState(initialStory);

  useEffect(() => {
    setStory(initialStory);
  }, [initialStory]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white px-6 py-4">
        <div className={INTAKE_OPENING_SHELL}>
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {STORY_FIRST_STEP_LABELS.story}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{WORKER_STORY_HEADING}</h1>
          {intakeNumber ? (
            <p className="mt-2 text-[11px] text-slate-500">Intake {intakeNumber}</p>
          ) : null}
        </div>
      </header>

      <main className={`${INTAKE_OPENING_SHELL} px-6 py-8`}>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">{WORKER_STORY_INTRO}</p>

        <p className="text-sm text-slate-500 leading-relaxed mb-4">{WORKER_STORY_REASSURANCE}</p>

        <div className="rounded-[14px] border border-slate-100 bg-slate-50/80 px-4 py-3 mb-4">
          <p className="text-xs font-medium text-slate-700 mb-2">Examples</p>
          <ul className="list-inside list-disc text-xs text-slate-600 space-y-1">
            {WORKER_STORY_EXAMPLES.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </div>

        <label className="sr-only" htmlFor="worker-story-intake">
          Tell your story
        </label>
        <textarea
          id="worker-story-intake"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={8}
          placeholder={WORKER_STORY_PLACEHOLDER}
          className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 leading-relaxed"
        />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => onContinue(story.trim())}
            className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 min-h-[48px]"
          >
            Continue to upload
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
