import { useEffect, useMemo, useState } from 'react';
import {
  CLAIM_LENSES,
  buildClaimLensView,
  lensEligibleForStrongestRanking,
  type ClaimLensInput,
  type LensSourceState,
} from '../../services/claimLens';
import { buildCartOutput, type ClientStatus, type GapItem } from '../../services/claimLensGapActions';

/**
 * Firm-side Claim Lens on a REAL intake. The attorney selects a lens; the intake's own facts
 * re-sort around that claim's elements. Firm-access-gated (this screen already requires full access);
 * counsel-gated before any real firm is given the feature. Organizes, never concludes.
 */

const STATE_LABEL: Record<LensSourceState, string> = {
  linked: 'Source-linked',
  named: 'Document on file',
  worker: 'Worker-stated',
  counted: 'Counted',
};

const CSS = `
.clp{color:#ECF3ED;border:1px solid #243029;border-radius:20px;overflow:hidden;
  background:linear-gradient(180deg,rgba(19,28,23,.85),rgba(12,18,14,.85));font-family:inherit}
.clp .pad{padding:20px 22px}
.clp .cap{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#A78BFA;display:flex;align-items:center;gap:9px;margin-bottom:4px}
.clp .cap .p{width:7px;height:7px;border-radius:50%;background:#A78BFA;box-shadow:0 0 8px #A78BFA}
.clp .lead{font-family:'Fraunces',Georgia,serif;font-size:20px;letter-spacing:-.01em;margin-bottom:2px}
.clp .sub{font-size:12.5px;color:#8FA495}
.clp .checks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
@media(max-width:640px){.clp .checks{grid-template-columns:1fr 1fr}}
.clp .check{background:#131C17;border:1px solid #243029;border-radius:10px;padding:9px 11px}
.clp .check .k{font-size:10.5px;color:#8FA495;margin-bottom:3px}
.clp .check .v{font-size:12.5px;font-weight:500}
.clp .check .v.absent{color:#F3A268}.clp .check .v.ok{color:#8FD3A6}
.clp .check .n{font-size:10px;color:#61756A;margin-top:2px}
.clp .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
.clp .tab{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11.5px;padding:8px 13px;border:1px solid #243029;background:#131C17;color:#8FA495;cursor:pointer;border-radius:999px;transition:all .15s}
.clp .tab:hover{border-color:rgba(143,211,166,.35);color:#ECF3ED}
.clp .tab[aria-pressed="true"]{background:rgba(224,123,62,.16);border-color:rgba(224,123,62,.5);color:#fff;box-shadow:0 0 16px -4px rgba(224,123,62,.6)}
.clp .lensHead{margin:20px 0 2px;padding-bottom:12px;border-bottom:1px solid #243029}
.clp .lensTitle{font-family:'Fraunces',Georgia,serif;font-size:19px;letter-spacing:-.01em}
.clp .lensTitle em{font-style:normal;color:#8FA495;font-weight:400}
.clp .tally{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#8FA495}
.clp .tally b{color:#ECF3ED;font-weight:600}.clp .tally .g{color:#F3A268}.clp .tally .lk{color:#A78BFA}
.clp .el{border-bottom:1px solid #243029;padding:18px 0 16px}.clp .el:last-child{border-bottom:none}
.clp .elIdx{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10.5px;color:#61756A}
.clp .elName{font-size:15px;font-weight:600;letter-spacing:-.01em;margin-top:4px;line-height:1.35;max-width:60ch}
.clp .elNote{font-size:11px;color:#8FA495;margin-top:6px;max-width:62ch;line-height:1.45}
.clp .items{margin-top:12px;list-style:none;padding:0}
.clp .item{display:flex;gap:11px;padding:9px 0;border-top:1px solid #243029}.clp .item:first-child{border-top:none}
.clp .item.clickable{cursor:pointer;border-radius:9px;margin:0 -8px;padding-left:8px;padding-right:8px;transition:background .12s}
.clp .item.clickable:hover{background:rgba(167,139,250,.10)}
.clp .item.clickable:hover .st--linked{background:rgba(124,92,255,.28)}
.clp .itemText{font-size:13.5px;line-height:1.5}.clp .itemMeta{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10.5px;color:#61756A;margin-top:3px}
.clp .st{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.02em;padding:4px 7px;border-radius:6px;white-space:nowrap;height:fit-content;margin-top:2px;border:1px solid transparent}
.clp .st--linked{background:rgba(124,92,255,.16);border-color:rgba(167,139,250,.4);color:#A78BFA}
.clp .st--named{border-color:rgba(143,211,166,.4);color:#8FD3A6;background:rgba(143,211,166,.08)}
.clp .st--worker{border-color:#243029;color:#8FA495;background:#131C17}
.clp .st--counted{border-color:rgba(143,211,166,.25);color:#5E8770;background:rgba(143,211,166,.05)}
.clp .gapCard{margin-top:12px;border:1.5px solid rgba(224,123,62,.45);background:rgba(224,123,62,.06);border-radius:12px;padding:13px 15px 12px}
.clp .gapLabel{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#F3A268;display:flex;align-items:center;gap:8px}
.clp .gapLabel::before{content:"";width:6px;height:6px;border-radius:2px;background:#F3A268;box-shadow:0 0 8px #F3A268}
.clp .gapText{font-size:12.5px;line-height:1.5;margin-top:8px;max-width:62ch}
.clp .foot{font-size:11px;color:#8FA495;line-height:1.5;background:#0e1512;border-top:1px solid #243029;padding:14px 22px}
.clp .foot b{color:#8FD3A6;font-weight:500}
.clp .cov{display:flex;align-items:center;gap:16px;margin:16px 0 2px;padding:15px 17px;border:1px solid #243029;border-radius:14px;background:#0f1713}
.clp .cov .ck{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8FA495;margin-bottom:5px}
.clp .cov .big{font-family:'Fraunces',Georgia,serif;font-size:36px;line-height:.9;color:#8FD3A6;font-weight:600}
.clp .cov .bar{height:7px;border-radius:999px;background:#1b2620;overflow:hidden;margin-bottom:8px}
.clp .cov .bar i{display:block;height:100%;background:#8FD3A6;border-radius:999px;transition:width .5s ease}
.clp .cov .sub{font-size:11.5px;line-height:1.45;color:#8FA495}
.clp .addBtn{margin-top:11px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.02em;padding:7px 12px;border-radius:999px;cursor:pointer;border:1px solid rgba(224,123,62,.5);background:rgba(224,123,62,.1);color:#F3A268;transition:all .15s}
.clp .addBtn:hover{background:rgba(224,123,62,.18)}
.clp .addBtn.added{border-color:rgba(143,211,166,.5);background:rgba(143,211,166,.1);color:#8FD3A6}
.clp .cart{border-top:1px solid #243029;padding:18px 0 4px;margin-top:4px}
.clp .cartHint{font-size:12.5px;color:#8FA495;line-height:1.5;max-width:62ch;margin-top:8px}
.clp .cartHint b{color:#F3A268;font-weight:600}
.clp .statusToggle{display:inline-flex;gap:4px;background:#0f1713;border:1px solid #243029;border-radius:999px;padding:3px;margin-top:12px}
.clp .statusToggle button{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;padding:7px 13px;border-radius:999px;border:none;background:transparent;color:#8FA495;cursor:pointer;transition:all .15s}
.clp .statusToggle button[aria-pressed="true"]{background:rgba(224,123,62,.18);color:#fff}
.clp .statusNote{font-size:11.5px;color:#8FA495;line-height:1.45;margin-top:10px;max-width:62ch}
.clp .cartItems{list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:6px}
.clp .cartItems li{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#131C17;border:1px solid #243029;border-radius:9px;padding:8px 11px;font-size:13px}
.clp .cartItems button{background:none;border:none;color:#8FA495;font-size:16px;line-height:1;cursor:pointer;padding:0 2px}
.clp .cartItems button:hover{color:#F3A268}
.clp .copyBtn{margin-top:14px;font-size:12.5px;font-weight:600;padding:10px 18px;border-radius:999px;cursor:pointer;border:1px solid rgba(143,211,166,.5);background:rgba(143,211,166,.12);color:#8FD3A6;transition:all .15s}
.clp .copyBtn:hover{background:rgba(143,211,166,.2)}
.clp .cartOut{margin-top:12px;background:#0e1512;border:1px solid #243029;border-radius:10px;padding:12px 14px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;line-height:1.55;color:#A9BBAD;white-space:pre-wrap;max-height:220px;overflow:auto}
.clp .theoryRow{display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:20px}
.clp .theoryEyebrow{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8FA495;display:block;margin-bottom:4px}
.clp .covPill{font-size:12.5px;color:#8FA495}.clp .covPill b{color:#8FD3A6;font-weight:600}.clp .covPill .g{color:#F3A268}
.clp .otherTheories{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:12px}
.clp .ot-label{font-size:11px;color:#61756A}
.clp .ot-pill{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;padding:5px 11px;border:1px solid #243029;background:#131C17;color:#8FA495;border-radius:999px;cursor:pointer;transition:all .15s}
.clp .ot-pill:hover{border-color:rgba(143,211,166,.35);color:#ECF3ED}
.clp .lensSub{font-size:12px;color:#8FA495;margin:14px 0 4px;line-height:1.5}
.clp .elRow{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;background:none;border:none;text-align:left;padding:0;color:inherit;font:inherit}
.clp .elRow.tog{cursor:pointer}
.clp .elName2{font-size:14.5px;font-weight:600;letter-spacing:-.01em;line-height:1.35;max-width:60ch}
.clp .elState{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:#8FA495;white-space:nowrap;display:flex;align-items:center;gap:8px}
.clp .elState .chev{color:#61756A;font-size:13px;width:12px;text-align:center}
.clp .st--gap{background:rgba(224,123,62,.14);border:1px solid rgba(224,123,62,.45);color:#F3A268;padding:3px 8px;border-radius:6px}
`;

export function ClaimLensPanel({
  input,
  onOpenSource,
}: {
  input: ClaimLensInput;
  /** Open the source PDF at a snippet — wired to the firm screen's citation panel. */
  onOpenSource?: (fileName: string, snippet: string) => void;
}) {
  // Theories, ordered by where the material actually lives (highest element coverage first) — so the
  // strongest-covered claim leads and the rest fall back as secondary options. A manual pick overrides.
  // Ranking-gated wage lenses (see lensEligibleForStrongestRanking) are excluded from the
  // "strongest" pick unless the record carries a concrete pay-gap fact — they still appear as
  // selectable theory pills and render fully in their own tab.
  const orderedLenses = useMemo(
    () =>
      [...CLAIM_LENSES]
        .map((l) => ({
          ...l,
          score: buildClaimLensView(l.id, input).coverage.withMaterial,
          rankEligible: lensEligibleForStrongestRanking(l.id, input),
        }))
        .sort((a, b) => b.score - a.score),
    [input]
  );
  const defaultId = (orderedLenses.find((l) => l.rankEligible) ?? orderedLenses[0]).id;
  const [picked, setPicked] = useState<string | null>(null);
  const activeId = picked ?? defaultId;
  const view = useMemo(() => buildClaimLensView(activeId, input), [activeId, input]);

  // Covered elements collapse to a one-line row; gaps stay open (they're the actionable part).
  // The attorney expands a covered element on demand instead of scrolling the whole rubric.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAllTheories, setShowAllTheories] = useState(false);
  const toggleEl = (name: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  // Gap "cart" — the attorney clicks "no material on file" elements to build a list. Client-status-
  // aware: prospect → records the worker can gather (worker-owned); signed → firm discovery worklist.
  // Gaps are theory-specific, so a new theory starts a fresh list.
  const [cart, setCart] = useState<GapItem[]>([]);
  const [clientStatus, setClientStatus] = useState<ClientStatus>('prospect');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCart([]); setCopied(false); setExpanded(new Set()); }, [activeId]);
  const inCart = (key: string) => cart.some((g) => g.key === key);
  const toggleCart = (g: GapItem) => {
    setCopied(false);
    setCart((c) => (c.some((x) => x.key === g.key) ? c.filter((x) => x.key !== g.key) : [...c, g]));
  };
  const copyCart = async () => {
    try {
      await navigator.clipboard.writeText(buildCartOutput(cart, clientStatus, view.title));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="clp">
      <style>{CSS}</style>
      <div className="pad">
        <div className="cap"><span className="p" />Claim Lens</div>

        {/* One coverage indicator — no duplicate stat grids or tallies. */}
        <div className="theoryRow">
          <div>
            <span className="theoryEyebrow">Strongest-covered theory</span>
            <div className="lensTitle">{view.title}</div>
          </div>
          <div className="covPill">
            <b>{view.coverage.withMaterial} of {view.coverage.total}</b> elements on file
            {view.tally.gaps > 0 ? <span className="g"> · {view.tally.gaps} gap{view.tally.gaps === 1 ? '' : 's'}</span> : null}
          </div>
        </div>

        {/* Other theories fall back as secondary pills, ordered by coverage. Only the theories that
            actually have material show by default; the full rubric list hides behind "+N more". */}
        {(() => {
          const others = orderedLenses.filter((l) => l.id !== activeId);
          const matching = others.filter((l) => l.score > 0).slice(0, 5);
          const shown = showAllTheories ? others : matching;
          const hidden = others.length - shown.length;
          if (others.length === 0) return null;
          return (
            <div className="otherTheories">
              <span className="ot-label">{matching.length > 0 ? 'Also matches:' : 'Other theories:'}</span>
              {shown.map((l) => (
                <button key={l.id} type="button" className="ot-pill" onClick={() => setPicked(l.id)}>
                  {l.tab}
                </button>
              ))}
              {hidden > 0 ? (
                <button type="button" className="ot-pill" onClick={() => setShowAllTheories(true)}>
                  +{hidden} more
                </button>
              ) : null}
            </div>
          );
        })()}

        <div className="lensSub">one3seven shows what&rsquo;s on file for each element and what isn&rsquo;t. Gaps are open below; covered elements collapse — click to expand. It draws no conclusions.</div>

        {view.elements.map((el) => {
          const isGap = !!el.empty;
          const isOpen = isGap || expanded.has(el.name);
          return (
            <section className="el" key={el.name}>
              <button
                type="button"
                className={`elRow${isGap ? '' : ' tog'}`}
                onClick={isGap ? undefined : () => toggleEl(el.name)}
                aria-expanded={isOpen}
              >
                <span className="elName2">{el.name}</span>
                <span className="elState">
                  {isGap ? (
                    <span className="st st--gap">no material</span>
                  ) : (
                    <>
                      {el.items.length} item{el.items.length === 1 ? '' : 's'}
                      <span className="chev">{isOpen ? '–' : '+'}</span>
                    </>
                  )}
                </span>
              </button>
              {isOpen && el.note ? <div className="elNote" style={{ marginTop: 8 }}>{el.note}</div> : null}
              {isGap ? (
                <div className="gapCard">
                  <div className="gapLabel">No material on file for this element</div>
                  <p className="gapText">{el.empty}</p>
                  <button
                    type="button"
                    className={`addBtn ${inCart(el.name) ? 'added' : ''}`}
                    onClick={() => toggleCart({ key: el.name, element: el.name, note: el.empty || 'no material on file' })}
                  >
                    {inCart(el.name) ? '✓ Added to list' : '+ Add to list'}
                  </button>
                </div>
              ) : isOpen ? (
                <ul className="items">
                  {el.items.map((it, j) => {
                    const clickable = it.state === 'linked' && !!it.sourceFile && !!onOpenSource;
                    const open = () => onOpenSource?.(it.sourceFile as string, it.snippet ?? it.text);
                    return (
                      <li
                        className={`item${clickable ? ' clickable' : ''}`}
                        key={j}
                        onClick={clickable ? open : undefined}
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : undefined}
                        title={clickable ? `Open ${it.sourceFile}` : undefined}
                      >
                        <span className={`st st--${it.state}`}>{STATE_LABEL[it.state]}{it.state === 'linked' ? ' »' : ''}</span>
                        <div>
                          <div className="itemText">{it.text}</div>
                          <div className="itemMeta">{it.meta}{clickable ? ' · open source ↗' : ''}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}

        {/* The gap cart — the attorney clicks "no material on file" elements above to build a list.
            Absence becomes an ACTION the attorney chooses to take, scoped to the selected lens.
            Client-status-aware so it never tasks a non-client: prospect → records the worker gathers
            (worker-owned); signed → the firm's own discovery worklist. Names absences, never concludes. */}
        <section className="cart">
          <div className="elIdx">Your list · {cart.length} item{cart.length === 1 ? '' : 's'} · from this theory&rsquo;s gaps</div>
          <h4 className="elName">Build a request from what isn&rsquo;t on file</h4>
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
              <pre className="cartOut">{buildCartOutput(cart, clientStatus, view.title)}</pre>
            </>
          )}
        </section>
      </div>
      <div className="foot">
        <b>one3seven organizes and reflects. It draws no conclusions.</b> Element sets are a starting rubric, configurable by the firm. Every matching item is shown with its source, whichever way it points. Nothing is ranked, weighted, or left out.
      </div>
    </div>
  );
}
