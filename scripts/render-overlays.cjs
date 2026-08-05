/**
 * render-overlays.cjs — render each scene of public/overlay-pack.html to its own MP4 on pure black.
 * Drop these over the presenter with "Screen" blend mode (black drops out, only the glow remains).
 *   node scripts/render-overlays.cjs
 */
const { spawnSync } = require('node:child_process');
const { resolve, dirname, delimiter } = require('node:path');
const { mkdirSync, rmSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer');
const ffmpegPath = require('ffmpeg-static');
process.env.PATH = dirname(ffmpegPath) + delimiter + (process.env.PATH || '');

const HTML = resolve(__dirname, '..', 'public', 'overlay-pack.html');
const OUT = resolve(__dirname, '..', 'public', 'overlays');
mkdirSync(OUT, { recursive: true });

const SCENES = [
  { name: 'hero_timeline', dur: 6 },   // messy docs → source-linked timeline (sage)
  { name: 'hallucination', dur: 4 },   // AI card glitches out (violet)
  { name: 'stat_200', dur: 4 },        // 200+ / FAKE
  { name: 'receipts', dur: 4 },        // doc → source beam (sage)
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(`${pathToFileURL(HTML).href}?render=1`, { waitUntil: 'load' });
  await page.waitForFunction('typeof window.__setScene === "function"');

  const tmp = resolve(OUT, '.tmp');
  mkdirSync(tmp, { recursive: true });
  for (let i = 0; i < SCENES.length; i++) {
    const { name, dur } = SCENES[i];
    const webm = resolve(tmp, `${name}.webm`);
    const rec = await page.screencast({ path: webm });
    await page.evaluate((n) => window.__setScene(n), i);
    await sleep(dur * 1000 + 400);
    await rec.stop();
    const out = resolve(OUT, `${name}.mp4`);
    const r = spawnSync(ffmpegPath, ['-y', '-i', webm, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', out], { stdio: ['ignore', 'ignore', 'inherit'] });
    if (r.status !== 0) { console.error('ffmpeg failed for', name); process.exit(1); }
    console.log(`✓ ${name}.mp4`);
  }
  rmSync(tmp, { recursive: true, force: true });
  await browser.close();
  console.log(`\n✅ Overlay pack → ${OUT}`);
})();
