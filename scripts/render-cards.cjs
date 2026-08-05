/** render-cards.cjs — record intro (scene0) + outro (scene1) of lesson-cards.html to MP4s with silent audio. */
const { spawnSync } = require('node:child_process');
const { resolve, dirname, delimiter } = require('node:path');
const { rmSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer');
const ffmpegPath = require('ffmpeg-static');
process.env.PATH = dirname(ffmpegPath) + delimiter + (process.env.PATH || '');
const HTML = resolve(__dirname, '..', 'public', 'lesson-cards.html');
const OUTDIR = resolve(__dirname, '..', 'build', 'rwm');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenes = [{ i: 0, name: 'intro', dur: 2.8 }, { i: 1, name: 'outro', dur: 3.2 }];

(async () => {
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.goto(`${pathToFileURL(HTML).href}?render=1`, { waitUntil: 'load' });
  await p.waitForFunction('typeof window.__setScene === "function"');
  for (const s of scenes) {
    const webm = resolve(OUTDIR, `${s.name}.webm`);
    // Switch to the target scene BEFORE recording so the first frame is this scene's background
    // (otherwise the previous scene flashes for a frame at the start of the clip).
    await p.evaluate((n) => window.__setScene(n), s.i);
    const rec = await p.screencast({ path: webm });
    await sleep(s.dur * 1000 + 300);
    await rec.stop();
    const out = resolve(OUTDIR, `${s.name}.mp4`);
    const r = spawnSync(ffmpegPath, ['-y', '-i', webm, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['ignore', 'ignore', 'inherit'] });
    if (r.status !== 0) process.exit(1);
    rmSync(webm, { force: true });
    console.log('✓', s.name);
  }
  await b.close();
})();
