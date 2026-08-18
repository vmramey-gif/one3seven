import { useMemo, useState } from 'react';
import { ArrowLeft, Copy, Download, Check, Mail } from 'lucide-react';
import { track } from '../../lib/analytics';

/**
 * "Get Your Employment Records" — the worker's first self-help tool.
 *
 * Generates a ready-to-send records-request letter citing California Labor Code §§ 226, 432, and
 * 1198.5 (the exact statutes the founder cited in her own case). This is SELF-HELP: it produces a
 * template the worker sends themselves. It organizes and informs — it does not give legal advice,
 * evaluate a claim, or conclude anything. Worker-first, low legal risk, no backend required.
 */
type RecordsRequestScreenProps = {
  workerName?: string | null;
  onBackToLanding: () => void;
};

type RecordKey = 'payroll' | 'personnel' | 'signed' | 'timekeeping' | 'reimbursement';

const RECORD_OPTIONS: { key: RecordKey; label: string; cite: string }[] = [
  { key: 'payroll', label: 'Pay & wage records', cite: 'Labor Code § 226 — 21 days' },
  { key: 'personnel', label: 'Personnel file', cite: 'Labor Code § 1198.5 — 30 days' },
  { key: 'signed', label: 'Documents I signed', cite: 'Labor Code § 432' },
  { key: 'timekeeping', label: 'Timekeeping records', cite: 'timecards, breaks, edits' },
  { key: 'reimbursement', label: 'Expense-reimbursement records', cite: 'Labor Code § 2802 — phone, internet, equipment' },
];

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function buildLetter(opts: {
  workerName: string;
  employerName: string;
  employerAddress: string;
  employmentStatus: 'current' | 'former';
  startDate: string;
  endDate: string;
  contactBack: string;
  records: Record<RecordKey, boolean>;
}): string {
  const today = new Date();

  const worker = opts.workerName.trim() || '[Your full name]';
  const employer = opts.employerName.trim() || '[Employer name]';
  const addr = opts.employerAddress.trim() || '[Employer address / HR email]';
  const isCurrent = opts.employmentStatus === 'current';
  const endDateText = opts.endDate.trim() || (isCurrent ? 'present' : '[end date]');
  const period =
    opts.startDate.trim() || opts.endDate.trim()
      ? `I was employed from ${opts.startDate.trim() || '[start date]'} to ${endDateText}.`
      : '';
  const statusWord = isCurrent ? 'a current' : 'a former';

  const items: string[] = [];
  if (opts.records.payroll)
    items.push(
      'Payroll and wage records, including itemized wage statements, records of hours worked, rates of pay, and deductions (California Labor Code § 226). Under Labor Code § 226(c), these must be made available within 21 calendar days of this request.',
    );
  if (opts.records.personnel)
    items.push(
      'My complete personnel file and records relating to my performance and to any grievance concerning me (California Labor Code § 1198.5). Under § 1198.5, these must be made available within 30 calendar days of this request.',
    );
  if (opts.records.signed)
    items.push(
      'Copies of every document I signed relating to obtaining or holding my employment (California Labor Code § 432).',
    );
  if (opts.records.timekeeping)
    items.push(
      'Timekeeping records, including all timecards, clock-in and clock-out records, meal- and rest-period records, and any edits or adjustments made to my recorded time.',
    );
  if (opts.records.reimbursement)
    items.push(
      'Records of business-expense reimbursements paid to me and any expense-reimbursement policy, including reimbursements for work-related use of a personal phone, internet, vehicle, equipment, or supplies (California Labor Code § 2802).',
    );
  // Never silently substitute a different request than what was actually selected — an empty
  // selection says so honestly instead of picking all four types on the worker's behalf.
  const numbered =
    items.length > 0
      ? items.map((t, i) => `${i + 1}. ${t}`).join('\n\n')
      : '[No record types were selected. Please go back and select at least one record type before sending this letter.]';

  // Only payroll (§226, 21 days) and personnel (§1198.5, 30 days) items state a deadline —
  // don't reference "the timeframe... as noted above" when neither is selected, or nothing was.
  const hasStatedDeadline = opts.records.payroll || opts.records.personnel;
  const deadlineSentence =
    items.length === 0
      ? ''
      : hasStatedDeadline
        ? 'Please provide these records within the timeframe that applies to each, as noted above. '
        : 'Please provide these records at your earliest convenience. ';

  // Avoid a double period when the employer name itself already ends with one (e.g. "Acme Inc.").
  const employerSentenceEnd = employer.endsWith('.') ? '' : '.';

  return `${fmtDate(today)}

${employer}
Attn: Human Resources / Records Custodian
${addr}

Re: Request for Employment Records — ${worker}

To Whom It May Concern:

I am ${statusWord} employee of ${employer}${employerSentenceEnd}${period ? ' ' + period : ''} Under California law, I am requesting to inspect and receive copies of the following employment records:

${numbered}

${deadlineSentence}If any portion is maintained by a separate entity or payroll provider, please identify who holds it so I can direct my request appropriately.

You may provide the records electronically to ${opts.contactBack.trim() || '[your email]'} or by mail to the address on file for me.

Thank you for your attention to this request.

Sincerely,

${worker}
${fmtDate(today)}`;
}

export function RecordsRequestScreen({ workerName, onBackToLanding }: RecordsRequestScreenProps) {
  const [name, setName] = useState(workerName?.trim() ?? '');
  const [employer, setEmployer] = useState('');
  const [employerAddress, setEmployerAddress] = useState('');
  const [status, setStatus] = useState<'current' | 'former'>('former');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contactBack, setContactBack] = useState('');
  const [records, setRecords] = useState<Record<RecordKey, boolean>>({
    payroll: true,
    personnel: true,
    signed: true,
    timekeeping: true,
    reimbursement: true,
  });
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);

  const letter = useMemo(
    () =>
      buildLetter({
        workerName: name,
        employerName: employer,
        employerAddress,
        employmentStatus: status,
        startDate,
        endDate,
        contactBack,
        records,
      }),
    [name, employer, employerAddress, status, startDate, endDate, contactBack, records],
  );

  const toggle = (k: RecordKey) => setRecords((r) => ({ ...r, [k]: !r[k] }));

  const hasAnyRecordSelected = Object.values(records).some(Boolean);
  // Employer address is deliberately optional (the letter itself offers "by mail to the address
  // on file" as a fallback) — but name/employer/contact-back all render as literal bracket
  // placeholders in the letter when blank, and shouldn't go out to a real employer that way.
  const canFinalize =
    hasAnyRecordSelected && Boolean(name.trim()) && Boolean(employer.trim()) && Boolean(contactBack.trim());
  const finalizeBlockedReason = !hasAnyRecordSelected
    ? 'Select at least one record type above.'
    : !name.trim() || !employer.trim() || !contactBack.trim()
      ? 'Fill in your name, employer, and where records should be sent before sending.'
      : '';

  // Worker sends from their OWN mail client — one3seven composes but never sends. Recipient
  // auto-fills only when the HR field is an email; otherwise the worker fills it in their client.
  // Mail clients silently drop mailto links whose URL exceeds ~2,000 chars, so a full-letter body
  // makes the link "dead" (clicking does nothing). Guard on length: short letters open pre-filled;
  // long ones copy the letter to the clipboard and open a short email telling the worker to paste.
  // Compose the request in the worker's own email. mailto: only works if a desktop mail app is the
  // registered handler — most people use webmail in a browser tab, where mailto silently does nothing.
  // So we offer Gmail / Outlook web compose (which reliably open a pre-filled draft) plus a mailto
  // fallback for desktop mail apps. one3seven composes; the worker reviews and sends.
  // Copying the encoded letter into a "paste here" short body instead of a dead/truncated deep
  // link — shared by all three compose destinations, not just mailto, since none of them
  // reliably carry an arbitrarily long URL.
  const openWithClipboardFallback = async (build: (body: string) => string) => {
    let clipboardOk = false;
    try {
      await navigator.clipboard.writeText(letter);
      clipboardOk = true;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the letter is still selectable on screen */
    }
    const shortBody = clipboardOk
      ? 'Your request letter has been copied to your clipboard — paste it here (Ctrl/Cmd + V) before sending.'
      : 'Paste your records request letter here before sending. You can copy it from the one3seven screen.';
    window.location.href = build(shortBody);
  };

  const openCompose = async (kind: 'gmail' | 'outlook' | 'mailto') => {
    if (!canFinalize) return;
    const recipient = employerAddress.includes('@') ? employerAddress.trim() : '';
    const subject = `Request for Employment Records — ${name.trim() || 'Employee'}`;
    track('records_request_email');
    setShowSend(false);
    if (kind === 'gmail') {
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`;
      // Gmail/Outlook web compose links have no documented hard cap, but in practice very long
      // URLs get silently truncated or rejected by the browser/server well before mailto's own
      // ~2,000-char limit — apply the same length guard mailto already had, uniformly.
      if (url.length <= 1800) {
        window.open(url, '_blank', 'noopener');
        return;
      }
      await openWithClipboardFallback(
        (body) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      );
      return;
    }
    if (kind === 'outlook') {
      const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`;
      if (url.length <= 1800) {
        window.open(url, '_blank', 'noopener');
        return;
      }
      await openWithClipboardFallback(
        (body) => `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      );
      return;
    }
    // mailto (desktop mail app). Mail clients drop mailto links over ~2,000 chars, so long letters
    // go to the clipboard with a short "paste here" body instead of a dead link.
    const fullHref = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`;
    if (fullHref.length <= 1800) {
      window.location.href = fullHref;
      return;
    }
    await openWithClipboardFallback(
      (body) => `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  };

  const handleCopy = async () => {
    if (!canFinalize) return;
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      track('records_request_copy');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the letter is still selectable on screen */
    }
  };

  const handleDownload = () => {
    if (!canFinalize) return;
    const blob = new Blob([letter], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employment-records-request.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    track('records_request_download');
  };

  const inputCls =
    'w-full rounded-[12px] border border-[#E4E5DE] bg-white px-4 py-3 text-sm text-[#1B2623] placeholder:text-[#9AA39B] focus:border-[#7C8B6F] focus:outline-none focus:ring-2 focus:ring-[#E4E5DE]';
  const labelCls = 'text-[13px] font-medium text-[#384039]';

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#6A6D66] hover:text-[#1B2623]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#7C857F]">A tool for you</p>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="mt-1 text-2xl font-medium text-[#1B2623]">
          Get your employment records
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[#6A6D66]">
          California law gives you the right to your own pay records, personnel file, and signed documents — and
          your employer has a deadline to hand them over. Fill this in and we&rsquo;ll write the request letter
          for you to send. Getting your records is the first step to organizing what happened.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="rr-name" className={labelCls}>Your full name</label>
            <input id="rr-name" className={`mt-1.5 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rr-emp" className={labelCls}>Employer name</label>
            <input id="rr-emp" className={`mt-1.5 ${inputCls}`} value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder="Acme Inc." />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rr-addr" className={labelCls}>Employer address or HR email <span className="font-normal text-[#9AA39B]">(optional)</span></label>
            <input id="rr-addr" className={`mt-1.5 ${inputCls}`} value={employerAddress} onChange={(e) => setEmployerAddress(e.target.value)} placeholder="hr@acme.com  ·  or a mailing address" />
          </div>
          <div>
            <label htmlFor="rr-start" className={labelCls}>Employment start <span className="font-normal text-[#9AA39B]">(optional)</span></label>
            <input id="rr-start" className={`mt-1.5 ${inputCls}`} value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Sept 2023" />
          </div>
          <div>
            <label htmlFor="rr-end" className={labelCls}>Employment end <span className="font-normal text-[#9AA39B]">(optional)</span></label>
            <input id="rr-end" className={`mt-1.5 ${inputCls}`} value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="April 2025 (or “present”)" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rr-back" className={labelCls}>Where should they send the records? <span className="font-normal text-[#9AA39B]">(your email)</span></label>
            <input id="rr-back" className={`mt-1.5 ${inputCls}`} value={contactBack} onChange={(e) => setContactBack(e.target.value)} placeholder="you@email.com" />
          </div>
        </div>

        <div className="mt-5">
          <p className={labelCls}>Are you still employed there?</p>
          <div className="mt-2 flex gap-2">
            {(['former', 'current'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  status === s ? 'border-[#42574E] bg-[#42574E] text-white' : 'border-[#E4E5DE] bg-white text-[#384039] hover:border-[#7C8B6F]'
                }`}
              >
                {s === 'former' ? 'No longer employed' : 'Still employed'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className={labelCls}>Which records? <span className="font-normal text-[#7C857F]">(all selected by default)</span></p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {RECORD_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => toggle(o.key)}
                className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition ${
                  records[o.key] ? 'border-[#7C8B6F] bg-[#EFF3ED]' : 'border-[#E4E5DE] bg-white'
                }`}
              >
                <span className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border ${records[o.key] ? 'border-[#42574E] bg-[#42574E]' : 'border-[#B7BCB2] bg-white'}`}>
                  {records[o.key] ? <Check className="h-3 w-3 text-white" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#1B2623]">{o.label}</span>
                  <span className="block text-[11px] text-[#7C857F]">{o.cite}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7C857F]">Your request letter</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void handleCopy()} disabled={!canFinalize} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E4E5DE] bg-white px-3 py-2 text-xs font-semibold text-[#384039] hover:border-[#7C8B6F] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E4E5DE]">
                {copied ? <Check className="h-3.5 w-3.5 text-[#42574E]" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={handleDownload} disabled={!canFinalize} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E4E5DE] bg-white px-3 py-2 text-xs font-semibold text-[#384039] hover:border-[#7C8B6F] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E4E5DE]">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <div className="relative">
                <button type="button" onClick={() => setShowSend((s) => !s)} disabled={!canFinalize} className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#42574E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#374a42] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#42574E]">
                  <Mail className="h-3.5 w-3.5" /> Send from your email
                </button>
                {showSend && canFinalize && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSend(false)} />
                    <div className="absolute right-0 z-20 mt-1 w-60 rounded-[12px] border border-[#E4E5DE] bg-white p-1 shadow-lg">
                      <button type="button" onClick={() => void openCompose('gmail')} className="block w-full rounded-[8px] px-3 py-2 text-left text-xs font-semibold text-[#384039] hover:bg-[#F2F4EC]">Open in Gmail</button>
                      <button type="button" onClick={() => void openCompose('outlook')} className="block w-full rounded-[8px] px-3 py-2 text-left text-xs font-semibold text-[#384039] hover:bg-[#F2F4EC]">Open in Outlook</button>
                      <button type="button" onClick={() => void openCompose('mailto')} className="block w-full rounded-[8px] px-3 py-2 text-left text-xs font-semibold text-[#384039] hover:bg-[#F2F4EC]">Use my desktop mail app</button>
                      <div className="px-3 py-1.5 text-[11px] leading-snug text-[#8a8f88]">Opens a pre-filled draft in a new tab. Review it, then send it yourself.</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {finalizeBlockedReason ? (
            <p className="mb-2 text-xs font-medium text-[#A8512B]">{finalizeBlockedReason}</p>
          ) : null}
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[14px] border border-[#E4E5DE] bg-white px-5 py-4 text-[13px] leading-relaxed text-[#1B2623]" style={{ fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" }}>
            {letter}
          </pre>
        </div>

        <p className="mt-5 rounded-[12px] border border-[#E4E5DE] bg-[#F2F4EC] px-4 py-3 text-[12px] leading-relaxed text-[#6A6D66]">
          This is a template for you to review and send yourself — it is not legal advice, and it doesn&rsquo;t
          decide anything about your situation. one3seven organizes and informs; the legal judgment stays with
          you and any attorney you choose. Send it to your employer&rsquo;s HR or records custodian, keep a copy
          of what you send, and note the date.
        </p>
      </div>
    </div>
  );
}
