/** render-mascot.cjs — render public/mascot-test.html to a short MP4 on black (for compositing). */
const { spawnSync } = require('node:child_process');
const { resolve, dirname, delimiter } = require('node:path');
const { mkdirSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer');
const ffmpegPath = require('ffmpeg-static');
process.env.PATH = dirname(ffmpegPath) + delimiter + (process.env.PATH || '');

const HTML = resolve(__dirname, '..', 'public', 'mascot-test.html');
const OUT = resolve(__dirname, '..', 'public', 'overlays', 'mascot-test.mp4');
mkdirSync(dirname(OUT), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(`${pathToFileURL(HTML).href}?render=1`, { waitUntil: 'load' });
  await page.waitForFunction('typeof window.__setScene === "function"');
  const webm = resolve(dirname(OUT), 'mascot.webm');
  const rec = await page.screencast({ path: webm });
  await page.evaluate(() => window.__setScene(0));
  await sleep(6000);
  await rec.stop();
  await browser.close();
  const r = spawnSync(ffmpegPath, ['-y', '-i', webm, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', OUT], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) process.exit(1);
  require('node:fs').rmSync(webm, { force: true });
  console.log('✓', OUT);
})();
