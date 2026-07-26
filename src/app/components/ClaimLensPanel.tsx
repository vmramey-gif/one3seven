import { useMemo, useState } from 'react';
import {
  CLAIM_LENSES,
  buildClaimLensView,
  buildExistenceChecks,
  type ClaimLensInput,
  type LensSourceState,
} from '../../services/claimLens';

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
`;

export function ClaimLensPanel({ input }: { input: ClaimLensInput }) {
  const [activeId, setActiveId] = useState(CLAIM_LENSES[0].id);
  const view = useMemo(() => buildClaimLensView(activeId, input), [activeId, input]);
  const checks = useMemo(() => buildExistenceChecks(input), [input]);

  return (
    <div className="clp">
      <style>{CSS}</style>
      <div className="pad">
        <div className="cap"><span className="p" />Claim Lens</div>
        <div className="lead">Pick a theory — the record re-sorts by its elements.</div>
        <div className="sub">Organized from this intake. one3seven shows what's on file for each element, and what isn't. It draws no conclusions.</div>

        <div className="checks">
          {checks.map((c) => (
            <div className="check" key={c.label}>
              <div className="k">{c.label}</div>
              <div className={`v ${c.present ? 'ok' : 'absent'}`}>{c.value}</div>
              {c.note ? <div className="n">{c.note}</div> : null}
            </div>
          ))}
        </div>

        <div className="tabs">
          {CLAIM_LENSES.map((l) => (
            <button key={l.id} type="button" className="tab" aria-pressed={l.id === activeId} onClick={() => setActiveId(l.id)}>
              {l.tab}
            </button>
          ))}
        </div>

        <div className="lensHead">
          <div className="lensTitle">{view.title} <em>— Elements &amp; Available Material</em></div>

          <div className="cov">
            <div>
              <div className="ck">Element coverage</div>
              <div className="big">{view.coverage.pct}%</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="bar"><i style={{ width: `${view.coverage.pct}%` }} /></div>
              <div className="sub">
                {view.coverage.withMaterial} of {view.coverage.total} elements have material on file. A structural fact about the record — not an assessment of the case.
              </div>
            </div>
          </div>

          <div className="tally">
            <span><b>{view.tally.total}</b> items</span>
            <span className="lk"><b>{view.tally.linked}</b> source-linked</span>
            <span><b>{view.tally.named}</b> on file</span>
            <span><b>{view.tally.worker}</b> worker-stated</span>
            <span className="g">{view.tally.gaps} element{view.tally.gaps === 1 ? '' : 's'} with no material on file</span>
          </div>
        </div>

        {view.elements.map((el, i) => (
          <section className="el" key={el.name}>
            <div className="elIdx">Element {String(i + 1).padStart(2, '0')} · firm-configured</div>
            <h4 className="elName">{el.name}</h4>
            {el.note ? <div className="elNote">{el.note}</div> : null}
            {el.empty ? (
              <div className="gapCard">
                <div className="gapLabel">No material on file for this element</div>
                <p className="gapText">{el.empty}</p>
              </div>
            ) : (
              <ul className="items">
                {el.items.map((it, j) => (
                  <li className="item" key={j}>
                    <span className={`st st--${it.state}`}>{STATE_LABEL[it.state]}{it.state === 'linked' ? ' »' : ''}</span>
                    <div>
                      <div className="itemText">{it.text}</div>
                      <div className="itemMeta">{it.meta}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div className="foot">
        <b>one3seven organizes and reflects. It draws no conclusions.</b> Element sets are a starting rubric, configurable by the firm. Every matching item is shown with its source, whichever way it points. Nothing is ranked, weighted, or left out.
      </div>
    </div>
  );
}
