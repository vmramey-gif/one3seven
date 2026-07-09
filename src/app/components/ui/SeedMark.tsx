/**
 * one3seven seed-head brand mark — the golden-angle (137.5°) phyllotaxis spiral,
 * rendered as static SVG. The resting form of the loading animation; the brand symbol.
 * Defaults to a small, crisp count for inline/nav use.
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const BRAND: [number, number, number] = [91, 33, 182]; // #42574E
const LAV: [number, number, number] = [181, 168, 232];

const hex = (a: number[]) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const lerp = (a: number[], b: number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t);

export function SeedMark({
  size = 26,
  count = 55,
  mono = false,
  color,
  className,
}: {
  size?: number;
  count?: number;
  mono?: boolean;
  /** Force a single fill (e.g. a light tone for dark backgrounds). Overrides mono/spread. */
  color?: string;
  className?: string;
}) {
  const cx = 100, cy = 100, maxR = 86;
  const scale = maxR / Math.sqrt(count);
  const dots = Array.from({ length: count }, (_, i) => {
    const ang = i * GOLDEN_ANGLE;
    const rad = scale * Math.sqrt(i);
    const t = Math.sqrt(i) / Math.sqrt(count);
    return {
      cx: +(cx + Math.cos(ang) * rad).toFixed(2),
      cy: +(cy + Math.sin(ang) * rad).toFixed(2),
      r: Math.max(4 * (1 - 0.45 * t), 1.2),
      fill: color ?? (mono ? hex(BRAND) : hex(lerp(BRAND, LAV, t))),
    };
  });

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label="one3seven">
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} />
      ))}
    </svg>
  );
}
