import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const MESSAGES = [
  'Organizing records...',
  'Building chronology...',
  'Connecting events...',
  'Preparing review packet...',
  'Structuring uploaded information...',
];

const CANVAS_SIZE = 280;

// 137.5° — the golden angle. one3seven's namesake, and the angle that turns a
// scatter of seeds into an organized phyllotaxis seed-head (sunflower spiral).
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SEED_COUNT = 137;
const SPIRAL_TURNS = 0.32; // a soft inward arc, not a spin
const FORM_MS = 2400; // scatter → formed (seeds accelerate inward)
const STAGGER = 0.55; // staggered arrival gathered into a collective rush

// Scattered lavender → organized brand purple (#5B21B6 = 91,33,182).
const LAV: [number, number, number] = [198, 190, 232];
const BRAND: [number, number, number] = [91, 33, 182];

interface Seed {
  tAngle: number; // target angle (phyllotaxis)
  tR: number; // target radius
  sx: number; // random scatter origin x
  sy: number; // random scatter origin y
  size: number;
}

function buildSeeds(maxR: number): Seed[] {
  const seedScale = maxR / Math.sqrt(SEED_COUNT);
  const c = CANVAS_SIZE / 2;
  return Array.from({ length: SEED_COUNT }, (_, i) => ({
    tAngle: i * GOLDEN_ANGLE,
    tR: seedScale * Math.sqrt(i),
    // scattered anywhere across (and a little beyond) the field, so the seeds
    // visibly converge from chaos into the organized spiral.
    sx: c + (Math.random() - 0.5) * CANVAS_SIZE * 1.5,
    sy: c + (Math.random() - 0.5) * CANVAS_SIZE * 1.5,
    size: 2.1 + 1.7 * (1 - i / SEED_COUNT), // inner seeds slightly larger
  }));
}

// Ease-in cubic: seeds hang at the edge, gather speed, and accelerate into place.
const easeIn = (t: number) => t * t * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function OneThreeSevenLoader({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const reduced = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVis, setMsgVis] = useState(true);

  // Microcopy rotation (lg only)
  useEffect(() => {
    if (size !== 'lg') return;
    const iv = setInterval(() => {
      setMsgVis(false);
      const t = setTimeout(() => {
        setMsgIdx((i) => (i + 1) % MESSAGES.length);
        setMsgVis(true);
      }, 340);
      return () => clearTimeout(t);
    }, 2800);
    return () => clearInterval(iv);
  }, [size]);

  // Golden-angle seed animation: scatter → spiral into the mark → hold.
  useEffect(() => {
    if (size !== 'lg') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const maxR = CANVAS_SIZE * 0.46;
    const seeds = buildSeeds(maxR);

    const drawSeed = (s: Seed, eased: number, extraAngle: number, alpha: number) => {
      // Spiraling target (unwinds as it settles); seed converges to it from its scatter point.
      const ang = s.tAngle + (1 - eased) * SPIRAL_TURNS * Math.PI * 2 + extraAngle;
      const tx = cx + Math.cos(ang) * s.tR;
      const ty = cy + Math.sin(ang) * s.tR;
      const x = s.sx + (tx - s.sx) * eased;
      const y = s.sy + (ty - s.sy) * eased;
      const r = Math.round(LAV[0] + (BRAND[0] - LAV[0]) * eased);
      const g = Math.round(LAV[1] + (BRAND[1] - LAV[1]) * eased);
      const b = Math.round(LAV[2] + (BRAND[2] - LAV[2]) * eased);
      ctx.globalAlpha = alpha * 0.92;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(x, y, s.size, 0, Math.PI * 2);
      ctx.fill();
    };

    // Reduced motion: draw the organized seed-head once, statically.
    if (reduced) {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      for (const s of seeds) drawSeed(s, 1, 0, 1);
      ctx.globalAlpha = 1;
      return;
    }

    let raf = 0;
    let start = 0;
    function tick(now: number) {
      if (!start) start = now;
      const e = now - start;
      const global = e / FORM_MS;
      const held = global >= 1;
      const holdRot = held ? (e - FORM_MS) * 0.00006 : 0; // barely-there drift once settled

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      for (let i = 0; i < SEED_COUNT; i++) {
        const s = seeds[i];
        const stagger = (i / SEED_COUNT) * STAGGER;
        const local = clamp01((Math.min(global, 1) - stagger) / (1 - STAGGER));
        const appear = clamp01(local / 0.3); // faint at the edge, brightens as it rushes in
        drawSeed(s, easeIn(local), holdRot, appear);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, reduced]);

  if (size === 'sm') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-[#1E1B4B]/60" role="status" aria-label="Organizing records">
        <span className="text-[15px] leading-none" aria-hidden="true">
          <span className="font-normal text-[#1E1B4B]/70">1</span>
          <span className="font-black text-[#5B21B6]">3</span>
          <span className="font-normal text-[#1E1B4B]/70">7</span>
        </span>
        Organizing records...
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 select-none" role="status" aria-label={MESSAGES[msgIdx]}>
      <div className="relative" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
        <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />
      </div>

      <p
        className="text-sm font-medium text-[#1E1B4B]/60 transition-opacity duration-300"
        style={{ opacity: msgVis ? 1 : 0, minHeight: '1.25rem' }}
      >
        {MESSAGES[msgIdx]}
      </p>
    </div>
  );
}
