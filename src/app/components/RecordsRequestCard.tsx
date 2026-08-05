import { useEffect, useState } from 'react';
import { FileText, Mail, Copy, Check, Trash2 } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useLang } from '../../i18n/i18n';
import {
  loadRecordsRequests,
  saveRecordsRequests,
  RECORD_TYPES,
  type RecordType,
  type RecordsRequestEntry,
} from '../../services/recordsRequest';

/**
 * Records-request card. The worker requests copies of THEIR OWN records; one3seven composes the
 * plain-language request and keeps a dated log — the WORKER sends it from their own email
 * (mailto / copy). one3seven is the composer + record-keeper, never the sender/agent. Bilingual.
 */

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;
const BODY = { fontFamily: '"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif' } as const;

const inputCls =
  'w-full rounded-xl border border-[#D3DED6] bg-white px-3.5 py-2.5 text-[14px] text-[#17181C] placeholder:text-[#9aa39b] focus:border-[#42574E] focus:outline-none focus:ring-4 focus:ring-[#42574E]/15';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function RecordsRequestCard({ intakeId }: { intakeId: string | null }) {
  const { t } = useLang();
  const [entries, setEntries] = useState<RecordsRequestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<RecordType[]>([]);
  const [showSend, setShowSend] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [yourName, setYourName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!intakeId || !isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await loadRecordsRequests(intakeId);
      if (res.error) setErr(res.error);
      setEntries(res.entries);
      setLoading(false);
    })();
  }, [intakeId]);

  const persist = async (next: RecordsRequestEntry[]) => {
    setEntries(next);
    if (!intakeId) return;
    setSaving(true);
    setErr(null);
    const res = await saveRecordsRequests(intakeId, next);
    if (res.error) setErr(res.error);
    setSaving(false);
  };

  const toggle = (rt: RecordType) =>
    setSelected((s) => (s.includes(rt) ? s.filter((x) => x !== rt) : [...s, rt]));

  const requestBody =
    `${t('rr.body.intro')}\n\n` +
    selected.map((rt) => `- ${t(`rr.type.${rt}`)}`).join('\n') +
    `\n\n${t('rr.body.outro')}\n${yourName.trim()}`;

  const mailtoHref =
    `mailto:${recipient.trim()}?subject=${encodeURIComponent(t('rr.subject'))}&body=${encodeURIComponent(requestBody)}`;

  const ready = selected.length > 0 && recipient.trim().length > 0;

  // mailto: only opens if a desktop mail app is the default handler — dead for webmail users.
  // Offer Gmail / Outlook web compose (which reliably open a pre-filled draft) plus the mailto fallback.
  const openCompose = (kind: 'gmail' | 'outlook' | 'mailto') => {
    const to = recipient.trim();
    const subject = t('rr.subject');
    setShowSend(false);
    if (kind === 'gmail') {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(requestBody)}`, '_blank', 'noopener');
      return;
    }
    if (kind === 'outlook') {
      window.open(`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(requestBody)}`, '_blank', 'noopener');
      return;
    }
    window.location.href = mailtoHref;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requestBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the mailto path still works */
    }
  };

  const logSent = async () => {
    if (!ready) return;
    const entry: RecordsRequestEntry = {
      id: crypto.randomUUID(),
      recordTypes: [...selected],
      recipient: recipient.trim(),
      sentAt: new Date().toISOString(),
    };
    setSelected([]);
    await persist([entry, ...entries]);
  };

  const markReceived = (id: string) =>
    persist(entries.map((e) => (e.id === id ? { ...e, responseReceivedAt: new Date().toISOString() } : e)));

  return (
    <section style={BODY} className="rounded-[22px] border border-[#CBD6CF] bg-white/80 p-6 sm:p-7">
      <div style={MONO} className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#42574E]">
        <FileText className="h-3.5 w-3.5" /> {t('rr.eyebrow')}
      </div>
      <h3 style={SERIF} className="text-[20px] font-semibold tracking-[-0.01em] text-[#17181C]">{t('rr.title')}</h3>
      <p className="mt-1.5 max-w-[54ch] text-[13.5px] leading-relaxed text-[#5a5f58]">{t('rr.desc')}</p>

      {/* Pick record types */}
      <div className="mt-4 flex flex-col gap-2">
        {RECORD_TYPES.map((rt) => {
          const on = selected.includes(rt);
          return (
            <button
              key={rt}
              type="button"
              onClick={() => toggle(rt)}
              className={`flex items-center gap-2.5 rounded-[12px] border px-3.5 py-2.5 text-left text-[14px] transition ${
                on ? 'border-[#42574E] bg-[#EEF3EF] text-[#20242a]' : 'border-[#E4E5DE] bg-[#FBFBFA] text-[#3a3f38] hover:border-[#B7BCB2]'
              }`}
            >
              <span className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border ${on ? 'border-[#42574E] bg-[#42574E] text-white' : 'border-[#C6D0C8] bg-white'}`}>
                {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
              {t(`rr.type.${rt}`)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('rr.recipient')}</span>
          <input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t('rr.recipient.ph')} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a6d66]">{t('rr.yourname')}</span>
          <input value={yourName} onChange={(e) => setYourName(e.target.value)} placeholder={t('rr.yourname.ph')} className={inputCls} />
        </label>
      </div>

      {/* Live preview + send actions (worker sends it) */}
      {selected.length > 0 ? (
        <div className="mt-3 rounded-[16px] border border-[#E4E5DE] bg-[#FBFBFA] p-4">
          <div style={MONO} className="mb-2 text-[10.5px] uppercase tracking-[0.12em] text-[#6a6d66]">{t('rr.preview')}</div>
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[#20242a]">{requestBody}</pre>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                disabled={!ready}
                onClick={() => setShowSend((s) => !s)}
                className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white transition ${ready ? 'bg-[var(--o3s-action)] hover:brightness-95' : 'cursor-not-allowed bg-[#c9c4bb]'}`}
              >
                <Mail className="h-4 w-4" /> {t('rr.openEmail')}
              </button>
              {showSend && ready ? (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSend(false)} />
                  <div className="absolute left-0 z-20 mt-1 w-56 rounded-[12px] border border-[#E4E5DE] bg-white p-1 shadow-lg">
                    <button type="button" onClick={() => openCompose('gmail')} className="block w-full rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold text-[#22262a] hover:bg-[#F2F4EC]">Open in Gmail</button>
                    <button type="button" onClick={() => openCompose('outlook')} className="block w-full rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold text-[#22262a] hover:bg-[#F2F4EC]">Open in Outlook</button>
                    <button type="button" onClick={() => openCompose('mailto')} className="block w-full rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold text-[#22262a] hover:bg-[#F2F4EC]">Use my mail app</button>
                    <div className="px-3 py-1.5 text-[11px] leading-snug text-[#8a8f88]">Opens a pre-filled draft. Review it, then send it yourself.</div>
                  </div>
                </>
              ) : null}
            </div>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-[#B7BCB2] bg-white px-4 py-2.5 text-[13.5px] font-medium text-[#22262a] transition hover:bg-[#F2F4EC]">
              {copied ? <Check className="h-4 w-4 text-[#42574E]" /> : <Copy className="h-4 w-4" />} {copied ? t('rr.copied') : t('rr.copy')}
            </button>
            <button type="button" onClick={logSent} disabled={!ready} className="inline-flex items-center gap-1.5 rounded-full border border-[#42574E] px-4 py-2.5 text-[13.5px] font-semibold text-[#42574E] transition hover:bg-[#EEF3EF] disabled:opacity-50">
              {t('rr.markSent')}
            </button>
          </div>
        </div>
      ) : null}

      {err ? <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">{err}</p> : null}

      {/* History — the timestamped activity record */}
      <div className="mt-4">
        {loading ? (
          <p className="text-[13px] text-[#8a938c]">{t('rr.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#CBD6CF] bg-[#FBFBFA] px-4 py-5 text-center text-[13px] text-[#6a6d66]">{t('rr.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-[14px] border border-[#E4E5DE] bg-[#FBFBFA] px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-[#20242a]">{e.recordTypes.map((rt) => t(`rr.type.${rt}`)).join(' · ')}</div>
                    <div style={MONO} className="mt-0.5 text-[11.5px] text-[#5a5f58]">{t('rr.sent')} {fmtDate(e.sentAt)} → {e.recipient}</div>
                    {e.responseReceivedAt ? (
                      <div style={MONO} className="mt-0.5 text-[11.5px] text-[#42574E]">✓ {t('rr.received')} {fmtDate(e.responseReceivedAt)}</div>
                    ) : null}
                  </div>
                  {!e.responseReceivedAt ? (
                    <button type="button" onClick={() => void markReceived(e.id)} className="flex-none rounded-full border border-[#CBD6CF] px-3 py-1.5 text-[11.5px] font-medium text-[#42574E] transition hover:bg-[#EEF3EF]">
                      {t('rr.markReceived')}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void persist(entries.filter((x) => x.id !== e.id))} aria-label={t('rr.remove')} className="mt-0.5 flex-none text-[#b6bbb2] transition hover:text-[#A8512B]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 border-t border-[#EEF0EA] pt-3 text-[11.5px] leading-relaxed text-[#8a8f88]">
        {t('rr.disclaimer')}{saving ? ' ·' : ''}
      </p>
    </section>
  );
}
