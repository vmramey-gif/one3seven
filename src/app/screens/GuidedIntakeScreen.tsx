import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Mic, Square, Trash2 } from 'lucide-react';
import type { GuidedIntakeAnswers } from '../../services/guidedIntakePersistence';
import {
  suggestGuidedFollowUpQuestions,
  type GuidedFollowUpQuestion,
} from '../../services/guidedFollowUpQuestionSuggestions';
import { UPLOAD_REDACTION_NOTICE } from '../constants/caseCategories';
import { INTAKE_OPENING_MICROCOPY, INTAKE_OPENING_SHELL } from '../constants/intakeOpeningPresentation';
import { WORKER_STORY_REASSURANCE } from '../constants/workerStoryIntake';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';

const STEP_CONTEXT_EXAMPLES = [
  'important conversations',
  'notices, complaints, or warnings',
  'changes at work, home, or in your health',
  'significant dates or events',
  'meetings, inspections, repairs, or appointments',
  'anything else that helps provide context',
];

const STEP_SECTION_LABELS: Record<number, string> = {
  1: 'Step 1: Tell your story',
  2: 'Step 2: Review and continue',
};

const GUIDED_VOICE_QUESTIONS = [
  {
    question: 'Take your time. Start wherever it feels easiest. What happened?',
    label: 'What happened',
  },
  {
    question: 'What happened first?',
    label: 'What happened first',
  },
  {
    question: 'Who was involved?',
    label: 'Who was involved',
  },
  {
    question: 'When did things start changing, if you remember?',
    label: 'When things started changing',
  },
  {
    question: 'Did you tell anyone at work or ask for help?',
    label: 'What was reported or asked',
  },
  {
    question: 'What changed after that?',
    label: 'What changed after that',
  },
  {
    question: 'Are there messages, schedules, pay records, write-ups, photos, notes, or other records that might help show what happened?',
    label: 'Records that may help',
  },
  {
    question: 'Is there anything important we did not ask about?',
    label: 'Anything else',
  },
] as const;

type GuidedVoiceQuestion = {
  question: string;
  label: string;
};

type GuidedVoiceAnswer = {
  question: string;
  label: string;
  answer: string;
};

type GuidedIntakeScreenProps = {
  intakeNumber?: string | null;
  initialAnswers?: GuidedIntakeAnswers | null;
  onComplete: (answers: GuidedIntakeAnswers) => void;
  onSkip: () => void;
  onDraftChange?: (answers: GuidedIntakeAnswers) => void;
  onBackToLanding?: () => void;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function GuidedIntakeScreen({
  intakeNumber,
  initialAnswers,
  onComplete,
  onSkip,
  onDraftChange,
  onBackToLanding,
}: GuidedIntakeScreenProps) {
  const [step, setStep] = useState(1);
  const [context, setContext] = useState(initialAnswers?.context ?? '');
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechInterim, setSpeechInterim] = useState('');
  const [speechReviewDraft, setSpeechReviewDraft] = useState('');
  const [speechReviewDirty, setSpeechReviewDirty] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [guidedVoiceMode, setGuidedVoiceMode] = useState(false);
  const [activeVoiceQuestionIndex, setActiveVoiceQuestionIndex] = useState(0);
  const [voiceAnswers, setVoiceAnswers] = useState<GuidedVoiceAnswer[]>([]);
  const [selectedFollowUpQuestions, setSelectedFollowUpQuestions] = useState<GuidedVoiceQuestion[]>([]);
  const [voiceAcknowledgment, setVoiceAcknowledgment] = useState<string | null>(null);
  const initialContext = initialAnswers?.context ?? '';
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const contextRef = useRef(initialAnswers?.context ?? '');
  const mergedGuidedVoiceLabelsRef = useRef<Set<string>>(new Set());
  const allVoiceQuestions: GuidedVoiceQuestion[] = [...GUIDED_VOICE_QUESTIONS, ...selectedFollowUpQuestions];
  const activeVoiceQuestion = allVoiceQuestions[Math.min(activeVoiceQuestionIndex, allVoiceQuestions.length - 1)];
  const activeVoiceAnswer = voiceAnswers.find((answer) => answer.label === activeVoiceQuestion.label);
  const suggestionContext = [
    context,
    ...voiceAnswers.map((answer) => answer.answer),
  ].join('\n');
  const suggestedFollowUps = suggestGuidedFollowUpQuestions(suggestionContext, [
    ...voiceAnswers.map((answer) => answer.label),
    ...Array.from(mergedGuidedVoiceLabelsRef.current),
  ]);
  const speechDraftText = speechReviewDirty
    ? speechReviewDraft
    : [speechTranscript, speechInterim].filter(Boolean).join(' ').trim();
  const hasSpeechDraft = Boolean(speechDraftText.trim());
  const hasUnmergedVoiceAnswers = voiceAnswers.some(
    (answer) => answer.answer.trim() && !mergedGuidedVoiceLabelsRef.current.has(answer.label)
  );

  const finish = () => {
    const safeContext = resolveContextWithGuidedVoiceAnswers(contextRef.current);
    onComplete({
      topics: [],
      context: safeContext.trim(),
      availableRecords: [],
      skipped: false,
    });
  };

  const sectionLabel = STEP_SECTION_LABELS[step] ?? '';

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const caseCategoryRef = useRef(initialAnswers?.caseCategory);
  caseCategoryRef.current = initialAnswers?.caseCategory;
  const scaffoldRef = useRef(initialAnswers?.scaffoldResponses ?? []);
  scaffoldRef.current = initialAnswers?.scaffoldResponses ?? [];

  const stopSpeechRecognition = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setIsListening(false);
      return;
    }
    try {
      recognition.stop();
    } catch {
      setIsListening(false);
    }
  };

  const buildVoiceAcknowledgment = (answer: string): string => {
    const lower = answer.toLowerCase();
    const hasDate =
      /\b(19|20)\d{2}\b/.test(lower) ||
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(lower) ||
      /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/.test(lower);

    if (/\bhr\b|human resources/.test(lower)) return "I heard you mention HR. I'll organize that.";
    if (/\bmanager\b|\bsupervisor\b/.test(lower)) return "I heard you mention a manager or supervisor. I'll organize that.";
    if (hasDate) return 'I heard you mention a date. That may help complete the timeline.';
    if (/\bschedule\b|\bhours?\b/.test(lower)) return 'I heard you mention schedule or hours. That may help complete the timeline.';
    if (/\bpay\b|\bpaid\b|\bpaystub\b|\bwages?\b|\bovertime\b/.test(lower)) return 'I heard you mention pay. That may help complete the timeline.';
    if (/\bbreaks?\b|meal break|rest break/.test(lower)) return 'I heard you mention breaks. That may help complete the timeline.';
    if (/\bwrite-up\b|\bwritten up\b|\bwarning\b/.test(lower)) return 'I heard you mention a write-up. That may help complete the timeline.';
    if (/\btermination\b|\bterminated\b|\bfired\b|\blet go\b/.test(lower)) return 'I heard you mention a work ending. That may help complete the timeline.';

    return "I'll organize that.";
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setSpeechError('Speech recognition is not supported in this browser. You can still type your story.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript?.trim() ?? '';
        if (!transcript) continue;
        if (result.isFinal) {
          finalText += `${transcript} `;
        } else {
          interimText += `${transcript} `;
        }
      }
      if (finalText.trim()) {
        setSpeechTranscript((prev) => `${prev}${prev ? ' ' : ''}${finalText.trim()}`.trim());
      }
      setSpeechInterim(interimText.trim());
    };
    recognition.onerror = (event) => {
      const error = event.error ?? '';
      const message =
        error === 'not-allowed' || error === 'service-not-allowed'
          ? 'Microphone access was not allowed. You can still type your story.'
          : 'Speech recognition stopped. You can try again or type your story.';
      setSpeechError(message);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    setSpeechError(null);
    setSpeechTranscript('');
    setSpeechInterim('');
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setSpeechError('Speech recognition could not start. You can still type your story.');
      setIsListening(false);
    }
  };

  const useSpeechTranscript = () => {
    const transcript = speechDraftText.trim();
    if (!transcript) return;
    setCanonicalContext((prev) => (prev.trim() ? `${prev.trim()}\n\n${transcript}` : transcript));
    resetSpeechDraft();
    setSpeechError(null);
    stopSpeechRecognition();
  };

  const discardSpeechTranscript = () => {
    resetSpeechDraft();
    stopSpeechRecognition();
  };

  const resetSpeechDraft = () => {
    setSpeechTranscript('');
    setSpeechInterim('');
    setSpeechReviewDraft('');
    setSpeechReviewDirty(false);
    setSpeechError(null);
  };

  const findNextUnansweredVoiceQuestionIndex = (currentIndex: number, answers: GuidedVoiceAnswer[]) => {
    const answeredLabels = new Set([
      ...answers.filter((answer) => answer.answer.trim()).map((answer) => answer.label),
      ...Array.from(mergedGuidedVoiceLabelsRef.current),
    ]);
    for (let index = currentIndex + 1; index < allVoiceQuestions.length; index += 1) {
      if (!answeredLabels.has(allVoiceQuestions[index].label)) return index;
    }
    return currentIndex;
  };

  const mergeAcceptedAnswerIntoContext = (answer: GuidedVoiceAnswer) => {
    const trimmedAnswer = answer.answer.trim();
    if (!trimmedAnswer || mergedGuidedVoiceLabelsRef.current.has(answer.label)) return false;
    mergedGuidedVoiceLabelsRef.current.add(answer.label);
    const assembled = `${answer.label}:\n${trimmedAnswer}`;
    const nextContext = contextRef.current.trim() ? `${contextRef.current.trim()}\n\n${assembled}` : assembled;
    setCanonicalContext(nextContext);
    return true;
  };

  const acceptGuidedVoiceAnswer = () => {
    const transcript = speechDraftText.trim();
    if (!transcript) return;
    const acceptedAnswer = {
      question: activeVoiceQuestion.question,
      label: activeVoiceQuestion.label,
      answer: transcript,
    };
    const nextAnswers = [
      ...voiceAnswers.filter((answer) => answer.label !== activeVoiceQuestion.label),
      acceptedAnswer,
    ];
    const acknowledgment = buildVoiceAcknowledgment(transcript);
    const nextQuestionIndex = findNextUnansweredVoiceQuestionIndex(activeVoiceQuestionIndex, nextAnswers);
    mergeAcceptedAnswerIntoContext(acceptedAnswer);
    setVoiceAnswers(nextAnswers);
    setVoiceAcknowledgment(acknowledgment);
    resetSpeechDraft();
    stopSpeechRecognition();
    setActiveVoiceQuestionIndex(nextQuestionIndex);
  };

  const retryGuidedVoiceAnswer = () => {
    resetSpeechDraft();
    stopSpeechRecognition();
    setVoiceAnswers((prev) => prev.filter((answer) => answer.label !== activeVoiceQuestion.label));
  };

  const skipGuidedVoiceQuestion = () => {
    retryGuidedVoiceAnswer();
    setActiveVoiceQuestionIndex((index) => Math.min(index + 1, allVoiceQuestions.length - 1));
  };

  const goToPreviousGuidedVoiceQuestion = () => {
    resetSpeechDraft();
    stopSpeechRecognition();
    setActiveVoiceQuestionIndex((index) => Math.max(index - 1, 0));
  };

  const buildGuidedVoiceStoryText = (answers: GuidedVoiceAnswer[] = voiceAnswers) => {
    const mergedLabels = mergedGuidedVoiceLabelsRef.current;
    const answerMap = new Map(
      answers
        .filter((answer) => !mergedLabels.has(answer.label))
        .map((answer) => [answer.label, answer.answer.trim()])
    );
    return allVoiceQuestions
      .map(({ label }) => {
        const answer = answerMap.get(label);
        return answer ? `${label}:\n${answer}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
  };

  const resolveContextWithGuidedVoiceAnswers = (baseContext: string) => {
    const assembled = buildGuidedVoiceStoryText();
    if (!assembled.trim()) return baseContext;
    return baseContext.trim() ? `${baseContext.trim()}\n\n${assembled}` : assembled;
  };

  const setCanonicalContext = (next: string | ((prev: string) => string)) => {
    if (typeof next === 'function') {
      setContext((prev) => {
        const resolved = next(prev);
        contextRef.current = resolved;
        return resolved;
      });
      return;
    }
    contextRef.current = next;
    setContext(next);
  };

  const mergeGuidedVoiceAnswersIntoContext = (): boolean => {
    const assembled = buildGuidedVoiceStoryText();
    if (!assembled.trim()) return false;
    const labelsToMerge = voiceAnswers
      .filter((answer) => answer.answer.trim() && !mergedGuidedVoiceLabelsRef.current.has(answer.label))
      .map((answer) => answer.label);
    for (const label of labelsToMerge) {
      mergedGuidedVoiceLabelsRef.current.add(label);
    }
    const nextContext = contextRef.current.trim() ? `${contextRef.current.trim()}\n\n${assembled}` : assembled;
    setCanonicalContext(nextContext);
    setVoiceAnswers((prev) => prev.filter((answer) => !answer.answer.trim()));
    setActiveVoiceQuestionIndex(0);
    setGuidedVoiceMode(false);
    return true;
  };

  const handleStoryStepNext = () => {
    mergeGuidedVoiceAnswersIntoContext();
    setStep(2);
  };

  const selectSuggestedFollowUp = (suggestion: GuidedFollowUpQuestion) => {
    const nextQuestion: GuidedVoiceQuestion = {
      question: suggestion.question,
      label: suggestion.label,
    };
    const existingIndex = allVoiceQuestions.findIndex((question) => question.label === suggestion.label);
    resetSpeechDraft();
    stopSpeechRecognition();
    setGuidedVoiceMode(true);
    if (existingIndex >= 0) {
      setActiveVoiceQuestionIndex(existingIndex);
      return;
    }
    setSelectedFollowUpQuestions((prev) => [...prev, nextQuestion]);
    setActiveVoiceQuestionIndex(allVoiceQuestions.length);
  };

  useEffect(() => {
    const restored = initialContext.trim();
    if (!restored) return;
    setCanonicalContext((prev) => (prev.trim() ? prev : initialContext));
  }, [initialContext]);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionConstructor()));
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          /* ignore */
        }
      }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (speechReviewDirty) return;
    setSpeechReviewDraft([speechTranscript, speechInterim].filter(Boolean).join(' ').trim());
  }, [speechTranscript, speechInterim, speechReviewDirty]);

  useEffect(() => {
    if (!onDraftChangeRef.current) return;
    const handle = window.setTimeout(() => {
      onDraftChangeRef.current?.({
        topics: [],
        context,
        availableRecords: [],
        caseCategory: caseCategoryRef.current,
        scaffoldResponses: scaffoldRef.current,
        skipped: false,
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [context]);

  return (
    <div className="min-h-screen bg-[var(--o3s-bg)]">
      <header className="border-b border-[var(--o3s-border)] bg-[var(--o3s-surface)]/92 px-6 py-4 backdrop-blur-md">
        <div className={`${INTAKE_OPENING_SHELL} flex items-start justify-between gap-3`}>
          <div className="min-w-0">
            {onBackToLanding ? (
              <button
                type="button"
                onClick={onBackToLanding}
                className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--o3s-text-muted)] hover:text-[var(--o3s-text)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : null}
            {sectionLabel ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--o3s-text-muted)]">{sectionLabel}</p>
            ) : null}
            {intakeNumber ? (
              <p className="text-[11px] text-[var(--o3s-text-muted)]/70 mt-0.5">Intake {intakeNumber}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 rounded-[12px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)] px-3 py-2 text-xs font-semibold text-[var(--o3s-text-soft)] hover:bg-[var(--o3s-bg)]"
          >
            Skip for now
          </button>
        </div>
      </header>

      <main className={`${INTAKE_OPENING_SHELL} px-6 py-8`}>
        <div className="mb-8 rounded-[14px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)]/92 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-[var(--o3s-text-muted)]">{UPLOAD_REDACTION_NOTICE}</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-[var(--o3s-text)] leading-snug">
                  Is there anything important that would help explain the records you&apos;re uploading?
                </h1>
                <p className="text-sm text-[var(--o3s-text-muted)] leading-relaxed">
                  Optional — A few sentences is enough. You can add or edit details later.
                </p>
                <p className="text-sm text-[var(--o3s-text-muted)] leading-relaxed">
                  {WORKER_STORY_REASSURANCE}
                </p>
              </div>
              <div className="rounded-[14px] border border-[var(--o3s-border)] bg-[var(--o3s-bg)]/80 px-4 py-3">
                <p className="text-xs font-medium text-[var(--o3s-text-soft)] mb-2">Examples</p>
                <ul className="list-inside list-disc text-xs text-[var(--o3s-text-muted)] space-y-1">
                  {STEP_CONTEXT_EXAMPLES.map((ex) => (
                    <li key={ex}>{ex}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="sr-only" htmlFor="guided-intake-context">
                  Your context
                </label>
                <div className="mb-4 rounded-[14px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--o3s-text)]">
                        Does talking it out help? No worries, we&apos;re here to listen.
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--o3s-text-muted)]">
                        Your microphone is used only while recording. Review and edit anything before continuing.
                      </p>
                    </div>
                    {!guidedVoiceMode ? (
                      <button
                        type="button"
                        onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                        disabled={speechSupported === false}
                        className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-[12px] border border-[var(--o3s-border)] bg-[var(--o3s-bg)] px-4 py-2 text-xs font-semibold text-[var(--o3s-text)] hover:border-[var(--o3s-primary)] hover:bg-[var(--o3s-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        {isListening ? 'Stop recording' : 'Speak Your Story'}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-[12px] bg-[var(--o3s-bg)]/80 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setGuidedVoiceMode(false);
                        resetSpeechDraft();
                        stopSpeechRecognition();
                      }}
                      className={`rounded-[10px] px-3 py-2 text-xs font-semibold transition ${
                        !guidedVoiceMode
                          ? 'bg-[var(--o3s-surface)] text-[var(--o3s-text)] shadow-sm'
                          : 'text-[var(--o3s-text-soft)] hover:bg-[var(--o3s-surface)]/70'
                      }`}
                    >
                      Free talk
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuidedVoiceMode(true);
                        resetSpeechDraft();
                        stopSpeechRecognition();
                      }}
                      className={`rounded-[10px] px-3 py-2 text-xs font-semibold transition ${
                        guidedVoiceMode
                          ? 'bg-[var(--o3s-surface)] text-[var(--o3s-text)] shadow-sm'
                          : 'text-[var(--o3s-text-soft)] hover:bg-[var(--o3s-surface)]/70'
                      }`}
                    >
                      Guided questions
                    </button>
                  </div>

                  {guidedVoiceMode ? (
                    <div className="mt-4 rounded-[22px] border border-[#E4DAFF] bg-gradient-to-br from-[#F8F4FF] via-white to-[#FFF5FA] px-4 py-4 shadow-[0_18px_44px_rgba(109,74,255,0.10)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Guided question {activeVoiceQuestionIndex + 1} of {allVoiceQuestions.length}
                          </p>
                          <p className="mt-2 text-lg font-semibold leading-snug text-[#0B1033]">
                            {activeVoiceQuestion.question}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-[#475569]">
                            Take your time. Skip anything you do not know or do not want to answer.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                          disabled={speechSupported === false}
                          className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full bg-[#6D4AFF] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(109,74,255,0.22)] transition hover:bg-[#5636E8] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          {isListening ? 'Listening...' : 'Record answer'}
                        </button>
                      </div>

                      {isListening ? (
                        <p className="mt-3 rounded-full bg-white/70 px-3 py-2 text-xs font-medium text-[#475569]">
                          Listening now. You can stop when you are ready to review.
                        </p>
                      ) : null}

                      {voiceAcknowledgment ? (
                        <p className="mt-3 rounded-[14px] border border-[#E8E1FF] bg-white/75 px-3 py-2 text-sm font-medium text-[#475569]">
                          {voiceAcknowledgment}
                        </p>
                      ) : null}

                      {activeVoiceAnswer ? (
                        <div className="mt-4 rounded-[16px] border border-[#E8E1FF] bg-white/85 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Accepted answer
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#475569]">
                            {activeVoiceAnswer.answer}
                          </p>
                        </div>
                      ) : null}

                      {hasSpeechDraft ? (
                        <div className="mt-4 rounded-[16px] border border-[#E8E1FF] bg-white/90 px-3 py-3">
                          <label
                            htmlFor="guided-speech-review"
                            className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]"
                          >
                            Review answer draft
                          </label>
                          <textarea
                            id="guided-speech-review"
                            value={speechReviewDraft}
                            onChange={(event) => {
                              setSpeechReviewDirty(true);
                              setSpeechReviewDraft(event.target.value);
                            }}
                            rows={4}
                            className="mt-2 w-full resize-none rounded-[12px] border border-[#E4DAFF] bg-white px-3 py-2 text-sm leading-relaxed text-[#0B1033] placeholder:text-[#64748B] focus:border-[#6D4AFF] focus:outline-none focus:ring-2 focus:ring-[#DED6FF]"
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={acceptGuidedVoiceAnswer}
                              disabled={!speechDraftText.trim()}
                              className="rounded-full bg-[#6D4AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5636E8] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Use answer
                            </button>
                            <button
                              type="button"
                              onClick={retryGuidedVoiceAnswer}
                              className="rounded-full border border-[#E4DAFF] bg-white px-4 py-2.5 text-sm font-semibold text-[#475569] hover:bg-[#F8F4FF]"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={discardSpeechTranscript}
                              className="inline-flex items-center gap-1 rounded-full border border-[#E4DAFF] bg-white px-4 py-2.5 text-sm font-semibold text-[#475569] hover:bg-[#F8F4FF]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Discard
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={goToPreviousGuidedVoiceQuestion}
                          disabled={activeVoiceQuestionIndex === 0}
                          className="rounded-full border border-[#E4DAFF] bg-white/85 px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={skipGuidedVoiceQuestion}
                          className="rounded-full border border-[#E4DAFF] bg-white/85 px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-white"
                        >
                          Skip question
                        </button>
                        <button
                          type="button"
                          onClick={handleStoryStepNext}
                          className="rounded-full border border-[#CFC3FF] bg-white px-3 py-2 text-xs font-semibold text-[#1E1B4B] hover:bg-[#F8F4FF]"
                        >
                          Review story
                        </button>
                        {hasUnmergedVoiceAnswers ? (
                          <button
                            type="button"
                            onClick={mergeGuidedVoiceAnswersIntoContext}
                            className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5636E8]"
                          >
                            Add answers to story
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {speechSupported === false ? (
                    <p className="mt-3 rounded-[12px] bg-[var(--o3s-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--o3s-text-soft)]">
                      Speech recognition is not supported in this browser. You can still type your story.
                    </p>
                  ) : null}

                  {speechError ? (
                    <p className="mt-3 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                      {speechError}
                    </p>
                  ) : null}

                  {!guidedVoiceMode && hasSpeechDraft ? (
                    <div className="mt-3 rounded-[12px] border border-[var(--o3s-border)] bg-[var(--o3s-bg)]/80 px-3 py-3">
                      <label
                        htmlFor="free-speech-review"
                        className="text-[11px] font-semibold uppercase tracking-wide text-[var(--o3s-text-muted)]"
                      >
                        Transcript draft
                      </label>
                      <textarea
                        id="free-speech-review"
                        value={speechReviewDraft}
                        onChange={(event) => {
                          setSpeechReviewDirty(true);
                          setSpeechReviewDraft(event.target.value);
                        }}
                        rows={4}
                        className="mt-2 w-full resize-none rounded-[12px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--o3s-text)] focus:border-[var(--o3s-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--o3s-primary-soft)]"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={useSpeechTranscript}
                          disabled={!speechDraftText.trim()}
                          className="rounded-[12px] bg-[var(--o3s-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--o3s-primary-hover)]"
                        >
                          Use transcript
                        </button>
                        <button
                          type="button"
                          onClick={discardSpeechTranscript}
                          className="inline-flex items-center gap-1 rounded-[12px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)] px-3 py-2 text-xs font-semibold text-[var(--o3s-text-soft)] hover:bg-[var(--o3s-bg)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Discard
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <p className="mt-3 text-[11px] leading-relaxed text-[var(--o3s-text-muted)]">
                    one3seven organizes what you choose to save. one3seven is not a law firm and does not provide legal advice.
                  </p>
                </div>

                {suggestionContext.trim() && suggestedFollowUps.length > 0 ? (
                  <div className="mb-4 rounded-[14px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)] px-4 py-4">
                    <p className="text-sm font-semibold text-[var(--o3s-text)]">
                      Suggested follow-up questions
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--o3s-text-muted)]">
                      These can help organize your intake. Choose any that apply, or skip them.
                    </p>
                    <div className="mt-3 space-y-2">
                      {suggestedFollowUps.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => selectSuggestedFollowUp(suggestion)}
                          className="w-full rounded-[12px] border border-[var(--o3s-border)] bg-[var(--o3s-bg)] px-3 py-2.5 text-left text-xs font-medium leading-relaxed text-[var(--o3s-text-soft)] hover:border-[var(--o3s-primary)] hover:bg-[var(--o3s-primary-soft)]"
                        >
                          {suggestion.question}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <textarea
                  id="guided-intake-context"
                  value={context}
                  onChange={(e) => setCanonicalContext(e.target.value)}
                  rows={5}
                  placeholder="Optional — a short explanation or timeline is enough."
                  className="w-full rounded-[12px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)] px-4 py-3 text-sm text-[var(--o3s-text)] placeholder:text-[var(--o3s-text-muted)]/70 focus:border-[var(--o3s-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--o3s-primary-soft)]"
                />
                <p className="mt-2 text-[11px] text-[var(--o3s-text-muted)]">{INTAKE_OPENING_MICROCOPY.shareWhatRelevant}</p>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-[var(--o3s-text)] leading-snug">Continue to upload your records</h1>
                <p className="text-sm text-[var(--o3s-text-muted)] leading-relaxed">
                  Next you will add files, rename them, and run organization in the same upload flow.
                </p>
              </div>
              {context.trim() && (
                <div className="rounded-[14px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)] px-4 py-3.5 text-sm text-[var(--o3s-text-soft)] space-y-2">
                  {context.trim() ? (
                    <p className="whitespace-pre-wrap break-words">
                      <span className="font-medium text-[var(--o3s-text)]">Context: </span>
                      {context.trim()}
                    </p>
                  ) : null}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 pt-6 border-t border-[var(--o3s-border)] flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={step <= 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="inline-flex items-center gap-1 rounded-[12px] border border-[var(--o3s-border)] bg-[var(--o3s-surface)] px-4 py-2.5 text-sm font-medium text-[var(--o3s-text-soft)] disabled:opacity-40 hover:bg-[var(--o3s-bg)] min-h-[44px] touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={handleStoryStepNext}
              className="inline-flex items-center gap-1 rounded-[12px] bg-[var(--o3s-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--o3s-primary-hover)] min-h-[44px] touch-manipulation"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="inline-flex items-center gap-1 rounded-[12px] bg-[var(--o3s-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--o3s-primary-hover)] min-h-[44px] touch-manipulation"
            >
              Continue to upload
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <One3SevenDisclaimer variant="compact" className="mt-8" />
      </main>
    </div>
  );
}
