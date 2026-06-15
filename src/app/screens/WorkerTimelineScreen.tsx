import { useEffect, useState } from 'react';
import { OneThreeSevenLoader } from '../components/ui/OneThreeSevenLoader';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, FileText, Clock } from 'lucide-react';
import { Screen } from '../App';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import * as intakeData from '../../services/intakeDataService';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import { SHOW_SAMPLE_INTAKE } from '../constants/flags';
import { SAMPLE_INTAKE_SUMMARY_PREVIEW, SAMPLE_DEMO_LABEL } from '../constants/one3sevenProduct';

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

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="px-6 py-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="text-xl font-semibold text-slate-900 hover:opacity-70 transition-opacity"
          >
            one3Seven
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <NotificationsBell items={workerBellNotifications} />
            {onOpenSettings ? (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-50"
              >
                Settings
              </button>
            ) : null}
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-50"
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
          className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Your dashboard
        </button>
      </div>

      <div className="px-6 pt-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Timeline</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your key events organized in order. Tap an event for details.
          </p>
        </motion.div>

        {loading ? (
          <OneThreeSevenLoader size="sm" />
        ) : err ? (
          <p className="text-sm text-red-600">{err}</p>
        ) : !intakeId ? (
          <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-700 mb-4">No active intake selected.</p>
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-[12px] hover:bg-slate-800"
            >
              Start organizing
            </button>
          </div>
        ) : displayRows.length > 0 ? (
          <ul className="space-y-3">
            {displayRows.map((item, i) => (
              <li key={item.timelineEventId ?? `${item.date}-${item.event}-${i}`}>
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="w-full text-left rounded-[14px] border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 mb-1">{item.date}</p>
                      <p className="text-sm font-medium text-slate-900 mb-1">{item.event}</p>
                      <p className="text-xs text-slate-600 line-clamp-2">{item.summary}</p>
                      {(item.workerAddedContext ?? '').trim() ? (
                        <p className="text-[11px] text-slate-500 mt-1">
                          <span className="font-medium text-slate-700">Added context</span> · present
                        </p>
                      ) : null}
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{item.category}</span>
                        {item.relatedDocs > 0 ? (
                          <>
                            <span className="text-slate-300">·</span>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{item.relatedDocs} related</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : rows.length === 0 && SHOW_SAMPLE_INTAKE && !(uploadFallbackTimeline && uploadFallbackTimeline.length) ? (
          <div className="rounded-[14px] border border-dashed border-amber-200 bg-amber-50/60 p-6">
            <p className="text-xs font-semibold text-amber-950 mb-1">{SAMPLE_DEMO_LABEL}</p>
            <p className="text-sm text-slate-800 mb-3">Sample timeline entry (layout preview only).</p>
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
              className="w-full text-left rounded-[14px] border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <p className="text-xs text-slate-500 mb-1">Jan – Mar 2026</p>
              <p className="text-sm font-medium text-slate-900 mb-1">Payroll and schedule alignment window</p>
              <p className="text-xs text-slate-600 line-clamp-3">{SAMPLE_INTAKE_SUMMARY_PREVIEW.timelineSummary}</p>
            </button>
          </div>
        ) : (
          <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-700 mb-4">
              No timeline yet. Add your story or records to begin organizing.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-[12px] hover:bg-slate-800"
            >
              Go to upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
