/**
 * Hero animation — six distinct employment records spill in, pop, and converge into a
 * source-linked "INTAKE READY" packet, then settle (plays once on mount, no loop).
 *
 * Responsive by design: the scene is authored at a fixed 380×340 "stage" and scaled to the
 * container width via CSS container queries (100cqw), so convergence stays pixel-correct and
 * never overflows on mobile. Pure CSS keyframes; respects prefers-reduced-motion.
 */

const CSS = `
.ha-wrap{position:relative;container-type:inline-size;width:100%;max-width:460px;margin:0 auto;aspect-ratio:380/312;overflow:hidden}
.ha-stage{position:absolute;top:0;left:0;width:380px;height:312px;transform-origin:top left;transform:scale(calc(100cqw / 380))}
.ha-glow{position:absolute;width:300px;height:300px;left:50%;top:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(124,92,255,0.22),transparent 60%);opacity:0;animation:haGlow 1.4s 2.4s ease forwards}
.ha-doc{position:absolute;width:94px;border-radius:9px;background:#FAF9F6;padding:8px 9px;opacity:0;box-shadow:0 10px 28px rgba(0,0,0,0.40)}
.ha-lbl{font:700 7px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:0.08em;margin-bottom:6px}
.ha-bub{height:9px;border-radius:6px;margin-bottom:4px}
.ha-ln{height:4px;border-radius:2px;background:#E2DAF3;margin-bottom:4px}
.ha-prow{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.ha-cell{width:13px;height:11px;border-radius:2px;background:#ECE7F8}
.ha-card{position:absolute;left:50%;top:50%;width:272px;transform:translate(-50%,-50%) scale(0.9);opacity:0;background:#FAF9F6;border-radius:14px;padding:11px 13px;animation:haCard 1s 2.3s cubic-bezier(.34,1.4,.64,1) forwards}
.ha-tag{font:700 9px/1 -apple-system,sans-serif;letter-spacing:0.14em;color:#5B21B6}
.ha-pill{float:right;font:600 9px/1 -apple-system,sans-serif;color:#0F6E56;background:rgba(29,158,117,0.14);border-radius:20px;padding:4px 8px}
.ha-sub{font:500 10px/1.3 -apple-system,sans-serif;color:#6B6685;margin-top:4px}
.ha-cats{margin:6px 0 2px;font:600 8px/1.4 -apple-system,sans-serif;color:#5B21B6}
.ha-tl{font:700 8px/1 -apple-system,sans-serif;letter-spacing:0.1em;color:#8B86A0;margin:7px 0 5px}
.ha-row{display:flex;gap:9px;opacity:0;transform:translateX(6px);margin-bottom:6px;animation:haRow .5s ease forwards}
.ha-r1{animation-delay:3s}.ha-r2{animation-delay:3.25s}.ha-r3{animation-delay:3.5s}
.ha-node{width:10px;height:10px;border-radius:50%;background:#6D4AFF;flex:none;margin-top:2px}
.ha-date{font:600 8.5px/1.2 -apple-system,sans-serif;color:#7C5CF0}
.ha-ev{font:600 11px/1.3 -apple-system,sans-serif;color:#14112E}
.ha-src{display:inline-flex;gap:4px;margin-top:4px;font:600 8px/1 -apple-system,sans-serif;color:#5B21B6;background:rgba(109,74,255,0.10);border-radius:5px;padding:3px 6px}
.ha-foot{border-top:0.5px solid #E7DEF7;margin-top:5px;padding-top:6px;font:500 8.5px/1.4 -apple-system,sans-serif;color:#8B86A0}
.ha-f1{animation:haF1 3s cubic-bezier(.5,0,.2,1) forwards}
.ha-f2{animation:haF2 3s .1s cubic-bezier(.5,0,.2,1) forwards}
.ha-f3{animation:haF3 3s .05s cubic-bezier(.5,0,.2,1) forwards}
.ha-f4{animation:haF4 3s .15s cubic-bezier(.5,0,.2,1) forwards}
.ha-f5{animation:haF5 3s .2s cubic-bezier(.5,0,.2,1) forwards}
.ha-f6{animation:haF6 3s .08s cubic-bezier(.5,0,.2,1) forwards}
@keyframes haF1{0%{opacity:0;transform:translate(0,0) rotate(-20deg) scale(.8)}10%{opacity:1;transform:translate(0,0) rotate(-16deg) scale(1.06)}20%{transform:translate(0,0) rotate(-16deg) scale(1)}52%{opacity:1;transform:translate(0,0) rotate(-16deg) scale(1)}100%{opacity:0;transform:translate(150px,120px) rotate(0) scale(.22)}}
@keyframes haF2{0%{opacity:0;transform:translate(0,0) rotate(15deg) scale(.8)}10%{opacity:1;transform:translate(0,0) rotate(12deg) scale(1.06)}20%{transform:translate(0,0) rotate(12deg) scale(1)}52%{opacity:1;transform:translate(0,0) rotate(12deg) scale(1)}100%{opacity:0;transform:translate(-80px,125px) rotate(0) scale(.22)}}
@keyframes haF3{0%{opacity:0;transform:translate(0,0) rotate(13deg) scale(.8)}10%{opacity:1;transform:translate(0,0) rotate(9deg) scale(1.06)}20%{transform:translate(0,0) rotate(9deg) scale(1)}52%{opacity:1;transform:translate(0,0) rotate(9deg) scale(1)}100%{opacity:0;transform:translate(160px,-50px) rotate(0) scale(.22)}}
@keyframes haF4{0%{opacity:0;transform:translate(0,0) rotate(-12deg) scale(.8)}10%{opacity:1;transform:translate(0,0) rotate(-9deg) scale(1.06)}20%{transform:translate(0,0) rotate(-9deg) scale(1)}52%{opacity:1;transform:translate(0,0) rotate(-9deg) scale(1)}100%{opacity:0;transform:translate(-85px,-55px) rotate(0) scale(.22)}}
@keyframes haF5{0%{opacity:0;transform:translate(0,0) rotate(-7deg) scale(.8)}10%{opacity:1;transform:translate(0,0) rotate(-5deg) scale(1.06)}20%{transform:translate(0,0) rotate(-5deg) scale(1)}52%{opacity:1;transform:translate(0,0) rotate(-5deg) scale(1)}100%{opacity:0;transform:translate(45px,130px) rotate(0) scale(.22)}}
@keyframes haF6{0%{opacity:0;transform:translate(0,0) rotate(9deg) scale(.8)}10%{opacity:1;transform:translate(0,0) rotate(6deg) scale(1.06)}20%{transform:translate(0,0) rotate(6deg) scale(1)}52%{opacity:1;transform:translate(0,0) rotate(6deg) scale(1)}100%{opacity:0;transform:translate(35px,-85px) rotate(0) scale(.22)}}
@keyframes haCard{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes haGlow{to{opacity:1}}
@keyframes haRow{to{opacity:1;transform:translateX(0)}}
@media (prefers-reduced-motion: reduce){
  .ha-doc,.ha-glow{display:none}
  .ha-card{opacity:1;transform:translate(-50%,-50%) scale(1);animation:none}
  .ha-row{opacity:1;transform:none;animation:none}
}
`;

export function HeroAnimation() {
  return (
    <div className="ha-wrap" role="img" aria-label="Scattered employment records — texts, a pay stub, an HR complaint, an email, a schedule, and a written warning — converge into an organized, source-linked intake timeline.">
      <style>{CSS}</style>
      <div className="ha-stage">
        <div className="ha-glow" />

        <div className="ha-doc ha-f1" style={{ left: '4%', top: '7%' }}>
          <div className="ha-lbl" style={{ color: '#6D4AFF' }}>TEXT MESSAGES</div>
          <div className="ha-bub" style={{ width: '62%', background: '#E2DAF3' }} />
          <div className="ha-bub" style={{ width: '74%', background: '#6D4AFF', marginLeft: 'auto' }} />
          <div className="ha-bub" style={{ width: '48%', background: '#E2DAF3' }} />
        </div>

        <div className="ha-doc ha-f2" style={{ left: '72%', top: '5%' }}>
          <div className="ha-lbl" style={{ color: '#39415f' }}>PAY STUB</div>
          <div className="ha-prow"><span className="ha-ln" style={{ width: '46%', margin: 0 }} /><span className="ha-cell" /></div>
          <div className="ha-prow"><span className="ha-ln" style={{ width: '54%', margin: 0 }} /><span className="ha-cell" /></div>
          <div className="ha-prow"><span className="ha-ln" style={{ width: '40%', margin: 0, background: '#6D4AFF' }} /><span className="ha-cell" style={{ background: '#6D4AFF' }} /></div>
        </div>

        <div className="ha-doc ha-f3" style={{ left: '3%', top: '64%' }}>
          <div className="ha-lbl" style={{ color: '#993C1D' }}>HR COMPLAINT</div>
          <div className="ha-ln" style={{ width: '90%' }} /><div className="ha-ln" style={{ width: '78%' }} /><div className="ha-ln" style={{ width: '85%' }} /><div className="ha-ln" style={{ width: '50%' }} />
        </div>

        <div className="ha-doc ha-f4" style={{ left: '73%', top: '66%' }}>
          <div className="ha-lbl" style={{ color: '#185FA5' }}>EMAIL</div>
          <div className="ha-ln" style={{ width: '64%', background: '#C9D7EE' }} /><div className="ha-ln" style={{ width: '88%' }} /><div className="ha-ln" style={{ width: '72%' }} />
        </div>

        <div className="ha-doc ha-f5" style={{ left: '38%', top: '2%' }}>
          <div className="ha-lbl" style={{ color: '#5B21B6' }}>SCHEDULE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '3px' }}>
            <span className="ha-cell" /><span className="ha-cell" /><span className="ha-cell" style={{ background: '#6D4AFF' }} /><span className="ha-cell" />
            <span className="ha-cell" /><span className="ha-cell" style={{ background: '#C4B5FD' }} /><span className="ha-cell" /><span className="ha-cell" />
          </div>
        </div>

        <div className="ha-doc ha-f6" style={{ left: '40%', top: '74%' }}>
          <div className="ha-lbl" style={{ color: '#854F0B' }}>WRITTEN WARNING</div>
          <div className="ha-ln" style={{ width: '86%', background: '#F6E0BC' }} /><div className="ha-ln" style={{ width: '70%' }} /><div className="ha-ln" style={{ width: '54%' }} />
        </div>

        <div className="ha-card">
          <div><span className="ha-tag">INTAKE READY</span><span className="ha-pill">● Ready for review</span></div>
          <div className="ha-sub">Employment matter · California · 7 records organized</div>
          <div className="ha-cats">Payroll · HR &amp; complaints · Communications · Separation</div>
          <div className="ha-tl">TIMELINE</div>
          <div className="ha-row ha-r1"><span className="ha-node" /><span><span className="ha-date">Sep 9, 2024</span><br /><span className="ha-ev">Concern raised with HR</span><br /><span className="ha-src">⎘ hr-complaint.pdf · p.1</span></span></div>
          <div className="ha-row ha-r2"><span className="ha-node" /><span><span className="ha-date">May 14, 2025</span><br /><span className="ha-ev">Written warning issued</span><br /><span className="ha-src">⎘ warning-notice.pdf · p.1</span></span></div>
          <div className="ha-row ha-r3"><span className="ha-node" style={{ background: '#39415f' }} /><span><span className="ha-date">Jun 2, 2025</span><br /><span className="ha-ev">Termination</span><br /><span className="ha-src">⎘ separation-letter.pdf · p.2</span></span></div>
          <div className="ha-foot">Every fact traces to its source · not legal advice.</div>
        </div>
      </div>
    </div>
  );
}
