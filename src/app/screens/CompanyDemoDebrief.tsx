/**
 * /company-demo/debrief — post-call capture, filled within ~10 min of a demo.
 * Controlled inputs + onClick submit (no full-page <form> POST). Writes to demo_debriefs.
 * The asked_for_search checkbox is a deliberate, separately-tracked product signal.
 */
import { useState } from 'react';
import {
  submitDemoDebrief,
  type DemoDebriefInput,
  type LeanInMoment,
  type DemoOutcome,
} from '../../services/demoDebriefService';

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;

const field =
  'w-full rounded-[11px] border border-[#E8E3F2] bg-white px-4 py-3 text-[14.5px] text-[#16121F] placeholder:text-[#9c93ad] outline-none focus:border-[#7C4DD6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C4DD6]';
const label = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7C4DD6]';

const LEAN_IN: Array<{ v: LeanInMoment; t: string }> = [
  { v: 'mess', t: 'The mess' },
  { v: 'timeline', t: 'The timeline' },
  { v: 'citation', t: 'The citation moment' },
  { v: 'other', t: 'Other' },
];
const OUTCOMES: Array<{ v: DemoOutcome; t: string }> = [
  { v: 'yes', t: 'Yes — design partner' },
  { v: 'maybe', t: 'Maybe — follow-up' },
  { v: 'no', t: 'No' },
];

const EMPTY: DemoDebriefInput = {
  firmName: '', prospectName: '', painPhrase: '', leanInMoment: null, fellFlat: '',
  objections: '', featureRequest: '', askedForSearch: false, outcome: null,
  nextStep: '', nextStepDate: '', improvement: '',
};

export function CompanyDemoDebrief() {
  const [v, setV] = useState<DemoDebriefInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof DemoDebriefInput>(k: K, val: DemoDebriefInput[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const save = async () => {
    setError('');
    if (!v.firmName.trim()) { setError('Firm name is required.'); return; }
    setBusy(true);
    const { error: err } = await submitDemoDebrief(v);
    setBusy(false);
    if (err) { setError(err); return; }
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8FE] px-5">
        <div className="w-full max-w-[440px] rounded-[20px] border border-[#E8E3F2] bg-white p-8 text-center shadow-[0_12px_40px_-12px_rgba(46,16,80,0.28)]">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#5B21B6] text-white">✓</div>
          <h2 style={SERIF} className="text-[20px] font-medium text-[#16121F]">Saved — debrief logged</h2>
          <p className="mt-2 text-[13.5px] text-[#4B4458]">That signal is captured. Schedule the follow-up before it goes cold.</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => { setV(EMPTY); setSaved(false); }}
              className="rounded-full border border-[#E8E3F2] bg-white px-5 py-2.5 text-[13.5px] font-semibold text-[#16121F] transition hover:border-[#7C4DD6]"
            >
              Log another
            </button>
            <a href="/company-demo" className="rounded-full bg-[#5B21B6] px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[#4C1A9C]">
              Back to the guide
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8FE] text-[#16121F] antialiased">
      <div className="mx-auto max-w-[560px] px-5 pb-16 pt-8">
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7C4DD6]">Post-call · within ~10 min</div>
        <h1 style={SERIF} className="text-[28px] font-bold tracking-[-0.02em]">Demo debrief</h1>
        <p className="mt-2 text-[14.5px] text-[#4B4458]">Log it while it’s fresh. Her words, not your summary.</p>

        <div className="mt-6 space-y-5 rounded-[20px] border border-[#E8E3F2] bg-white p-6 shadow-[0_12px_40px_-12px_rgba(46,16,80,0.28)]">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Firm name *</label>
              <input className={field} value={v.firmName} onChange={(e) => set('firmName', e.target.value)} />
            </div>
            <div>
              <label className={label}>Prospect name</label>
              <input className={field} value={v.prospectName} onChange={(e) => set('prospectName', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={label}>Her exact words for the pain</label>
            <textarea rows={2} className={`${field} resize-none`} value={v.painPhrase} onChange={(e) => set('painPhrase', e.target.value)} />
          </div>

          <div>
            <label className={label}>What made her lean in</label>
            <div className="flex flex-wrap gap-2">
              {LEAN_IN.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => set('leanInMoment', v.leanInMoment === o.v ? null : o.v)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                    v.leanInMoment === o.v ? 'border-[#5B21B6] bg-[#5B21B6] text-white' : 'border-[#E8E3F2] bg-white text-[#4B4458] hover:border-[#7C4DD6]'
                  }`}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>What confused her or fell flat</label>
            <textarea rows={2} className={`${field} resize-none`} value={v.fellFlat} onChange={(e) => set('fellFlat', e.target.value)} />
          </div>

          <div>
            <label className={label}>Objections, verbatim</label>
            <textarea rows={2} className={`${field} resize-none`} value={v.objections} onChange={(e) => set('objections', e.target.value)} />
          </div>

          <div>
            <label className={label}>Feature requested we don’t have yet</label>
            <textarea rows={2} className={`${field} resize-none`} value={v.featureRequest} onChange={(e) => set('featureRequest', e.target.value)} />
            <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 rounded-[11px] bg-[#F3EDFD] p-3">
              <input
                type="checkbox"
                checked={v.askedForSearch}
                onChange={(e) => set('askedForSearch', e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-[#5B21B6]"
              />
              <span className="text-[13.5px] text-[#16121F]">
                <b>Asked to search / interrogate the record</b>
                <span className="mt-0.5 block text-[12px] text-[#4B4458]">Tracked signal — when enough firms ask, that’s the trigger to build it.</span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Outcome</label>
              <div className="flex flex-col gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => set('outcome', v.outcome === o.v ? null : o.v)}
                    className={`rounded-[11px] border px-4 py-2.5 text-left text-[13.5px] font-medium transition ${
                      v.outcome === o.v ? 'border-[#5B21B6] bg-[#5B21B6] text-white' : 'border-[#E8E3F2] bg-white text-[#4B4458] hover:border-[#7C4DD6]'
                    }`}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className={label}>Next step</label>
                <input className={field} value={v.nextStep} onChange={(e) => set('nextStep', e.target.value)} />
              </div>
              <div>
                <label className={label}>Next step date</label>
                <input type="date" className={field} value={v.nextStepDate} onChange={(e) => set('nextStepDate', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <label className={label}>One improvement for next demo</label>
            <textarea rows={2} className={`${field} resize-none`} value={v.improvement} onChange={(e) => set('improvement', e.target.value)} />
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#5B21B6] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#4C1A9C] disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save debrief'}
          </button>
        </div>
      </div>
    </div>
  );
}
