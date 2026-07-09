import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Volume2 } from 'lucide-react';
import {
  STORY_FIRST_STEP_LABELS,
  WORKER_STORY_EXAMPLES,
  WORKER_STORY_HEADING,
  WORKER_STORY_INTRO,
  WORKER_STORY_PLACEHOLDER,
  WORKER_STORY_REASSURANCE,
} from '../constants/workerStoryIntake';
import { INTAKE_OPENING_SHELL } from '../constants/intakeOpeningPresentation';
import { track } from '../../lib/analytics';

type WorkerStoryIntakeScreenProps = {
  intakeNumber?: string | null;
  initialStory?: string;
  onContinue: (story: string) => void;
  onSkip: () => void;
  onBackToLanding: () => void;
};

// Cognitive-interview "report everything" follow-ups: open, non-leading, no "why", strictly
// factual recall aids (people / order / documents / moments) — never feelings or sensory
// re-experiencing, never legal labels. Every one is optional; blanks are fine.
const FOLLOW_UPS: { key: string; label: string; placeholder: string }[] = [
  { key: 'order', label: 'What happened first — and then what came next?', placeholder: 'The order of events, as best you remember. "Around March…" is fine.' },
  { key: 'people', label: 'Who else was involved or saw what happened?', placeholder: 'Names or roles are both fine — managers, HR, coworkers, witnesses.' },
  { key: 'records', label: 'Was anything written down or sent?', placeholder: 'Emails, texts, letters, notices, write-ups — anything you remember.' },
  { key: 'moment', label: 'Was there a specific moment that stands out?', placeholder: 'A particular day or event that feels important.' },
];

export function WorkerStoryIntakeScreen({
  intakeNumber,
  initialStory = '',
  onContinue,
  onSkip,
  onBackToLanding,
}: WorkerStoryIntakeScreenProps) {
  const [story, setStory] = useState(initialStory);
  const [followUps, setFollowUps] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play a pre-rendered, vetted voice clip from /voice/<key>.mp3. Fixed audio only —
  // never a live/generative agent. Multimodal: the text is always on screen; audio is
  // additive. No autoplay (a click is required), and it no-ops if a clip isn't present.
  const playClip = (key: string) => {
    try {
      if (audioRef.current) audioRef.current.pause();
      const a = new Audio(`/voice/${key}.mp3`);
      audioRef.current = a;
      setPlaying(key);
      a.onended = () => setPlaying(null);
      void a.play().catch(() => setPlaying(null));
    } catch {
      setPlaying(null);
    }
  };

  useEffect(() => {
    setStory(initialStory);
  }, [initialStory]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const setFollowUp = (key: string, value: string) =>
    setFollowUps((prev) => ({ ...prev, [key]: value }));

  const handleContinue = () => {
    const narrative = story.trim();
    const answered = FOLLOW_UPS.filter((f) => (followUps[f.key] ?? '').trim());
    // Combine narrative + answered follow-ups into one richer story string (no parent/DB change).
    const combined = [
      narrative,
      ...answered.map((f) => `${f.label}\n${(followUps[f.key] ?? '').trim()}`),
    ]
      .filter(Boolean)
      .join('\n\n');
    // Richness metric — counts only, never the content (no PII).
    track('intake_story_submitted', {
      narrative_chars: narrative.length,
      followups_answered: answered.length,
    });
    onContinue(combined);
  };

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
        <p className="text-sm text-[#6B6685] leading-relaxed mb-1">{WORKER_STORY_INTRO}</p>
        {/* Velocity / no-limbo framing — answer once, completely, so you're not stuck later. */}
        <p className="text-sm text-[#6B6685] leading-relaxed mb-4">
          Answer once, at your own pace — so a firm can look at your full story in one sitting, instead of you waiting weeks for back-and-forth.
        </p>

        <p className="text-sm text-[#8B86A0] leading-relaxed mb-4">{WORKER_STORY_REASSURANCE}</p>

        <div className="rounded-[14px] border border-[#F1ECF8] bg-[#FAF9F6]/80 px-4 py-3 mb-4">
          <p className="text-xs font-medium text-[#3A3552] mb-2">Examples</p>
          <ul className="list-inside list-disc text-xs text-[#6B6685] space-y-1">
            {WORKER_STORY_EXAMPLES.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => playClip('intake_narrative')}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#42574E] hover:text-[#4C1D96]"
        >
          <Volume2 className={`h-3.5 w-3.5 ${playing === 'intake_narrative' ? 'animate-pulse' : ''}`} />
          {playing === 'intake_narrative' ? 'Playing…' : 'Listen to this question'}
        </button>
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

        {/* Optional follow-ups — surface more of the account; all skippable. */}
        <div className="mt-7">
          <p className="text-sm font-medium text-[#14112E]">A few things that often bring more back</p>
          <p className="mt-1 text-xs text-[#8B86A0]">All optional — answer any that fit, skip the rest.</p>
          <div className="mt-3 space-y-4">
            {FOLLOW_UPS.map((f) => (
              <div key={f.key}>
                <div className="mb-1.5 flex items-center gap-2">
                  <label htmlFor={`fu-${f.key}`} className="text-[13px] font-medium text-[#3A3552]">{f.label}</label>
                  <button
                    type="button"
                    onClick={() => playClip(`intake_recall_${f.key}`)}
                    aria-label="Listen to this question"
                    className="text-[#8B86A0] hover:text-[#42574E]"
                  >
                    <Volume2 className={`h-3.5 w-3.5 ${playing === `intake_recall_${f.key}` ? 'animate-pulse text-[#42574E]' : ''}`} />
                  </button>
                </div>
                <textarea
                  id={`fu-${f.key}`}
                  value={followUps[f.key] ?? ''}
                  onChange={(e) => setFollowUp(f.key, e.target.value)}
                  rows={2}
                  placeholder={f.placeholder}
                  className="w-full rounded-[12px] border border-[#ECE7F5] bg-white px-4 py-3 text-sm text-[#14112E] placeholder:text-[#A8A3BC] focus:border-[#C9B8F0] focus:outline-none focus:ring-2 focus:ring-[#ECE7F5] leading-relaxed"
                />
              </div>
            ))}
          </div>
        </div>

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
            onClick={handleContinue}
            className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#42574E] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#4C1D96] min-h-[48px]"
          >
            Continue to upload
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
