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
  GraduationCap, ListChecks, Check, MessageSquare, Send, StickyNote, Trash2, ChevronRight, ChevronDown, ShieldCheck, RefreshCw, AlertTriangle, DollarSign, Flame, Sparkles, Trophy, Calculator, Link2, Copy, ExternalLink, Globe, Hand, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  listFirms, listActivity, addFirm, logActivity,
  listMessages, sendMessage, getCurrentMember, getLatestMessageAt, subscribeTeamMessages,
  listNotes, addNote, deleteNote, getIntakesCount, setFirmStage, setFirmMinutesSaved, getSiteAnalytics,
  claimFirm, releaseFirm,
  listCrmMembers, listMyDirectMessages, sendDirectMessage, markThreadRead, getUnreadDmCount, subscribeDirectMessages,
  type CrmFirm, type CrmActivityWithFirm, type NewFirmInput, type LogActivityInput, type CrmMessage, type CrmNote, type SiteAnalytics,
  type CrmMember, type CrmDirectMessage,
} from '../../services/crmService';
import {
  computeRevenue, targetColor, dailyTargetsContext, tierPrice, avgMinutesSaved, DAILY_TARGETS, PHASE1_PAYING_TARGET, COMMISSION_RATE, TIER_PRICES,
  firstThreeBonus, commissionProjection, BONUS_LADDER, SPRINT_BONUS,
  companyEconomics, ECON_DEFAULTS, type EconomicsInput,
} from '../../services/crmAnalytics';
import { CRM_STAGES, CRM_STAGE_LABELS, type CrmStage } from '../../services/crmStageLogic';
import { CRM_WEEKLY_TARGETS, CRM_CALL_SCRIPT, CRM_OBJECTIONS, CRM_COLD_EMAIL } from '../constants/crmReference';
import { FIRE_DEMO_TRAINING, PI_RULES, CRM_COMMISSIONS, CRM_SUBSCRIPTION_TIERS, LAUNCH_CHECKLIST } from '../constants/crmTraining';
import { AUDIT_SITE_CHECKS, AUDIT_MANUAL_GROUPS } from '../constants/crmAudit';
import { crmFirmIntel } from '../constants/crmFirmIntel';
import { STARTER_QUESTIONS, askAssistant, type ChatMessage } from '../../services/chatAssistant';

type Tab = 'dashboard' | 'pipeline' | 'firms' | 'activity' | 'metrics' | 'revenue' | 'comp' | 'economics' | 'growth' | 'team' | 'inbox' | 'notes' | 'scripts' | 'training' | 'askai' | 'checklist' | 'audit' | 'links' | 'add';

// Every URL off www.one3seven.com, grouped — the founder "links in one place" directory.
const SITE_BASE = 'https://www.one3seven.com';
const SITE_LINK_GROUPS: { group: string; items: { path: string; label: string; desc: string }[] }[] = [
  { group: 'Public', items: [
    { path: '/', label: 'Marketing home', desc: 'Worker-facing landing page' },
    { path: '/for-firms', label: 'For law firms', desc: 'Firm pitch + pilot request — send to prospects' },
  ]},
  { group: 'Demos', items: [
    { path: '/demo', label: 'Firm demo', desc: 'Attorney / firm walkthrough' },
    { path: '/worker-demo', label: 'Worker demo', desc: 'Worker experience walkthrough' },
    { path: '/fire-demo', label: 'Fire-displaced demo', desc: 'Marcus Reyes scenario (counsel-gated wording)' },
  ]},
  { group: 'Internal — founder + reps', items: [
    { path: '/hq', label: 'HQ / CRM', desc: 'Sales CRM, pipeline, earnings' },
    { path: '/company-demo', label: 'Demo coach', desc: 'Rep demo guide (Coach / Present)' },
    { path: '/company-demo/debrief', label: 'Demo debrief', desc: 'Post-demo debrief form' },
  ]},
  { group: 'Legal', items: [
    { path: '/terms', label: 'Terms of Service', desc: 'Legal terms' },
    { path: '/privacy', label: 'Privacy Policy', desc: 'Privacy policy' },
  ]},
];

// The Company Economics tab is restricted to these specific accounts only.
const ECON_ALLOWED_EMAILS = ['vmramey@gmail.com', 'tadmor86@gmail.com'];

// `founderOnly` tabs are hidden from sales reps. `econOnly` tabs show only for ECON_ALLOWED_EMAILS.
const TABS: { id: Tab; label: string; icon: typeof LayoutGrid; founderOnly?: boolean; econOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'pipeline', label: 'Pipeline', icon: TrendingUp },
  { id: 'firms', label: 'Firms', icon: Building2 },
  { id: 'activity', label: 'Activity', icon: ClipboardList },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'team', label: 'Team chat', icon: MessageSquare },
  { id: 'inbox', label: 'Inbox', icon: Mail },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'scripts', label: 'Scripts', icon: BookOpen },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'comp', label: 'Earnings', icon: Trophy },
  { id: 'economics', label: 'Company Economics', icon: Calculator, econOnly: true },
  { id: 'growth', label: 'Growth', icon: Globe, econOnly: true },
  { id: 'links', label: 'Links', icon: Link2, founderOnly: true },
  { id: 'askai', label: 'Ask one3seven AI', icon: Sparkles },
  { id: 'checklist', label: 'Checklist', icon: ListChecks, founderOnly: true },
  { id: 'audit', label: 'Audit', icon: ShieldCheck, founderOnly: true },
  { id: 'revenue', label: 'Revenue', icon: DollarSign, founderOnly: true },
  { id: 'add', label: 'Add / Log', icon: Plus },
];

// Tab lookup + categorized navigation. Reps live in "Sell" + "Me" + "Learn"; founder-only
// and economics tabs collapse into "Founder". Groups render as dropdowns so the nav never
// sprawls sideways — it wraps and stays one or two rows on a phone.
const TAB_BY_ID: Record<Tab, { id: Tab; label: string; icon: typeof LayoutGrid; founderOnly?: boolean; econOnly?: boolean }> =
  Object.fromEntries(TABS.map((t) => [t.id, t])) as Record<Tab, (typeof TABS)[number]>;

const NAV_GROUPS: { id: string; label: string; icon: typeof LayoutGrid; tabIds: Tab[] }[] = [
  { id: 'sell', label: 'Sell', icon: TrendingUp, tabIds: ['dashboard', 'firms', 'pipeline', 'add', 'activity'] },
  { id: 'me', label: 'My numbers', icon: Trophy, tabIds: ['comp', 'metrics'] },
  { id: 'learn', label: 'Learn', icon: BookOpen, tabIds: ['scripts', 'training', 'askai'] },
  { id: 'team', label: 'Team', icon: MessageSquare, tabIds: ['inbox', 'team', 'notes'] },
  { id: 'founder', label: 'Founder', icon: ShieldCheck, tabIds: ['revenue', 'economics', 'growth', 'checklist', 'audit', 'links'] },
];

type ClaimBundle = { userId: string | null; onClaim: (id: string) => Promise<void>; onRelease: (id: string) => Promise<void> };

const FAST_LOG_OUTCOMES = [
  'Demo booked', 'Left voicemail', 'No answer', 'Not interested', 'Follow up needed', 'Send something',
];

const todayISO = () => new Date().toISOString().slice(0, 10);

// Time-based greeting (Pacific), matching the worker dashboard's tone.
function crmGreeting(name: string): string {
  const first = name?.trim().split(/\s+/)[0] ?? '';
  try {
    const hour = Number.parseInt(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }).format(new Date()),
      10,
    );
    const g = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening';
    return first ? `${g}, ${first}` : g;
  } catch {
    return first ? `Welcome back, ${first}` : 'Welcome back';
  }
}
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

// Pipeline order vs. terminal/side states (no/nurture aren't steps, they're outcomes).
const PIPELINE_STAGES: CrmStage[] = ['target', 'contacted', 'convo', 'demo_booked', 'demo_done', 'pilot', 'paid'];
const SIDE_STAGES: CrmStage[] = ['no', 'nurture'];

/** Always-on Dashboard diagnostic: how many firms sit in each stage right now. */
function StageStrip({ firms }: { firms: CrmFirm[] }) {
  const n = (s: CrmStage) => firms.filter((f) => f.stage === s).length;
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-bold text-[#1E1B4B]">Pipeline by stage</h2>
      <div className="flex flex-wrap items-stretch gap-1.5">
        {PIPELINE_STAGES.map((s) => (
          <div key={s} className="min-w-[62px] flex-1 rounded-[10px] border border-[#E7E1FF] bg-white px-2 py-1.5 text-center">
            <div className="text-[18px] font-black leading-none text-[#6D4AFF]">{n(s)}</div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1E1B4B]/50">{CRM_STAGE_LABELS[s]}</div>
          </div>
        ))}
        <div className="w-px self-stretch bg-[#E7E1FF]" />
        {SIDE_STAGES.map((s) => (
          <div key={s} className="min-w-[58px] rounded-[10px] border border-[#F0ECFA] bg-[#FAF9FE] px-2 py-1.5 text-center">
            <div className="text-[18px] font-black leading-none text-[#1E1B4B]/40">{n(s)}</div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1E1B4B]/40">{CRM_STAGE_LABELS[s]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PriorityBadge({ priority }: { priority: 'A' | 'B' | 'C' | null }) {
  if (!priority) return null;
  const c = priority === 'A' ? 'bg-red-100 text-red-700' : priority === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c}`}>{priority}</span>;
}

export function FounderCRMScreen({ onExit, isFounder = true }: { onExit: () => void; isFounder?: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Team-chat unread indicator: compare the latest message time to the last one this
  // member has seen (persisted), so the Team button lights up on new posts.
  const [latestMsgAt, setLatestMsgAt] = useState<string | null>(null);
  const [seenTeamAt, setSeenTeamAt] = useState<string>(() =>
    (typeof window !== 'undefined' && window.localStorage.getItem('o3s_crm_team_seen')) || ''
  );
  const unreadTeam = !!latestMsgAt && latestMsgAt > seenTeamAt && tab !== 'team';
  const [unreadDm, setUnreadDm] = useState(0);
  const [realtimeLive, setRealtimeLive] = useState(false);
  const [memberName, setMemberName] = useState('');
  useEffect(() => { void getCurrentMember().then((m) => setMemberName(m.name)); }, []);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const showEconomics = ECON_ALLOWED_EMAILS.includes(userEmail.trim().toLowerCase());
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUserEmail(data.user?.email ?? ''); setUserId(data.user?.id ?? null); });
  }, []);
  const [firms, setFirms] = useState<CrmFirm[]>([]);
  const [activity, setActivity] = useState<CrmActivityWithFirm[]>([]);
  const [workerCount, setWorkerCount] = useState(0);
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
    const [f, a, wc] = await Promise.all([listFirms(), listActivity(200), getIntakesCount()]);
    if (f.error) setError(f.error);
    if (a.error) setError(a.error);
    setFirms(f.data);
    setActivity(a.data);
    setWorkerCount(wc);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  // Team chat: real-time push the instant a message lands (poll is a slow fallback only).
  useEffect(() => {
    let active = true;
    const check = async () => {
      const at = await getLatestMessageAt();
      if (active) setLatestMsgAt(at);
    };
    void check();
    const unsub = subscribeTeamMessages(
      (m) => setLatestMsgAt((prev) => (!prev || m.created_at > prev ? m.created_at : prev)),
      (status) => setRealtimeLive(status === 'SUBSCRIBED'),
    );
    const h = window.setInterval(check, 60000);
    return () => { active = false; unsub(); window.clearInterval(h); };
  }, []);

  // Inbox: real-time unread count for direct messages addressed to me.
  useEffect(() => {
    let active = true;
    const refreshDm = async () => { const n = await getUnreadDmCount(); if (active) setUnreadDm(n); };
    void refreshDm();
    const unsub = subscribeDirectMessages(() => { void refreshDm(); });
    const iv = window.setInterval(refreshDm, 60000);
    return () => { active = false; unsub(); window.clearInterval(iv); };
  }, []);

  // Opening Team marks everything up to the latest message as seen.
  useEffect(() => {
    if (tab === 'team' && latestMsgAt) {
      setSeenTeamAt(latestMsgAt);
      if (typeof window !== 'undefined') window.localStorage.setItem('o3s_crm_team_seen', latestMsgAt);
    }
  }, [tab, latestMsgAt]);

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

  /** Explicit claim — reserve a firm for this rep with a timestamp, before contacting. */
  const claimFirmHandler = async (firmId: string) => {
    const r = await claimFirm(firmId);
    if (r.error) { setError(r.claimedBy ? `${r.error} (${r.claimedBy})` : r.error); return; }
    await load();
  };
  const releaseFirmHandler = async (firmId: string) => {
    const r = await releaseFirm(firmId);
    if (r.error) { setError(r.error); return; }
    await load();
  };
  const claim: ClaimBundle = { userId, onClaim: claimFirmHandler, onRelease: releaseFirmHandler };

  /** One-tap "I emailed this firm" — logs an email + claims credit, no form. */
  const quickEmail = async (firmId: string) => {
    const f = firmsById[firmId];
    const r = await logActivity({
      firm_id: firmId,
      activity_type: 'email',
      activity_date: today,
      outcome: 'Emailed',
      new_stage: f && f.stage === 'target' ? 'contacted' : '',
    });
    if (r.error) { setError(r.error); return; }
    setLastFirmId(firmId);
    await load();
  };

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
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold tracking-tight">Sales CRM</span>
            <span
              title={realtimeLive ? 'Real-time updates are live' : 'Using periodic refresh (real-time not connected)'}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${realtimeLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${realtimeLive ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
              {realtimeLive ? 'Live' : 'Polling'}
            </span>
          </div>
          <span className="rounded-full bg-[#EDE7FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6D4AFF]">Founder</span>
        </div>
        {/* Categorized dropdown nav — wraps, never scrolls sideways. */}
        <div className="relative mx-auto max-w-3xl px-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {NAV_GROUPS.map((group) => {
              const items = group.tabIds
                .map((id) => TAB_BY_ID[id])
                .filter((t) => t && (!t.founderOnly || isFounder) && (!t.econOnly || showEconomics));
              if (items.length === 0) return null;
              const activeHere = items.some((t) => t.id === tab);
              const open = openGroup === group.id;
              const activeItem = items.find((t) => t.id === tab);
              return (
                <div key={group.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.id)}
                    className={`relative flex ${tap} items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition ${activeHere ? 'bg-[#6D4AFF] text-white' : 'bg-[#F2EEFF] text-[#1E1B4B]/70 hover:bg-[#EDE7FF]'}`}
                  >
                    <group.icon className="h-3.5 w-3.5" />
                    {activeHere && activeItem ? activeItem.label : group.label}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    {group.id === 'team' && (unreadTeam || unreadDm > 0) && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 ring-2 ring-white" />
                    )}
                  </button>
                  {open && (
                    <div className="absolute left-0 z-40 mt-1 min-w-[190px] rounded-[12px] border border-[#E7E1FF] bg-white p-1 shadow-[0_12px_30px_rgba(109,74,255,0.18)]">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setTab(t.id); setOpenGroup(null); }}
                          className={`flex ${tap} w-full items-center gap-2 rounded-[8px] px-3 text-left text-[13px] font-medium transition ${tab === t.id ? 'bg-[#EDE7FF] text-[#6D4AFF]' : 'text-[#1E1B4B]/70 hover:bg-[#F4F1FF]'}`}
                        >
                          <t.icon className="h-3.5 w-3.5 shrink-0" /> {t.label}
                          {t.id === 'team' && unreadTeam && (
                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
                              <span className="h-2 w-2 rounded-full bg-red-500" /> New
                            </span>
                          )}
                          {t.id === 'inbox' && unreadDm > 0 && (
                            <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                              {unreadDm}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Click-away backdrop to close an open dropdown */}
          {openGroup && (
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpenGroup(null)}
              className="fixed inset-0 z-30 cursor-default"
            />
          )}
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
            {tab === 'dashboard' && (
              <SuitesHome greeting={crmGreeting(memberName)} isFounder={isFounder} showEconomics={showEconomics} activeTab={tab} onPick={setTab} />
            )}
            {tab === 'dashboard' && <DashboardTab firms={firms} activity={activity} today={today} onLog={openFast} workerCount={workerCount} onChanged={load} onQuickEmail={quickEmail} claim={claim} />}
            {tab === 'pipeline' && <PipelineTab firms={firms} onLog={openFast} workerCount={workerCount} onQuickEmail={quickEmail} claim={claim} />}
            {tab === 'firms' && <FirmsTab firms={firms} onLog={openFast} userId={userId} onQuickEmail={quickEmail} claim={claim} />}
            {tab === 'activity' && <ActivityTab activity={activity} />}
            {tab === 'metrics' && <MetricsTab firms={firms} activity={activity} />}
            {tab === 'team' && <TeamTab />}
            {tab === 'inbox' && <InboxTab onReadChange={async () => setUnreadDm(await getUnreadDmCount())} />}
            {tab === 'notes' && <NotesTab isFounder={isFounder} />}
            {tab === 'scripts' && <ScriptsTab />}
            {tab === 'training' && <TrainingTab />}
            {tab === 'askai' && <AskAITab />}
            {tab === 'checklist' && isFounder && <ChecklistTab />}
            {tab === 'audit' && isFounder && <AuditTab />}
            {tab === 'revenue' && isFounder && <RevenueTab firms={firms} />}
            {tab === 'comp' && <CompTab firms={firms} />}
            {tab === 'economics' && showEconomics && <CompanyEconomicsTab firms={firms} />}
            {tab === 'growth' && showEconomics && <GrowthTab />}
            {tab === 'links' && isFounder && <LinksTab />}
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
// Reusable collapsible section — keeps long tabs compact.
function Collapsible({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#E7E1FF] bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`flex ${tap} w-full items-center justify-between px-4 text-left`}>
        <span className="text-[13px] font-bold text-[#1E1B4B]">{title}</span>
        <ChevronRight className={`h-4 w-4 shrink-0 text-[#1E1B4B]/35 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="border-t border-[#F0EBFF] p-4">{children}</div>}
    </div>
  );
}

// Compact, collapsible firm row. Tap-to-call lives in the header so it's reachable without expanding.
// Per-tier call angle + objection prep (verbatim from the sales cheat sheet). Tier is
// stored on the firm (cela_tier_update.sql); these 4 templates stay in code, not per-row.
const TIER_PLAYS: Record<number, { label: string; angle: string; objection: string }> = {
  1: {
    label: 'Tier 1 · Tech-native',
    angle: "Skip the AI-concept pitch. Lead: “You're already running a modern firm — your case lifecycle has AI. Your intake probably still has a worker arriving scattered. We close that gap before the case starts.” They get it in 30 seconds.",
    objection: 'Price / fit / timing only. NOT AI skepticism.',
  },
  2: {
    label: 'Tier 2 · Growth',
    angle: "“Firms your size tell us the bottleneck isn't caseload — it's the staff time sorting intake before the attorney can evaluate. We eliminate that step.”",
    objection: "“Already have a process” → ask what it is. “Who else is using this?” → have 1–2 firm names ready.",
  },
  3: {
    label: 'Tier 3 · Modern boutique',
    angle: "“Solo and boutique firms often take fewer cases but need each one to be right. We help you see the full picture before the first consult so you decide faster.”",
    objection: "“Not the right time” / “Send something first” → follow up with the demo link same day.",
  },
  4: {
    label: 'Tier 4 · Traditional',
    angle: "“It's not complicated — worker uploads records, we organize it, you get a clean packet. No AI jargon, no learning curve. Free pilot this week.”",
    objection: "AI skepticism — don't oversell tech. Sell the packet.",
  },
};

// Deal brief fallback for firms without researched crmFirmIntel (e.g. the CELA 350):
// build a call-ready brief from data we already have. On-message, no legal conclusions.
function suggestedOpener(firm: CrmFirm): string {
  const who = firm.attorney_name?.trim().split(/\s+/)[0] || 'there';
  return `Hi ${who} — I help California employment firms turn a client's scattered records into one organized, source-linked timeline, so you open an intake and decide in minutes. Could I show you a real one?`;
}
function practiceFit(focus: string | null): string {
  const f = (focus || '').trim();
  return f
    ? `${f} — document-heavy intake; organizing scattered records before the first meeting is a strong fit.`
    : 'Employment practice — organizing scattered client records before the first meeting is a strong fit.';
}
function localAngle(firm: CrmFirm): string | null {
  const r = (firm.region || '').toLowerCase();
  if (r.includes('central valley')) return 'Local angle: Central Valley — near Tracy. Lead with the hometown connection.';
  if (r.includes('sacramento')) return 'Regional: Sacramento area — Northern California.';
  if (r.includes('norcal')) return 'Regional: Northern California.';
  return null;
}

function FirmCard({ firm, onLog, today, onQuickEmail, userId, onClaim, onRelease }: { firm: CrmFirm; onLog: (id: string) => void; today?: string; onQuickEmail?: (id: string) => Promise<void>; userId?: string | null; onClaim?: (id: string) => Promise<void>; onRelease?: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const due = today && firm.next_followup && firm.next_followup <= today;
  const mine = !!userId && firm.contacted_by === userId;
  const claimedDate = firm.contacted_at ? firm.contacted_at.slice(0, 10) : null;
  const intel = crmFirmIntel[firm.name];
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#E7E1FF] bg-white">
      <div className="flex items-center gap-2 p-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight className={`h-4 w-4 shrink-0 text-[#1E1B4B]/30 transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="truncate text-[14px] font-bold">{firm.name}</span>
          <PriorityBadge priority={firm.priority} />
          {due && <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">due</span>}
        </button>
        {firm.contacted_by ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${mine ? 'bg-emerald-100 text-emerald-700' : 'bg-[#EDE7FF] text-[#6D4AFF]'}`}
            title={`Claimed by ${firm.contacted_by_name ?? 'rep'}${claimedDate ? ' · ' + claimedDate : ''}`}
          >
            {mine ? 'Yours' : (firm.contacted_by_name?.split(' ')[0] ?? 'Claimed')}
          </span>
        ) : onClaim ? (
          <button
            type="button"
            disabled={claiming}
            onClick={async () => { setClaiming(true); try { await onClaim(firm.id); } finally { setClaiming(false); } }}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#6D4AFF] px-2.5 text-[11px] font-bold text-white transition hover:bg-[#5B3FE0] disabled:opacity-50"
            aria-label={`Claim ${firm.name}`}
          >
            <Hand className="h-3.5 w-3.5" /> {claiming ? '…' : 'Claim'}
          </button>
        ) : null}
        <StageTag stage={firm.stage} />
        {firm.phone && (
          <a href={`tel:${digitsOf(firm.phone)}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-label={`Call ${firm.name}`}>
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>
      {open && (
        <div className="space-y-2 border-t border-[#F0EBFF] p-3">
          {firm.attorney_name && <div className="text-[12px] text-[#1E1B4B]/55">{firm.attorney_name}</div>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-[#1E1B4B]/35" /><PhoneLink phone={firm.phone} /></span>
            {firm.next_followup && (
              <span className={`flex items-center gap-1.5 ${due ? 'font-semibold text-red-600' : 'text-[#1E1B4B]/50'}`}>
                <Calendar className="h-3.5 w-3.5" /> {firm.next_followup}
              </span>
            )}
            {firm.region && <span className="text-[#1E1B4B]/45">{firm.region}</span>}
          </div>
          {firm.notes && <p className="text-[12px] leading-relaxed text-[#1E1B4B]/60">{firm.notes}</p>}

          {/* Call strip — quick-glance intel for use during the call */}
          {intel && (
            <div className="rounded-[12px] border border-[#DCD3FF] bg-[#F7F3FF] p-3">
              {intel.fireCaseSignal && (
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">🔥 Fire case signal</span>
              )}
              <p className="text-[12px] font-semibold text-[#1E1B4B]">{intel.headlineWin}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#1E1B4B]/75"><span className="font-bold text-[#6D4AFF]">Opener: </span>{intel.opener}</p>
            </div>
          )}

          {/* Deal brief — fallback for firms without researched intel (CELA 350). */}
          {!intel && (() => {
            const play = firm.tier ? TIER_PLAYS[firm.tier] : null;
            return (
              <div className="rounded-[12px] border border-[#DCD3FF] bg-[#F7F3FF] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#6D4AFF]">Call brief</p>
                  {play && (
                    <span className="rounded-full bg-[#6D4AFF] px-2 py-0.5 text-[10px] font-bold text-white">{play.label}</span>
                  )}
                </div>
                {play ? (
                  <>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#1E1B4B]/80"><span className="font-bold text-[#6D4AFF]">Angle: </span>{play.angle}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[#1E1B4B]/65"><span className="font-bold text-[#1E1B4B]/75">If they push back: </span>{play.objection}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#1E1B4B]/80">{practiceFit(firm.focus_areas)}</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#1E1B4B]/75"><span className="font-bold text-[#6D4AFF]">Opener: </span>{suggestedOpener(firm)}</p>
                  </>
                )}
                {localAngle(firm) && (
                  <p className="mt-1.5 text-[12px] font-medium text-[#1E1B4B]/70">{localAngle(firm)}</p>
                )}
                {firm.notes && <p className="mt-1 text-[11px] text-[#1E1B4B]/45">{firm.notes}</p>}
              </div>
            );
          })()}

          {/* Full brief — deeper research, collapsed by default */}
          {intel && (
            <Collapsible title="Full brief">
              <ul className="mb-2 space-y-1">
                {intel.topWins.map((w) => (
                  <li key={w} className="flex gap-2 text-[12px] leading-relaxed text-[#1E1B4B]/70">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B6DFF]" /><span>{w}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] leading-relaxed text-[#1E1B4B]/60">{intel.awardsRecognition}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#1E1B4B]/60">{intel.intakeNotes}</p>
            </Collapsible>
          )}

          {firm.contacted_by && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-[#1E1B4B]/50">
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Claimed by {mine ? 'you' : (firm.contacted_by_name ?? 'a rep')}{claimedDate ? ` on ${claimedDate}` : ''}
              </span>
              {mine && onRelease && (
                <button
                  type="button"
                  onClick={() => onRelease(firm.id)}
                  className="font-semibold text-[#1E1B4B]/45 underline-offset-2 hover:text-red-600 hover:underline"
                >
                  Release
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => onLog(firm.id)} className={`flex ${tap} flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#EDE7FF] font-semibold text-[#6D4AFF]`}>
              <Phone className="h-4 w-4" /> Log call
            </button>
            {onQuickEmail && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => { setBusy(true); try { await onQuickEmail(firm.id); } finally { setBusy(false); } }}
                className={`flex ${tap} items-center justify-center gap-1.5 rounded-[12px] border border-[#E0D6FF] px-3 font-semibold text-[#6D4AFF] disabled:opacity-50`}
              >
                <Mail className="h-4 w-4" /> {busy ? '…' : 'Emailed'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Clean CRM home: greeting + the nav categories as "suite" cards.
function SuitesHome({ greeting, isFounder, showEconomics, activeTab, onPick }: {
  greeting: string; isFounder: boolean; showEconomics: boolean; activeTab: Tab; onPick: (t: Tab) => void;
}) {
  const groups = NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.tabIds
        .map((id) => TAB_BY_ID[id])
        .filter((t) => t && (!t.founderOnly || isFounder) && (!t.econOnly || showEconomics)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mb-7">
      <h1 className="font-display text-[clamp(1.5rem,5vw,2rem)] font-medium leading-[1.12] tracking-[-0.02em] text-transparent bg-[linear-gradient(110deg,#1E1B4B_0%,#5B35D5_42%,#1E1B4B_78%)] bg-[length:220%_100%] bg-clip-text">
        {greeting}
      </h1>
      <p className="mt-1 text-[13px] text-[#1E1B4B]/50">Your sales suite — jump back in.</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className="rounded-[18px] border border-[#E7E1FF] bg-white p-4 shadow-[0_10px_30px_rgba(31,27,75,0.05)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EDE7FF] text-[#6D4AFF]"><g.icon className="h-4 w-4" /></span>
              <span className="text-[14px] font-bold text-[#1E1B4B]">{g.label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPick(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${activeTab === t.id ? 'bg-[#6D4AFF] text-white' : 'bg-[#F4F1FF] text-[#1E1B4B]/70 hover:bg-[#EDE7FF]'}`}
                >
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ firms, activity, today, onLog, workerCount, onChanged, onQuickEmail, claim }: { firms: CrmFirm[]; activity: CrmActivityWithFirm[]; today: string; onLog: (id: string) => void; workerCount: number; onChanged: () => void; onQuickEmail?: (id: string) => Promise<void>; claim?: ClaimBundle }) {
  const stats = [
    { label: 'Firms', value: firms.length },
    { label: 'Calls', value: activity.filter((a) => a.activity_type === 'call').length },
    { label: 'Demos booked', value: firms.filter((f) => f.stage === 'demo_booked').length },
    { label: 'Active pilots', value: firms.filter((f) => f.stage === 'pilot').length },
    { label: 'Workers organized', value: workerCount },
  ];
  const due = firms
    .filter((f) => f.next_followup && f.next_followup <= today)
    .sort((a, b) => (a.next_followup ?? '').localeCompare(b.next_followup ?? ''));
  const recent = activity.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[14px] border border-[#E7E1FF] bg-white p-4">
            <div className="text-[26px] font-black leading-none text-[#6D4AFF]">{s.value}</div>
            <div className="mt-1 text-[11px] font-semibold text-[#1E1B4B]/55">{s.label}</div>
          </div>
        ))}
      </div>

      <StageStrip firms={firms} />

      <DemoPrepCard firms={firms} today={today} onChanged={onChanged} />

      <section>
        <h2 className="mb-2 text-[14px] font-bold">Follow-ups due today</h2>
        {due.length === 0 ? (
          <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">Nothing due. Nice.</p>
        ) : (
          <div className="space-y-3">{due.map((f) => <FirmCard key={f.id} firm={f} onLog={onLog} today={today} onQuickEmail={onQuickEmail} userId={claim?.userId} onClaim={claim?.onClaim} onRelease={claim?.onRelease} />)}</div>
        )}
      </section>

      <DailyTargetsScoreboard activity={activity} today={today} />

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

// ── Demo prep card (top of Dashboard; only when a demo is booked) ────────────
function DemoPrepCard({ firms, today, onChanged }: { firms: CrmFirm[]; today: string; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const booked = firms.filter((f) => f.stage === 'demo_booked');
  if (booked.length === 0) return null;

  const markDone = async (id: string) => { setBusyId(id); await setFirmStage(id, 'demo_done'); setBusyId(null); onChanged(); };

  const daysUntil = (date: string | null): string => {
    if (!date) return 'date not set';
    const d = Math.round((new Date(date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
    if (d === 0) return 'today';
    if (d === 1) return 'tomorrow';
    return d < 0 ? `${Math.abs(d)}d ago` : `in ${d}d`;
  };

  const discoveryQuestions = (focus: string | null): string[] => {
    const f = (focus ?? '').toLowerCase();
    const QW = 'Who sorts the records before attorney review?';
    const QR = 'How does a new employment intake usually come in today?';
    const QD = 'What makes an intake a waste of time?';
    if (/wage|hour/.test(f)) return [QW, QR, QD];
    if (/retaliation|termination/.test(f)) return [QR, QW, QD];
    return [QD, QW, QR];
  };

  const fireAngle = (region: string | null): boolean => {
    const r = (region ?? '').toLowerCase();
    return r.includes('los angeles') || r.includes('sacramento');
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-amber-600" /><h2 className="text-[14px] font-bold">Demo prep</h2></div>
      {booked.map((f) => {
        const intel = crmFirmIntel[f.name];
        return (
        <div key={f.id} className="rounded-[16px] border-2 border-amber-300 bg-amber-50 p-4">
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold text-[#1E1B4B]">{f.name}</div>
              {f.attorney_name && <div className="text-[12px] text-[#1E1B4B]/55">{f.attorney_name}</div>}
            </div>
            <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">Demo {daysUntil(f.next_followup)}</span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            {f.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-[#1E1B4B]/40" /><PhoneLink phone={f.phone} /></span>}
            {f.region && <span className="text-[#1E1B4B]/55">{f.region}</span>}
          </div>
          {f.focus_areas && <p className="mb-2 text-[12px] leading-relaxed text-[#1E1B4B]/60">Focus: {f.focus_areas}</p>}
          {intel && (
            <div className="mb-2 rounded-[10px] border border-amber-300/60 bg-white/70 p-2.5">
              <p className="text-[12px] font-semibold text-[#1E1B4B]">{intel.headlineWin}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#1E1B4B]/75"><span className="font-bold text-[#6D4AFF]">Opener: </span>{intel.opener}</p>
            </div>
          )}
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-amber-800/70">Lead with these</div>
          <ol className="mb-2 list-decimal space-y-1 pl-5 text-[13px] text-[#1E1B4B]/80">
            {discoveryQuestions(f.focus_areas).map((q) => <li key={q}>{q}</li>)}
          </ol>
          {fireAngle(f.region) && (
            <p className="mb-3 rounded-[10px] bg-amber-200/60 px-3 py-2 text-[12px] font-medium leading-relaxed text-amber-900">
              Tracy/Medline and Boyle Heights fire-displaced workers are the most urgent intake population right now — use this as the opening hook.
            </p>
          )}
          <button type="button" onClick={() => markDone(f.id)} disabled={busyId === f.id} className={`flex ${tap} w-full items-center justify-center gap-2 rounded-[12px] bg-amber-600 font-semibold text-white disabled:opacity-50`}>
            <Check className="h-4 w-4" /> {busyId === f.id ? 'Saving…' : 'Mark demo done'}
          </button>
        </div>
        );
      })}
    </section>
  );
}

// ── Daily targets scoreboard (Dashboard) ─────────────────────────────────────
function DailyTargetsScoreboard({ activity, today }: { activity: CrmActivityWithFirm[]; today: string }) {
  const monday = startOfWeekISO();
  const calls = activity.filter((a) => a.activity_type === 'call' && a.activity_date === today).length;
  const emails = activity.filter((a) => a.activity_type === 'email' && a.activity_date === today).length;
  const demos = activity.filter((a) => a.activity_type === 'demo' && (a.activity_date ?? '') >= monday).length;
  const cards = [
    { label: 'Calls today', count: calls, target: DAILY_TARGETS.calls },
    { label: 'Emails today', count: emails, target: DAILY_TARGETS.emails },
    { label: 'Demos this week', count: demos, target: DAILY_TARGETS.demos },
  ];
  const colorMap = {
    green: { text: 'text-emerald-600', bar: 'bg-emerald-500' },
    amber: { text: 'text-amber-600', bar: 'bg-amber-500' },
    gray: { text: 'text-[#1E1B4B]/35', bar: 'bg-[#1E1B4B]/25' },
  };
  return (
    <section>
      <h2 className="mb-2 text-[14px] font-bold">Today’s targets</h2>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => {
          const color = colorMap[targetColor(c.count, c.target)];
          const pct = Math.min(100, Math.round((c.count / c.target) * 100));
          return (
            <div key={c.label} className="rounded-[14px] border border-[#E7E1FF] bg-white p-3">
              <div className={`text-[26px] font-black leading-none ${color.text}`}>{c.count}</div>
              <div className="mt-1 text-[10px] font-semibold leading-tight text-[#1E1B4B]/55">{c.label}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F0EBFF]"><div className={`h-full rounded-full ${color.bar}`} style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 text-[10px] text-[#1E1B4B]/40">target: {c.target}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] font-medium text-[#6D4AFF]">{dailyTargetsContext(calls, emails, demos)}</p>
    </section>
  );
}

// ── Revenue (founder-only) ───────────────────────────────────────────────────
function CompStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#1E1B4B]/55">{label}</div>
      <div className={`text-[18px] font-black ${highlight ? 'text-[#6D4AFF]' : 'text-[#1E1B4B]'}`}>{value}</div>
    </div>
  );
}

/** Earnings tab — visible bonus tracker (the "bonus earned" signal) + a calculator sandbox. */
function CompTab({ firms }: { firms: CrmFirm[] }) {
  const usd = (n: number) => `$${n.toLocaleString()}`;
  const paidCount = firms.filter((f) => f.stage === 'paid').length;
  const bonus = firstThreeBonus(paidCount);

  const [firmCount, setFirmCount] = useState(3);
  const [tier, setTier] = useState<'solo' | 'practice' | 'firm'>('practice');
  const [months, setMonths] = useState(12);
  const calc = commissionProjection({ firmCount, tier, months });

  return (
    <div className="space-y-5">
      {/* Bonus tracker — the "bonus earned" signal */}
      <section>
        <h2 className="mb-2 text-[14px] font-bold">First 3 paying firms — launch bonus</h2>
        <div className="rounded-[16px] border border-[#DCD3FF] bg-[#F7F3FF] p-4">
          {bonus.earned > 0 ? (
            <div className="mb-3 rounded-[12px] bg-[#6D4AFF] px-4 py-3 text-white">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">Bonus earned</div>
              <div className="text-[26px] font-black leading-tight">{usd(bonus.earned)}</div>
              <div className="text-[12px] text-white/80">{paidCount} of {BONUS_LADDER.length} paying firms · pay within 1–2 business days of the cleared invoice</div>
            </div>
          ) : (
            <p className="mb-3 text-[13px] text-[#1E1B4B]/55">No paying firms yet. The first conversion earns {usd(BONUS_LADDER[0])}.</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {bonus.steps.map((s) => (
              <div key={s.n} className={`rounded-[10px] border px-2 py-2.5 text-center ${s.hit ? 'border-[#6D4AFF] bg-white' : 'border-[#E7E1FF] bg-white/60'}`}>
                <div className={`text-[15px] font-black ${s.hit ? 'text-[#6D4AFF]' : 'text-[#1E1B4B]/30'}`}>{usd(s.amount)}</div>
                <div className="text-[10px] font-semibold text-[#1E1B4B]/55">Firm {s.n}{s.hit ? ' ✓' : ''}</div>
              </div>
            ))}
          </div>
          {!bonus.complete && bonus.nextAmount != null && (
            <p className="mt-3 text-[12px] text-[#1E1B4B]/55">Next conversion: <b className="text-[#6D4AFF]">{usd(bonus.nextAmount)}</b></p>
          )}
          <p className="mt-3 text-[12px] text-[#1E1B4B]/45">
            + {usd(SPRINT_BONUS)} sprint bonus if all 3 land in the sprint window — plus {Math.round(COMMISSION_RATE * 100)}% recurring on every firm, every month.
          </p>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#1E1B4B]/45">
          A firm counts when it's marked <b>Paid</b> — set that the moment Stripe confirms the first cleared invoice. 30-day clawback: if a firm cancels within 30 days, its bonus reverses.
        </p>
      </section>

      {/* Calculator sandbox */}
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Earnings calculator</h2>
        <div className="space-y-4 rounded-[16px] border border-[#E7E1FF] bg-white p-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#1E1B4B]/70">Paying firms</label>
              <input
                type="number"
                min={0}
                max={500}
                value={firmCount}
                onChange={(e) => setFirmCount(Math.max(0, Math.min(500, Math.floor(+e.target.value) || 0)))}
                className="w-20 rounded-[8px] border border-[#E7E1FF] px-2 py-1 text-right text-[13px] font-bold text-[#6D4AFF] outline-none focus:border-[#6D4AFF]"
              />
            </div>
            <input type="range" min={0} max={500} value={firmCount} onChange={(e) => setFirmCount(+e.target.value)} className="w-full accent-[#6D4AFF]" />
            <div className="mt-1.5 flex gap-1.5">
              {[10, 50, 100, 250, 500].map((n) => (
                <button key={n} type="button" onClick={() => setFirmCount(n)} className={`flex-1 rounded-[8px] border px-1 py-1 text-[11px] font-semibold transition ${firmCount === n ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white' : 'border-[#E7E1FF] text-[#1E1B4B]/55 hover:border-[#B8A8FF]'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold text-[#1E1B4B]/70">Tier</div>
            <div className="flex gap-2">
              {(['solo', 'practice', 'firm'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTier(t)} className={`flex-1 rounded-[10px] border px-2 py-2 text-[12px] font-semibold capitalize transition ${tier === t ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white' : 'border-[#E7E1FF] text-[#1E1B4B]/60 hover:border-[#B8A8FF]'}`}>
                  {t} ${TIER_PRICES[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold text-[#1E1B4B]/70">Months retained</div>
            <div className="flex gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button key={m} type="button" onClick={() => setMonths(m)} className={`flex-1 rounded-[10px] border px-2 py-2 text-[12px] font-semibold transition ${months === m ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white' : 'border-[#E7E1FF] text-[#1E1B4B]/60 hover:border-[#B8A8FF]'}`}>
                  {m} mo
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-[12px] bg-[#F7F3FF] p-4">
            <div className="grid grid-cols-2 gap-3">
              <CompStat label="Monthly commission" value={`${usd(calc.monthlyCommission)}/mo`} />
              <CompStat label={`Commission over ${months} mo`} value={usd(calc.totalCommission)} />
              <CompStat label="First-3 bonus" value={usd(calc.bonus)} />
              <CompStat label="Total potential" value={usd(calc.total)} highlight />
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-[#1E1B4B]/45">
            Illustration only — assumes all firms on the {tier} tier, retained {months} month{months === 1 ? '' : 's'}. The {Math.round(COMMISSION_RATE * 100)}% commission keeps paying every month a firm stays.
          </p>
        </div>
      </section>
    </div>
  );
}

/** Company Economics — net to one3seven after overhead. Restricted to ECON_ALLOWED_EMAILS. */
function CompanyEconomicsTab({ firms }: { firms: CrmFirm[] }) {
  const usd = (n: number) => `$${n.toLocaleString()}`;
  const paidCount = firms.filter((f) => f.stage === 'paid').length;

  const [firmCount, setFirmCount] = useState(Math.max(3, paidCount));
  const [tier, setTier] = useState<'solo' | 'practice' | 'firm'>('practice');
  const [months, setMonths] = useState(12);
  const [a, setA] = useState({ ...ECON_DEFAULTS });
  const setNum = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setA((prev) => ({ ...prev, [k]: Math.max(0, +e.target.value || 0) }));

  const input: EconomicsInput = { firmCount, tier, months, ...a };
  const r = companyEconomics(input);

  const numCls = 'w-20 rounded-[8px] border border-[#E7E1FF] px-2 py-1 text-right text-[13px] font-bold text-[#6D4AFF] outline-none focus:border-[#6D4AFF]';

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Company economics — net after overhead</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-[#1E1B4B]/45">
          The mirror of the rep calculator, from one3seven's side. Restricted view. AI and infra are estimates — tune them as real usage comes in.
        </p>
        <div className="space-y-4 rounded-[16px] border border-[#E7E1FF] bg-white p-4">
          {/* Firm count */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#1E1B4B]/70">Paying firms</label>
              <input type="number" min={0} max={500} value={firmCount} onChange={(e) => setFirmCount(Math.max(0, Math.min(500, Math.floor(+e.target.value) || 0)))} className={numCls} />
            </div>
            <input type="range" min={0} max={500} value={firmCount} onChange={(e) => setFirmCount(+e.target.value)} className="w-full accent-[#6D4AFF]" />
            <div className="mt-1.5 flex gap-1.5">
              {[10, 50, 100, 250, 500].map((n) => (
                <button key={n} type="button" onClick={() => setFirmCount(n)} className={`flex-1 rounded-[8px] border px-1 py-1 text-[11px] font-semibold transition ${firmCount === n ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white' : 'border-[#E7E1FF] text-[#1E1B4B]/55 hover:border-[#B8A8FF]'}`}>{n}</button>
              ))}
            </div>
          </div>
          {/* Tier */}
          <div>
            <div className="mb-1 text-[12px] font-semibold text-[#1E1B4B]/70">Tier</div>
            <div className="flex gap-2">
              {(['solo', 'practice', 'firm'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTier(t)} className={`flex-1 rounded-[10px] border px-2 py-2 text-[12px] font-semibold capitalize transition ${tier === t ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white' : 'border-[#E7E1FF] text-[#1E1B4B]/60 hover:border-[#B8A8FF]'}`}>{t} ${TIER_PRICES[t]}</button>
              ))}
            </div>
          </div>
          {/* Months */}
          <div>
            <div className="mb-1 text-[12px] font-semibold text-[#1E1B4B]/70">Months retained</div>
            <div className="flex gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button key={m} type="button" onClick={() => setMonths(m)} className={`flex-1 rounded-[10px] border px-2 py-2 text-[12px] font-semibold transition ${months === m ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white' : 'border-[#E7E1FF] text-[#1E1B4B]/60 hover:border-[#B8A8FF]'}`}>{m} mo</button>
              ))}
            </div>
          </div>

          {/* Editable assumptions */}
          <div className="rounded-[12px] border border-[#E7E1FF] bg-[#FBFAFF] p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#1E1B4B]/55">Overhead assumptions</div>
            <div className="space-y-2">
              {([
                ['commissionPct', 'Sales commission %'],
                ['stripePct', 'Stripe fee %'],
                ['stripeFlat', 'Stripe flat $/charge'],
                ['aiCostPerFirm', 'AI cost $/firm/mo (est.)'],
                ['fixedInfraMonthly', 'Fixed infra $/mo'],
              ] as const).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between">
                  <label className="text-[12px] text-[#1E1B4B]/65">{label}</label>
                  <input type="number" min={0} step="any" value={a[k]} onChange={setNum(k)} className={numCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="rounded-[12px] bg-[#F7F3FF] p-4">
            <div className="grid grid-cols-2 gap-3">
              <CompStat label="Gross revenue" value={usd(r.grossTotal)} />
              <CompStat label="− Commission" value={usd(r.commission)} />
              <CompStat label="− Stripe fees" value={usd(r.stripe)} />
              <CompStat label="− AI (est.)" value={usd(r.ai)} />
              <CompStat label="− Fixed infra" value={usd(r.fixed)} />
              <CompStat label="Total overhead" value={usd(r.totalCost)} />
              <CompStat label={`Net / mo`} value={`${usd(r.netMonthly)}/mo`} />
              <CompStat label={`Net over ${months} mo · ${r.marginPct}% margin`} value={usd(r.netTotal)} highlight />
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-[#1E1B4B]/45">
            Illustration only — assumes all firms on the {tier} tier, retained {months} month{months === 1 ? '' : 's'}. Margin improves with scale as fixed infra amortizes. Excludes founder time, counsel, and E&O.
          </p>
        </div>
      </section>
    </div>
  );
}

/** Growth analytics — site traffic, demo engagement, and the signup log (allowlisted accounts). */
function GrowthTab() {
  const [data, setData] = useState<SiteAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setErr('');
    const r = await getSiteAnalytics();
    if (r.error) setErr(r.error);
    else { setData(r.data ?? null); setRefreshedAt(new Date()); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const fmtDuration = (sec: number) => {
    const s = Math.round(sec);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };
  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString(); } catch { return iso; } };

  if (loading) return <p className="text-[13px] text-[#1E1B4B]/45">Loading analytics…</p>;
  if (err) return <p className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{err}</p>;
  if (!data) return <p className="text-[13px] text-[#1E1B4B]/45">No data yet.</p>;

  const daily = data.daily ?? [];
  const tiers = data.tier_breakdown ?? [];
  const signups = data.recent_signups ?? [];

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-[12px] border border-[#E7E1FF] bg-white p-4">
      <div className="text-[24px] font-black leading-none text-[#6D4AFF]">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-[#1E1B4B]/55">{label}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-bold">Traffic</h2>
          <button type="button" onClick={() => void load()} className="flex items-center gap-1.5 rounded-full border border-[#E7E1FF] px-3 py-1.5 text-[11px] font-semibold text-[#6D4AFF] transition hover:border-[#B8A8FF] hover:bg-[#F5F1FB]">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {refreshedAt && <p className="mb-2 text-[11px] text-[#1E1B4B]/40">Live · as of {refreshedAt.toLocaleTimeString()}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Landing page visits" value={data.landing_visits.toLocaleString()} />
          <Stat label="For-firms visits" value={data.for_firms_visits.toLocaleString()} />
          <Stat label="Demo visits" value={data.demo_visits.toLocaleString()} />
          <Stat label="Total sessions" value={data.total_sessions.toLocaleString()} />
          <Stat label="Avg time on site" value={fmtDuration(data.avg_session_seconds)} />
          <Stat label="Avg time in demos" value={fmtDuration(data.demo_avg_session_seconds)} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[14px] font-bold">Conversion</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pilot form starts" value={data.pilot_submits.toLocaleString()} />
          <Stat label="Pilot requests sent" value={data.pilot_success.toLocaleString()} />
          <Stat label="Accounts created" value={data.signups_count.toLocaleString()} />
          <Stat label="Recent shown" value={signups.length} />
        </div>
      </section>

      {daily.length > 0 && (
        <section>
          <h2 className="mb-2 text-[14px] font-bold">Last 7 days</h2>
          <div className="space-y-2 rounded-[12px] border border-[#E7E1FF] bg-white p-4">
            {(() => {
              const max = Math.max(1, ...daily.map((d) => d.visits));
              return daily.map((d) => (
                <div key={d.day} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11px] text-[#1E1B4B]/55">{d.day}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-[#F3EFFF]">
                    <div className="h-full rounded bg-[#6D4AFF]" style={{ width: `${Math.round((d.visits / max) * 100)}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-[#1E1B4B]">{d.visits}</span>
                  <span className="w-16 shrink-0 text-right text-[11px] text-[#6D4AFF]">{d.signups} new</span>
                </div>
              ));
            })()}
          </div>
          <p className="mt-1.5 text-[11px] text-[#1E1B4B]/45">Bar = page visits · right = new signups</p>
        </section>
      )}

      {tiers.length > 0 && (
        <section>
          <h2 className="mb-2 text-[14px] font-bold">Tier breakdown</h2>
          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => (
              <span key={t.tier} className="rounded-full border border-[#E7E1FF] bg-white px-3 py-1.5 text-[12px] text-[#1E1B4B]">
                <b className="capitalize text-[#6D4AFF]">{t.tier}</b> · {t.count}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[14px] font-bold">Signups ({signups.length})</h2>
        {signups.length === 0 ? (
          <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No accounts yet.</p>
        ) : (
          <div className="space-y-2">
            {signups.map((s, i) => (
              <div key={s.email + i} className="flex items-center gap-3 rounded-[12px] border border-[#E7E1FF] bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#1E1B4B]">{s.name}</div>
                  <div className="truncate text-[11px] text-[#1E1B4B]/50">{s.email} · {fmtDate(s.created_at)}</div>
                </div>
                {s.tier ? (
                  <span className="shrink-0 rounded-full bg-[#F3EFFF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6D4AFF]">{s.tier}{s.sub_status && s.sub_status !== 'active' ? ` · ${s.sub_status}` : ''}</span>
                ) : (
                  <span className="shrink-0 rounded-full border border-[#E7E1FF] px-2.5 py-1 text-[10px] font-semibold text-[#1E1B4B]/45">worker</span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-[#1E1B4B]/45">
          Time-on-site is measured from new sessions going forward (heartbeat-based). Tier shows for firm accounts with a subscription; workers have no tier.
        </p>
      </section>
    </div>
  );
}

/** Founder directory — every link off www.one3seven.com in one place (open + copy). */
function LinksTab() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (url: string) => {
    try {
      void navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-1 text-[14px] font-bold">All one3seven links</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-[#1E1B4B]/45">
          Every page off <b>www.one3seven.com</b>. Tap to open, or copy to share. Internal links require sign-in.
        </p>
        <div className="space-y-4">
          {SITE_LINK_GROUPS.map((g) => (
            <div key={g.group}>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6D4AFF]">{g.group}</div>
              <div className="space-y-2">
                {g.items.map((it) => {
                  const url = `${SITE_BASE}${it.path === '/' ? '' : it.path}`;
                  return (
                    <div key={it.path} className="flex items-center gap-2 rounded-[12px] border border-[#E7E1FF] bg-white p-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-[#1E1B4B]">{it.label}</div>
                        <div className="truncate text-[11px] text-[#1E1B4B]/50">{it.desc}</div>
                        <div className="truncate text-[11px] font-medium text-[#6D4AFF]">{url}</div>
                      </div>
                      <button type="button" onClick={() => copy(url)} aria-label="Copy link" className="rounded-lg border border-[#E7E1FF] p-2 text-[#1E1B4B]/55 transition hover:border-[#B8A8FF] hover:bg-[#F7F3FF]">
                        {copied === url ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <a href={url} target="_blank" rel="noreferrer" aria-label="Open link" className="rounded-lg border border-[#E7E1FF] p-2 text-[#1E1B4B]/55 transition hover:border-[#B8A8FF] hover:bg-[#F7F3FF]">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-[#1E1B4B]/45">
          Tip: <b>/for-firms</b> is the page to send prospects — it opens straight to the pitch and pilot request.
        </p>
      </section>
    </div>
  );
}

function RevenueTab({ firms }: { firms: CrmFirm[] }) {
  const r = computeRevenue(firms);
  const paid = firms.filter((f) => f.stage === 'paid');
  const usd = (n: number) => `$${n.toLocaleString()}`;
  const progressPct = Math.min(100, Math.round((r.paidCount / PHASE1_PAYING_TARGET) * 100));
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Current MRR (actual)</h2>
        <div className="rounded-[16px] border border-[#DCD3FF] bg-[#F7F3FF] p-4">
          <div className="text-[32px] font-black leading-none text-[#6D4AFF]">{usd(r.currentMrr)}<span className="text-[14px] font-semibold text-[#1E1B4B]/40">/mo</span></div>
          <div className="mt-1 text-[12px] text-[#1E1B4B]/55">{r.paidCount} paying firm{r.paidCount === 1 ? '' : 's'}</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {r.perTier.map((t) => (
              <div key={t.tier} className="rounded-[10px] border border-[#E7E1FF] bg-white px-2 py-2 text-center">
                <div className="text-[15px] font-black text-[#1E1B4B]">{t.count}</div>
                <div className="text-[10px] font-semibold capitalize text-[#1E1B4B]/55">{t.tier} · ${TIER_PRICES[t.tier]}</div>
              </div>
            ))}
          </div>
          {r.currentMrr === 0 && <p className="mt-3 text-[12px] text-[#1E1B4B]/45">No firms on paid plans yet — $0 until conversions begin (Stripe billing not live yet).</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[14px] font-bold">Pipeline forecast</h2>
        <div className="rounded-[16px] border border-[#E7E1FF] bg-white p-4">
          <div className="text-[26px] font-black leading-none text-[#1E1B4B]">{usd(r.projectedMrr)}<span className="text-[13px] font-semibold text-[#1E1B4B]/40">/mo</span></div>
          <div className="mt-1 text-[12px] text-[#1E1B4B]/55">projected — 30% conversion estimate on {r.candidateCount} pipeline firm{r.candidateCount === 1 ? '' : 's'} at Practice tier</div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[14px] font-bold">Phase 1 target: {PHASE1_PAYING_TARGET} paying firms</h2>
        <div className="rounded-[16px] border border-[#E7E1FF] bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-[13px] font-semibold"><span>{r.paidCount} of {PHASE1_PAYING_TARGET}</span><span className="text-[#6D4AFF]">{progressPct}%</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#F0EBFF]"><div className="h-full rounded-full bg-[#6D4AFF]" style={{ width: `${progressPct}%` }} /></div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[14px] font-bold">Commission liability ({Math.round(COMMISSION_RATE * 100)}% recurring)</h2>
        {paid.length === 0 ? (
          <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No paying firms yet — $0 commission liability.</p>
        ) : (
          <div className="space-y-2">
            {paid.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-2.5">
                <span className="truncate text-[13px] font-semibold">{f.name}</span>
                <span className="text-[13px] text-[#1E1B4B]/70">{usd(Math.round(tierPrice(f.subscription_tier) * COMMISSION_RATE))}/mo</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-[12px] bg-[#EDE7FF] px-4 py-2.5">
              <span className="text-[13px] font-bold text-[#6D4AFF]">Total monthly commission</span>
              <span className="text-[13px] font-bold text-[#6D4AFF]">{usd(r.commissionMonthly)}/mo</span>
            </div>
          </div>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-[#1E1B4B]/40">Figures derive from the CRM pipeline only (no Stripe integration). Forecast is an estimate, not booked revenue.</p>
    </div>
  );
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
function PipelineTab({ firms, onLog, workerCount, onQuickEmail, claim }: { firms: CrmFirm[]; onLog: (id: string) => void; workerCount: number; onQuickEmail?: (id: string) => Promise<void>; claim?: ClaimBundle }) {
  const counts = CRM_STAGES.map((s) => ({ stage: s, n: firms.filter((f) => f.stage === s).length }));
  const priorityA = firms.filter((f) => f.priority === 'A');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-[#E7E1FF] bg-white p-4">
          <div className="text-[26px] font-black leading-none text-[#6D4AFF]">{firms.length}</div>
          <div className="mt-1 text-[11px] font-semibold text-[#1E1B4B]/55">Firms in pipeline</div>
        </div>
        <div className="rounded-[14px] border border-[#E7E1FF] bg-white p-4">
          <div className="text-[26px] font-black leading-none text-[#6D4AFF]">{workerCount}</div>
          <div className="mt-1 text-[11px] font-semibold text-[#1E1B4B]/55">Workers organized</div>
        </div>
      </div>
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
          <div className="space-y-3">{priorityA.map((f) => <FirmCard key={f.id} firm={f} onLog={onLog} onQuickEmail={onQuickEmail} userId={claim?.userId} onClaim={claim?.onClaim} onRelease={claim?.onRelease} />)}</div>
        )}
      </section>
    </div>
  );
}

// ── Firms ────────────────────────────────────────────────────────────────────
function FirmsTab({ firms, onLog, userId, onQuickEmail, claim }: { firms: CrmFirm[]; onLog: (id: string) => void; userId: string | null; onQuickEmail?: (id: string) => Promise<void>; claim?: ClaimBundle }) {
  const [stage, setStage] = useState<CrmStage | ''>('');
  const [priority, setPriority] = useState<'A' | 'B' | 'C' | ''>('');
  const [owner, setOwner] = useState<'all' | 'mine' | 'uncontacted'>('all');
  const filtered = firms.filter((f) =>
    (!stage || f.stage === stage) &&
    (!priority || f.priority === priority) &&
    (owner === 'all' ||
      (owner === 'mine' && !!userId && f.contacted_by === userId) ||
      (owner === 'uncontacted' && !f.contacted_by))
  );
  const mineCount = userId ? firms.filter((f) => f.contacted_by === userId).length : 0;
  const uncontacted = firms.filter((f) => !f.contacted_by).length;
  return (
    <div className="space-y-4">
      {/* Owner filter — separates each rep's credit and the remaining list */}
      <div className="flex gap-1.5">
        {([['all', `All (${firms.length})`], ['mine', `Mine (${mineCount})`], ['uncontacted', `To contact (${uncontacted})`]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setOwner(key)} className={`flex-1 rounded-[10px] border px-2 py-2 text-[12px] font-semibold transition ${owner === key ? 'border-[#6D4AFF] bg-[#6D4AFF] text-white' : 'border-[#E7E1FF] text-[#1E1B4B]/60 hover:border-[#B8A8FF]'}`}>
            {label}
          </button>
        ))}
      </div>
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
        <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No firms match this filter.</p>
      ) : (
        <div className="space-y-3">{filtered.map((f) => <FirmCard key={f.id} firm={f} onLog={onLog} today={todayISO()} onQuickEmail={onQuickEmail} userId={claim?.userId ?? userId} onClaim={claim?.onClaim} onRelease={claim?.onRelease} />)}</div>
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

  const mins = avgMinutesSaved(firms);

  const creditByRep = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of firms) {
      if (f.contacted_by_name) m.set(f.contacted_by_name, (m.get(f.contacted_by_name) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [firms]);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Firms contacted — credit by rep</h2>
        <div className="rounded-[14px] border border-[#E7E1FF] bg-white p-4">
          {creditByRep.length === 0 ? (
            <p className="text-[13px] text-[#1E1B4B]/45">No firms contacted yet. Logging a firm credits the rep who logged it first.</p>
          ) : (
            <div className="space-y-2">
              {creditByRep.map(([name, n]) => (
                <div key={name} className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-[#1E1B4B]">{name}</span>
                  <span className="rounded-full bg-[#EDE7FF] px-2.5 py-0.5 text-[12px] font-bold text-[#6D4AFF]">{n} firm{n === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-[14px] font-bold">Time saved (the value claim)</h2>
        <div className="rounded-[14px] border border-[#DCD3FF] bg-[#F7F3FF] p-4">
          {mins.n > 0 ? (
            <>
              <div className="text-[28px] font-black leading-none text-[#6D4AFF]">{mins.avg} min</div>
              <div className="mt-1 text-[12px] text-[#1E1B4B]/60">avg attorney time saved per intake — firm estimate · n={mins.n} firm{mins.n === 1 ? '' : 's'}</div>
            </>
          ) : (
            <div className="text-[12px] leading-relaxed text-[#1E1B4B]/55">No estimates yet. On a demo, ask the firm how long assembling a worker's records takes them today, and log it in the "minutes saved" field — that's the number you quote on every call.</div>
          )}
        </div>
      </section>
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
    <div className="space-y-3">
      <Collapsible title="Call script" defaultOpen>
        <div className="space-y-3">
          {CRM_CALL_SCRIPT.map((s) => (
            <div key={s.step}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#6D4AFF]">{s.step}</div>
              <p className="text-[14px] leading-relaxed text-[#1E1B4B]/75">{s.text}</p>
            </div>
          ))}
        </div>
      </Collapsible>
      <Collapsible title="Objections (5)">
        <div className="space-y-3">
          {CRM_OBJECTIONS.map((o) => (
            <div key={o.objection}>
              <div className="mb-1 text-[13px] font-bold text-[#1E1B4B]">{o.objection}</div>
              <p className="text-[13px] leading-relaxed text-[#1E1B4B]/65">{o.response}</p>
            </div>
          ))}
        </div>
      </Collapsible>
      <Collapsible title="Cold email sequence (free pilot · 3-touch)">
        <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#1E1B4B]/75">{CRM_COLD_EMAIL}</pre>
      </Collapsible>
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
    const unsub = subscribeTeamMessages(() => { if (active) void load(); }); // real-time
    const iv = setInterval(() => { if (active) void load(); }, 30000); // slow fallback
    return () => { active = false; unsub(); clearInterval(iv); };
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

// ── Inbox: private 1:1 direct messages between CRM members ────────────────────
function InboxTab({ onReadChange }: { onReadChange?: () => void }) {
  const [me, setMe] = useState<{ id: string | null; name: string }>({ id: null, name: 'Member' });
  const [members, setMembers] = useState<CrmMember[]>([]);
  const [messages, setMessages] = useState<CrmDirectMessage[]>([]);
  const [selected, setSelected] = useState<CrmMember | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMsgs = async () => { const r = await listMyDirectMessages(); if (!r.error) setMessages(r.data); };

  useEffect(() => {
    let active = true;
    void (async () => {
      const m = await getCurrentMember();
      if (!active) return;
      setMe(m);
      const mem = await listCrmMembers();
      // Normalize so name is never null (avoids .slice/.localeCompare crashes downstream).
      if (active && !mem.error) setMembers(mem.data.map((x) => ({ ...x, name: x.name || x.email || 'Member' })));
      await loadMsgs();
    })();
    const unsub = subscribeDirectMessages(() => { if (active) void loadMsgs(); });
    const iv = window.setInterval(() => { if (active) void loadMsgs(); }, 30000);
    return () => { active = false; unsub(); window.clearInterval(iv); };
  }, []);

  const threadWith = (otherId: string) =>
    messages.filter((m) => (m.sender_id === otherId && m.recipient_id === me.id) || (m.sender_id === me.id && m.recipient_id === otherId));
  const lastMsg = (otherId: string) => { const t = threadWith(otherId); return t.length ? t[t.length - 1] : null; };
  const unreadFrom = (otherId: string) => messages.filter((m) => m.sender_id === otherId && m.recipient_id === me.id && !m.read_at).length;

  // Mark the open thread read whenever it has unread messages (covers live arrivals).
  useEffect(() => {
    if (selected && unreadFrom(selected.id) > 0) {
      void (async () => { await markThreadRead(selected.id); await loadMsgs(); onReadChange?.(); })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, selected]);

  useEffect(() => { if (selected) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, selected]);

  const openThread = async (member: CrmMember) => {
    setSelected(member);
    await markThreadRead(member.id);
    await loadMsgs();
    onReadChange?.();
  };

  const send = async () => {
    if (!selected || !body.trim()) return;
    setSending(true); setErr('');
    const r = await sendDirectMessage({ recipientId: selected.id, recipientName: selected.name, body });
    setSending(false);
    if (r.error) { setErr(r.error); return; }
    setBody('');
    await loadMsgs();
  };

  const others = members.filter((m) => m.id !== me.id);

  if (!selected) {
    const sorted = [...others].sort((a, b) => {
      const la = lastMsg(a.id)?.created_at ?? ''; const lb = lastMsg(b.id)?.created_at ?? '';
      return lb.localeCompare(la) || a.name.localeCompare(b.name);
    });
    return (
      <div>
        <p className="mb-3 text-[12px] leading-relaxed text-[#1E1B4B]/55">Inbox — private 1:1 messages with a teammate. Only you two see these.</p>
        <div className="space-y-2">
          {sorted.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[#1E1B4B]/40">No teammates to message yet.</p>
          ) : sorted.map((m) => {
            const last = lastMsg(m.id); const unread = unreadFrom(m.id);
            return (
              <button key={m.id} type="button" onClick={() => openThread(m)} className={`flex ${tap} w-full items-center gap-3 rounded-[12px] border border-[#E7E1FF] bg-white px-3 text-left`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-[13px] font-bold text-[#6D4AFF]">{m.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <span className="truncate text-[14px] font-semibold">{m.name}{m.is_founder && <span className="ml-1 text-[10px] font-bold text-[#6D4AFF]">· Founder</span>}</span>
                  <p className="truncate text-[12px] text-[#1E1B4B]/50">{last ? (last.sender_id === me.id ? 'You: ' : '') + last.body : 'Start a conversation'}</p>
                </div>
                {unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{unread}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const thread = threadWith(selected.id);
  return (
    <div className="flex flex-col" style={{ minHeight: '62vh' }}>
      <button type="button" onClick={() => setSelected(null)} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#6D4AFF]"><ArrowLeft className="h-4 w-4" /> Inbox</button>
      <div className="mb-2 text-[14px] font-bold">{selected.name}{selected.is_founder && <span className="ml-1 text-[11px] font-semibold text-[#6D4AFF]">· Founder</span>}</div>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-[12px] border border-[#E7E1FF] bg-white p-3">
        {thread.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#1E1B4B]/40">No messages yet. Say hi 👋</p>
        ) : thread.map((m) => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-[14px] px-3.5 py-2 ${mine ? 'bg-[#6D4AFF] text-white' : 'bg-[#F3EFFF] text-[#1E1B4B]'}`}>
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</div>
                <div className={`mt-0.5 text-[10px] ${mine ? 'text-white/60' : 'text-[#1E1B4B]/40'}`}>{new Date(m.created_at).toLocaleString()}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
      <div className="mt-2 flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Message ${selected.name}… (Ctrl/⌘+Enter to send)`}
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

// ── Shared team notes board ──────────────────────────────────────────────────
function NotesTab({ isFounder }: { isFounder: boolean }) {
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [me, setMe] = useState<{ id: string | null; name: string }>({ id: null, name: 'Member' });
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => { const r = await listNotes(); if (!r.error) setNotes(r.data); };
  useEffect(() => { void (async () => { setMe(await getCurrentMember()); await load(); })(); }, []);

  const post = async () => {
    if (!body.trim()) return;
    setBusy(true); setErr('');
    const r = await addNote(body, me.name);
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setBody(''); await load();
  };

  const remove = async (id: string) => {
    const r = await deleteNote(id);
    if (r.error) { setErr(r.error); return; }
    void load();
  };

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-[#1E1B4B]/55">
        Shared team notes — tips, reminders, what’s working. Everyone on the team sees these.
      </p>
      <div className="rounded-[12px] border border-[#E7E1FF] bg-white p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note for the team…"
          rows={3}
          className="w-full rounded-[10px] border border-[#E7E1FF] px-3 py-2.5 text-sm outline-none focus:border-[#6D4AFF]"
        />
        {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
        <button type="button" onClick={post} disabled={busy || !body.trim()} className={`mt-2 flex ${tap} w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] font-semibold text-white disabled:opacity-40`}>
          <Plus className="h-4 w-4" /> {busy ? 'Posting…' : 'Add note'}
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-[12px] border border-[#E7E1FF] bg-white px-4 py-3 text-[13px] text-[#1E1B4B]/45">No notes yet. Add the first one.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const canDelete = isFounder || (!!me.id && n.author_id === me.id);
            return (
              <div key={n.id} className="rounded-[12px] border border-[#E7E1FF] bg-white p-3.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[#6D4AFF]">{n.author_name || 'Member'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#1E1B4B]/40">{new Date(n.created_at).toLocaleString()}</span>
                    {canDelete && (
                      <button type="button" onClick={() => remove(n.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-[#1E1B4B]/35 hover:bg-red-50 hover:text-red-500" aria-label="Delete note">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#1E1B4B]/80">{n.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Ask one3seven AI (founder + reps) ────────────────────────────────────────
function AskAITab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    const res = await askAssistant(next);
    setLoading(false);
    const reply =
      res.status === 401 ? 'Session expired — please sign in again.'
      : res.error || res.content === undefined ? 'Something went wrong. Try again or ask Victoria.'
      : (res.content || '');
    setMessages((m) => [...m, { role: 'assistant', content: reply }]);
  };

  return (
    <div className="flex flex-col" style={{ minHeight: '64vh' }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed text-[#1E1B4B]/55">Internal sales assistant — product, pitch, objections. Not legal advice.</p>
        {messages.length > 0 && (
          <button type="button" onClick={() => setMessages([])} className="shrink-0 text-[12px] font-semibold text-[#6D4AFF] hover:underline">Clear conversation</button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-[12px] border border-[#E7E1FF] bg-white p-3">
        {messages.length === 0 ? (
          <div className="space-y-2 py-6">
            <p className="px-1 text-[13px] font-semibold text-[#1E1B4B]/70">Ask anything about selling one3seven:</p>
            {STARTER_QUESTIONS.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="block w-full rounded-[12px] border border-[#E7E1FF] bg-[#FAFAFF] px-3 py-2.5 text-left text-[13px] text-[#1E1B4B] transition hover:border-[#C9BEF5]">
                {q}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-[14px] px-3.5 py-2 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-[#5B21B6] text-white' : 'bg-[#F3EFFF] text-[#1E1B4B]'}`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-[14px] bg-[#F3EFFF] px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#6D4AFF]/50" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#6D4AFF]/50" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#6D4AFF]/50" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          placeholder="Ask the assistant…"
          className="flex-1 rounded-[12px] border border-[#E7E1FF] px-3 py-2.5 text-sm outline-none focus:border-[#6D4AFF]"
        />
        <button type="button" onClick={() => send(input)} disabled={loading || !input.trim()} className={`flex ${tap} shrink-0 items-center gap-1.5 rounded-full bg-[#6D4AFF] px-5 font-semibold text-white disabled:opacity-40`}>
          <Send className="h-4 w-4" /> Send
        </button>
      </div>
    </div>
  );
}

// ── Daily audit (founder-only) ───────────────────────────────────────────────
type AuditState = 'pass' | 'fail' | 'warn' | 'checking' | null;

function AuditPill({ state }: { state: AuditState }) {
  if (state === 'checking') return <span className="text-[11px] font-bold text-[#1E1B4B]/40">checking…</span>;
  if (state === 'pass') return <span className="flex items-center gap-1 text-[12px] font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Pass</span>;
  if (state === 'fail') return <span className="flex items-center gap-1 text-[12px] font-bold text-red-600"><X className="h-4 w-4" /> Fail</span>;
  if (state === 'warn') return <span className="flex items-center gap-1 text-[12px] font-bold text-amber-600"><AlertTriangle className="h-4 w-4" /> Warn</span>;
  return <span className="text-[11px] text-[#1E1B4B]/30">—</span>;
}

function AuditTab() {
  const MKEY = 'o3s_audit_manual_v1';
  const HKEY = 'o3s_audit_history_v1';
  const [site, setSite] = useState<Record<string, AuditState>>({});
  const [crm, setCrm] = useState<{ id: string; label: string; state: AuditState; detail: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [manual, setManual] = useState<Record<string, AuditState>>(() => {
    try { return JSON.parse(localStorage.getItem(MKEY) || '{}'); } catch { return {}; }
  });
  const [history, setHistory] = useState<{ ts: string; site: string; crm: string; manual: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch { return []; }
  });

  const setManualState = (id: string, s: AuditState) => {
    setManual((prev) => { const n = { ...prev, [id]: s }; try { localStorage.setItem(MKEY, JSON.stringify(n)); } catch {} return n; });
  };

  const runAudit = async () => {
    setRunning(true);
    // Site checks (relative URLs → the origin you're on, i.e. production at one3seven.com).
    const siteStart: Record<string, AuditState> = {};
    AUDIT_SITE_CHECKS.forEach((c) => { siteStart[c.id] = 'checking'; });
    setSite(siteStart);
    const siteResults: Record<string, AuditState> = {};
    await Promise.all(AUDIT_SITE_CHECKS.map(async (c) => {
      try { const r = await fetch(c.path, { method: 'GET', cache: 'no-store' }); siteResults[c.id] = r.ok ? 'pass' : 'fail'; }
      catch { siteResults[c.id] = 'fail'; }
    }));
    setSite(siteResults);

    // CRM checks.
    const crmChecks: { id: string; label: string; state: AuditState; detail: string }[] = [];
    const f = await listFirms();
    if (f.error) {
      crmChecks.push({ id: 'storage', label: 'CRM storage reachable', state: 'fail', detail: f.error });
      crmChecks.push({ id: 'firms', label: 'Firms in pipeline', state: 'fail', detail: '—' });
      crmChecks.push({ id: 'followups', label: 'Follow-up dates set', state: 'fail', detail: '—' });
    } else {
      const firms = f.data;
      crmChecks.push({ id: 'storage', label: 'CRM storage reachable', state: 'pass', detail: 'Supabase responding' });
      crmChecks.push({ id: 'firms', label: 'Firms in pipeline', state: firms.length > 0 ? 'pass' : 'warn', detail: `${firms.length} firms` });
      const withFollowup = firms.filter((x) => x.next_followup).length;
      crmChecks.push({ id: 'followups', label: 'Follow-up dates set', state: withFollowup > 0 ? 'pass' : 'warn', detail: `${withFollowup} with a date` });
    }
    const a = await listActivity();
    crmChecks.push({ id: 'activity', label: 'Activity logs written', state: a.error ? 'fail' : (a.data.length > 0 ? 'pass' : 'warn'), detail: a.error ? a.error : `${a.data.length} entries` });
    setCrm(crmChecks);

    // Snapshot to history.
    const sitePass = Object.values(siteResults).filter((s) => s === 'pass').length;
    const crmPass = crmChecks.filter((c) => c.state === 'pass').length;
    const mp = Object.values(manual).filter((s) => s === 'pass').length;
    const mf = Object.values(manual).filter((s) => s === 'fail').length;
    const mw = Object.values(manual).filter((s) => s === 'warn').length;
    const entry = {
      ts: new Date().toLocaleString(),
      site: `${sitePass}/${AUDIT_SITE_CHECKS.length}`,
      crm: `${crmPass}/${crmChecks.length}`,
      manual: `${mp}P · ${mf}F · ${mw}W`,
    };
    setHistory((prev) => { const n = [entry, ...prev].slice(0, 7); try { localStorage.setItem(HKEY, JSON.stringify(n)); } catch {} return n; });
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={runAudit} disabled={running} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#6D4AFF] font-semibold text-white transition hover:bg-[#5B35D5] disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} /> {running ? 'Running audit…' : 'Run audit'}
      </button>
      <p className="text-[12px] leading-relaxed text-[#1E1B4B]/55">
        Morning routine: run this first. If anything automated is red, fix it before any outreach goes out. Then rotate through a few manual checks.
      </p>

      <Collapsible title="Website checks (automated)" defaultOpen>
        <div className="space-y-1.5">
          {AUDIT_SITE_CHECKS.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-[10px] border border-[#F0EBFF] px-3 py-2">
              <span className="text-[13px] text-[#1E1B4B]">{c.label} <span className="text-[#1E1B4B]/35">{c.path}</span></span>
              <AuditPill state={site[c.id] ?? null} />
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="CRM checks (automated)" defaultOpen>
        {crm.length === 0 ? (
          <p className="text-[12px] text-[#1E1B4B]/40">Run the audit to populate.</p>
        ) : (
          <div className="space-y-1.5">
            {crm.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-[10px] border border-[#F0EBFF] px-3 py-2">
                <span className="text-[13px] text-[#1E1B4B]">{c.label} <span className="text-[#1E1B4B]/35">{c.detail}</span></span>
                <AuditPill state={c.state} />
              </div>
            ))}
          </div>
        )}
      </Collapsible>

      {AUDIT_MANUAL_GROUPS.map((g) => (
        <Collapsible key={g.group} title={`${g.group} (manual)`}>
          <div className="space-y-2">
            {g.items.map((item) => (
              <div key={item.id} className="rounded-[10px] border border-[#F0EBFF] px-3 py-2.5">
                <div className="mb-1.5 text-[13px] text-[#1E1B4B]">{item.label}</div>
                <div className="flex gap-1.5">
                  {(['pass', 'warn', 'fail'] as const).map((s) => {
                    const active = manual[item.id] === s;
                    const styles = {
                      pass: { on: 'bg-emerald-500 text-white', off: 'bg-emerald-50 text-emerald-700' },
                      warn: { on: 'bg-amber-500 text-white', off: 'bg-amber-50 text-amber-700' },
                      fail: { on: 'bg-red-500 text-white', off: 'bg-red-50 text-red-700' },
                    }[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setManualState(item.id, active ? null : s)}
                        className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize transition ${active ? styles.on : styles.off}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
      ))}

      <Collapsible title="Audit history (last 7 runs)">
        {history.length === 0 ? (
          <p className="text-[12px] text-[#1E1B4B]/40">No runs yet. Hit “Run audit” to start your history.</p>
        ) : (
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#F0EBFF] px-3 py-2 text-[12px]">
                <span className="text-[#1E1B4B]/55">{h.ts}</span>
                <span className="text-[#1E1B4B]/75">Site {h.site} · CRM {h.crm} · Manual {h.manual}</span>
              </div>
            ))}
          </div>
        )}
      </Collapsible>
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
    <div className="space-y-3">
      <Collapsible title="🔥 Fire demo — how to run it" defaultOpen>
        <p className="mb-3 text-[13px] leading-relaxed text-[#1E1B4B]/65">{FIRE_DEMO_TRAINING.intro}</p>
        <a href={`https://${FIRE_DEMO_TRAINING.link}`} target="_blank" rel="noreferrer" className="mb-3 inline-block text-[13px] font-semibold text-[#6D4AFF] hover:underline">
          {FIRE_DEMO_TRAINING.link} ↗
        </a>
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
      </Collapsible>

      <Collapsible title="⚠️ PI & scope rules — do not break these">
        <div className="space-y-2.5">
          {PI_RULES.map((r) => (
            <div key={r.rule} className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5">
              <div className="mb-0.5 text-[13px] font-bold text-amber-900">{r.rule}</div>
              <p className="text-[13px] leading-relaxed text-amber-900/75">{r.detail}</p>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="💵 Subscription tiers — what firms pay">
        <div className="space-y-2">
          {CRM_SUBSCRIPTION_TIERS.map((t) => (
            <div key={t.tier} className="flex items-center justify-between gap-3 rounded-[10px] border border-[#E7E1FF] bg-white px-3 py-2.5">
              <div>
                <div className="text-[13px] font-bold text-[#1E1B4B]">{t.tier}</div>
                <div className="text-[11px] text-[#1E1B4B]/55">{t.detail}</div>
              </div>
              <div className="shrink-0 text-[13px] font-bold text-[#6D4AFF]">{t.price}</div>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title={CRM_COMMISSIONS.headline}>
        <p className="mb-3 text-[13px] leading-relaxed text-[#1E1B4B]/65">{CRM_COMMISSIONS.intro}</p>

        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6D4AFF]">Your commission by tier (20%)</div>
        <div className="mb-4 overflow-hidden rounded-[12px] border border-[#E7E1FF]">
          {CRM_COMMISSIONS.perTier.map((r, i) => (
            <div key={r.tier} className={`flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] ${i > 0 ? 'border-t border-[#F0EBFF]' : ''}`}>
              <span className="font-bold text-[#1E1B4B]">{r.tier} <span className="font-normal text-[#1E1B4B]/45">{r.price}</span></span>
              <span className="text-right"><span className="font-bold text-[#6D4AFF]">{r.perMo}</span> <span className="text-[#1E1B4B]/45">· {r.perYr}</span></span>
            </div>
          ))}
        </div>

        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6D4AFF]">How it compounds as you build your book</div>
        <div className="mb-4 overflow-hidden rounded-[12px] border border-[#E7E1FF]">
          {CRM_COMMISSIONS.compounding.map((r, i) => (
            <div key={r.firms} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-[#F0EBFF]' : ''}`}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-bold text-[#1E1B4B]">{r.firms}</span>
                <span><span className="font-bold text-[#6D4AFF]">{r.mo}/mo</span> <span className="text-[#1E1B4B]/45">· {r.yr}/yr</span></span>
              </div>
              <div className="text-[11px] text-[#1E1B4B]/50">{r.mix}</div>
            </div>
          ))}
        </div>

        <ul className="mb-3 space-y-1.5">
          {CRM_COMMISSIONS.terms.map((l) => (
            <li key={l} className="flex gap-2 text-[13px] leading-relaxed text-[#1E1B4B]/75"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B6DFF]" /><span>{l}</span></li>
          ))}
        </ul>

        <div className="mb-3 rounded-[10px] border border-[#E7E1FF] bg-[#FAFAFF] p-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#1E1B4B]/45">Not offered at this stage</div>
          <div className="text-[12px] text-[#1E1B4B]/60">{CRM_COMMISSIONS.notOffered.join(' · ')}</div>
        </div>

        <p className="rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">{CRM_COMMISSIONS.note}</p>
      </Collapsible>

      <div className="rounded-[12px] border border-[#E7E1FF] bg-white p-3.5 text-[13px] leading-relaxed text-[#1E1B4B]/70">
        To contact one3seven, email <a href="mailto:info@one3seven.com" className="font-semibold text-[#6D4AFF] hover:underline">info@one3seven.com</a>.
      </div>
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
  const [minutesSaved, setMinutesSaved] = useState('');
  const set = (patch: Partial<LogActivityInput>) => setL((p) => ({ ...p, ...patch }));
  const submit = async () => {
    if (!l.firm_id) { setError('Pick a firm.'); return; }
    setSaving(true);
    const r = await logActivity(l);
    if (!r.error) {
      const m = parseInt(minutesSaved, 10);
      if (Number.isFinite(m) && m >= 0) await setFirmMinutesSaved(l.firm_id, m);
    }
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    setOk(true); onSaved(l.firm_id);
    setL({ firm_id: l.firm_id, activity_type: 'call', activity_date: todayISO() });
    setMinutesSaved('');
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
      <input className={inputCls} type="number" min="0" placeholder="Minutes saved per intake (firm's estimate)" value={minutesSaved} onChange={(e) => setMinutesSaved(e.target.value)} />
      <label className="block text-[12px] font-semibold text-[#1E1B4B]/45">Next follow-up</label>
      <input className={inputCls} type="date" value={l.next_followup ?? ''} onChange={(e) => set({ next_followup: e.target.value })} />
      <textarea className="min-h-[64px] w-full rounded-[12px] border border-[#E7E1FF] px-3 py-2.5 text-sm outline-none focus:border-[#6D4AFF]" placeholder="Notes" value={l.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      <button type="button" onClick={submit} disabled={saving} className={`flex ${tap} w-full items-center justify-center rounded-full bg-[#6D4AFF] font-semibold text-white disabled:opacity-40`}>{saving ? 'Saving…' : 'Log activity'}</button>
    </div>
  );
}
