import { useEffect, useState } from 'react';

/**
 * Thin scroll-progress bar for the worker "sunset" summary — fills as the worker moves through their
 * file toward completion, in the action→done gradient (orange → sage). Ambient only; never blocks or
 * shifts content. See project_ui_direction_july2026.
 */
export function WorkerSkyProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed left-0 top-0 z-[60] h-[3px] transition-[width] duration-100 ease-linear"
      style={{
        width: `${pct}%`,
        background: 'linear-gradient(90deg, var(--o3s-action), var(--o3s-done))',
        boxShadow: '0 0 12px rgba(181, 83, 31, 0.4)',
      }}
    />
  );
}
