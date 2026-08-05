import { useEffect, useState } from 'react';
import { buildCartOutput, type ClientStatus, type GapItem } from '../../services/claimLensGapActions';

/**
 * /?claim-lens-demo — the pilot-closer demo. The attorney SELECTS a lens (never asks a question);
 * the intake re-sorts around that claim's statutory elements, showing three source states plus LOUD
 * absence cards. Doctrine held tight: organizes and reflects, never concludes; no ranking, no
 * omission; absence is a fact, not a verdict.
 *
 * DEMO-GRADE / ILLUSTRATIVE ONLY. Element→material mappings are hand-authored on a sample record.
 * This does NOT run live extraction. Wiring to real intakes is counsel-gated + accuracy-validated —
 * see the strategy notes. Color roles: violet = source-linked (AI), sage = on file, orange = gap/action.
 */

type SourceState = 'linked' | 'named' | 'worker' | 'counted';
type Item = { state: SourceState; text: string; meta: string };
type Element = { name: string; note?: string; items?: Item[]; empty?: string };
type Lens = { id: string; tab: string; title: string; elements: Element[] };

const STATE_LABEL: Record<SourceState, string> = {
  linked: 'Source-linked',
  named: 'Document on file',
  worker: 'Worker-stated',
  counted: 'Counted',
};

const CHECKS = [
  { label: 'Arbitration agreement', value: 'Not on file', present: false, note: 'not addressed in intake' },
  { label: 'Employment dates', value: 'On file', present: true, note: 'Aug 15, 2022 – Jun 12, 2026' },
  { label: 'Employer headcount', value: 'Not on file', present: false, note: 'not addressed in intake' },
  { label: 'CRD right-to-sue letter', value: 'Not on file', present: false, note: 'not addressed in intake' },
  { label: 'Wage statements', value: '4 on file', present: true, note: 'Apr 30 – Jun 15, 2026' },
  { label: 'Separation date', value: 'On file', present: true, note: 'Jun 12, 2026' },
  { label: 'EEOC charge', value: 'Not on file', present: false, note: 'not addressed in intake' },
  { label: 'LWDA / PAGA notice', value: 'Not on file', present: false, note: 'not addressed in intake' },
  { label: 'Damages material', value: 'Not on file', present: false, note: 'not addressed in intake' },
  { label: 'Prior claims / agreements', value: 'Not on file', present: false, note: 'not addressed in intake' },
];

const LENSES: Lens[] = [
  {
    id: 'retaliation',
    tab: '§1102.5 Retaliation',
    title: 'Labor Code §1102.5 — Retaliation',
    elements: [
      {
        name: 'Reports and complaints made, and to whom',
        items: [
          { state: 'worker', text: 'Reported blocked exit doors at Loading Dock 3 to shift supervisor Dana Whitfield.', meta: 'Approx. May 28, 2026' },
          { state: 'linked', text: 'Text thread with coworker R. Alcaraz referencing the dock door report.', meta: 'May 28, 2026 · texts_alcaraz.pdf, p.3' },
          { state: 'named', text: 'Photograph of Loading Dock 3 taken by worker.', meta: 'dock3_photo_0528.jpg' },
          { state: 'worker', text: 'Raised the same issue again at a safety huddle.', meta: 'Week of Jun 1, 2026 · no exact date recorded' },
        ],
      },
      {
        name: "Worker's account of what he understood at the time of the disclosure",
        empty: 'Nothing in the record addresses what Marcus was told or understood about the exit-door rule before he reported it.',
      },
      {
        name: 'Employment actions taken, with dates',
        items: [
          { state: 'linked', text: 'Termination letter citing attendance.', meta: 'Jun 12, 2026 · termination_letter.pdf, p.1' },
          { state: 'linked', text: 'Final wage statement.', meta: 'Pay date Jun 15, 2026 · ws_0615.pdf' },
          { state: 'worker', text: 'Badge access stopped working the morning of the termination meeting.', meta: 'Jun 12, 2026' },
        ],
      },
      {
        name: 'Sequence and interval',
        note: 'Includes material pointing in both directions. one3seven does not omit items that cut against a theory.',
        items: [
          { state: 'counted', text: '15 days between the reported disclosure and the separation date.', meta: 'May 28, 2026 → Jun 12, 2026' },
          { state: 'worker', text: 'Worker states the supervisor said he had “been making a lot of noise lately” during the Jun 12 meeting.', meta: 'Jun 12, 2026 · no witness named' },
          { state: 'linked', text: 'Written warning for attendance predating the reported disclosure.', meta: 'Apr 2, 2026 · attendance_writeup.pdf, p.1' },
          { state: 'counted', text: '56 days between that warning and the reported disclosure.', meta: 'Apr 2, 2026 → May 28, 2026' },
        ],
      },
    ],
  },
  {
    id: 'wage',
    tab: 'Wage statements & final pay',
    title: 'Wage statements & final pay',
    elements: [
      {
        name: 'Employment relationship and dates on file',
        items: [
          { state: 'linked', text: 'Offer letter listing position and start date.', meta: 'Aug 15, 2022 · offer_letter.pdf, p.1' },
          { state: 'linked', text: 'Termination letter listing separation date.', meta: 'Jun 12, 2026 · termination_letter.pdf, p.1' },
        ],
      },
      {
        name: 'Wage statements in the record',
        items: [
          { state: 'named', text: 'Four wage statements on file.', meta: 'Apr 30 · May 15 · May 31 · Jun 15, 2026' },
          { state: 'counted', text: 'No statements on file for Aug 2022 through Mar 2026.', meta: '43 months not represented in the record' },
        ],
      },
      {
        name: 'Items appearing on the statements on file',
        items: [
          { state: 'linked', text: 'Employer legal name and address appear on all four statements.', meta: 'ws_0430 · ws_0515 · ws_0531 · ws_0615' },
          { state: 'linked', text: 'Total hours field is blank on the May 31 statement.', meta: 'ws_0531.pdf, p.1' },
          { state: 'counted', text: 'Four of four statements list an hourly rate.', meta: 'Apr 30 – Jun 15, 2026' },
        ],
      },
      {
        name: 'Meal and rest period records',
        empty: 'No time records on file. The worker narrative does not address break timing.',
      },
    ],
  },
  {
    id: 'feha',
    tab: 'Disability Accommodation §12940(m)',
    title: 'Disability Accommodation — §12940(m)',
    elements: [
      {
        name: 'Medical condition material',
        empty: 'No medical documentation on file. The worker narrative does not describe what was disclosed to the employer, or to whom.',
      },
      {
        name: 'Accommodation requested',
        items: [
          { state: 'worker', text: 'Worker states he asked for a lighter lifting assignment after a back strain.', meta: 'Approx. Feb 2026 · no exact date recorded · no document on file' },
        ],
      },
      {
        name: 'Employer response',
        empty: 'Nothing in the record addresses whether the employer responded, met, or offered anything in reply.',
      },
      {
        name: 'Employment actions taken, with dates',
        note: 'Same items as the retaliation lens, re-sorted under this element.',
        items: [
          { state: 'linked', text: 'Termination letter citing attendance.', meta: 'Jun 12, 2026 · termination_letter.pdf, p.1' },
          { state: 'worker', text: 'Badge access stopped working the morning of the termination meeting.', meta: 'Jun 12, 2026' },
        ],
      },
      {
        name: 'Administrative filing',
        empty: 'No CRD right-to-sue letter on file, and no filing date recorded in intake.',
      },
    ],
  },
];

const CSS = `
.cl{min-height:100vh;color:#ECF3ED;
  background:radial-gradient(820px 460px at 88% -10%,rgba(124,92,255,.14),transparent 60%),radial-gradient(680px 420px at -8% 4%,rgba(143,211,166,.08),transparent 55%),linear-gradient(180deg,#0A0F0C,#0C120E);
  font-family:'Inter Tight',ui-sans-serif,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;padding:clamp(18px,4vw,40px)}
.cl .serif{font-family:'Fraunces','Iowan Old Style',Georgia,serif}
.cl .mono{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace}
.cl .page{max-width:820px;margin:0 auto}
.cl .top{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
.cl .brand{display:flex;align-items:center;gap:10px}
.cl .spark{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#7C5CFF,#A78BFA);box-shadow:0 0 20px rgba(124,92,255,.5);display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px}
.cl .brand b{font-weight:600}.cl .brand em{color:#61756A;font-size:12px;font-style:normal}
.cl .crumb{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8FA495}
.cl h1.subject{font-size:clamp(26px,4.5vw,34px);letter-spacing:-.02em;margin:18px 0 5px;font-weight:500}
.cl .subjectMeta{font-size:13px;color:#8FA495}
.cl .checks{margin-top:22px}
.cl .checksHead{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8FA495;margin-bottom:11px}
.cl .checkGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media(max-width:620px){.cl .checkGrid{grid-template-columns:1fr 1fr}}
.cl .check{background:linear-gradient(180deg,#182219,#131C17);border:1px solid #243029;border-radius:12px;padding:12px 13px}
.cl .check .k{font-size:11px;color:#8FA495;margin-bottom:5px}
.cl .check .v{font-size:13.5px;font-weight:500}
.cl .check .v.absent{color:#F3A268}.cl .check .v.ok{color:#8FD3A6}
.cl .check .n{font-size:10.5px;color:#61756A;margin-top:3px}
.cl .lensBar{margin-top:28px}
.cl .lensLabel{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8FA495;margin-bottom:10px}
.cl .tabs{display:flex;gap:8px;flex-wrap:wrap}
.cl .tab{font-family:'IBM Plex Mono',monospace;font-size:12px;padding:9px 14px;border:1px solid #243029;background:#131C17;color:#8FA495;cursor:pointer;border-radius:999px;transition:all .15s}
.cl .tab:hover{border-color:rgba(143,211,166,.35);color:#ECF3ED}
.cl .tab[aria-pressed="true"]{background:rgba(224,123,62,.16);border-color:rgba(224,123,62,.5);color:#fff;box-shadow:0 0 16px -4px rgba(224,123,62,.6)}
.cl .lensHead{margin:26px 0 4px;padding-bottom:14px;border-bottom:1px solid #243029}
.cl .lensTitle{font-size:clamp(21px,3.4vw,26px);letter-spacing:-.015em}
.cl .lensTitle em{font-style:normal;color:#8FA495;font-weight:400}
.cl .tally{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:11.5px;color:#8FA495}
.cl .tally b{color:#ECF3ED;font-weight:600}.cl .tally .g{color:#F3A268}.cl .tally .lk{color:#A78BFA}
.cl .cov{display:flex;align-items:center;gap:16px;margin:14px 0 2px;padding:15px 17px;border:1px solid #243029;border-radius:14px;background:#0f1713}
.cl .cov .ck{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8FA495;margin-bottom:5px}
.cl .cov .big{font-family:'Fraunces',Georgia,serif;font-size:36px;line-height:.9;color:#8FD3A6;font-weight:600}
.cl .cov .bar{height:7px;border-radius:999px;background:#1b2620;overflow:hidden;margin-bottom:8px}
.cl .cov .bar i{display:block;height:100%;background:#8FD3A6;border-radius:999px;transition:width .5s ease}
.cl .cov .sub{font-size:11.5px;line-height:1.45;color:#8FA495}
.cl .fade{animation:clfade .25s ease both}@keyframes clfade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.cl .el{border-bottom:1px solid #243029;padding:22px 0 20px}
.cl .elIdx{font-size:11px;color:#61756A}
.cl .elName{font-size:15.5px;font-weight:600;letter-spacing:-.01em;margin-top:5px;line-height:1.35;max-width:60ch}
.cl .elNote{font-size:11.5px;color:#8FA495;margin-top:7px;max-width:62ch;line-height:1.45}
.cl .items{margin-top:14px;list-style:none;padding:0}
.cl .item{display:flex;gap:12px;padding:10px 0;border-top:1px solid #243029}.cl .item:first-child{border-top:none}
.cl .itemText{font-size:14px;line-height:1.5}.cl .itemMeta{font-size:11px;color:#61756A;margin-top:4px}
.cl .st{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.02em;padding:4px 8px;border-radius:6px;white-space:nowrap;height:fit-content;margin-top:2px;border:1px solid transparent}
.cl .st--linked{background:rgba(124,92,255,.16);border-color:rgba(167,139,250,.4);color:#A78BFA}
.cl .st--named{border-color:rgba(143,211,166,.4);color:#8FD3A6;background:rgba(143,211,166,.08)}
.cl .st--worker{border-color:#243029;color:#8FA495;background:#131C17}
.cl .st--counted{border-color:rgba(143,211,166,.25);color:#5E8770;background:rgba(143,211,166,.05)}
.cl .gapCard{margin-top:14px;border:1.5px solid rgba(224,123,62,.45);background:rgba(224,123,62,.06);border-radius:14px;padding:15px 16px 14px}
.cl .gapLabel{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#F3A268;display:flex;align-items:center;gap:9px}
.cl .gapLabel::before{content:"";width:7px;height:7px;border-radius:2px;background:#F3A268;box-shadow:0 0 10px #F3A268}
.cl .gapText{font-size:13.5px;line-height:1.5;margin-top:9px;max-width:62ch}
.cl .gapAct{margin-top:12px;font-family:'IBM Plex Mono',monospace;font-size:11.5px;background:transparent;border:1px solid rgba(224,123,62,.5);color:#F3A268;padding:8px 13px;cursor:pointer;border-radius:8px;transition:all .15s}
.cl .gapAct:hover{background:#E07B3E;border-color:#E07B3E;color:#fff}
.cl .gapAct.added{background:rgba(143,211,166,.12);border-color:rgba(143,211,166,.5);color:#8FD3A6}
.cl .gapAct.added:hover{background:rgba(143,211,166,.2);color:#8FD3A6}
.cl .cart{margin-top:26px;padding-top:20px;border-top:1px solid #243029}
.cl .cartHead{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8FA495;margin-bottom:6px}
.cl .cartTitle{font-size:17px;font-weight:600;letter-spacing:-.01em}
.cl .cartHint{font-size:13px;color:#8FA495;line-height:1.5;max-width:62ch;margin-top:9px}
.cl .cartHint b{color:#F3A268;font-weight:600}
.cl .statusToggle{display:inline-flex;gap:4px;background:#0f1713;border:1px solid #243029;border-radius:999px;padding:3px;margin-top:14px}
.cl .statusToggle button{font-family:'IBM Plex Mono',monospace;font-size:11.5px;padding:8px 14px;border-radius:999px;border:none;background:transparent;color:#8FA495;cursor:pointer;transition:all .15s}
.cl .statusToggle button[aria-pressed="true"]{background:rgba(224,123,62,.18);color:#fff}
.cl .statusNote{font-size:12px;color:#8FA495;line-height:1.45;margin-top:11px;max-width:62ch}
.cl .cartItems{list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:7px}
.cl .cartItems li{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#131C17;border:1px solid #243029;border-radius:10px;padding:9px 12px;font-size:13.5px}
.cl .cartItems button{background:none;border:none;color:#8FA495;font-size:17px;line-height:1;cursor:pointer;padding:0 2px}
.cl .cartItems button:hover{color:#F3A268}
.cl .copyBtn{margin-top:15px;font-size:13px;font-weight:600;padding:11px 19px;border-radius:999px;cursor:pointer;border:1px solid rgba(143,211,166,.5);background:rgba(143,211,166,.12);color:#8FD3A6;transition:all .15s}
.cl .copyBtn:hover{background:rgba(143,211,166,.2)}
.cl .cartOut{margin-top:13px;background:#0e1512;border:1px solid #243029;border-radius:11px;padding:13px 15px;font-family:'IBM Plex Mono',monospace;font-size:11.5px;line-height:1.55;color:#A9BBAD;white-space:pre-wrap;max-height:240px;overflow:auto}
.cl .foot{margin-top:26px;padding-top:18px;border-top:1px solid #243029}
.cl .footLine{font-size:14.5px;color:#8FD3A6}
.cl .footNote{font-size:11.5px;color:#8FA495;margin-top:7px;line-height:1.55;max-width:64ch}
`;

export function ClaimLensDemoPage() {
  const [activeId, setActiveId] = useState('retaliation');
  const lens = LENSES.find((l) => l.id === activeId) ?? LENSES[0];

  // Gap cart — the attorney clicks "no material on file" cards to build a list. Client-status-aware
  // (prospect → records the worker gathers; signed → firm discovery worklist) so it never tasks a
  // non-client. Gaps are theory-specific → a new lens starts a fresh list.
  const [cart, setCart] = useState<GapItem[]>([]);
  const [clientStatus, setClientStatus] = useState<ClientStatus>('prospect');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCart([]); setCopied(false); }, [activeId]);
  const inCart = (key: string) => cart.some((g) => g.key === key);
  const toggleCart = (g: GapItem) => {
    setCopied(false);
    setCart((c) => (c.some((x) => x.key === g.key) ? c.filter((x) => x.key !== g.key) : [...c, g]));
  };
  const copyCart = async () => {
    try {
      await navigator.clipboard.writeText(buildCartOutput(cart, clientStatus, lens.title));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  let linked = 0, named = 0, worker = 0, counted = 0, gaps = 0;
  for (const el of lens.elements) {
    if (el.empty) { gaps += 1; continue; }
    for (const it of el.items ?? []) {
      if (it.state === 'linked') linked += 1;
      else if (it.state === 'named') named += 1;
      else if (it.state === 'worker') worker += 1;
      else if (it.state === 'counted') counted += 1;
    }
  }
  // Coverage Rate: share of this claim's elements with any material on file — a record fact, not merit.
  const totalEls = lens.elements.length;
  const withMaterial = totalEls - gaps;
  const covPct = totalEls ? Math.round((withMaterial / totalEls) * 100) : 0;

  return (
    <div className="cl">
      <style>{CSS}</style>
      <div className="page">
        <div className="top">
          <div className="brand">
            <div className="spark serif">137</div>
            <div><b>one3seven</b> <em className="mono">· firm workspace</em></div>
          </div>
          <div className="crumb mono">Intake 2026-0612-MR</div>
        </div>
        <h1 className="subject serif">Marcus Reyes</h1>
        <div className="subjectMeta">Warehouse associate · Medline Industries, Tracy CA · Intake received Jun 18, 2026</div>

        <div className="checks">
          <div className="checksHead mono">On file / not on file</div>
          <div className="checkGrid">
            {CHECKS.map((c) => (
              <div className="check" key={c.label}>
                <div className="k">{c.label}</div>
                <div className={`v ${c.present ? 'ok' : 'absent'}`}>{c.value}</div>
                <div className="n mono">{c.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lensBar">
          <div className="lensLabel mono">Select a lens</div>
          <div className="tabs">
            {LENSES.map((l) => (
              <button key={l.id} type="button" className="tab" aria-pressed={l.id === activeId} onClick={() => setActiveId(l.id)}>
                {l.tab}
              </button>
            ))}
          </div>
        </div>

        <div className="lensHead">
          <div className="lensTitle serif">{lens.title} <em>— Elements &amp; Available Material</em></div>
          <div className="cov">
            <div>
              <div className="ck">Element coverage</div>
              <div className="big">{covPct}%</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="bar"><i style={{ width: `${covPct}%` }} /></div>
              <div className="sub">{withMaterial} of {totalEls} elements have material on file. A structural fact about the record — not an assessment of the case.</div>
            </div>
          </div>
          <div className="tally mono">
            <span><b>{linked + named + worker + counted}</b> items</span>
            <span className="lk"><b>{linked}</b> source-linked</span>
            <span><b>{named}</b> documents on file</span>
            <span><b>{worker}</b> worker-stated</span>
            <span className="g">{gaps} element{gaps === 1 ? '' : 's'} with no material on file</span>
          </div>
        </div>

        <div key={activeId} className="fade">
          {lens.elements.map((el, i) => (
            <section className="el" key={el.name}>
              <div className="elIdx mono">Element {String(i + 1).padStart(2, '0')} · firm-configured</div>
              <h2 className="elName">{el.name}</h2>
              {el.note ? <div className="elNote">{el.note}</div> : null}
              {el.empty ? (
                <div className="gapCard">
                  <div className="gapLabel">No material on file for this element</div>
                  <p className="gapText">{el.empty}</p>
                  <button
                    type="button"
                    className={`gapAct ${inCart(el.name) ? 'added' : ''}`}
                    onClick={() => toggleCart({ key: el.name, element: el.name, note: el.empty || 'no material on file' })}
                  >
                    {inCart(el.name) ? '✓ Added to list' : '+ Add to list'}
                  </button>
                </div>
              ) : (
                <ul className="items">
                  {(el.items ?? []).map((it, j) => (
                    <li className="item" key={j}>
                      <span className={`st st--${it.state}`}>{STATE_LABEL[it.state]}{it.state === 'linked' ? ' »' : ''}</span>
                      <div>
                        <div className="itemText">{it.text}</div>
                        <div className="itemMeta mono">{it.meta}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Gap cart — absence becomes an action the attorney CHOOSES. Client-status-aware so it never
            tasks a non-client. Names absences only; draws no conclusion. */}
        <section className="cart">
          <div className="cartHead mono">Your list · {cart.length} item{cart.length === 1 ? '' : 's'} · from this theory&rsquo;s gaps</div>
          <div className="cartTitle serif">Build a request from what isn&rsquo;t on file</div>
          {cart.length === 0 ? (
            <p className="cartHint">
              Click <b>&ldquo;+ Add to list&rdquo;</b> on any element with no material on file. Selected gaps become a records
              request the worker can gather, or your own discovery worklist — your call.
            </p>
          ) : (
            <>
              <div className="statusToggle" role="group" aria-label="Client status">
                <button type="button" aria-pressed={clientStatus === 'prospect'} onClick={() => { setClientStatus('prospect'); setCopied(false); }}>
                  Prospect — not yet signed
                </button>
                <button type="button" aria-pressed={clientStatus === 'client'} onClick={() => { setClientStatus('client'); setCopied(false); }}>
                  Signed client
                </button>
              </div>
              <p className="statusNote">
                {clientStatus === 'prospect'
                  ? 'Pre-representation: these become records the worker can request on their own — worker-owned, worker-sent. one3seven composes; they send.'
                  : 'Client is represented: these become your own discovery / follow-up worklist. Confirm representation before directing records-gathering.'}
              </p>
              <ul className="cartItems">
                {cart.map((g) => (
                  <li key={g.key}>
                    <span>{g.element}</span>
                    <button type="button" onClick={() => toggleCart(g)} aria-label={`Remove ${g.element}`}>×</button>
                  </li>
                ))}
              </ul>
              <button type="button" className="copyBtn" onClick={copyCart}>
                {copied ? '✓ Copied' : clientStatus === 'prospect' ? 'Copy records request (worker)' : 'Copy discovery worklist'}
              </button>
              <pre className="cartOut">{buildCartOutput(cart, clientStatus, lens.title)}</pre>
            </>
          )}
        </section>

        <footer className="foot">
          <div className="footLine serif">one3seven organizes and reflects. It draws no conclusions.</div>
          <p className="footNote">
            Illustrative sample. Element sets are configured by the firm. Every item is shown with the source it came from,
            in the order it appears in the record, whichever way it points. Nothing is ranked, weighted, or left out.
          </p>
        </footer>
      </div>
    </div>
  );
}
