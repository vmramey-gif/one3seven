// Generates one3seven PWA icons from the SeedMark golden-angle phyllotaxis.
// Brand-purple full-bleed background (maskable-safe) with light seed dots.
// Run: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const BRAND = '#5B21B6';
const WHITE = [255, 255, 255];
const LAV = [199, 185, 255];
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (a) => '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('');

function seedIcon(size = 512, count = 110) {
  const cx = size / 2, cy = size / 2;
  // Keep dots well within the maskable safe zone (~80% center). maxR ≈ 30% of size.
  const maxR = size * 0.3;
  const scale = maxR / Math.sqrt(count);
  let dots = '';
  for (let i = 0; i < count; i++) {
    const ang = i * GOLDEN_ANGLE;
    const rad = scale * Math.sqrt(i);
    const t = Math.sqrt(i) / Math.sqrt(count);
    const x = +(cx + Math.cos(ang) * rad).toFixed(2);
    const y = +(cy + Math.sin(ang) * rad).toFixed(2);
    const r = Math.max(size * 0.026 * (1 - 0.4 * t), size * 0.008);
    dots += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${hex(lerp(WHITE, LAV, t))}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<rect width="${size}" height="${size}" fill="${BRAND}"/>${dots}</svg>`;
}

const outDir = path.resolve('public/icons');
await mkdir(outDir, { recursive: true });

const masterSvg = seedIcon(512);
await writeFile(path.join(outDir, 'o3s-icon.svg'), masterSvg, 'utf8');

const targets = [
  { name: 'pwa-192.png', size: 192 },
  { name: 'pwa-512.png', size: 512 },
  { name: 'maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of targets) {
  const svg = seedIcon(size);
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, name));
  console.log('wrote', path.join('public/icons', name));
}
console.log('PWA icons generated.');
