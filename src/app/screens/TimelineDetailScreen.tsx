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
      <nav className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-[#F1ECF8] z-50">
        <div className="px-6 py-7 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate(backScreen)}
            className="text-xl font-semibold text-[#14112E] hover:opacity-70 transition-opacity duration-200"
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
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#8B86A0] hover:text-[#3A3552] transition-colors duration-200 font-normal"
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
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[32px] leading-[1.2] font-medium text-[#14112E] mb-4 tracking-[-0.01em]">
            Clarify This Event
          </h1>
          <p className="text-base text-[#6B6685] mb-10 leading-relaxed">
            Add any details that may help organize this timeline entry more clearly.
          </p>

          {/* Timeline Summary Card */}
          <div className="mb-8 bg-[#FAF9F6] rounded-[14px] p-6 border border-[#ECE7F5] relative">
            {isUpdatingSummary && (
              <div className="absolute inset-0 bg-[#FAF9F6]/90 rounded-[14px] flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-[#3A3552]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Updating timeline note...</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#6B6685]" />
                <label className="text-sm font-semibold text-[#14112E]">Timeline Note</label>
              </div>
              <button
                onClick={() => setIsEditingSummary(!isEditingSummary)}
                className="flex items-center gap-1.5 text-xs text-[#6B6685] hover:text-[#14112E] transition-colors"
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
                  className="w-full h-24 px-3 py-3 bg-white border border-[#D6CEE8] rounded-lg text-xs text-[#3A3552] placeholder:text-[#A8A3BC] focus:outline-none focus:ring-2 focus:ring-[#42574E] focus:border-transparent resize-none"
                />
                <p className="text-xs text-[#8B86A0] mt-2 leading-relaxed">
                  You can adjust this summary if you want the timeline entry to describe the record more clearly.
                </p>
              </>
            ) : (
              <p className="text-xs text-[#3A3552] leading-relaxed">{timelineSummary}</p>
            )}
          </div>

          {/* Related Uploaded Documents */}
          <div className="mb-8">
            <label className="text-sm font-semibold text-[#14112E] mb-3 block">
              Related Uploaded Documents
            </label>
            <div className="space-y-2">
              {Array.from({ length: timelineItem.relatedDocs }).map((_, index) => {
                const fileName = `${timelineItem.event.replace(/\s+/g, '_')}_${index + 1}.pdf`;
                return (
                  <button
                    key={index}
                    className="w-full bg-[#FAF9F6] rounded-[14px] p-4 border border-[#ECE7F5] hover:border-[#C9B8F0] hover:bg-[#F1ECFE] transition-all flex items-center gap-3 text-left"
                  >
                    <FileText className="w-4 h-4 text-[#6B6685] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#14112E] truncate">{fileName}</div>
                    </div>
                    <div className="inline-block bg-[#ECE7F5] px-2 py-1 rounded text-xs text-[#3A3552] flex-shrink-0">
                      {timelineItem.category}
                    </div>
                    <div className="text-xs text-[#6B6685] flex-shrink-0">Open</div>
                  </button>
                );
              })}
            </div>
          </div>


          {/* Worker-added context */}
          <div className="mb-12">
            <label className="text-sm font-semibold text-[#14112E] mb-3 block">Added context</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add factual details that help interpret this timeline entry. This saves with your intake."
              className="w-full h-32 px-4 py-3 bg-[#FAF9F6] border border-[#ECE7F5] rounded-[14px] text-sm text-[#14112E] placeholder:text-[#A8A3BC] focus:outline-none focus:ring-2 focus:ring-[#42574E] focus:border-transparent resize-none leading-relaxed"
            />
            {context.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-start gap-2 text-xs text-[#6B6685]"
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
                className="mb-6 bg-[#42574E] text-white rounded-[14px] p-4 flex items-center gap-3"
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">Context saved</div>
                  <div className="text-xs text-[#C9C2DC]">Intake summary refreshed</div>
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
                className="mb-6 bg-[#FAF9F6] rounded-[14px] p-5 border border-[#ECE7F5]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-[#6B6685] animate-spin flex-shrink-0" />
                  <span className="text-sm text-[#3A3552] font-medium">Updating organized timeline</span>
                </div>
                <div className="text-xs text-[#6B6685] leading-relaxed">
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
                  ? 'bg-[#A8A3BC] text-white cursor-not-allowed'
                  : 'bg-[#42574E] text-white hover:bg-[#4C1D96] hover:shadow-md'
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
                  ? 'bg-[#F1ECFE] text-[#A8A3BC] cursor-not-allowed'
                  : 'bg-[#F1ECFE] text-[#14112E] hover:bg-[#ECE7F5]'
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
