import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Save, FileText, Edit3, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { Screen } from '../App';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';

interface TimelineDetailScreenProps {
  onNavigate: (screen: Screen) => void;
  timelineItem: WorkerTimelineItem;
  savedContext: string;
  onSaveContext: (context: string) => void | Promise<void>;
  /** Where the Back control returns (e.g. summary vs worker timeline list) */
  backScreen?: Screen;
  /** After saving context, where to return */
  afterSaveNavigate?: Screen;
  workerBellNotifications?: AppNotificationItem[];
}

export function TimelineDetailScreen({
  onNavigate,
  timelineItem,
  savedContext,
  onSaveContext,
  backScreen = 'summary',
  afterSaveNavigate = 'summary',
  workerBellNotifications = [],
}: TimelineDetailScreenProps) {
  const [context, setContext] = useState(savedContext);
  const [timelineSummary, setTimelineSummary] = useState(timelineItem.summary);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isUpdatingSummary, setIsUpdatingSummary] = useState(false);

  useEffect(() => {
    setContext(savedContext);
    setTimelineSummary(timelineItem.summary);
  }, [savedContext, timelineItem.summary, timelineItem.date, timelineItem.event]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /** No related events until documents are actually parsed. */
  const getConnectedEvents = () => {
    return [];
  };

  const connectedEvents = getConnectedEvents();

  const handleSave = async () => {
    setIsSaving(true);

    // Save context to app state (persists for this timeline card)
    await Promise.resolve(onSaveContext(context));

    // Simulate context processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // If context was added, update the timeline summary
    if (context.trim()) {
      setIsUpdatingSummary(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsUpdatingSummary(false);
    }

    setIsSaving(false);
    setShowSaveConfirmation(true);

    // Auto-hide confirmation and navigate
      setTimeout(() => {
        setShowSaveConfirmation(false);
        setTimeout(() => {
          onNavigate(afterSaveNavigate);
        }, 300);
      }, 1500);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="px-6 py-7 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate(backScreen)}
            className="text-xl font-semibold text-slate-900 hover:opacity-70 transition-opacity duration-200"
          >
            one3seven
          </button>
          <NotificationsBell items={workerBellNotifications} />
        </div>
      </nav>

      {/* Back Navigation */}
      <div className="px-6 pt-6">
        <button
          type="button"
          onClick={() => onNavigate(backScreen)}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500 hover:text-slate-700 transition-colors duration-200 font-normal"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="px-6 pt-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <h1 className="text-[32px] leading-[1.2] font-semibold text-slate-900 mb-4 tracking-tight">
            Clarify This Event
          </h1>
          <p className="text-base text-slate-600 mb-10 leading-relaxed">
            Add any details that may help organize this timeline entry more clearly.
          </p>

          {/* Timeline Summary Card */}
          <div className="mb-8 bg-slate-50 rounded-[14px] p-6 border border-slate-200 relative">
            {isUpdatingSummary && (
              <div className="absolute inset-0 bg-slate-50/90 rounded-[14px] flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-slate-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Updating timeline note...</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-600" />
                <label className="text-sm font-semibold text-slate-900">Timeline Note</label>
              </div>
              <button
                onClick={() => setIsEditingSummary(!isEditingSummary)}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit timeline note
              </button>
            </div>
            {isEditingSummary ? (
              <>
                <textarea
                  value={timelineSummary}
                  onChange={(e) => setTimelineSummary(e.target.value)}
                  className="w-full h-24 px-3 py-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                />
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  You can adjust this summary if you want the timeline entry to describe the record more clearly.
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed">{timelineSummary}</p>
            )}
          </div>

          {/* Related Uploaded Documents */}
          <div className="mb-8">
            <label className="text-sm font-semibold text-slate-900 mb-3 block">
              Related Uploaded Documents
            </label>
            <div className="space-y-2">
              {Array.from({ length: timelineItem.relatedDocs }).map((_, index) => {
                const fileName = `${timelineItem.event.replace(/\s+/g, '_')}_${index + 1}.pdf`;
                return (
                  <button
                    key={index}
                    className="w-full bg-slate-50 rounded-[14px] p-4 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all flex items-center gap-3 text-left"
                  >
                    <FileText className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900 truncate">{fileName}</div>
                    </div>
                    <div className="inline-block bg-slate-200 px-2 py-1 rounded text-xs text-slate-700 flex-shrink-0">
                      {timelineItem.category}
                    </div>
                    <div className="text-xs text-slate-600 flex-shrink-0">Open</div>
                  </button>
                );
              })}
            </div>
          </div>


          {/* Worker-added context */}
          <div className="mb-12">
            <label className="text-sm font-semibold text-slate-900 mb-3 block">Added context</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add factual details that help interpret this timeline entry. This saves with your intake."
              className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-[14px] text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none leading-relaxed"
            />
            {context.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-start gap-2 text-xs text-slate-600"
              >
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  This context is saved to the timeline event and appears in your intake summary when shared with a firm.
                </span>
              </motion.div>
            )}
          </div>

          {/* Save Confirmation */}
          <AnimatePresence>
            {showSaveConfirmation && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 bg-slate-900 text-white rounded-[14px] p-4 flex items-center gap-3"
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">Context saved</div>
                  <div className="text-xs text-slate-300">Intake summary refreshed</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Organizational Review Message */}
          <AnimatePresence>
            {isSaving && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 bg-slate-50 rounded-[14px] p-5 border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-slate-600 animate-spin flex-shrink-0" />
                  <span className="text-sm text-slate-700 font-medium">Updating organized timeline</span>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed">
                  Organizing related records and updating the timeline...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full py-4 px-6 rounded-[14px] transition-all shadow-sm font-medium flex items-center justify-center gap-2 ${
                isSaving
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Details
                </>
              )}
            </button>
            <button
              onClick={() => onNavigate('summary')}
              disabled={isSaving}
              className={`w-full py-4 px-6 rounded-[14px] transition-colors font-medium ${
                isSaving
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
