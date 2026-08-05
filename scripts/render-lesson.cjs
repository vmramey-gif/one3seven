/**
 * render-lesson.cjs — turn an animated lesson HTML into a finished, ready-to-post MP4.
 *
 * No Canva, no manual screen-recording. It:
 *   1. probes each narration clip's duration (ffprobe),
 *   2. drives the film scene-by-scene in headless Chrome (?render=1 fills a clean 1080x1920 frame,
 *      window.__setScene(i) advances it) while screen-recording (puppeteer page.screencast),
 *   3. concatenates the narration and muxes it onto the video as H.264 MP4 (ffmpeg).
 *
 * Usage:
 *   node scripts/render-lesson.cjs <htmlFile> <voiceDir> <prefix> <outMp4>
 * e.g.
 *   node scripts/render-lesson.cjs public/real-talk-lesson1.html public/voice/lesson-ai l1_s public/renders/real-talk-lesson1.mp4
 */
const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, rmSync } = require('node:fs');
const { resolve, dirname, delimiter } = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
// puppeteer's page.screencast spawns a bare `ffmpeg` from PATH — point PATH at the static binary.
process.env.PATH = dirname(ffmpegPath) + delimiter + (process.env.PATH || '');

const [htmlArg, voiceDir, prefix, outArg] = process.argv.slice(2);
if (!htmlArg || !voiceDir || !prefix || !outArg) {
  console.error('Usage: node scripts/render-lesson.cjs <htmlFile> <voiceDir> <prefix> <outMp4>');
  process.exit(1);
}
const htmlPath = resolve(htmlArg);
const outPath = resolve(outArg);
mkdirSync(dirname(outPath), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOLD = 0.35; // small tail after each clip so captions don't cut on the last word

function probeDuration(file) {
  const r = spawnSync(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat((r.stdout || '').trim());
}
function run(bin, args) {
  const r = spawnSync(bin, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) { console.error('ffmpeg failed:', bin, args.join(' ')); process.exit(1); }
}

(async () => {
  const clips = [];
  for (let k = 1; ; k++) {
    const f = resolve(voiceDir, `${prefix}${k}.mp3`);
    if (!existsSync(f)) break;
    clips.push({ file: f, dur: probeDuration(f) });
  }
  if (!clips.length) { console.error('No narration clips found at', voiceDir, prefix); process.exit(1); }
  console.log(`${clips.length} scenes · total narration ${clips.reduce((s, c) => s + c.dur, 0).toFixed(1)}s`);

  const tmpDir = resolve(dirname(outPath), '.render-tmp');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  const rawWebm = resolve(tmpDir, 'raw.webm');
  const audioFile = resolve(tmpDir, 'audio.m4a');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.goto(`${pathToFileURL(htmlPath).href}?render=1`, { waitUntil: 'load' });
    await page.waitForFunction('typeof window.__setScene === "function"');

    const recorder = await page.screencast({ path: rawWebm });
    for (let i = 0; i < clips.length; i++) {
      await page.evaluate((n) => window.__setScene(n), i);
      await sleep((clips[i].dur + HOLD) * 1000);
    }
    await recorder.stop();
    console.log('✓ captured video');
  } finally {
    await browser.close();
  }

  // Concatenate the narration clips into one audio track.
  const concatArgs = [];
  clips.forEach((c) => concatArgs.push('-i', c.file));
  const filter = clips.map((_, i) => `[${i}:a]`).join('') + `concat=n=${clips.length}:v=0:a=1[a]`;
  run(ffmpegPath, ['-y', ...concatArgs, '-filter_complex', filter, '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', audioFile]);

  // Mux: re-encode captured video to H.264 (accepted by IG/FB/TikTok) + the narration.
  run(ffmpegPath, [
    '-y', '-i', rawWebm, '-i', audioFile,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outPath,
  ]);

  rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\n✅ Finished MP4 → ${outPath}`);
})();
