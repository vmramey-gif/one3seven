import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const MESSAGES = [
  'Organizing records...',
  'Building chronology...',
  'Connecting events...',
  'Preparing review packet...',
  'Structuring uploaded information...',
];

type ShapeType = 'square' | 'circle' | 'triangle' | 'diamond';
const SHAPES: ShapeType[] = ['square', 'circle', 'triangle', 'diamond'];

interface Particle {
  type: ShapeType;
  angle: number;
  startR: number;
  size: number;
  phase: number;
  speed: number;
}

const CANVAS_SIZE = 280;

function spawn(maxR: number, phase = Math.random()): Particle {
  return {
    type: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    angle: Math.random() * Math.PI * 2,
    startR: maxR * (0.52 + Math.random() * 0.44),
    size: 9 + Math.random() * 11,   // larger shapes — more visible
    phase,
    speed: 0.0032 + Math.random() * 0.0025,
  };
}

function drawShape(ctx: CanvasRenderingContext2D, type: ShapeType, x: number, y: number, s: number) {
  const h = s / 2;
  ctx.beginPath();
  switch (type) {
    case 'square':
      ctx.rect(x - h, y - h, s, s);
      break;
    case 'circle':
      ctx.arc(x, y, h, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + h, y + h);
      ctx.lineTo(x - h, y + h);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(x, y - h * 1.25);
      ctx.lineTo(x + h * 0.82, y);
      ctx.lineTo(x, y + h * 1.25);
      ctx.lineTo(x - h * 0.82, y);
      ctx.closePath();
      break;
  }
  ctx.fill();
}

export function OneThreeSevenLoader({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const reduced = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVis, setMsgVis] = useState(true);

  // Microcopy rotation
  useEffect(() => {
    if (size !== 'lg') return;
    const iv = setInterval(() => {
      setMsgVis(false);
      const t = setTimeout(() => {
        setMsgIdx(i => (i + 1) % MESSAGES.length);
        setMsgVis(true);
      }, 340);
      return () => clearTimeout(t);
    }, 2800);
    return () => clearInterval(iv);
  }, [size]);

  // Canvas — shapes drift from scatter toward center "137"
  useEffect(() => {
    if (size !== 'lg' || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const maxR = CANVAS_SIZE * 0.46;
    const NUM = 12;

    const particles = Array.from({ length: NUM }, (_, i) => spawn(maxR, i / NUM));

    let raf = 0;

    function tick() {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      for (const p of particles) {
        p.phase += p.speed;
        if (p.phase >= 1) Object.assign(p, spawn(maxR, 0));

        const t = p.phase;
        let alpha: number;
        let posT: number;

        if (t < 0.12) {
          alpha = t / 0.12;
          posT = 0;
        } else if (t < 0.82) {
          alpha = 1;
          posT = (t - 0.12) / 0.70;
        } else {
          alpha = 1 - (t - 0.82) / 0.18;
          posT = 1;
        }

        // Smoothstep: slow start, accelerates toward center
        const eased = posT * posT * (3 - 2 * posT);

        const px = cx + Math.cos(p.angle) * p.startR * (1 - eased);
        const py = cy + Math.sin(p.angle) * p.startR * (1 - eased);

        // Muted lavender → indigo as they organize
        const cT = Math.min(eased * 1.3, 1);
        const r = Math.round(198 + (109 - 198) * cT);
        const g = Math.round(190 + (74 - 190) * cT);
        const b = Math.round(232 + (255 - 232) * cT);

        ctx.globalAlpha = alpha * 0.72;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        drawShape(ctx, p.type, px, py, p.size);
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
          <span className="font-black text-[#6D4AFF]">3</span>
          <span className="font-normal text-[#1E1B4B]/70">7</span>
        </span>
        Organizing records...
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 select-none" role="status" aria-label={MESSAGES[msgIdx]}>
      {/* Canvas + 137 overlay */}
      <div className="relative" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
        {!reduced && (
          <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />
        )}
        {/* 137 — center and organizing force, styled like the logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            style={{ animation: reduced ? 'none' : 'o3s-pulse 2.6s ease-in-out infinite', lineHeight: 1 }}
            aria-hidden="true"
          >
            <span className="text-[54px] font-normal text-[#1E1B4B]/60">1</span>
            <span className="text-[54px] font-black text-[#6D4AFF]">3</span>
            <span className="text-[54px] font-normal text-[#1E1B4B]/60">7</span>
          </span>
        </div>
      </div>

      {/* Rotating microcopy */}
      <p
        className="text-sm font-medium text-[#1E1B4B]/60 transition-opacity duration-300"
        style={{ opacity: msgVis ? 1 : 0, minHeight: '1.25rem' }}
      >
        {MESSAGES[msgIdx]}
      </p>

      <style>{`
        @keyframes o3s-pulse {
          0%, 100% { opacity: 0.78; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
