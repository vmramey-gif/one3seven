import { useEffect, useState } from 'react';
import { Plus, Trash2, BellRing, Check } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useLang } from '../../i18n/i18n';
import {
  loadReminders,
  saveReminders,
  SUGGESTED_REMINDER_KEYS,
  type WorkerReminder,
} from '../../services/workerReminders';

/**
 * Worker-owned "what's mine to do" reminders. The worker owns their journey, so they own the
 * checklist: upload records, an expert appointment, send a form back. one3seven ORGANIZES these —
 * it NEVER computes a legal deadline (SOL / filing window); any date is what the worker typed.
 * Firm-authored reminders (source: 'firm') render with a small "from your firm" tag. Bilingual.
 */

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

const inputCls =
  'w-full rounded-xl border border-[#D3DED6] bg-white px-3.5 py-2.5 text-[14px] text-[#17181C] placeholder:text-[#9aa39b] focus:border-[#42574E] focus:outline-none focus:ring-4 focus:ring-[#42574E]/15';

export function RemindersCard({ intakeId }: { intakeId: string | null }) {
  const { t } = useLang();
  const [reminders, setReminders] = useState<WorkerReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ text: '', dueDate: '' });

  useEffect(() => {
    void (async () => {
      if (!intakeId || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await loadReminders(intakeId);
      if (res.error) setErr(res.error);
      setReminders(res.reminders);
      setLoading(false);
    })();
  }, [intakeId]);

  const persist = async (next: WorkerReminder[]) => {
    setReminders(next);
    if (!intakeId) return;
    setSaving(true);
    setErr(null);
    const res = await saveReminders(intakeId, next);
    if (res.error) setErr(res.error);
    setSaving(false);
  };

  const addReminder = async (text: string, dueDate?: string) => {
    const clean = text.trim();
    if (!clean) return;
    const reminder: WorkerReminder = {
      id: crypto.randomUUID(),
      text: clean,
      dueDate: dueDate?.trim() || undefined,
      source: 'worker',
      done: false,
      createdAt: new Date().toISOString(),
    };
    setForm({ text: '', dueDate: '' });
    setShowForm(false);
    await persist([reminder, ...reminders]);
  };

  const toggleDone = (id: string) =>
    void persist(reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));

  // Suggested one-tap reminders the worker hasn't added yet (matched by their resolved text).
  const suggestions = SUGGESTED_REMINDER_KEYS.map((k) => t(`rem.suggest.${k}`)).filter(
    (label) => !reminders.some((r) => r.text.toLowerCase() === label.toLowerCase())
  );

  const open = reminders.filter((r) => !r.done);
  const done = reminders.filter((r) => r.done);
  const ordered = [...open, ...done];

  return (
    <section style={BODY} className="rounded-[22px] border border-[#CBD6CF] bg-white/80 p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div style={MONO} className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#42574E]">
            <BellRing className="h-3.5 w-3.5" /> {t('rem.eyebrow')}
          </div>
          <h3 style={SERIF} className="text-[20px] font-semibold tracking-[-0.01em] text-[#17181C]">{t('rem.title')}</h3>
          <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-[#5a5f58]">{t('rem.desc')}</p>
        </div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex flex-none items-center gap-1.5 rounded-full bg-[var(--o3s-action)] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-95"
          >
            <Plus className="h-4 w-4" /> {t('rem.add')}
          </button>
        ) : null}
      </div>

      {/* One-tap suggestions — all pure logistics, never a computed deadline. */}
      {suggestions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => void addReminder(label)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#CBD6CF] bg-[#FBFBFA] px-3.5 py-2 text-[12.5px] font-medium text-[#42574E] transition hover:bg-[#EEF3EF]"
            >
              <Plus className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="mt-4 rounded-[16px] border border-[#E4E5DE] bg-[#FBFBFA] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('rem.what')}</span>
              <input value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder={t('rem.what.ph')} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('rem.when')}</span>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
            </label>
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void addReminder(form.text, form.dueDate)}
              disabled={!form.text.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--o3s-action)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
            >
              {t('rem.save')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full px-4 py-2.5 text-[13.5px] font-medium text-[#6a6d66] transition hover:text-[#17181C]">
              {t('rem.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {err ? <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">{err}</p> : null}

      <div className="mt-4">
        {loading ? (
          <p className="text-[13px] text-[#8a938c]">{t('rem.loading')}</p>
        ) : reminders.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#CBD6CF] bg-[#FBFBFA] px-4 py-5 text-center text-[13px] text-[#6a6d66]">
            {t('rem.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ordered.map((r) => (
              <li key={r.id} className={`flex items-start gap-3 rounded-[14px] border px-4 py-3 ${r.done ? 'border-[#E4E5DE] bg-[#F4F6F1]' : 'border-[#E4E5DE] bg-[#FBFBFA]'}`}>
                <button
                  type="button"
                  onClick={() => toggleDone(r.id)}
                  aria-label={r.done ? t('rem.markUndone') : t('rem.markDone')}
                  className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border transition ${r.done ? 'border-[#42574E] bg-[#42574E] text-white' : 'border-[#C6D0C8] bg-white hover:border-[#42574E]'}`}
                >
                  {r.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-[14px] ${r.done ? 'text-[#8a8f88] line-through' : 'font-medium text-[#20242a]'}`}>{r.text}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {r.dueDate ? <span style={MONO} className="text-[11.5px] text-[#42574E]">{r.dueDate}</span> : null}
                    {r.source === 'firm' ? (
                      <span className="rounded-full border border-[#CBD6CF] bg-[#EEF3EF] px-2 py-0.5 text-[10.5px] font-medium text-[#42574E]">{t('rem.fromFirm')}</span>
                    ) : null}
                  </div>
                </div>
                <button type="button" onClick={() => void persist(reminders.filter((x) => x.id !== r.id))} aria-label={t('rem.remove')} className="mt-0.5 flex-none text-[#b6bbb2] transition hover:text-[#A8512B]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 border-t border-[#EEF0EA] pt-3 text-[11.5px] leading-relaxed text-[#8a8f88]">
        {t('rem.disclaimer')}{saving ? ` · ${t('rem.saving')}` : ''}
      </p>
    </section>
  );
}
