#!/usr/bin/env node
/**
 * gen-voice.mjs — render FIXED, vetted script lines into elite audio via ElevenLabs TTS.
 *
 * SAFE BY DESIGN: this is text-to-speech only. It speaks text you wrote and approved —
 * it is NOT a conversational agent and never improvises. Use it to voice the fixed intake
 * prompts (see docs/voice-interface-spec.md) and the demo voiceovers. Every output is a
 * constant you can review before shipping.
 *
 * Usage:
 *   node scripts/gen-voice.mjs "<text>" <out.mp3> [--voice <id>] [--model <id>]
 *   node scripts/gen-voice.mjs --lines <lines.json> <out-dir> [--voice <id>] [--model <id>]
 *
 * --lines mode: lines.json is { "key": "text to speak", ... } → writes <out-dir>/<key>.mp3
 *   for each entry. Ideal for batch-rendering the fixed intake script.
 *
 * Voice direction for one3seven (set in the ElevenLabs dashboard or via settings below):
 *   calm, unhurried, warm, conversational — a kind person beside you, not a hotline.
 *
 * Key: reads ELEVENLABS_API_KEY from env or .env / .env.local (gitignored). Never printed
 *      or committed. Default voice overridable via --voice or ELEVENLABS_VOICE_ID.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Default model + a calm narration voice. Model/voice ids change — override as needed.
// Pick a warmer voice in the ElevenLabs dashboard and pass its id via --voice / env.
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs "Rachel" (calm) — replace with your chosen warm voice
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true };

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  for (const f of ['.env', '.env.local']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return null;
}

function parseArgs(argv) {
  const positional = [];
  const opts = {
    voice: process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE,
    model: DEFAULT_MODEL,
    lines: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--voice') opts.voice = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--lines') opts.lines = argv[++i];
    else positional.push(a);
  }
  opts.first = positional[0];
  opts.out = positional[1];
  return opts;
}

async function synthesize(text, voice, model, key) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: model, voice_settings: VOICE_SETTINGS }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs API ${res.status}: ${body.slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const key = loadKey();
  if (!key) {
    console.error('Missing ELEVENLABS_API_KEY. Add it to .env (gitignored) or your shell.');
    process.exit(1);
  }

  if (opts.lines) {
    const outDir = opts.first;
    if (!outDir) {
      console.error('Usage: node scripts/gen-voice.mjs --lines <lines.json> <out-dir>');
      process.exit(1);
    }
    const lines = JSON.parse(readFileSync(resolve(ROOT, opts.lines), 'utf8'));
    mkdirSync(resolve(ROOT, outDir), { recursive: true });
    console.log(`Voice: ${opts.voice} · model: ${opts.model} · lines: ${Object.keys(lines).length}`);
    for (const [k, text] of Object.entries(lines)) {
      const outPath = resolve(ROOT, outDir, `${k}.mp3`);
      try {
        const buf = await synthesize(String(text), opts.voice, opts.model, key);
        writeFileSync(outPath, buf);
        console.log(`✓ ${k}.mp3 (${(buf.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        console.error(`✗ ${k}: ${err.message}`);
        process.exitCode = 1;
      }
    }
    return;
  }

  if (!opts.first || !opts.out) {
    console.error('Usage: node scripts/gen-voice.mjs "<text>" <out.mp3> [--voice <id>] [--model <id>]');
    console.error('   or: node scripts/gen-voice.mjs --lines <lines.json> <out-dir>');
    process.exit(1);
  }
  console.log(`Voice: ${opts.voice} · model: ${opts.model}`);
  try {
    const buf = await synthesize(opts.first, opts.voice, opts.model, key);
    writeFileSync(resolve(ROOT, opts.out), buf);
    console.log(`✓ ${opts.out} (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`✗ ${opts.out}: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
