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
    <div className="min-h-screen bg-[#FAF9F6]">
      <header className="border-b border-[#F1ECF8] bg-white px-6 py-4">
        <div className={INTAKE_OPENING_SHELL}>
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#6B6685] hover:text-[#14112E]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#8B86A0]">
            {STORY_FIRST_STEP_LABELS.story}
          </p>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mt-1 text-xl font-medium text-[#14112E]">{WORKER_STORY_HEADING}</h1>
          {intakeNumber ? (
            <p className="mt-2 text-[11px] text-[#8B86A0]">Intake {intakeNumber}</p>
          ) : null}
        </div>
      </header>

      <main className={`${INTAKE_OPENING_SHELL} px-6 py-8`}>
        <p className="text-sm text-[#6B6685] leading-relaxed mb-4">{WORKER_STORY_INTRO}</p>

        <p className="text-sm text-[#8B86A0] leading-relaxed mb-4">{WORKER_STORY_REASSURANCE}</p>

        <div className="rounded-[14px] border border-[#F1ECF8] bg-[#FAF9F6]/80 px-4 py-3 mb-4">
          <p className="text-xs font-medium text-[#3A3552] mb-2">Examples</p>
          <ul className="list-inside list-disc text-xs text-[#6B6685] space-y-1">
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
          className="w-full rounded-[14px] border border-[#ECE7F5] bg-white px-4 py-3.5 text-sm text-[#14112E] placeholder:text-[#A8A3BC] focus:border-[#C9B8F0] focus:outline-none focus:ring-2 focus:ring-[#ECE7F5] leading-relaxed"
        />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-[#6B6685] hover:text-[#14112E]"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => onContinue(story.trim())}
            className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#5B21B6] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#4C1D96] min-h-[48px]"
          >
            Continue to upload
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
