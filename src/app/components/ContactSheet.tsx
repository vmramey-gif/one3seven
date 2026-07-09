import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { submitContactMessage } from '../../services/contactService';
import { track } from '../../lib/analytics';

const inputCls =
  'w-full rounded-xl border border-[#ECE7F5] bg-white px-4 py-3 text-sm text-[#14112E] placeholder:text-[#8B86A0] focus:border-[#42574E] focus:outline-none focus:ring-4 focus:ring-[#42574E]/10';

/** Lightweight contact form modal. Light work-surface styling. Saves to contact_messages. */
export function ContactSheet({ source, onClose }: { source: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await submitContactMessage({ name, email, message, source });
    setSubmitting(false);
    if (res.error) { setError(res.error); return; }
    track('contact_submit', { source });
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-[24px] bg-white p-6 shadow-2xl sm:rounded-[20px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-[20px] font-medium text-[#14112E]">Contact us</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[#6B6685] hover:bg-[#F1ECFE]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center">
            <Check className="mx-auto mb-3 h-8 w-8 text-[#42574E]" />
            <p className="text-[15px] font-semibold text-[#14112E]">Message sent.</p>
            <p className="mt-1 text-[13px] text-[#6B6685]">We'll get back to you at the email you provided.</p>
            <button type="button" onClick={onClose} className="mt-4 rounded-full bg-[#42574E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4C1D96]">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className={inputCls} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Your email *" className={inputCls} />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} placeholder="How can we help? *" className={`${inputCls} resize-none`} />
            <button type="submit" disabled={submitting} className="w-full rounded-full bg-[#42574E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4C1D96] disabled:opacity-60">
              {submitting ? 'Sending…' : 'Send message'}
            </button>
            <p className="text-center text-[11px] text-[#8B86A0]">
              Or email <a href="mailto:info@one3seven.com" className="font-semibold text-[#42574E] hover:underline">info@one3seven.com</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
