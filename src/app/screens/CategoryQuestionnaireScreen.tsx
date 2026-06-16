import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  CATEGORY_SCAFFOLD_QUESTIONS,
  type IntakeCaseCategory,
  UPLOAD_REDACTION_NOTICE,
} from '../constants/caseCategories';
import { INTAKE_OPENING_MICROCOPY, INTAKE_OPENING_SHELL } from '../constants/intakeOpeningPresentation';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';

export type CategoryQuestionnaireAnswers = Array<{ question: string; answer: string }>;

type CategoryQuestionnaireScreenProps = {
  category: IntakeCaseCategory;
  intakeNumber?: string | null;
  initialAnswers?: CategoryQuestionnaireAnswers;
  onBackToCategories: () => void;
  onDraftChange?: (answers: CategoryQuestionnaireAnswers) => void;
  onContinueToUpload: (answers: CategoryQuestionnaireAnswers) => void;
};

export function CategoryQuestionnaireScreen({
  category,
  intakeNumber,
  initialAnswers = [],
  onBackToCategories,
  onDraftChange,
  onContinueToUpload,
}: CategoryQuestionnaireScreenProps) {
  const questions = useMemo(() => CATEGORY_SCAFFOLD_QUESTIONS[category] ?? [], [category]);
  const [answersByIndex, setAnswersByIndex] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {};
    initialAnswers.forEach((row, idx) => {
      out[idx] = row.answer;
    });
    return out;
  });

  const prevCategoryRef = useRef(category);
  useEffect(() => {
    if (prevCategoryRef.current === category) return;
    prevCategoryRef.current = category;
    const out: Record<number, string> = {};
    initialAnswers.forEach((row, idx) => {
      out[idx] = row.answer;
    });
    setAnswersByIndex(out);
  }, [category, initialAnswers]);

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    if (!onDraftChangeRef.current) return;
    const handle = window.setTimeout(() => {
      const answers = questions.map((question, idx) => ({
        question,
        answer: answersByIndex[idx] ?? '',
      }));
      onDraftChangeRef.current?.(answers);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [answersByIndex, questions]);

  const saveAndContinue = () => {
    const answers = questions.map((question, idx) => ({
      question,
      answer: (answersByIndex[idx] ?? '').trim(),
    }));
    onContinueToUpload(answers);
  };

  const questionGroups = useMemo(() => {
    if (questions.length <= 3) return [{ label: null as string | null, indices: questions.map((_, i) => i) }];
    const mid = Math.ceil(questions.length / 2);
    return [
      { label: 'Start with the basics', indices: questions.map((_, i) => i).slice(0, mid) },
      { label: 'Additional detail (all optional)', indices: questions.map((_, i) => i).slice(mid) },
    ];
  }, [questions]);

  return (
    <div className="min-h-screen bg-[#f8f6ff]">
      <header className="border-b border-[#e5def8] bg-white px-6 py-4">
        <div className={INTAKE_OPENING_SHELL}>
          <button
            type="button"
            onClick={onBackToCategories}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#39415f] hover:text-[#111b3d]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#66708f]">
            {category}
            {questions.length > 0 ? ` · ${questions.length} optional prompts` : ''}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-[#111b3d] leading-snug">A few questions to organize your records</h1>
          <p className="mt-2 text-sm text-[#39415f] leading-relaxed">
            {INTAKE_OPENING_MICROCOPY.briefOk} {INTAKE_OPENING_MICROCOPY.shareWhatRelevant}{' '}
            {INTAKE_OPENING_MICROCOPY.organizesTimeline}
          </p>
          {intakeNumber ? (
            <p className="mt-2 text-[11px] text-[#66708f]">Intake {intakeNumber}</p>
          ) : null}
        </div>
      </header>

      <main className={`${INTAKE_OPENING_SHELL} px-6 py-8`}>
        <div className="mb-8 rounded-[14px] border border-[#e5def8] bg-white/90 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-[#39415f]">{UPLOAD_REDACTION_NOTICE}</p>
        </div>

        <div className="space-y-10">
          {questionGroups.map((group, groupIdx) => (
            <section key={group.label ?? `group-${groupIdx}`}>
              {group.label ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-[#66708f] mb-4">{group.label}</p>
              ) : null}
              <div className="space-y-5">
                {group.indices.map((idx) => {
                  const question = questions[idx];
                  if (!question) return null;
                  return (
                    <div
                      key={question}
                      className="rounded-[14px] border border-[#e5def8] bg-white px-4 py-4 shadow-[0_2px_8px_rgba(24,31,67,0.05)]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <label htmlFor={`scaffold-q-${idx}`} className="text-sm font-medium text-[#111b3d] leading-snug">
                          {question}
                        </label>
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[#66708f]">
                          {INTAKE_OPENING_MICROCOPY.optionalField}
                        </span>
                      </div>
                      {questions.length > 1 ? (
                        <p className="text-[11px] text-[#66708f] mb-2">
                          {idx + 1} of {questions.length}
                        </p>
                      ) : null}
                      <textarea
                        id={`scaffold-q-${idx}`}
                        value={answersByIndex[idx] ?? ''}
                        onChange={(e) => setAnswersByIndex((prev) => ({ ...prev, [idx]: e.target.value }))}
                        rows={3}
                        placeholder="Optional — leave blank if not applicable"
                        className="w-full rounded-[12px] border border-[#e5def8] bg-[#f8f6ff] px-3 py-2.5 text-sm text-[#111b3d] placeholder:text-[#66708f] focus:border-[#6d4aff] focus:outline-none focus:ring-2 focus:ring-[#c7b9ff] focus:bg-white"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-[14px] border border-[#e5def8] bg-[#f2efff] px-4 py-3.5">
          <p className="text-xs leading-relaxed text-[#39415f]">
            By continuing, you confirm you control what you share. You can redact sensitive details before upload.{' '}
            {INTAKE_OPENING_MICROCOPY.editLater}
          </p>
        </div>
        <One3SevenDisclaimer variant="compact" className="mt-4" />

        <div className="mt-8 flex items-center justify-end">
          <button
            type="button"
            onClick={saveAndContinue}
            className="inline-flex items-center gap-1 rounded-[12px] bg-[#6d4aff] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5b39e6] min-h-[44px] touch-manipulation"
          >
            Continue to upload
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
