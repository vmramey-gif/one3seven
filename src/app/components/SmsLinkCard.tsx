import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import {
  loadSmsLink,
  requestSmsLink,
  verifySmsLink,
  unlinkSmsPhone,
  type WorkerSmsLink,
} from '../../services/smsLinkService';

/**
 * Lets a worker text photos of documents in directly instead of using the web uploader — some
 * workers find that easier from a phone. Two-step: request a code, then confirm it, so a texted
 * file can only ever be attributed to a phone number the worker actually proved they control.
 *
 * SCAFFOLDING: requestSmsLink calls an edge function that returns a clear "not turned on yet"
 * error until the founder sets up Twilio (see project memory) — this card is safe to ship as-is
 * and will start working the moment those credentials are configured, no code change needed.
 */

const E164_HINT = /^\+?[1-9]\d{6,14}$/;

export function SmsLinkCard({ intakeId }: { intakeId: string | null }) {
  const [link, setLink] = useState<WorkerSmsLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!intakeId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLink(await loadSmsLink(intakeId));
      setLoading(false);
    })();
  }, [intakeId]);

  if (loading || !intakeId) return null;

  const handleSendCode = async () => {
    const trimmed = phone.trim();
    if (!E164_HINT.test(trimmed)) {
      setError('Enter your phone number as +1 followed by your 10-digit number.');
      return;
    }
    const normalized = trimmed.startsWith('+') ? trimmed : `+1${trimmed.replace(/\D/g, '')}`;
    setBusy(true);
    setError(null);
    const r = await requestSmsLink(intakeId, normalized);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'Could not send a code. Try again.');
      return;
    }
    setSentTo(normalized);
  };

  const handleVerify = async () => {
    if (!sentTo || !code.trim()) return;
    setBusy(true);
    setError(null);
    const r = await verifySmsLink(sentTo, code.trim());
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? 'That code is not right.');
      return;
    }
    setLink({ id: '', phoneNumber: sentTo, status: 'verified' });
    setSentTo(null);
    setCode('');
    // Refresh from the server to pick up the real row id (needed to unlink later).
    setLink(await loadSmsLink(intakeId));
  };

  const handleUnlink = async () => {
    if (!link?.id) return;
    setBusy(true);
    const r = await unlinkSmsPhone(link.id);
    setBusy(false);
    if (r.ok) setLink(null);
    else setError(r.error ?? 'Could not remove this number.');
  };

  return (
    <section className="rounded-[18px] border border-[#CBD6CF] bg-white/80 p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#42574E]">
        <MessageSquare className="h-3.5 w-3.5" /> Text in documents
      </div>

      {link?.status === 'verified' ? (
        <>
          <p className="mt-1.5 max-w-[58ch] text-[12.5px] leading-relaxed text-[#5a5f58]">
            Texts and photos sent to your one3seven number from{' '}
            <span className="font-medium text-[#20242a]">{link.phoneNumber}</span> are added to
            this record automatically.
          </p>
          <button
            type="button"
            onClick={() => void handleUnlink()}
            disabled={busy}
            className="mt-3 text-[12px] font-medium text-[#8A5A3A] hover:underline disabled:opacity-50"
          >
            Stop texting from this number
          </button>
        </>
      ) : sentTo ? (
        <>
          <p className="mt-1.5 max-w-[58ch] text-[12.5px] leading-relaxed text-[#5a5f58]">
            We texted a 6-digit code to {sentTo}. Enter it below to finish linking.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              className="w-28 rounded-[10px] border border-[#D8E0CF] bg-white px-3 py-2 text-[13px] tracking-[0.15em] text-[#20242a]"
            />
            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={busy || code.length < 4}
              className="rounded-full bg-[var(--o3s-action)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => { setSentTo(null); setCode(''); setError(null); }}
              className="text-[12px] text-[#6A6D66] hover:underline"
            >
              Use a different number
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1.5 max-w-[58ch] text-[12.5px] leading-relaxed text-[#5a5f58]">
            Prefer texting? Link your phone and send photos of documents straight to your record.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 415 555 1234"
              inputMode="tel"
              className="w-44 rounded-[10px] border border-[#D8E0CF] bg-white px-3 py-2 text-[13px] text-[#20242a]"
            />
            <button
              type="button"
              onClick={() => void handleSendCode()}
              disabled={busy || phone.trim().length < 7}
              className="rounded-full bg-[var(--o3s-action)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Send code
            </button>
          </div>
          <p className="mt-2 max-w-[58ch] text-[11px] leading-relaxed text-[#6A6D66]">
            By entering your number and tapping Send code, you agree to receive text messages
            from one3seven about your document uploads. Message and data rates may apply. Reply
            STOP to opt out, HELP for help. See our{' '}
            <a href="/privacy#7-text-messaging-sms-program" className="text-[#42574E] underline-offset-2 hover:underline">
              SMS terms
            </a>.
          </p>
        </>
      )}

      {error ? <p className="mt-2 text-[12px] text-[#A8512B]">{error}</p> : null}
    </section>
  );
}
