import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { FileText, Folder, Calendar, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Screen } from '../App';
import { ONE3SEVEN_NOTICES } from '../constants/one3sevenProduct';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';

const FINALIZE_SLOW_NOTICE_MS = 18_000;
/** Must exceed organization timeout (45s) + extraction wait so the gate runs after persist finishes. */
const FINALIZE_HARD_CAP_MS = 75_000;

interface ProcessingScreenProps {
  onNavigate: (screen: Screen) => void;
  uploadedFiles: File[];
  /** When set, runs before navigating to summary (e.g. persist placeholder organization to Supabase). */
  onRunOrganization?: () => Promise<void>;
  /** Where to send the worker after organization (e.g. landing after firm doc re-upload). */
  destinationAfterComplete?: Screen;
  /** Shorter UI + faster backend wait when updating an existing intake. */
  quickMode?: boolean;
  /** Verify summary + hydrate before leaving processing. */
  onProcessingFinished?: () => Promise<{ ok: true } | { ok: false; error: string } | void>;
  onOpenWorkerSettings?: () => void;
  onWorkerSignOut?: () => void;
  workerBellNotifications?: AppNotificationItem[];
  notificationsPanelNotice?: string;
}

const processingSteps = [
  'Document upload confirmed',
  'Reviewing uploaded files and file names',
  'Connecting worker-provided context',
  'Organizing records by timeline relevance',
  'Building chronological narrative',
  'Preparing structured intake summary',
];

type ProcessingPhase = 'steps' | 'finalizing' | 'complete';

export function ProcessingScreen({
  onNavigate,
  uploadedFiles,
  onRunOrganization,
  destinationAfterComplete = 'summary',
  quickMode = false,
  onProcessingFinished,
  onOpenWorkerSettings,
  onWorkerSignOut,
  workerBellNotifications = [],
  notificationsPanelNotice,
}: ProcessingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState<ProcessingPhase>('steps');
  const [finalizeTimedOut, setFinalizeTimedOut] = useState(false);

  const onRunOrganizationRef = useRef(onRunOrganization);
  const onNavigateRef = useRef(onNavigate);
  const onProcessingFinishedRef = useRef(onProcessingFinished);
  const destinationRef = useRef(destinationAfterComplete);
  onRunOrganizationRef.current = onRunOrganization;
  onNavigateRef.current = onNavigate;
  onProcessingFinishedRef.current = onProcessingFinished;
  destinationRef.current = destinationAfterComplete;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const stepMs = quickMode ? 200 : 700;
    const totalMs = quickMode ? 1400 : 4800;

    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < processingSteps.length - 1) return prev + 1;
        return prev;
      });
    }, stepMs);

    const stepsDoneTimer = setTimeout(() => {
      setCurrentStep(processingSteps.length - 1);
      setPhase('finalizing');
    }, totalMs);

    return () => {
      clearInterval(stepTimer);
      clearTimeout(stepsDoneTimer);
    };
  }, [quickMode]);

  useEffect(() => {
    if (phase !== 'finalizing') return;

    let cancelled = false;
    let finished = false;

    const finishAndNavigate = async () => {
      if (finished) return;
      finished = true;

      let destination: Screen = destinationRef.current;
      try {
        const result = await onProcessingFinishedRef.current?.();
        if (result && result.ok === false) {
          console.warn('[o3s-processing] post-organization gate failed', result.error);
          window.alert(result.error);
          destination = 'upload';
        }
      } catch (e) {
        console.error('[o3s-processing] onProcessingFinished', e);
        window.alert('Could not load your intake summary. Return to upload and try again.');
        destination = 'upload';
      }

      const pauseMs = quickMode ? 400 : 800;
      await new Promise((resolve) => window.setTimeout(resolve, pauseMs));
      // Navigate even if the finalizing effect cleaned up (`cancelled`); that cleanup must not block exit.
      onNavigateRef.current(destination);
      if (!cancelled) setPhase('complete');
    };

    const slowNoticeId = window.setTimeout(() => {
      if (cancelled || finished) return;
      console.info('[o3s-summary-save] organization still running (slow notice)', {
        quickMode,
        elapsedMs: FINALIZE_SLOW_NOTICE_MS,
      });
      setFinalizeTimedOut(true);
    }, FINALIZE_SLOW_NOTICE_MS);

    const hardCapId = window.setTimeout(() => {
      if (cancelled || finished) return;
      console.error('[o3s-summary-save] error details', {
        stage: 'processing_finalize_hard_cap',
        message: `Organization exceeded ${FINALIZE_HARD_CAP_MS}ms hard cap`,
        quickMode,
      });
      void finishAndNavigate();
    }, FINALIZE_HARD_CAP_MS);

    void (async () => {
      try {
        if (onRunOrganizationRef.current) await onRunOrganizationRef.current();
      } catch (e) {
        console.error('[o3s-summary-save] error details', {
          stage: 'onRunOrganization',
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        });
      }
      window.clearTimeout(slowNoticeId);
      window.clearTimeout(hardCapId);
      if (cancelled || finished) return;
      void finishAndNavigate();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(slowNoticeId);
      window.clearTimeout(hardCapId);
    };
  }, [phase, quickMode]);

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="px-6 py-7 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="text-xl font-semibold text-slate-900 hover:opacity-70 transition-opacity duration-200"
          >
            one3Seven
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationsBell items={workerBellNotifications} panelNotice={notificationsPanelNotice} />
            {onOpenWorkerSettings ? (
              <button
                type="button"
                onClick={onOpenWorkerSettings}
                className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50"
              >
                Settings
              </button>
            ) : null}
            {onWorkerSignOut ? (
              <button
                type="button"
                onClick={onWorkerSignOut}
                className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      {/* Back Navigation */}
      <div className="px-6 pt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onNavigate('upload')}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-normal self-start text-slate-500 hover:text-slate-700 transition-colors duration-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to upload
        </button>
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="text-xs self-start text-slate-500 hover:text-slate-800"
        >
          Your dashboard
        </button>
        {phase === 'finalizing' ? (
          <p className="text-xs text-slate-500 self-start">
            {finalizeTimedOut
              ? 'Taking longer than expected — you can leave; your intake will keep updating.'
              : quickMode
                ? 'Updating your intake for the firm…'
                : 'Finalizing your intake… You can leave via the links above if needed.'}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-center min-h-[calc(100vh-180px)]">
        <div className="px-6 max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-[28px] leading-[1.2] font-semibold text-slate-900 mb-4 tracking-tight">
              Organizing Your Intake
            </h1>
            <p className="text-base text-slate-600 mb-10 leading-relaxed">
              Your records, file names, and any context you added are being organized into a clear timeline and intake
              summary structure.
            </p>

            {/* Animated workflow visualization */}
            <div className="relative bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-[18px] p-10 mb-8 border border-slate-200/60">
              <div className="flex justify-center gap-6 items-center mb-8">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <FileText className="w-8 h-8 text-slate-600" />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                >
                  <Folder className="w-8 h-8 text-slate-700" />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                >
                  <Calendar className="w-8 h-8 text-slate-800" />
                </motion.div>
              </div>

              {/* Processing Steps */}
              <div className="space-y-3">
                {processingSteps.map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.2 }}
                    className="flex items-center justify-center gap-2 text-sm"
                  >
                    {index <= currentStep ? (
                      <CheckCircle2 className="w-4 h-4 text-slate-700" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-slate-300 rounded-full" />
                    )}
                    <span className={index <= currentStep ? 'text-slate-700' : 'text-slate-400'}>{step}</span>
                  </motion.div>
                ))}
              </div>

              {phase === 'finalizing' ? (
                <div className="mt-8 pt-6 border-t border-slate-200/80 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-slate-700 animate-spin" aria-hidden />
                  <p className="text-sm font-medium text-slate-800">
                    {quickMode ? 'Sending updated files to the firm…' : 'Finalizing organization...'}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {quickMode ? 'Usually under a few seconds.' : 'This can take a few more seconds.'}
                  </p>
                </div>
              ) : null}

              {phase === 'complete' ? (
                <div className="mt-8 pt-6 border-t border-slate-200/80 flex flex-col items-center gap-3">
                  <CheckCircle2 className="w-10 h-10 text-slate-700" aria-hidden />
                  <p className="text-sm font-medium text-slate-800">
                    {quickMode ? 'Intake updated' : 'Intake summary updated'}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {destinationAfterComplete === 'landing'
                      ? 'Returning to your dashboard…'
                      : 'Opening your summary…'}
                  </p>
                </div>
              ) : null}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">{ONE3SEVEN_NOTICES.positioning}</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
