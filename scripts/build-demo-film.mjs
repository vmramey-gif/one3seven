import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve('.');
const lines = JSON.parse(readFileSync(resolve(ROOT, 'scripts/demo-voice-lines.json'), 'utf8'));
const keys = Object.keys(lines);
const PUBLIC = process.argv.includes('--public');
const AUDIO = keys.map(k => PUBLIC
  ? `/voice/demo/${k}.mp3`
  : 'data:audio/mpeg;base64,' + readFileSync(resolve(ROOT, `public/voice/demo/${k}.mp3`)).toString('base64'));
const IMGBASE = PUBLIC ? '/' : '';

// beat = timing chip; img optional; say = must-say-verbatim line; note = on-screen coaching cue
const S = [
  { card:true, kick:'one3seven · FL sales training', title:'The 15-Minute Intake Review', sub:'How to run the live demo — the beats, the pauses, the lines you say word-for-word' },
  { beat:'Beat 1 · 0:00 · Set the frame', title:'Before you open the laptop', note:'Name their pain in their words. Get them nodding before any screen.', say:'The 90-minute cold read. The client who re-tells it three times. The shoebox someone has to reconstruct.' },
  { beat:'Beat 2 · 2:00 · Worker record', title:'Open on the worker’s home', img:'walkthrough/home.jpg', note:'Start on the worker side, never the firm side.', say:'This record belongs to the worker — not to us, not to you.' },
  { beat:'Beat 2 · Worker record', title:'Records go in — no sorting', img:'walkthrough/add_records.jpg', note:'Tie it back to the shoebox you just named.', say:'The worker never organizes this. The system infers the types.' },
  { beat:'Beat 2 · Worker record', title:'The worker chooses to send it', img:'walkthrough/firm_code.jpg', note:'Stress “chooses.” This is the clean-money foundation, not a footnote.', say:'The worker decides who sees the record.' },
  { beat:'Beat 3 · 8:00 · The binder', title:'It arrives already organized', img:'walkthrough/firm_queue.jpg', note:'Pause. Let them feel the contrast with the cold read. Don’t narrate every field.' },
  { beat:'Beat 3 · The money shot', title:'The Decision Card', img:'walkthrough/firm_decision.jpg', note:'SLOW ALL THE WAY DOWN. Then stop talking and let them scan.', say:'This is what replaces the first hour of every intake.' },
  { beat:'Beat 4 · 11:00 · The metric', title:'Claim Lens → Coverage Rate', img:'walkthrough/firm_lens.jpg', note:'Say the metric name out loud. It’s the number rivals can’t compute.', say:'Coverage Rate — how much of what the law requires is actually on file.' },
  { beat:'Beat 4 · The trust moment', title:'Click one fact → its source', img:'walkthrough/firm_sourcelink.jpg', note:'Do it LIVE and slowly. This is what earns an attorney’s trust.', say:'Verify in one click, not twenty minutes.' },
  { beat:'Beat 4 · Keep it quick', title:'The attorney decides', img:'walkthrough/firm_actions.jpg', note:'Accept, request, decline — one click. Then move on.', say:'The software organizes. The lawyer decides.' },
  { beat:'Beat 5 · 13:00 · Guardrail', title:'The lines you never cross', note:'Even when a firm pushes. This discipline IS the product.', say:'We describe the record. We never characterize the case. No — it does not score the case, and that’s the point.' },
  { beat:'Beat 5 · Reframe', title:'Everything through Coverage Rate', note:'When they ask what’s different — don’t list features. Say this in one breath.', say:'We measure completeness against the law, we link every fact to its source, and the worker chooses who sees it. Never a verdict.' },
  { beat:'Beat 6 · 15:00 · Close', title:'Ask, then go silent', note:'Ask for ONE thing. After you ask, whoever speaks first loses.', say:'Get a firm code where workers are already organizing intakes for 2-minute attorney decisions.' },
  { beat:'Recap · Timing', title:'The beats, timed', note:'Run it the same way every time until it’s muscle memory.', say:'2 pain · 6 record + binder · 3 Coverage Rate + source link · 2 guardrail · 2 ask & wait = 15.' },
  { card:true, kick:'The reason it works', title:'Sell the discipline, not the magic', sub:'We’re not flawless — we use AI too. Every fact is reviewable, the source is one click away, the worker owns and chooses. Now go run it.' },
];
const SCRIPT = keys.map(k => lines[k]);

const html = `<title>one3seven — The 15-Minute Intake Review (sales training)</title>
<style>
  :root{
    --bg:#0E1512;--bg2:#0A100D;--panel:#16201B;--ink:#ECF0E8;--soft:#9DA99F;--faint:#6B776E;
    --sage:#8FB8A2;--sage-deep:#B7D2C4;--orange:#E08A4E;--orange-soft:#2A1B10;--line:#263029;
    --serif:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
    --sans:'Inter Tight',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    --mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,monospace;
  }
  *{box-sizing:border-box;} html,body{margin:0;height:100%;}
  body{background:radial-gradient(120% 90% at 50% 0%,#16201B 0%,var(--bg) 46%,var(--bg2) 100%);
    color:var(--ink);font-family:var(--sans);min-height:100%;-webkit-font-smoothing:antialiased;}
  .app{max-width:1120px;margin:0 auto;padding:20px 20px 40px;}
  .topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;}
  .brand{font-family:var(--serif);font-weight:600;font-size:18px;} .brand b{color:var(--orange);}
  .topmeta{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);}
  .stage{position:relative;margin-top:14px;border:1px solid var(--line);border-radius:20px;
    background:linear-gradient(160deg,#17211C 0%,#101713 100%);aspect-ratio:16/9;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);}
  .slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:clamp(18px,3vw,40px);opacity:0;transition:opacity .5s;pointer-events:none;text-align:center;}
  .slide.active{opacity:1;pointer-events:auto;}
  @media (prefers-reduced-motion:reduce){.slide{transition:none;}}
  .beat{font-family:var(--mono);font-size:clamp(9px,1.1vw,11px);letter-spacing:.16em;text-transform:uppercase;color:var(--orange);
    border:1px solid var(--orange);border-radius:999px;padding:4px 12px;margin-bottom:12px;background:var(--orange-soft);}
  .title{font-family:var(--serif);font-weight:600;font-size:clamp(20px,3.3vw,36px);letter-spacing:-.01em;line-height:1.08;margin-bottom:12px;text-wrap:balance;}
  .slide img{max-width:100%;max-height:52%;border-radius:12px;border:1px solid var(--line);box-shadow:0 18px 50px rgba(0,0,0,.5);object-fit:contain;margin-bottom:12px;}
  .note{color:var(--soft);font-size:clamp(13px,1.7vw,17px);max-width:54ch;line-height:1.45;margin-bottom:10px;}
  .say{display:inline-block;max-width:60ch;font-size:clamp(13px,1.7vw,18px);color:var(--ink);
    border-left:3px solid var(--orange);background:var(--orange-soft);border-radius:0 10px 10px 0;padding:9px 16px;text-align:left;}
  .say::before{content:'SAY:';font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:var(--orange);display:block;margin-bottom:3px;}
  .slide.card{justify-content:center;} .kick{font-family:var(--mono);font-size:clamp(9px,1.2vw,12px);letter-spacing:.2em;text-transform:uppercase;color:var(--sage);margin-bottom:12px;}
  .slide.card .title{font-size:clamp(30px,5.6vw,58px);} .slide.card .sub{color:var(--soft);font-size:clamp(14px,1.9vw,20px);max-width:52ch;margin:0 auto;line-height:1.5;}
  .counter{position:absolute;top:14px;right:18px;font-family:var(--mono);font-size:12px;color:var(--faint);}
  .ticks{position:absolute;left:18px;right:18px;bottom:12px;display:flex;gap:3px;}
  .ticks span{height:3px;flex:1;border-radius:2px;background:var(--line);} .ticks span.done{background:var(--orange);}
  .controls{margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  button.ctl{font-family:var(--sans);font-size:14px;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:10px 16px;cursor:pointer;}
  button.ctl:hover{border-color:var(--orange);} button.ctl:focus-visible{outline:2px solid var(--orange);outline-offset:2px;}
  button.play{background:var(--orange);color:#0E1512;border-color:var(--orange);font-weight:700;padding:10px 22px;}
  .spacer{flex:1;} .rate{font-family:var(--mono);font-size:11px;color:var(--faint);display:flex;gap:8px;align-items:center;} .rate input{accent-color:var(--orange);}
  .caption{margin-top:14px;min-height:44px;border-left:2px solid var(--orange);padding:4px 0 4px 16px;font-size:15px;color:var(--soft);font-style:italic;}
  .caption b{color:var(--ink);font-style:normal;}
  .foot{margin-top:18px;font-family:var(--mono);font-size:11px;color:var(--faint);line-height:1.6;}
</style>
<div class="app">
  <div class="topbar"><div class="brand">one3<b>seven</b></div><div class="topmeta">Sales training · the demo · internal</div></div>
  <div class="stage" id="stage"><div class="counter" id="counter"></div><div class="ticks" id="ticks"></div></div>
  <div class="controls">
    <button class="ctl play" id="play">▶ Play</button>
    <button class="ctl" id="prev">‹ Prev</button>
    <button class="ctl" id="next">Next ›</button>
    <button class="ctl" id="restart">↺ Restart</button>
    <span class="spacer"></span>
    <span class="rate">speed <input id="rate" type="range" min="0.8" max="1.3" step="0.05" value="1" aria-label="playback speed"></span>
  </div>
  <div class="caption" id="caption"><b>Press Play.</b> How to run the 15-minute intake-review demo — internal rep coaching.</div>
  <div class="foot">Internal FL sales training. Orange = your cue to act or say a line verbatim. Coaching only — not a customer script. one3seven organizes and cites; it never scores cases or gives legal advice.</div>
  <audio id="audio" preload="auto"></audio>
</div>
<script>
  var S=${JSON.stringify(S)}, SCRIPT=${JSON.stringify(SCRIPT)}, AUDIO=${JSON.stringify(AUDIO)};
  var stage=document.getElementById('stage'),ticks=document.getElementById('ticks'),counter=document.getElementById('counter'),
      caption=document.getElementById('caption'),playBtn=document.getElementById('play'),rateEl=document.getElementById('rate'),audio=document.getElementById('audio');
  var i=0,playing=false;
  S.forEach(function(s){
    var d=document.createElement('div');d.className='slide'+(s.card?' card':'');
    var h='';
    if(s.card){ h='<div class="kick">'+s.kick+'</div><div class="title">'+s.title+'</div>'+(s.sub?'<div class="sub">'+s.sub+'</div>':''); }
    else {
      h='<div class="beat">'+s.beat+'</div>';
      if(s.img) h+='<img src="${IMGBASE}'+s.img+'" alt="'+s.title+'">';
      h+='<div class="title">'+s.title+'</div>';
      if(s.note) h+='<div class="note">'+s.note+'</div>';
      if(s.say) h+='<div class="say">'+s.say+'</div>';
    }
    d.innerHTML=h;stage.appendChild(d);ticks.appendChild(document.createElement('span'));
  });
  var slides=stage.querySelectorAll('.slide'),tickEls=ticks.querySelectorAll('span');
  function paint(){
    slides.forEach(function(el,idx){el.classList.toggle('active',idx===i);});
    tickEls.forEach(function(el,idx){el.classList.toggle('done',idx<=i);});
    counter.textContent=String(i+1).padStart(2,'0')+' / '+String(S.length).padStart(2,'0');
    caption.innerHTML=(playing?'<b>▶</b> ':'')+SCRIPT[i];
  }
  function playCurrent(){ audio.src=AUDIO[i]; audio.playbackRate=parseFloat(rateEl.value)||1; var p=audio.play(); if(p&&p.catch)p.catch(function(){caption.innerHTML='<b>Tap Play once more</b> — autoplay was blocked.';}); }
  audio.addEventListener('ended',function(){ if(!playing)return; if(i<S.length-1){i++;paint();playCurrent();} else {playing=false;setLabel();caption.innerHTML='<b>Fin.</b> Replay any beat, or screen-record to export.';} });
  function setLabel(){playBtn.textContent=playing?'❚❚ Pause':'▶ Play';}
  playBtn.addEventListener('click',function(){ playing=!playing;setLabel(); if(playing){paint();playCurrent();} else audio.pause(); });
  document.getElementById('next').addEventListener('click',function(){ if(i<S.length-1){i++;paint(); if(playing)playCurrent();} });
  document.getElementById('prev').addEventListener('click',function(){ if(i>0){i--;paint(); if(playing)playCurrent();} });
  document.getElementById('restart').addEventListener('click',function(){ i=0;paint(); if(playing)playCurrent(); else audio.pause(); });
  rateEl.addEventListener('input',function(){ audio.playbackRate=parseFloat(rateEl.value)||1; });
  paint();
</script>`;
const OUT = process.argv.slice(2).find(a => !a.startsWith('--')) || resolve(ROOT, 'demo-intake-review.html');
writeFileSync(OUT, html);
console.log('wrote', OUT, '(' + (html.length/1024).toFixed(0) + ' KB)');
