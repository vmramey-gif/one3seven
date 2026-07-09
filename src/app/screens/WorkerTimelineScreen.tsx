import { useEffect, useState } from 'react';
import { OneThreeSevenLoader } from '../components/ui/OneThreeSevenLoader';
import { motion } from 'motion/react';
import { ArrowLeft, FileText, Clock, MessageCircle } from 'lucide-react';
import { Screen } from '../App';
import { ContactSheet } from '../components/ContactSheet';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import * as intakeData from '../../services/intakeDataService';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import { SHOW_SAMPLE_INTAKE } from '../constants/flags';
import { SAMPLE_INTAKE_SUMMARY_PREVIEW, SAMPLE_DEMO_LABEL } from '../constants/one3sevenProduct';
import { WordMark } from '../components/WordMark';

interface WorkerTimelineScreenProps {
  intakeId: string | null;
  onNavigate: (screen: Screen) => void;
  onSelectItem: (item: WorkerTimelineItem) => void;
  onBackToDashboard: () => void;
  onOpenSettings?: () => void;
  onSignOut?: () => void;
  workerBellNotifications?: AppNotificationItem[];
  /** One card per local upload when Supabase timeline rows are still empty. */
  uploadFallbackTimeline?: WorkerTimelineItem[];
}

export function WorkerTimelineScreen({
  intakeId,
  onNavigate,
  onSelectItem,
  onBackToDashboard,
  onOpenSettings,
  onSignOut,
  workerBellNotifications = [],
  uploadFallbackTimeline,
}: WorkerTimelineScreenProps) {
  const [rows, setRows] = useState<WorkerTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setErr(null);
      if (!intakeId || !isSupabaseConfigured()) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      let bundle = await intakeData.fetchIntakeSummaryBundle(intakeId);
      const fileCount = (bundle.files ?? []).length;
      let ev = (bundle.events ?? []) as Array<{
        id: string;
        event_date: string;
        title: string;
        category: string;
        ai_summary: string;
        worker_context: string | null;
      }>;
      if (ev.length === 0 && fileCount > 0) {
        const ensure = await intakeData.ensureTimelineEventsFromUploadedFiles(intakeId);
        if (ensure.error) setErr(ensure.error);
        bundle = await intakeData.fetchIntakeSummaryBundle(intakeId);
        ev = (bundle.events ?? []) as typeof ev;
      }
      setRows(
        ev.map((e) => ({
          date: e.event_date,
          event: e.title,
          category: e.category,
          summary: e.ai_summary,
          relatedDocs: 1,
          timelineEventId: e.id,
          workerAddedContext: (e.worker_context ?? '').trim() || null,
        }))
      );
      setLoading(false);
    })();
  }, [intakeId]);

  const displayRows: WorkerTimelineItem[] =
    intakeId && !loading
      ? rows.length > 0
        ? rows
        : uploadFallbackTimeline && uploadFallbackTimeline.length > 0
          ? uploadFallbackTimeline
          : []
      : [];

  const [showContact, setShowContact] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {showContact && <ContactSheet source="workerTimeline" onClose={() => setShowContact(false)} />}
      <nav className="sticky top-0 bg-[#FAF9F6]/85 backdrop-blur-md border-b border-[#E4E5DE] z-50">
        <div className="px-6 py-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="text-xl font-semibold text-[#1B2623] hover:opacity-70 transition-opacity"
          >
            <WordMark />
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <NotificationsBell items={workerBellNotifications} />
            {onOpenSettings ? (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs text-[#6A6D66] hover:text-[#1B2623] px-2 py-1.5 rounded-lg hover:bg-[#F2F4EC]"
              >
                Settings
              </button>
            ) : null}
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="text-xs text-[#6A6D66] hover:text-[#1B2623] px-2 py-1.5 rounded-lg hover:bg-[#F2F4EC]"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="px-6 pt-4">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#7C857F] hover:text-[#42574E]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Your dashboard
        </button>
      </div>

      <div className="px-6 pt-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[28px] font-medium tracking-[-0.01em] text-[#1B2623] mb-2">Timeline</h1>
          <p className="text-sm text-[#6A6D66] leading-relaxed">
            Your records, organized and ready — no waiting on a callback. Tap an event for details.
          </p>
        </motion.div>

        {loading ? (
          <OneThreeSevenLoader size="sm" />
        ) : err ? (
          <p className="text-sm text-red-600">{err}</p>
        ) : !intakeId ? (
          <div className="rounded-2xl border border-[#E4E5DE] bg-white p-6 text-center">
            <p className="text-sm text-[#6A6D66] mb-4">No active intake selected.</p>
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="text-sm font-semibold bg-[#42574E] text-white px-5 py-2.5 rounded-full hover:bg-[#42574E] transition"
            >
              Start organizing
            </button>
          </div>
        ) : displayRows.length > 0 ? (
          <ol className="relative ml-1 space-y-4 border-l border-[#C6D0C8] pl-6">
            {displayRows.map((item, i) => (
              <li key={item.timelineEventId ?? `${item.date}-${item.event}-${i}`} className="relative">
                <span className="absolute -left-[31px] top-4 h-3 w-3 rounded-full bg-[#42574E] ring-4 ring-[#42574E]/10" />
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="w-full text-left rounded-2xl border border-[#E4E5DE] bg-white p-4 transition-all hover:border-[#7C8B6F] hover:shadow-[0_8px_28px_rgba(66,87,78,0.08)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#42574E] mb-1">{item.date}</p>
                  <p className="text-[15px] font-medium text-[#1B2623] mb-1">{item.event}</p>
                  <p className="text-xs text-[#6A6D66] line-clamp-2">{item.summary}</p>
                  {(item.workerAddedContext ?? '').trim() ? (
                    <p className="text-[11px] text-[#7C857F] mt-1">
                      <span className="font-medium text-[#6A6D66]">Added context</span> · present
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2 mt-2 text-xs text-[#7C857F]">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{item.category}</span>
                    {item.relatedDocs > 0 ? (
                      <>
                        <span className="text-[#CBD6CF]">·</span>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{item.relatedDocs} related</span>
                      </>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ol>
        ) : rows.length === 0 && SHOW_SAMPLE_INTAKE && !(uploadFallbackTimeline && uploadFallbackTimeline.length) ? (
          <div className="rounded-[14px] border border-dashed border-amber-200 bg-amber-50/60 p-6">
            <p className="text-xs font-semibold text-amber-950 mb-1">{SAMPLE_DEMO_LABEL}</p>
            <p className="text-sm text-[#1B2623] mb-3">Sample timeline entry (layout preview only).</p>
            <button
              type="button"
              onClick={() =>
                onSelectItem({
                  date: 'Jan – Mar 2026',
                  event: 'Payroll and schedule alignment window',
                  category: 'Payroll',
                  summary: SAMPLE_INTAKE_SUMMARY_PREVIEW.timelineSummary,
                  relatedDocs: 0,
                  timelineEventId: null,
                  workerAddedContext: null,
                })
              }
              className="w-full text-left rounded-2xl border border-[#E4E5DE] bg-white p-4 hover:border-[#7C8B6F] hover:shadow-[0_8px_28px_rgba(66,87,78,0.08)] transition-all"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#42574E] mb-1">Jan – Mar 2026</p>
              <p className="text-[15px] font-medium text-[#1B2623] mb-1">Payroll and schedule alignment window</p>
              <p className="text-xs text-[#6A6D66] line-clamp-3">{SAMPLE_INTAKE_SUMMARY_PREVIEW.timelineSummary}</p>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E4E5DE] bg-white p-6 text-center">
            <p className="text-sm text-[#6A6D66] mb-4">
              No timeline yet. Add your story or records to begin organizing.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="text-sm font-semibold bg-[#42574E] text-white px-5 py-2.5 rounded-full hover:bg-[#42574E] transition"
            >
              Go to upload
            </button>
          </div>
        )}

        {/* Contact / help */}
        <div className="mt-10 border-t border-[#E4E5DE] pt-5 text-center">
          <button
            type="button"
            onClick={() => setShowContact(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#42574E] hover:text-[#42574E]"
          >
            <MessageCircle className="h-4 w-4" />
            Questions? Contact us
          </button>
        </div>
      </div>
    </div>
  );
}
