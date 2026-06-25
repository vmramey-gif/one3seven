#!/usr/bin/env node
/**
 * gen-image.mjs — on-demand brand image generation via Google's Gemini image models
 * ("nano banana"). MARKETING ASSETS ONLY — never wire this into the product, near worker
 * documents, or intake output.
 *
 * Usage:
 *   node scripts/gen-image.mjs "<prompt>" <out.png> [--model <id>] [--raw] [--n <count>]
 *
 * Examples:
 *   node scripts/gen-image.mjs "abstract hero background, organized records becoming a timeline" hero.png
 *   node scripts/gen-image.mjs "social card: 'Organized intake'" card.png --model gemini-3-pro-image-preview
 *
 * Flags:
 *   --model  Gemini image model id. Default below. Model names CHANGE — update if it 404s.
 *            Fast/cheap: gemini-2.5-flash-image   |  Best text rendering: gemini-3-pro-image-preview
 *   --raw    Skip the appended one3seven brand style block (use the prompt verbatim).
 *   --n      Generate N variants (out.png, out-2.png, ...). Default 1.
 *
 * Key: reads GEMINI_API_KEY from your environment or .env / .env.local (gitignored).
 *      Get one at https://aistudio.google.com. This script never prints or commits the key.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

// one3seven brand style — appended unless --raw. Keep marketing-grade and on-palette.
const BRAND_STYLE = [
  'Style: elite, editorial, premium — never generic stock or clip-art.',
  'Brand palette: deep ink #14112E, brand violet #5B21B6 (use as a deliberate accent, not a wash),',
  'soft lavender highlights, warm off-white #FAF9F6. Restraint over gradients.',
  'Visual motif: organization out of chaos — scattered documents resolving into a clean timeline;',
  'a subtle golden-angle / seed spiral nod (one3seven = 137.5°) is welcome but never literal text.',
  'Composition: generous negative space, calm, trustworthy, legal-grade. No legal claims, no fake logos,',
  'no readable body text unless the prompt explicitly asks for a specific headline.',
].join(' ');

function loadEnvKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  for (const f of ['.env', '.env.local']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return null;
}

function parseArgs(argv) {
  const positional = [];
  const opts = { model: DEFAULT_MODEL, raw: false, n: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--raw') opts.raw = true;
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--n') opts.n = Math.max(1, parseInt(argv[++i], 10) || 1);
    else positional.push(a);
  }
  opts.prompt = positional[0];
  opts.out = positional[1];
  return opts;
}

function variantPath(out, idx) {
  if (idx === 0) return out;
  const ext = extname(out);
  return out.slice(0, out.length - ext.length) + `-${idx + 1}` + ext;
}

/** Pull the first inline image (base64) out of a Gemini generateContent response. */
function extractImageBase64(json) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) return inline.data;
  }
  return null;
}

async function generateOne(model, key, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = await res.json();
  const b64 = extractImageBase64(json);
  if (!b64) {
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(`No image in response.${text ? ' Model said: ' + text.slice(0, 200) : ''}`);
  }
  return Buffer.from(b64, 'base64');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.prompt || !opts.out) {
    console.error('Usage: node scripts/gen-image.mjs "<prompt>" <out.png> [--model <id>] [--raw] [--n <count>]');
    process.exit(1);
  }
  const key = loadEnvKey();
  if (!key) {
    console.error('Missing GEMINI_API_KEY. Add it to .env (gitignored) or your shell. Get one at https://aistudio.google.com');
    process.exit(1);
  }

  const prompt = opts.raw ? opts.prompt : `${opts.prompt}\n\n${BRAND_STYLE}`;
  console.log(`Model: ${opts.model} · variants: ${opts.n}`);

  for (let i = 0; i < opts.n; i++) {
    const outPath = variantPath(opts.out, i);
    try {
      const buf = await generateOne(opts.model, key, prompt);
      writeFileSync(outPath, buf);
      console.log(`✓ ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`✗ ${outPath}: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

main();
