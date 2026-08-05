import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * Generic narrated training-film builder — one3seven FL sales-enablement system.
 * Data model (per slide, in the slides JSON):
 *   { card, kick, beat, title, displayText, obj, mean, say, sayClass, ask, note,
 *     sources:[{label,url,checked}], verifiedOn, reviewAfter, claimStatus }
 * narration lives separately in the lines JSON (key -> spoken text) and is index-matched.
 *
 * Usage:
 *   node build-training-film.mjs --id objections --lines ob.json --slides ob-slides.json \
 *        --voice objections --title "Objection Handling" --topmeta "Sales training · internal" \
 *        --accent orange [--public] OUT.html
 */
const A = process.argv.slice(2);
const flags = new Set(A.filter(a => a.startsWith('--') && !['--lines','--slides','--voice','--title','--topmeta','--accent','--id'].includes(a)));
function opt(n){ const i=A.indexOf('--'+n); return i>=0 ? A[i+1] : null; }
const PUBLIC = flags.has('--public');
const ROOT = resolve('.');
const ID = opt('id') || 'film';
const TITLE = opt('title') || 'Training film';
const TOPMETA = opt('topmeta') || 'Sales training · internal';
const ACCENT = opt('accent') || 'orange';
const linesPath = opt('lines'), slidesPath = opt('slides'), voiceDir = opt('voice');
const OUT = A.filter(a => a.endsWith('.html')).pop() || resolve(ROOT, ID + '.html');

const lines = JSON.parse(readFileSync(resolve(ROOT, linesPath), 'utf8'));
const keys = Object.keys(lines);
const S = JSON.parse(readFileSync(resolve(ROOT, slidesPath), 'utf8'));
if (S.length !== keys.length) { console.error(`!! slide/line count mismatch: ${S.length} slides vs ${keys.length} narration lines`); process.exit(1); }
const NARR = keys.map(k => lines[k]);
const AUDIO = keys.map(k => PUBLIC
  ? `/voice/${voiceDir}/${k}.mp3`
  : 'data:audio/mpeg;base64,' + readFileSync(resolve(ROOT, `public/voice/${voiceDir}/${k}.mp3`)).toString('base64'));

const ACC = ACCENT === 'sage'
  ? { main:'#8FB8A2', soft:'#12241C', ink:'#0E1512' }
  : { main:'#E08A4E', soft:'#2A1B10', ink:'#0E1512' };

const html = `<title>one3seven — ${TITLE}</title>
<style>
  :root{
    --bg:#0E1512;--bg2:#0A100D;--panel:#16201B;--ink:#ECF0E8;--soft:#9DA99F;--faint:#6B776E;
    --sage:#8FB8A2;--amber:#E0B84E;--red:#D97A6C;--acc:${ACC.main};--acc-soft:${ACC.soft};--line:#263029;
    --serif:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
    --sans:'Inter Tight',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    --mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,monospace;
  }
  *{box-sizing:border-box;} html,body{margin:0;height:100%;}
  body{background:radial-gradient(120% 90% at 50% 0%,#16201B 0%,var(--bg) 46%,var(--bg2) 100%);color:var(--ink);font-family:var(--sans);min-height:100%;-webkit-font-smoothing:antialiased;}
  .app{max-width:1120px;margin:0 auto;padding:20px 20px 44px;}
  .topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;}
  .brand{font-family:var(--serif);font-weight:600;font-size:18px;} .brand b{color:var(--acc);}
  .topmeta{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);}
  .stage{position:relative;margin-top:14px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(160deg,#17211C 0%,#101713 100%);aspect-ratio:16/9;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);}
  .slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(20px,3.2vw,44px);opacity:0;transition:opacity .5s;pointer-events:none;text-align:center;overflow-y:auto;}
  .slide.active{opacity:1;pointer-events:auto;}
  @media (prefers-reduced-motion:reduce){.slide{transition:none;}}
  .beat{font-family:var(--mono);font-size:clamp(9px,1.1vw,11px);letter-spacing:.16em;text-transform:uppercase;color:var(--acc);border:1px solid var(--acc);border-radius:999px;padding:4px 12px;margin-bottom:13px;background:var(--acc-soft);}
  .title{font-family:var(--serif);font-weight:600;font-size:clamp(20px,3.2vw,36px);letter-spacing:-.01em;line-height:1.08;margin-bottom:10px;text-wrap:balance;max-width:26ch;}
  .dtext{color:var(--acc);font-size:clamp(14px,1.9vw,20px);font-weight:600;max-width:46ch;margin-bottom:12px;line-height:1.3;}
  .layer{max-width:60ch;text-align:left;margin:5px auto;padding:8px 14px;border-radius:0 10px 10px 0;font-size:clamp(12.5px,1.55vw,16px);line-height:1.4;}
  .layer .lab{font-family:var(--mono);font-size:10px;letter-spacing:.14em;display:block;margin-bottom:3px;}
  .l-obj{border-left:3px solid var(--faint);background:#151d18;color:var(--soft);font-style:italic;} .l-obj .lab{color:var(--faint);font-style:normal;}
  .l-mean{border-left:3px solid var(--sage);background:#12201a;color:var(--sage-deep,#B7D2C4);} .l-mean .lab{color:var(--sage);}
  .l-say{border-left:3px solid var(--acc);background:var(--acc-soft);color:var(--ink);} .l-say .lab{color:var(--acc);}
  .l-ask{border-left:3px solid var(--amber);background:#231e10;color:#EBD9A0;} .l-ask .lab{color:var(--amber);}
  .l-never{border-left:3px solid var(--red);background:#241512;color:#F0B7AD;} .l-never .lab{color:var(--red);}
  .badge{display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:6px;margin-left:8px;vertical-align:middle;}
  .b-exact{background:#183025;color:var(--sage);border:1px solid var(--sage);}
  .b-adaptable{background:#2b2410;color:var(--amber);border:1px solid var(--amber);}
  .b-never{background:#2b1512;color:var(--red);border:1px solid var(--red);}
  .note{color:var(--faint);font-size:clamp(12px,1.5vw,15px);max-width:56ch;line-height:1.4;margin-top:8px;}
  /* ---- visual component kit (price cards, ledgers, packs, lanes, comparison, flow) ---- */
  .visual{width:100%;max-width:940px;margin:4px auto 8px;}
  .pcards{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
  .pcard{flex:1 1 150px;max-width:230px;border:1px solid var(--line);border-radius:14px;background:#131c17;padding:13px 14px;text-align:left;}
  .pcard.hero{border-color:var(--acc);background:var(--acc-soft);}
  .pcard.dead{opacity:.72;border-color:var(--red);background:#20130f;}
  .pc-name{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);}
  .pc-price{font-family:var(--serif);font-size:clamp(20px,2.6vw,26px);color:var(--ink);margin:5px 0 2px;font-variant-numeric:tabular-nums;}
  .pcard.dead .pc-price{text-decoration:line-through;color:var(--red);}
  .pc-unit{font-size:11.5px;color:var(--faint);}
  .pc-feat{list-style:none;padding:0;margin:8px 0 0;font-size:12px;color:var(--soft);}
  .pc-feat li{padding:3px 0;border-top:1px solid var(--line);}
  .packs{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;align-items:stretch;}
  .pack{border:1px solid var(--line);border-radius:12px;padding:10px 14px;background:#131c17;min-width:112px;text-align:left;}
  .pack.base{border-color:var(--sage);background:#12201a;}
  .pack .pk-n{font-size:12.5px;color:var(--ink);} .pack .pk-p{font-family:var(--mono);color:var(--acc);font-size:13px;margin-top:4px;font-variant-numeric:tabular-nums;}
  .pack.base .pk-p{color:var(--sage);}
  .ledger{max-width:560px;margin:0 auto;font-family:var(--mono);font-size:clamp(12px,1.5vw,14px);text-align:left;}
  .ledger .lr{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px solid var(--line);color:var(--soft);}
  .ledger .lr .num{font-variant-numeric:tabular-nums;color:var(--ink);white-space:nowrap;}
  .ledger .lr .num.bad{color:var(--red);} .ledger .lr .num.good{color:var(--sage);}
  .ledger .lr.tot{border-top:2px solid var(--acc);border-bottom:none;margin-top:3px;color:var(--ink);}
  .lanes{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;}
  .lane{width:46px;height:26px;border-radius:6px;border:1px solid var(--line);background:#131c17;}
  .lane.on{background:var(--acc-soft);border-color:var(--acc);}
  .cmp{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
  .cmp .col{flex:1 1 260px;max-width:360px;border:1px solid var(--line);border-radius:14px;padding:13px 15px;text-align:left;}
  .cmp .col.them{border-color:var(--red);} .cmp .col.us{border-color:var(--sage);}
  .cmp h4{margin:0 0 8px;font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;}
  .cmp .col.them h4{color:var(--red);} .cmp .col.us h4{color:var(--sage);}
  .cmp ul{margin:0;padding-left:16px;font-size:12.5px;color:var(--soft);line-height:1.5;}
  .flow{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;}
  .flow .step{border:1px solid var(--line);border-radius:10px;padding:7px 11px;background:#131c17;font-size:12.5px;color:var(--ink);}
  .flow .step.free{border-color:var(--sage);color:var(--sage);}
  .flow .arrow{color:var(--acc);font-family:var(--mono);font-size:14px;}
  .bignum{font-family:var(--serif);font-size:clamp(30px,5vw,40px);color:var(--acc);font-variant-numeric:tabular-nums;line-height:1;}
  .chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
  .chip{border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:12px;color:var(--soft);background:#131c17;}
  .chip.good{border-color:var(--sage);color:var(--sage);} .chip.bad{border-color:var(--red);color:var(--red);}
  .eq{font-family:var(--serif);font-size:26px;color:var(--faint);align-self:center;padding:0 2px;}
  .cardgrid{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
  .qcard{border:1px solid var(--line);border-radius:12px;padding:11px 14px;background:#131c17;text-align:left;flex:1 1 180px;max-width:250px;}
  .qcard .qh{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--acc);margin-bottom:5px;}
  .qcard .qb{font-size:12.5px;color:var(--soft);line-height:1.45;}
  .stale{margin-top:8px;font-family:var(--mono);font-size:11px;color:var(--amber);}
  .kick{font-family:var(--mono);font-size:clamp(9px,1.2vw,12px);letter-spacing:.2em;text-transform:uppercase;color:var(--sage);margin-bottom:12px;}
  .slide.card .title{font-size:clamp(28px,5.2vw,54px);max-width:20ch;} .slide.card .sub{color:var(--soft);font-size:clamp(14px,1.9vw,20px);max-width:54ch;margin:0 auto;line-height:1.5;}
  .counter{position:absolute;top:12px;right:16px;font-family:var(--mono);font-size:12px;color:var(--faint);}
  .ticks{position:absolute;left:16px;right:16px;bottom:10px;display:flex;gap:3px;} .ticks span{height:3px;flex:1;border-radius:2px;background:var(--line);} .ticks span.done{background:var(--acc);}
  .controls{margin-top:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  button.ctl{font-family:var(--sans);font-size:14px;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:9px 15px;cursor:pointer;}
  button.ctl:hover{border-color:var(--acc);} button.ctl:focus-visible{outline:2px solid var(--acc);outline-offset:2px;}
  button.play{background:var(--acc);color:${ACC.ink};border-color:var(--acc);font-weight:700;padding:9px 20px;}
  .spacer{flex:1;} .rate{font-family:var(--mono);font-size:11px;color:var(--faint);display:flex;gap:8px;align-items:center;} .rate input{accent-color:var(--acc);}
  .resume{margin-top:10px;font-family:var(--mono);font-size:12px;color:var(--acc);display:none;} .resume button{margin-left:8px;}
  .caption{margin-top:12px;min-height:38px;border-left:2px solid var(--acc);padding:4px 0 4px 16px;font-size:15px;color:var(--soft);font-style:italic;} .caption b{color:var(--ink);font-style:normal;}
  .panel{display:none;margin-top:14px;border:1px solid var(--line);border-radius:14px;background:#0f1713;padding:16px 18px;}
  .panel.open{display:block;} .panel h3{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin:0 0 12px;}
  .tr{border-bottom:1px solid var(--line);padding:10px 0;} .tr:last-child{border-bottom:0;}
  .tr .th{font-family:var(--serif);font-size:15px;color:var(--ink);margin-bottom:4px;} .tr .tn{color:var(--soft);font-size:13.5px;line-height:1.5;}
  .tr .ts{margin-top:6px;color:var(--ink);font-size:13.5px;background:var(--acc-soft);border-left:2px solid var(--acc);padding:6px 10px;border-radius:0 8px 8px 0;display:flex;justify-content:space-between;gap:10px;align-items:flex-start;}
  .cpy{font-family:var(--mono);font-size:10px;color:var(--acc);background:none;border:1px solid var(--acc);border-radius:6px;padding:2px 7px;cursor:pointer;white-space:nowrap;}
  .src{font-size:13px;color:var(--soft);padding:6px 0;border-bottom:1px solid var(--line);} .src a{color:var(--acc);} .src .dt{font-family:var(--mono);font-size:11px;color:var(--faint);}
  .foot{margin-top:16px;font-family:var(--mono);font-size:11px;color:var(--faint);line-height:1.6;}
</style>
<div class="app">
  <div class="topbar"><div class="brand">one3<b>seven</b></div><div class="topmeta">${TOPMETA}</div></div>
  <div class="stage" id="stage"><div class="counter" id="counter"></div><div class="ticks" id="ticks"></div></div>
  <div class="controls">
    <button class="ctl play" id="play">▶ Play</button>
    <button class="ctl" id="prev">‹ Prev</button>
    <button class="ctl" id="next">Next ›</button>
    <button class="ctl" id="restart">↺ Restart</button>
    <button class="ctl" id="tbtn">☰ Transcript</button>
    <button class="ctl" id="sbtn">⌗ Sources</button>
    <span class="spacer"></span>
    <span class="rate">speed <input id="rate" type="range" min="0.8" max="1.3" step="0.05" value="1" aria-label="playback speed"></span>
  </div>
  <div class="resume" id="resume"></div>
  <div class="caption" id="caption"><b>Press Play.</b> ${TITLE} — internal rep coaching. Arrow keys navigate · Space plays.</div>
  <div class="panel" id="transcript"><h3>Transcript · copyable talk tracks</h3><div id="trbody"></div></div>
  <div class="panel" id="sources"><h3>Sources · verify before repeating</h3><div id="srcbody"></div></div>
  <div class="foot">Internal FL sales training. Coaching, not a customer script. SAY badges: <b style="color:var(--sage)">EXACT</b> = verbatim · <b style="color:var(--amber)">ADAPTABLE</b> = keep the meaning · <b style="color:var(--red)">NEVER</b> = prohibited. one3seven organizes and cites; it never scores cases or gives legal advice.</div>
  <audio id="audio" preload="auto"></audio>
</div>
<script>
  var ID=${JSON.stringify(ID)}, S=${JSON.stringify(S)}, NARR=${JSON.stringify(NARR)}, AUDIO=${JSON.stringify(AUDIO)};
  var stage=document.getElementById('stage'),ticks=document.getElementById('ticks'),counter=document.getElementById('counter'),
      caption=document.getElementById('caption'),playBtn=document.getElementById('play'),rateEl=document.getElementById('rate'),audio=document.getElementById('audio');
  var i=0,playing=false,now=new Date();
  function esc(t){return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');}
  function className(c){return c==='exact'?'b-exact':c==='adaptable'?'b-adaptable':c==='never'?'b-never':'';}
  function staleFor(s){ if(!s.reviewAfter) return false; try{ return new Date(s.reviewAfter) < now; }catch(e){ return false; } }
  S.forEach(function(s){
    var d=document.createElement('div');d.className='slide'+(s.card?' card':'');
    var h='';
    if(s.card){ h='<div class="kick">'+esc(s.kick)+'</div><div class="title">'+esc(s.title)+'</div>'+(s.sub?'<div class="sub">'+esc(s.sub)+'</div>':''); }
    else {
      if(s.beat) h+='<div class="beat">'+esc(s.beat)+'</div>';
      h+='<div class="title">'+esc(s.title)+'</div>';
      if(s.displayText) h+='<div class="dtext">'+esc(s.displayText)+'</div>';
      if(s.visual) h+='<div class="visual">'+s.visual+'</div>';
      if(s.obj) h+='<div class="layer l-obj"><span class="lab">THEY SAY</span>'+esc(s.obj)+'</div>';
      if(s.mean) h+='<div class="layer l-mean"><span class="lab">WHAT THEY MAY MEAN</span>'+esc(s.mean)+'</div>';
      if(s.never) h+='<div class="layer l-never"><span class="lab">NEVER SAY</span>'+esc(s.never)+'</div>';
      if(s.say){ var cls=s.sayClass==='never'?'l-never':'l-say'; var lab=s.sayClass==='never'?'NEVER SAY':(s.never?'SAY INSTEAD':'SAY');
        var badge=s.sayClass&&s.sayClass!=='never'?'<span class="badge '+className(s.sayClass)+'">'+s.sayClass+'</span>':'';
        h+='<div class="layer '+cls+'"><span class="lab">'+lab+badge+'</span>'+esc(s.say)+'</div>'; }
      if(s.ask) h+='<div class="layer l-ask"><span class="lab">ASK NEXT</span>'+esc(s.ask)+'</div>';
      if(s.note) h+='<div class="note">'+esc(s.note)+'</div>';
      if(staleFor(s)) h+='<div class="stale">⚠ Research figure — reverification required (review-after '+esc(s.reviewAfter)+').</div>';
    }
    d.innerHTML=h;stage.appendChild(d);ticks.appendChild(document.createElement('span'));
  });
  var slides=stage.querySelectorAll('.slide'),tickEls=ticks.querySelectorAll('span');
  // Transcript
  var trbody=document.getElementById('trbody');
  S.forEach(function(s,idx){
    var row=document.createElement('div');row.className='tr';
    var h='<div class="th">'+String(idx+1).padStart(2,'0')+' · '+esc(s.title||s.kick||'')+'</div>';
    h+='<div class="tn">'+esc(NARR[idx])+'</div>';
    if(s.say){ h+='<div class="ts"><span>'+esc(s.say)+'</span><button class="cpy" data-say="'+esc(s.say).replace(/"/g,'&quot;')+'">copy</button></div>'; }
    row.innerHTML=h;trbody.appendChild(row);
  });
  trbody.addEventListener('click',function(e){ var b=e.target.closest('.cpy'); if(!b)return; var t=b.getAttribute('data-say');
    if(navigator.clipboard){navigator.clipboard.writeText(t);} b.textContent='copied'; setTimeout(function(){b.textContent='copy';},1200); });
  // Sources
  var srcbody=document.getElementById('srcbody'),anySrc=false;
  S.forEach(function(s,idx){ (s.sources||[]).forEach(function(src){ anySrc=true;
    var el=document.createElement('div');el.className='src';
    el.innerHTML='<b>'+esc(s.title||('Slide '+(idx+1)))+'</b> — '+(src.url?'<a href="'+esc(src.url)+'" target="_blank" rel="noopener">'+esc(src.label)+'</a>':esc(src.label))
      +(src.checked?' <span class="dt">· checked '+esc(src.checked)+'</span>':'')
      +(s.reviewAfter?' <span class="dt">· review-after '+esc(s.reviewAfter)+(staleFor(s)?' ⚠ DUE':'')+'</span>':'');
    srcbody.appendChild(el); }); });
  if(!anySrc) srcbody.innerHTML='<div class="src" style="color:var(--faint)">No external market claims in this film — talk tracks are doctrine and workflow, not figures.</div>';
  function paint(){
    slides.forEach(function(el,idx){el.classList.toggle('active',idx===i);});
    tickEls.forEach(function(el,idx){el.classList.toggle('done',idx<=i);});
    counter.textContent=String(i+1).padStart(2,'0')+' / '+String(S.length).padStart(2,'0');
    var s=S[i]; caption.innerHTML=(playing?'<b>▶</b> ':'')+esc(s.displayText||s.title||NARR[i]);
    try{ localStorage.setItem('film:'+ID+':slide', i); if(i===S.length-1) localStorage.setItem('film:'+ID+':completed','true'); }catch(e){}
  }
  function playCurrent(){ audio.src=AUDIO[i]; audio.playbackRate=parseFloat(rateEl.value)||1; var p=audio.play(); if(p&&p.catch)p.catch(function(){caption.innerHTML='<b>Tap Play once more</b> — autoplay was blocked.';}); }
  audio.addEventListener('ended',function(){ if(!playing)return; if(i<S.length-1){i++;paint();playCurrent();} else {playing=false;setLabel();caption.innerHTML='<b>Fin.</b> Transcript below has every talk track. Replay any beat, or screen-record to export.';} });
  function setLabel(){playBtn.textContent=playing?'❚❚ Pause':'▶ Play';}
  function togglePlay(){ playing=!playing;setLabel(); if(playing){paint();playCurrent();} else audio.pause(); }
  playBtn.addEventListener('click',togglePlay);
  document.getElementById('next').addEventListener('click',function(){ if(i<S.length-1){i++;paint(); if(playing)playCurrent();} });
  document.getElementById('prev').addEventListener('click',function(){ if(i>0){i--;paint(); if(playing)playCurrent();} });
  document.getElementById('restart').addEventListener('click',function(){ i=0;paint(); if(playing)playCurrent(); else audio.pause(); });
  document.getElementById('tbtn').addEventListener('click',function(){ document.getElementById('transcript').classList.toggle('open'); });
  document.getElementById('sbtn').addEventListener('click',function(){ document.getElementById('sources').classList.toggle('open'); });
  rateEl.addEventListener('input',function(){ audio.playbackRate=parseFloat(rateEl.value)||1; });
  document.addEventListener('keydown',function(e){ if(e.target.tagName==='INPUT')return;
    if(e.key==='ArrowRight'){ if(i<S.length-1){i++;paint(); if(playing)playCurrent();} }
    else if(e.key==='ArrowLeft'){ if(i>0){i--;paint(); if(playing)playCurrent();} }
    else if(e.key===' '){ e.preventDefault(); togglePlay(); } });
  // Resume
  try{ var saved=parseInt(localStorage.getItem('film:'+ID+':slide')||'0',10);
    if(saved>0 && saved<S.length-1){ var r=document.getElementById('resume');
      r.style.display='block'; r.innerHTML='You left off at slide '+(saved+1)+'. <button class="ctl" id="rz">Resume</button> <button class="ctl" id="rs">Start over</button>';
      document.getElementById('rz').addEventListener('click',function(){ i=saved;paint();r.style.display='none'; });
      document.getElementById('rs').addEventListener('click',function(){ i=0;paint();r.style.display='none'; }); } }catch(e){}
  paint();
</script>`;
writeFileSync(OUT, html);
console.log('wrote', OUT, '(' + (html.length/1024).toFixed(0) + ' KB, ' + S.length + ' slides)');
