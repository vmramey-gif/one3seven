import { useEffect, useState } from 'react';
import { Plus, Trash2, Briefcase } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useLang } from '../../i18n/i18n';
import {
  loadMitigationLog,
  saveMitigationLog,
  type MitigationLogEntry,
  type MitigationOutcome,
} from '../../services/mitigationLog';

/**
 * Worker-owned job-search (mitigation) log. Encourage, never score. one3seven records where the
 * worker applied and what happened — it does NOT judge whether the search is "enough" (that's the
 * firm's call, and a "report card" would be an anxiety engine). Worker-first surface: warm, calm,
 * theirs. Bilingual via i18n (this audience skews Spanish-preferring).
 */

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

const OUTCOMES: MitigationOutcome[] = ['applied', 'interview', 'offer', 'hired', 'declined', 'no_response'];

const inputCls =
  'w-full rounded-xl border border-[#D3DED6] bg-white px-3.5 py-2.5 text-[14px] text-[#17181C] placeholder:text-[#9aa39b] focus:border-[#42574E] focus:outline-none focus:ring-4 focus:ring-[#42574E]/15';

export function MitigationLogCard({ intakeId }: { intakeId: string | null }) {
  const { t } = useLang();
  const [entries, setEntries] = useState<MitigationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', employer: '', role: '', outcome: 'applied' as MitigationOutcome, notes: '' });

  const outcomeLabel = (o: MitigationOutcome) => t(`ml.outcome.${o}`);

  useEffect(() => {
    void (async () => {
      if (!intakeId || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await loadMitigationLog(intakeId);
      if (res.error) setErr(res.error);
      setEntries(res.entries);
      setLoading(false);
    })();
  }, [intakeId]);

  const persist = async (next: MitigationLogEntry[]): Promise<boolean> => {
    if (!intakeId) {
      // No backend to persist to yet — reflect the edit locally rather than silently no-op,
      // but there's nothing durable to roll back to if this path is ever reached.
      setEntries(next);
      return true;
    }
    setSaving(true);
    setErr(null);
    const res = await saveMitigationLog(intakeId, next);
    setSaving(false);
    if (res.error) {
      // Don't update `entries` on failure — the list stays exactly as it was before this
      // edit, so what's on screen always matches what's actually saved.
      setErr(res.error);
      return false;
    }
    setEntries(next);
    return true;
  };

  const canAdd = form.date.trim() && form.employer.trim() && form.role.trim();

  const addEntry = async () => {
    if (!canAdd) return;
    const entry: MitigationLogEntry = {
      id: crypto.randomUUID(),
      date: form.date.trim(),
      employer: form.employer.trim(),
      role: form.role.trim(),
      outcome: form.outcome,
      notes: form.notes.trim() || undefined,
      loggedAt: new Date().toISOString(),
    };
    const next = [entry, ...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const ok = await persist(next);
    // Only clear the form on real success — a failed save keeps what the worker typed on
    // screen instead of making them re-enter it after already seeing an error.
    if (ok) {
      setForm({ date: '', employer: '', role: '', outcome: 'applied', notes: '' });
      setShowForm(false);
    }
  };

  return (
    <section style={BODY} className="rounded-[22px] border border-[#CBD6CF] bg-white/80 p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div style={MONO} className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#42574E]">
            <Briefcase className="h-3.5 w-3.5" /> {t('ml.eyebrow')}
          </div>
          <h3 style={SERIF} className="text-[20px] font-semibold tracking-[-0.01em] text-[#17181C]">{t('ml.title')}</h3>
          <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-[#5a5f58]">{t('ml.desc')}</p>
        </div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex flex-none items-center gap-1.5 rounded-full bg-[var(--o3s-action)] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-95"
          >
            <Plus className="h-4 w-4" /> {t('ml.add')}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div className="mt-4 rounded-[16px] border border-[#E4E5DE] bg-[#FBFBFA] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('ml.date')}</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('ml.happened')}</span>
              <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value as MitigationOutcome })} className={inputCls}>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>{outcomeLabel(o)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('ml.employer')}</span>
              <input value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} placeholder={t('ml.employer.ph')} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('ml.role')}</span>
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder={t('ml.role.ph')} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('ml.notes')}</span>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('ml.notes.ph')} className={inputCls} />
            </label>
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={addEntry}
              disabled={!canAdd}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--o3s-action)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
            >
              {t('ml.save')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full px-4 py-2.5 text-[13.5px] font-medium text-[#6a6d66] transition hover:text-[#17181C]">
              {t('ml.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {err ? <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">{err}</p> : null}

      <div className="mt-4">
        {loading ? (
          <p className="text-[13px] text-[#8a938c]">{t('ml.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#CBD6CF] bg-[#FBFBFA] px-4 py-5 text-center text-[13px] text-[#6a6d66]">
            {t('ml.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 rounded-[14px] border border-[#E4E5DE] bg-[#FBFBFA] px-4 py-3">
                <span style={MONO} className="mt-0.5 w-[86px] flex-none text-[11.5px] text-[#42574E]">{e.date}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-[#20242a]">{e.employer}</div>
                  <div className="text-[12.5px] text-[#5a5f58]">{e.role}</div>
                  {e.notes ? <div className="mt-0.5 text-[12px] leading-snug text-[#7a7f78]">{e.notes}</div> : null}
                </div>
                <span className="mt-0.5 flex-none rounded-full border border-[#CBD6CF] bg-[#EEF3EF] px-2.5 py-1 text-[11px] font-medium text-[#42574E]">
                  {outcomeLabel(e.outcome)}
                </span>
                <button type="button" onClick={() => void persist(entries.filter((x) => x.id !== e.id))} aria-label={t('ml.remove')} className="mt-0.5 flex-none text-[#b6bbb2] transition hover:text-[#A8512B]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 border-t border-[#EEF0EA] pt-3 text-[11.5px] leading-relaxed text-[#8a8f88]">
        {t('ml.disclaimer')}{saving ? ` · ${t('ml.saving')}` : ''}
      </p>
    </section>
  );
}
