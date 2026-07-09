/**
 * Hero animation — the intake packet assembles itself in place: the card reveals, the
 * timeline spine draws, and source-linked events stagger in. Plays once, then settles.
 *
 * Normal responsive flow (width:100% + max-width, content-driven height) — no fixed stage
 * and no transform scaling, so it can never clip or overflow on mobile. Respects
 * prefers-reduced-motion (shows the resolved packet immediately).
 */

const CSS = `
.hp-wrap{width:100%;max-width:380px;margin:0 auto;position:relative;padding:8px 0}
.hp-glow{position:absolute;inset:-10% 0;background:radial-gradient(60% 55% at 50% 45%,rgba(124,92,255,0.28),transparent 70%);opacity:0;animation:hpGlow 1s .1s ease forwards;pointer-events:none}
.hp-card{position:relative;background:#FAF9F6;border-radius:16px;padding:18px;opacity:0;transform:translateY(12px) scale(.98);animation:hpIn .7s .15s cubic-bezier(.22,1,.36,1) forwards}
.hp-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.hp-tag{font:700 11px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:0.14em;color:#42574E}
.hp-pill{font:600 10px/1 -apple-system,sans-serif;color:#0F6E56;background:rgba(29,158,117,0.14);border-radius:20px;padding:5px 10px;white-space:nowrap;opacity:0;transform:scale(.8);animation:hpPop .4s .7s cubic-bezier(.34,1.56,.64,1) forwards}
.hp-sub{font:500 12px/1.4 -apple-system,sans-serif;color:#6A6D66;margin-top:6px}
.hp-cats{margin:10px 0 4px;font:600 10px/1.5 -apple-system,sans-serif;color:#42574E}
.hp-tl{font:700 9px/1 -apple-system,sans-serif;letter-spacing:0.12em;color:#7C857F;margin:12px 0 10px}
.hp-rows{position:relative;padding-left:20px}
.hp-spine{position:absolute;left:5px;top:4px;bottom:4px;width:2px;background:#E2DAF3;transform:scaleY(0);transform-origin:top;animation:hpSpine .7s .8s ease forwards}
.hp-row{position:relative;margin-bottom:13px;opacity:0;transform:translateX(8px);animation:hpRow .5s ease forwards}
.hp-row:last-child{margin-bottom:0}
.hp-r1{animation-delay:1s}.hp-r2{animation-delay:1.2s}.hp-r3{animation-delay:1.4s}
.hp-node{position:absolute;left:-20px;top:3px;width:12px;height:12px;border-radius:50%;background:#42574E;box-shadow:0 0 0 4px #FAF9F6}
.hp-date{font:600 10px/1.3 -apple-system,sans-serif;color:#7C5CF0}
.hp-ev{font:600 14px/1.35 -apple-system,sans-serif;color:#1B2623}
.hp-src{display:inline-flex;gap:5px;margin-top:5px;font:600 10px/1 -apple-system,sans-serif;color:#42574E;background:rgba(109,74,255,0.10);border-radius:6px;padding:4px 8px}
.hp-foot{border-top:0.5px solid #E7DEF7;margin-top:14px;padding-top:11px;font:500 11px/1.5 -apple-system,sans-serif;color:#7C857F;opacity:0;animation:hpRow .5s 1.6s ease forwards}
@keyframes hpIn{to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes hpGlow{to{opacity:1}}
@keyframes hpPop{to{opacity:1;transform:scale(1)}}
@keyframes hpSpine{to{transform:scaleY(1)}}
@keyframes hpRow{to{opacity:1;transform:translateX(0)}}
@media (prefers-reduced-motion: reduce){
  .hp-card,.hp-pill,.hp-row,.hp-foot,.hp-glow{opacity:1;transform:none;animation:none}
  .hp-spine{transform:scaleY(1);animation:none}
}
`;

export function HeroAnimation() {
  return (
    <div className="hp-wrap" role="img" aria-label="An organized, source-linked employment intake timeline: concern raised with HR, written warning, and termination — each traced to its source document.">
      <style>{CSS}</style>
      <div className="hp-glow" />
      <div className="hp-card">
        <div className="hp-head">
          <span className="hp-tag">INTAKE READY</span>
          <span className="hp-pill">● Ready for review</span>
        </div>
        <div className="hp-sub">Employment matter · California · 7 records organized</div>
        <div className="hp-cats">Payroll · HR &amp; complaints · Communications · Separation</div>
        <div className="hp-tl">TIMELINE</div>
        <div className="hp-rows">
          <div className="hp-spine" />
          <div className="hp-row hp-r1">
            <span className="hp-node" />
            <div className="hp-date">Sep 9, 2024</div>
            <div className="hp-ev">Concern raised with HR</div>
            <span className="hp-src">⎘ hr-complaint.pdf · p.1</span>
          </div>
          <div className="hp-row hp-r2">
            <span className="hp-node" />
            <div className="hp-date">May 14, 2025</div>
            <div className="hp-ev">Written warning issued</div>
            <span className="hp-src">⎘ warning-notice.pdf · p.1</span>
          </div>
          <div className="hp-row hp-r3">
            <span className="hp-node" style={{ background: '#39415f' }} />
            <div className="hp-date">Jun 2, 2025</div>
            <div className="hp-ev">Termination</div>
            <span className="hp-src">⎘ separation-letter.pdf · p.2</span>
          </div>
        </div>
        <div className="hp-foot">Organizes &amp; reflects — every fact traces to its source record. Not legal advice.</div>
      </div>
    </div>
  );
}
