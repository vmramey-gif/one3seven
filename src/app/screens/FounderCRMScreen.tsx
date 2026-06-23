/**
 * Founder-only CRM — internal sales tooling. Mobile-first (sales reps work from phones in the
 * field): single-column layout, >=44px tap targets, and every phone number is a tel: link that
 * opens the dialer on tap. Gated by profile.is_founder in App.tsx and by founder-only RLS in
 * the database. Never shown to workers or firms.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone, Mail, Calendar, ArrowLeft, Plus, X, TrendingUp,
  ClipboardList, LayoutGrid, Building2, BookOpen, BarChart3, CheckCircle2,
  GraduationCap, AlertTriangle, Flame, ListChecks, Check, MessageSquare, Send,
} from 'lucide-react';
import {
  listFirms, listActivity, addFirm, logActivity,
  listMessages, sendMessage, getCurrentMember,
  type CrmFirm, type CrmActivityWithFirm, type NewFirmInput, type LogActivityInput, type CrmMessage,
} from '../../services/crmService';
import { CRM_STAGES, CRM_STAGE_LABELS, type CrmStage } from '../../services/crmStageLogic';
import { CRM_WEEKLY_TARGETS, CRM_CALL_SCRIPT, CRM_OBJECTIONS, CRM_COLD_EMAIL } from '../constants/crmReference';
import { FIRE_DEMO_TRAINING, PI_RULES, CRM_COMMISSIONS, LAUNCH_CHECKLIST } from '../constants/crmTraining';

type Tab = 'dashboard' | 'pipeline' | 'firms' | 'activity' | 'metrics' | 'team' | 'scripts' | 'training' | 'checklist' | 'add';

// `founderOnly` tabs are hidden from sales reps.
const TABS: { id: Tab; label: string; icon: typeof LayoutGrid; founderOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'pipeline', label: 'Pipeline', icon: TrendingUp },
  { id: 'firms', label: 'Firms', icon: Building2 },
  { id: 'activity', label: 'Activity', icon: ClipboardList },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'team', label: 'Team', icon: MessageSquare },
  { id: 'scripts', label: 'Scripts', icon: BookOpen },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'checklist', label: 'Checklist', icon: ListChecks, founderOnly: true },
  { id: 'add', label: 'Add / Log', icon: Plus },
];

const FAST_LOG_OUTCOMES = [
  'Demo booked', 'Left voicemail', 'No answer', 'Not interested', 'Follow up needed', 'Send something',
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const tap = 'min-h-[44px]'; // mobile touch-target floor
const digitsOf = (p: string) => p.replace(/[^\d+]/g, '');

function PhoneLink({ phone, className = '' }: { phone: string | null; className?: string }) {
  if (!phone || !phone.trim()) return <span className="text-[#1E1B4B]/30">—</span>;
  return (
    <a href={`tel:${digitsOf(phone)}`} className={`text-[#6D4AFF] underline-offset-2 hover:underline ${className}`}>
      {phone}
    </a>
  );
}

function StageTag({ stage }: { stage: CrmStage }) {
  const hot = stage === 'pilot' || stage === 'paid' || stage === 'demo_booked' || stage === 'demo_done';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${hot ? 'bg-[#EDE7FF] text-[#6D4AFF]' : 'bg-slate-100 text-slate-600'}`}>
      {CRM_STAGE_LABELS[stage]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: 'A' | 'B' | 'C' | null }) {
  if (!priority) return null;
  const c = priority === 'A' ? 'bg-red-100 text-red-700' : priority === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c}`}>{priority}</span>;
}

export function FounderCRMScreen({ onExit, isFounder = true }: { onExit: () => void; isFounder?: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [firms, setFirms] = useState<CrmFirm[]>([]);
  const [activity, setActivity] = useState<CrmActivityWithFirm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastFirmId, setLastFirmId] = useState<string>('');

  // Fast-log sheet
  const [fastFirmId, setFastFirmId] = useState<string | null>(null);
  const [fastOutcome, setFastOutcome] = useState('');
  const [fastNotes, setFastNotes] = useState('');
  const [fastFollowup, setFastFollowup] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [f, a] = await Promise.all([listFirms(), listActivity(200)]);
    if (f.error) setError(f.error);
    if (a.error) setError(a.error);
    setFirms(f.data);
    setActivity(a.data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const firmsById = useMemo(() => Object.fromEntries(firms.map((f) => [f.id, f])), [firms]);
  const today = todayISO();

  const openFast = (firmId: string) => {
    setFastFirmId(firmId);
    setFastOutcome('');
    setFastNotes('');
    setFastFollowup('');
    setError('');
  };
  const closeFast = () => setFastFirmId(null);

  const saveFast = async () => {
    if (!fastFirmId || !fastOutcome) return;
    setSaving(true);
    const r = await logActivity({
      firm_id: fastFirmId, activity_type: 'call', activity_date: today,
      outcome: fastOutcome, notes: fastNotes, next_followup: fastFollowup,
    });
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    setLastFirmId(fastFirmId);
    closeFast();
    void load();
  };

  return (
    <div className="min-h-screen bg-[#F6F2FF] text-[#1E1B4B] antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#E7E1FF] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button type="button" onClick={onExit} className={`flex items-center gap-1.5 ${tap} px-1 text-sm font-medium text-[#1E1B4B]/60 hover:text-[#1E1B4B]`}>
            <ArrowLeft className="h-4 w-4" /> Exit
          </button>
          <div className="text-[15px] font-bold tracking-tight">Sales CRM</div>
          <span className="rounded-full bg-[#EDE7FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6D4AFF]">Founder</span>
        </div>
        {/* Tab bar — horizontally scrollable on mobile */}
        <div className="mx-auto max-w-3xl overflow-x-auto px-2 pb-1">
          <div className="flex gap-1">
            {TABS.filter((t) => !t.founderOnly || isFounder).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex ${tap} shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition ${tab === t.id ? 'bg-[#6D4AFF] text-white' : 'text-[#1E1B4B]/55 hover:bg-[#EDE7FF]'}`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {error && (
          <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {loading ? (
          <div className="py-20 text-center text-sm text-[#1E1B4B]/40">Loading…</div>
        ) : (
          <>
            {tab === 'dashboard' && <DashboardTab firms={firms} activity={activity} today={today} onLog={openFast} />}
            {tab === 'pipeline' && <PipelineTab firms={firms} onLog={openFast} />}
            {tab === 'firms' && <FirmsTab firms={firms} onLog={openFast} />}
            {tab === 'activity' && <ActivityTab activity={activity} />}
            {tab === 'metrics' && <MetricsTab firms={firms} activity={activity} />}
            {tab === 'team' && <TeamTab />}
            {tab === 'scripts' && <ScriptsTab />}
            {tab === 'training' && <TrainingTab />}
            {tab === 'checklist' && isFounder && <ChecklistTab />}
            {tab === 'add' && (
              <AddLogTab firms={firms} lastFirmId={lastFirmId} onSaved={(fid) => { if (fid) setLastFirmId(fid); void load(); }} setError={setError} />
            )}
          </>
        )}
      </main>

      {/* Fast-log sheet (3 taps: firm -> outcome -> save) */}
      {fastFirmId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={closeFast}>
          <div className="w-full max-w-md rounded-t-[20px] bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[15px] font-bold">Log call · {firmsById[fastFirmId]?.name}</div>
              <button type="button" onClick={closeFast} className={`flex ${tap} w-11 items-center justify-center rounded-full hover:bg-slate-100`}><X className="h-4 w-4" /></button>
            </div>
            {firmsById[fastFirmId]?.phone && (
              <a href={`tel:${digitsOf(firmsById[fastFirmId]!.phone!)}`} className={`mb-3 flex ${tap} items-center justify-center gap-2 rounded-[12px] bg-emerald-600 px-4 font-semibold text-white`}>
                <Phone className="h-4 w-4" /> Call {firmsById[fastFirmId]?.phone}
              </a>
            )}
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#1E1B4B]/45">Outcome</div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {FAST_LOG_OUTCOMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setFastOutcome(o)}
                  className={`${tap} rounded-[12px] border px-3 text-[13px] font-semibold transition ${fastOutcome === o ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white' : 'border-[#E7E1FF] bg-white text-[#1E1B4B]/70'}`}
                >
                  {o}
                </button>
              ))}
            </div>
            <textarea
              value={fastNotes}
              onChange={(e) => setFastNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="mb-2 min-h-[64px] w-full rounded-[12px] border border-[#E7E1FF] px-3 py-2.5 text-sm outline-none focus:border-[#6D4AFF]"
            />
            <label className="mb-1 block text-[12px] font-semibold text-[#1E1B4B]/45">Next follow-up (optional)</label>
            <input
              type="date"
              value={fastFollowup}
              onChange={(e) => setFastFollowup(e.target.value)}
              className={`mb-4 ${tap} w-full rounded-[12px] border border-[#E7E1FF] px-3 text-sm outline-none focus:border-[#6D4AFF]`}
            />
            <button
              type="button"
              onClick={saveFast}
              disabled={!fastOutcome || saving}
              className={`flex ${tap} w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] font-semibold text-white disabled:opacity-40`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Firm card (shared) ───────────────────────────────────────────────────────
function FirmCard({ firm, onLog, today }: { firm: CrmFirm; onLog: (id: string) => void; today?: string }) {
  const due = today && firm.next_followup && firm.next_followup <= today;
  return (
    <div className="rounded-[14px] border border-[#E7E1FF] bg-white p-4">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold">{firm.name}</span>
            <PriorityBadge priority={firm.priority} />
          </div>
          {firm.attorney_name && <div className="text-[12px] text-[#1E1B4B]/50">{firm.attorney_name}</div>}
        </div>
        <StageTag stage={firm.stage} />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-[#1E1B4B]/35" /><PhoneLink phone={firm.phone} /></span>
        {firm.next_followup && (
          <span className={`flex items-center gap-1.5 ${due ? 'font-semibold text-red-600' : 'text-[#1E1B4B]/50'}`}>
            <Calendar className="h-3.5 w-3.5" /> {firm.next_followup}{due ? ' · due' : ''}
          </span>
        )}
      </div>
      {firm.notes && <p className="mb-2.5 line-clamp-2 text-[12px] leading-relaxed text-[#1E1B4B]/55">{firm.notes}</p>}
      <button type="button" onClick={() => onLog(firm.id)} className={`flex ${tap} w-full items-center justify-center gap-2 rounded-[12px] bg-[#EDE7FF] font-semibold text-[#6D4AFF]`}>
        <Phone className="h-4 w-4" /> Log call
      </button>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ firms, activity, today, onLog }: { firms: CrmFirm[]; activity: CrmActivityWithFirm[]; today: string; onLog: (id: string) => void }) {
  const stats = [
    { label: 'Firms', value: firms.length },
    { label: 'Calls', value: activity.filter((a) => a.activity_type === 'call').length },
    { label: 'Demos booked', value: firms.filter((f) => f.stage === 'demo_booked').length },
    { label: 'Active pilots', value: firms.filter((f) => f.stage === 'pilot').length },
  ];
  const due = firms
    .filter((f) => f.next_followup && f.next_followup <= today)
    .sort((a, b) => (a.next_followup ?? '').localeCompare(b.next_followup ?? ''));
  const recent = activity.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[14px] border border-[#E7E1FF] bg-white p-4">
            <div className="text-[26px] font-black leading-none text-[#6D4AFF]">{s.value}</div>
            <div className="mt-1 text-[11px] font-semibold text-[#1E1B4B]/55">{s.label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-[14px] font-bold">Follow-ups due today</h2>
        {due.length === 0 ? (
          <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">Nothing due. Nice.</p>
        ) : (
          <div className="space-y-3">{due.map((f) => <FirmCard key={f.id} firm={f} onLog={onLog} today={today} />)}</div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[14px] font-bold">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No activity logged yet.</p>
        ) : (
          <div className="space-y-2">{recent.map((a) => <ActivityRow key={a.id} a={a} />)}</div>
        )}
      </section>
    </div>
  );
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
function PipelineTab({ firms, onLog }: { firms: CrmFirm[]; onLog: (id: string) => void }) {
  const counts = CRM_STAGES.map((s) => ({ stage: s, n: firms.filter((f) => f.stage === s).length }));
  const priorityA = firms.filter((f) => f.priority === 'A');
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Stage counts</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {counts.map((c) => (
            <div key={c.stage} className="rounded-[12px] border border-[#E7E1FF] bg-white p-3 text-center">
              <div className="text-[20px] font-black text-[#6D4AFF]">{c.n}</div>
              <div className="mt-0.5 text-[10px] font-semibold text-[#1E1B4B]/55">{CRM_STAGE_LABELS[c.stage]}</div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Priority A firms</h2>
        {priorityA.length === 0 ? (
          <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No Priority A firms yet.</p>
        ) : (
          <div className="space-y-3">{priorityA.map((f) => <FirmCard key={f.id} firm={f} onLog={onLog} />)}</div>
        )}
      </section>
    </div>
  );
}

// ── Firms ────────────────────────────────────────────────────────────────────
function FirmsTab({ firms, onLog }: { firms: CrmFirm[]; onLog: (id: string) => void }) {
  const [stage, setStage] = useState<CrmStage | ''>('');
  const [priority, setPriority] = useState<'A' | 'B' | 'C' | ''>('');
  const filtered = firms.filter((f) => (!stage || f.stage === stage) && (!priority || f.priority === priority));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={stage} onChange={(e) => setStage(e.target.value as CrmStage | '')} className={`${tap} rounded-[10px] border border-[#E7E1FF] bg-white px-3 text-[13px]`}>
          <option value="">All stages</option>
          {CRM_STAGES.map((s) => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as 'A' | 'B' | 'C' | '')} className={`${tap} rounded-[10px] border border-[#E7E1FF] bg-white px-3 text-[13px]`}>
          <option value="">All priorities</option>
          <option value="A">A</option><option value="B">B</option><option value="C">C</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No firms match. Add some in the Add / Log tab.</p>
      ) : (
        <div className="space-y-3">{filtered.map((f) => <FirmCard key={f.id} firm={f} onLog={onLog} today={todayISO()} />)}</div>
      )}
    </div>
  );
}

// ── Activity ─────────────────────────────────────────────────────────────────
function ActivityRow({ a }: { a: CrmActivityWithFirm }) {
  const typeColor = a.activity_type === 'demo' ? 'bg-emerald-100 text-emerald-700' : a.activity_type === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-[#EDE7FF] text-[#6D4AFF]';
  return (
    <div className="rounded-[12px] border border-[#E7E1FF] bg-white p-3.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typeColor}`}>{a.activity_type ?? '—'}</span>
          <span className="text-[13px] font-semibold">{a.firm_name ?? 'Unknown firm'}</span>
        </div>
        <span className="text-[11px] text-[#1E1B4B]/40">{a.activity_date}</span>
      </div>
      {a.outcome && <div className="text-[13px] text-[#1E1B4B]/70">{a.outcome}</div>}
      {a.objection && <div className="mt-0.5 text-[12px] text-amber-700">Objection: {a.objection}</div>}
      {a.notes && <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#1E1B4B]/50">{a.notes}</p>}
    </div>
  );
}

function ActivityTab({ activity }: { activity: CrmActivityWithFirm[] }) {
  if (activity.length === 0) return <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No activity logged yet.</p>;
  return <div className="space-y-2">{activity.map((a) => <ActivityRow key={a.id} a={a} />)}</div>;
}

// ── Weekly metrics ───────────────────────────────────────────────────────────
function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function Bar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[13px]">
        <span className="font-semibold text-[#1E1B4B]/70">{label}</span>
        <span className="font-bold text-[#6D4AFF]">{value} / {target}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#EDE7FF]">
        <div className="h-full rounded-full bg-[#6D4AFF]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricsTab({ firms, activity }: { firms: CrmFirm[]; activity: CrmActivityWithFirm[] }) {
  const weekStart = startOfWeekISO();
  const thisWeek = activity.filter((a) => a.activity_date >= weekStart);
  const calls = thisWeek.filter((a) => a.activity_type === 'call').length;
  const emails = thisWeek.filter((a) => a.activity_type === 'email').length;
  const demos = thisWeek.filter((a) => a.activity_type === 'demo').length;
  const pilots = firms.filter((f) => f.stage === 'pilot').length;

  const objectionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activity) {
      const o = (a.objection ?? '').trim();
      if (o) m.set(o, (m.get(o) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [activity]);
  const maxObj = objectionCounts[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-[14px] font-bold">This week vs targets</h2>
        <Bar label="Firms in pipeline" value={firms.length} target={CRM_WEEKLY_TARGETS.firms} />
        <Bar label="Calls (this week)" value={calls} target={CRM_WEEKLY_TARGETS.calls} />
        <Bar label="Emails (this week)" value={emails} target={CRM_WEEKLY_TARGETS.emails} />
        <Bar label="Demos (this week)" value={demos} target={CRM_WEEKLY_TARGETS.demos} />
        <Bar label="Active pilots" value={pilots} target={CRM_WEEKLY_TARGETS.pilots} />
      </section>
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Top objections</h2>
        {objectionCounts.length === 0 ? (
          <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No objections logged yet.</p>
        ) : (
          <div className="space-y-2">
            {objectionCounts.map(([obj, n]) => (
              <div key={obj} className="rounded-[12px] border border-[#E7E1FF] bg-white p-3">
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="text-[#1E1B4B]/70">{obj}</span>
                  <span className="font-bold text-[#6D4AFF]">{n}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#EDE7FF]">
                  <div className="h-full rounded-full bg-[#8B6DFF]" style={{ width: `${Math.round((n / maxObj) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Scripts & objections ─────────────────────────────────────────────────────
function ScriptsTab() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Call script</h2>
        <div className="space-y-3">
          {CRM_CALL_SCRIPT.map((s) => (
            <div key={s.step} className="rounded-[12px] border border-[#E7E1FF] bg-white p-4">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#6D4AFF]">{s.step}</div>
              <p className="text-[14px] leading-relaxed text-[#1E1B4B]/75">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Objections</h2>
        <div className="space-y-3">
          {CRM_OBJECTIONS.map((o) => (
            <div key={o.objection} className="rounded-[12px] border border-[#E7E1FF] bg-white p-4">
              <div className="mb-1 text-[13px] font-bold text-[#1E1B4B]">{o.objection}</div>
              <p className="text-[13px] leading-relaxed text-[#1E1B4B]/65">{o.response}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Cold email template</h2>
        <pre className="whitespace-pre-wrap rounded-[12px] border border-[#E7E1FF] bg-white p-4 text-[13px] leading-relaxed text-[#1E1B4B]/75">{CRM_COLD_EMAIL}</pre>
      </section>
    </div>
  );
}

// ── Team chat (founder + reps, one shared channel) ───────────────────────────
function TeamTab() {
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [me, setMe] = useState<{ id: string | null; name: string }>({ id: null, name: 'Member' });
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => { const r = await listMessages(); if (!r.error) setMessages(r.data); };

  useEffect(() => {
    let active = true;
    void (async () => { setMe(await getCurrentMember()); if (active) await load(); })();
    const iv = setInterval(() => { if (active) void load(); }, 10000); // light poll so it feels live
    return () => { active = false; clearInterval(iv); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true); setErr('');
    const r = await sendMessage(body, me.name);
    setSending(false);
    if (r.error) { setErr(r.error); return; }
    setBody('');
    await load();
  };

  return (
    <div className="flex flex-col" style={{ minHeight: '62vh' }}>
      <p className="mb-3 text-[12px] leading-relaxed text-[#1E1B4B]/55">
        Team chat — the founder and all sales reps share this channel. Everyone here sees these messages.
      </p>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-[12px] border border-[#E7E1FF] bg-white p-3">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#1E1B4B]/40">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = !!me.id && m.sender_id === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-[14px] px-3.5 py-2 ${mine ? 'bg-[#6D4AFF] text-white' : 'bg-[#F3EFFF] text-[#1E1B4B]'}`}>
                  {!mine && <div className="mb-0.5 text-[11px] font-bold text-[#6D4AFF]">{m.sender_name || 'Member'}</div>}
                  <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</div>
                  <div className={`mt-0.5 text-[10px] ${mine ? 'text-white/60' : 'text-[#1E1B4B]/40'}`}>{new Date(m.created_at).toLocaleString()}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
      <div className="mt-2 flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message the team… (Ctrl/⌘+Enter to send)"
          rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
          className="flex-1 rounded-[12px] border border-[#E7E1FF] px-3 py-2.5 text-sm outline-none focus:border-[#6D4AFF]"
        />
        <button type="button" onClick={send} disabled={sending || !body.trim()} className={`flex ${tap} shrink-0 items-center gap-1.5 rounded-full bg-[#6D4AFF] px-5 font-semibold text-white disabled:opacity-40`}>
          <Send className="h-4 w-4" /> Send
        </button>
      </div>
    </div>
  );
}

// ── Launch checklist (founder-only) ──────────────────────────────────────────
function ChecklistTab() {
  const KEY = 'o3s_crm_checklist_v1';
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  });
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  const allItems = LAUNCH_CHECKLIST.flatMap((g) => g.items);
  const completed = allItems.filter((i) => done[i.id]).length;
  const pct = Math.round((completed / allItems.length) * 100);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[13px] font-bold">
          <span>Launch checklist</span>
          <span className="text-[#6D4AFF]">{completed} of {allItems.length} done</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#EDE7FF]">
          <div className="h-full rounded-full bg-[#6D4AFF] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#1E1B4B]/55">
          Plain-English steps from “built” to “charging customers.” Tap to check off — saved on this device.
        </p>
      </div>

      {LAUNCH_CHECKLIST.map((group) => (
        <section key={group.group}>
          <h3 className="mb-2 text-[13px] font-bold text-[#1E1B4B]">{group.group}</h3>
          <div className="space-y-2">
            {group.items.map((item) => {
              const checked = !!done[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`flex w-full items-start gap-3 rounded-[12px] border p-3.5 text-left transition ${checked ? 'border-emerald-200 bg-emerald-50' : 'border-[#E7E1FF] bg-white hover:border-[#C9BEF5]'}`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#C9BEF5] bg-white'}`}>
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-semibold ${checked ? 'text-emerald-800 line-through' : 'text-[#1E1B4B]'}`}>{item.label}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-[#1E1B4B]/55">{item.why}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Training (fire demo, PI rules, commissions) ──────────────────────────────
function TrainingTab() {
  return (
    <div className="space-y-7">
      {/* Fire demo */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <h2 className="text-[14px] font-bold">Fire demo — how to run it</h2>
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-[#1E1B4B]/65">{FIRE_DEMO_TRAINING.intro}</p>
        <a href={`https://${FIRE_DEMO_TRAINING.link}`} target="_blank" rel="noreferrer" className="mb-3 inline-block text-[13px] font-semibold text-[#6D4AFF] hover:underline">
          {FIRE_DEMO_TRAINING.link} ↗
        </a>

        {/* Employment focus — highlighted */}
        <div className="mb-4 rounded-[12px] border-2 border-[#6D4AFF]/40 bg-[#F3EFFF] p-4">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#6D4AFF]">Employment focus — read this first</div>
          <p className="text-[13px] leading-relaxed text-[#1E1B4B]/80">{FIRE_DEMO_TRAINING.employmentFocus}</p>
        </div>

        <div className="space-y-2.5">
          {FIRE_DEMO_TRAINING.steps.map((s) => (
            <div key={s.title} className="rounded-[12px] border border-[#E7E1FF] bg-white p-3.5">
              <div className="mb-0.5 text-[13px] font-bold text-[#1E1B4B]">{s.title}</div>
              <p className="text-[13px] leading-relaxed text-[#1E1B4B]/65">{s.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-[10px] bg-[#EDE7FF] px-3 py-2 text-[12px] font-semibold text-[#6D4AFF]">{FIRE_DEMO_TRAINING.theAsk}</p>
      </section>

      {/* PI rules */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-[14px] font-bold">PI &amp; scope rules — do not break these</h2>
        </div>
        <div className="space-y-2.5">
          {PI_RULES.map((r) => (
            <div key={r.rule} className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5">
              <div className="mb-0.5 text-[13px] font-bold text-amber-900">{r.rule}</div>
              <p className="text-[13px] leading-relaxed text-amber-900/75">{r.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Commissions */}
      <section>
        <h2 className="mb-2 text-[14px] font-bold">{CRM_COMMISSIONS.headline}</h2>
        <p className="mb-3 text-[13px] leading-relaxed text-[#1E1B4B]/65">{CRM_COMMISSIONS.intro}</p>
        <div className="mb-3 rounded-[12px] border-2 border-[#6D4AFF]/40 bg-[#F3EFFF] p-4">
          <div className="mb-2 text-[14px] font-bold text-[#1E1B4B]">{CRM_COMMISSIONS.rule}</div>
          <ul className="space-y-1">
            {CRM_COMMISSIONS.examples.map((e) => (
              <li key={e} className="flex gap-2 text-[13px] text-[#1E1B4B]/75">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B6DFF]" /><span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
        <ul className="mb-3 space-y-1.5">
          {CRM_COMMISSIONS.rules.map((l) => (
            <li key={l} className="flex gap-2 text-[13px] leading-relaxed text-[#1E1B4B]/75">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B6DFF]" /><span>{l}</span>
            </li>
          ))}
        </ul>
        <p className="rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">{CRM_COMMISSIONS.note}</p>
      </section>

      {/* Contact */}
      <section>
        <div className="rounded-[12px] border border-[#E7E1FF] bg-white p-3.5 text-[13px] leading-relaxed text-[#1E1B4B]/70">
          To contact one3seven, email <a href="mailto:info@one3seven.com" className="font-semibold text-[#6D4AFF] hover:underline">info@one3seven.com</a>.
        </div>
      </section>
    </div>
  );
}

// ── Add firm / Log activity ──────────────────────────────────────────────────
function AddLogTab({ firms, lastFirmId, onSaved, setError }: { firms: CrmFirm[]; lastFirmId: string; onSaved: (firmId?: string) => void; setError: (s: string) => void }) {
  const [mode, setMode] = useState<'firm' | 'log'>('firm');
  return (
    <div className="space-y-4">
      <div className="flex rounded-[12px] border border-[#E7E1FF] bg-white p-1">
        {(['firm', 'log'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 ${tap} rounded-[9px] text-[13px] font-semibold ${mode === m ? 'bg-[#6D4AFF] text-white' : 'text-[#1E1B4B]/55'}`}>
            {m === 'firm' ? 'Add firm' : 'Log activity'}
          </button>
        ))}
      </div>
      {mode === 'firm' ? <AddFirmForm onSaved={onSaved} setError={setError} /> : <FullLogForm firms={firms} lastFirmId={lastFirmId} onSaved={onSaved} setError={setError} />}
    </div>
  );
}

const inputCls = `${tap} w-full rounded-[12px] border border-[#E7E1FF] px-3 text-sm outline-none focus:border-[#6D4AFF]`;

function AddFirmForm({ onSaved, setError }: { onSaved: (firmId?: string) => void; setError: (s: string) => void }) {
  const [f, setF] = useState<NewFirmInput>({ name: '' });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const set = (patch: Partial<NewFirmInput>) => setF((p) => ({ ...p, ...patch }));
  const submit = async () => {
    if (!f.name.trim()) { setError('Firm name is required.'); return; }
    setSaving(true);
    const r = await addFirm(f);
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    setOk(true); setF({ name: '' }); onSaved();
    setTimeout(() => setOk(false), 2500);
  };
  return (
    <div className="space-y-2.5 rounded-[14px] border border-[#E7E1FF] bg-white p-4">
      {ok && <div className="flex items-center gap-2 rounded-[10px] bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Firm added</div>}
      <input className={inputCls} placeholder="Firm name *" value={f.name} onChange={(e) => set({ name: e.target.value })} />
      <input className={inputCls} placeholder="Attorney name" value={f.attorney_name ?? ''} onChange={(e) => set({ attorney_name: e.target.value })} />
      <input className={inputCls} type="tel" placeholder="Phone" value={f.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
      <input className={inputCls} type="email" placeholder="Email" value={f.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
      <input className={inputCls} placeholder="Website" value={f.website ?? ''} onChange={(e) => set({ website: e.target.value })} />
      <input className={inputCls} placeholder="Region" value={f.region ?? ''} onChange={(e) => set({ region: e.target.value })} />
      <div className="flex gap-2">
        <select className={`${inputCls} flex-1`} value={f.priority ?? ''} onChange={(e) => set({ priority: e.target.value as 'A' | 'B' | 'C' | '' })}>
          <option value="">Priority</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
        </select>
        <select className={`${inputCls} flex-1`} value={f.stage ?? 'target'} onChange={(e) => set({ stage: e.target.value as CrmStage })}>
          {CRM_STAGES.map((s) => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}
        </select>
      </div>
      <input className={inputCls} placeholder="Focus areas" value={f.focus_areas ?? ''} onChange={(e) => set({ focus_areas: e.target.value })} />
      <input className={inputCls} placeholder="Source" value={f.source ?? ''} onChange={(e) => set({ source: e.target.value })} />
      <label className="block text-[12px] font-semibold text-[#1E1B4B]/45">Next follow-up</label>
      <input className={inputCls} type="date" value={f.next_followup ?? ''} onChange={(e) => set({ next_followup: e.target.value })} />
      <textarea className="min-h-[64px] w-full rounded-[12px] border border-[#E7E1FF] px-3 py-2.5 text-sm outline-none focus:border-[#6D4AFF]" placeholder="Notes" value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      <button type="button" onClick={submit} disabled={saving} className={`flex ${tap} w-full items-center justify-center rounded-full bg-[#6D4AFF] font-semibold text-white disabled:opacity-40`}>{saving ? 'Saving…' : 'Add firm'}</button>
    </div>
  );
}

function FullLogForm({ firms, lastFirmId, onSaved, setError }: { firms: CrmFirm[]; lastFirmId: string; onSaved: (firmId?: string) => void; setError: (s: string) => void }) {
  const [l, setL] = useState<LogActivityInput>({ firm_id: lastFirmId || (firms[0]?.id ?? ''), activity_type: 'call', activity_date: todayISO() });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const set = (patch: Partial<LogActivityInput>) => setL((p) => ({ ...p, ...patch }));
  const submit = async () => {
    if (!l.firm_id) { setError('Pick a firm.'); return; }
    setSaving(true);
    const r = await logActivity(l);
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    setOk(true); onSaved(l.firm_id);
    setL({ firm_id: l.firm_id, activity_type: 'call', activity_date: todayISO() });
    setTimeout(() => setOk(false), 2500);
  };
  return (
    <div className="space-y-2.5 rounded-[14px] border border-[#E7E1FF] bg-white p-4">
      {ok && <div className="flex items-center gap-2 rounded-[10px] bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Activity logged</div>}
      <label className="block text-[12px] font-semibold text-[#1E1B4B]/45">Firm</label>
      <select className={inputCls} value={l.firm_id} onChange={(e) => set({ firm_id: e.target.value })}>
        <option value="">Select firm…</option>
        {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <div className="flex gap-2">
        <select className={`${inputCls} flex-1`} value={l.activity_type} onChange={(e) => set({ activity_type: e.target.value as 'call' | 'email' | 'demo' })}>
          <option value="call">Call</option><option value="email">Email</option><option value="demo">Demo</option>
        </select>
        <input className={`${inputCls} flex-1`} type="date" value={l.activity_date} onChange={(e) => set({ activity_date: e.target.value })} />
      </div>
      <input className={inputCls} placeholder="Outcome" value={l.outcome ?? ''} onChange={(e) => set({ outcome: e.target.value })} />
      <input className={inputCls} placeholder="Who answered" value={l.who_answered ?? ''} onChange={(e) => set({ who_answered: e.target.value })} />
      <input className={inputCls} placeholder="Objection" value={l.objection ?? ''} onChange={(e) => set({ objection: e.target.value })} />
      <div className="flex gap-2">
        <select className={`${inputCls} flex-1`} value={l.interest_level ?? ''} onChange={(e) => set({ interest_level: e.target.value as 'hot' | 'warm' | 'cold' | '' })}>
          <option value="">Interest</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option>
        </select>
        <select className={`${inputCls} flex-1`} value={l.new_stage ?? ''} onChange={(e) => set({ new_stage: e.target.value as CrmStage | '' })}>
          <option value="">Stage (no change)</option>
          {CRM_STAGES.map((s) => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}
        </select>
      </div>
      <label className="block text-[12px] font-semibold text-[#1E1B4B]/45">Next follow-up</label>
      <input className={inputCls} type="date" value={l.next_followup ?? ''} onChange={(e) => set({ next_followup: e.target.value })} />
      <textarea className="min-h-[64px] w-full rounded-[12px] border border-[#E7E1FF] px-3 py-2.5 text-sm outline-none focus:border-[#6D4AFF]" placeholder="Notes" value={l.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      <button type="button" onClick={submit} disabled={saving} className={`flex ${tap} w-full items-center justify-center rounded-full bg-[#6D4AFF] font-semibold text-white disabled:opacity-40`}>{saving ? 'Saving…' : 'Log activity'}</button>
    </div>
  );
}
