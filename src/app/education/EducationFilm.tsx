import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { Lesson } from './lessons';

/**
 * EducationFilm — the reusable narrated-lesson player (worker-facing, public).
 *
 * Auto-advancing slides narrated by pre-rendered ElevenLabs clips at /voice/lessons/<key>.mp3
 * (the same voice as the intake). Captions + a full transcript make it study-able and accessible.
 * The narration only ever speaks the lesson's vetted fixed lines — the format is the guardrail.
 */

const SERIF = { fontFamily: "'Fraunces', Georgia, serif" } as const;
const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;

export function EducationFilm({ lesson, audioBase = '/voice/lessons' }: { lesson: Lesson; audioBase?: string }) {
  const beats = lesson.beats;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const beat = beats[i];

  const src = useMemo(() => `${audioBase}/${beat.key}.mp3`, [audioBase, beat.key]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.src = src;
      const p = a.play();
      if (p && p.catch) p.catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, playing]);

  const onEnded = () => {
    if (!playing) return;
    if (i < beats.length - 1) setI(i + 1);
    else setPlaying(false);
  };

  const go = (next: number) => {
    if (next < 0 || next > beats.length - 1) return;
    setI(next);
  };

  const toggle = () => {
    const a = audioRef.current;
    if (playing) {
      a?.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  return (
    <div style={{ fontFamily: '"Inter Tight", ui-sans-serif, system-ui, sans-serif' }}>
      {/* Stage */}
      <div className="relative overflow-hidden rounded-[24px] border border-[#E4E5DE] bg-gradient-to-b from-[#FBFBF8] to-[#F1F3EC] shadow-[0_20px_60px_rgba(31,27,45,0.10)]" style={{ aspectRatio: '16 / 9' }}>
        {beats.map((b, idx) => (
          <div
            key={b.key}
            className={`absolute inset-0 flex flex-col justify-center px-6 py-8 transition-opacity duration-500 sm:px-12 ${idx === i ? 'opacity-100' : 'pointer-events-none opacity-0'} motion-reduce:transition-none`}
          >
            <div style={MONO} className="mb-3 text-[10.5px] uppercase tracking-[0.2em] text-[#7C8B6F]">{b.kicker}</div>
            <h3 style={SERIF} className="max-w-[20ch] text-[clamp(22px,4.4vw,44px)] font-semibold leading-[1.05] tracking-[-0.01em] text-[#1B2623]" dangerouslySetInnerHTML={{ __html: emphasize(b.title) }} />
            <p className="mt-4 max-w-[46ch] text-[clamp(13px,1.7vw,18px)] leading-relaxed text-[#4B564E]">{b.body}</p>
          </div>
        ))}
        <div className="absolute right-5 top-4 font-mono text-[12px] text-[#9AA39B]" style={MONO}>
          {String(i + 1).padStart(2, '0')} / {String(beats.length).padStart(2, '0')}
        </div>
        <div className="absolute inset-x-5 bottom-4 flex gap-1.5">
          {beats.map((b, idx) => (
            <span key={b.key} className={`h-[3px] flex-1 rounded-full ${idx <= i ? 'bg-[#42574E]' : 'bg-[#DCE1D6]'}`} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} className="inline-flex items-center gap-2 rounded-full bg-[#42574E] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#374a42]">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => go(i - 1)} aria-label="Previous" className="inline-flex items-center gap-1 rounded-full border border-[#D3DED6] bg-white px-4 py-2.5 text-[13.5px] font-medium text-[#384039] transition hover:border-[#7C8B6F]">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={() => go(i + 1)} aria-label="Next" className="inline-flex items-center gap-1 rounded-full border border-[#D3DED6] bg-white px-4 py-2.5 text-[13.5px] font-medium text-[#384039] transition hover:border-[#7C8B6F]">
          Next <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => { setI(0); }} aria-label="Restart" className="inline-flex items-center gap-1 rounded-full border border-[#D3DED6] bg-white px-4 py-2.5 text-[13.5px] font-medium text-[#384039] transition hover:border-[#7C8B6F]">
          <RotateCcw className="h-4 w-4" /> Restart
        </button>
      </div>

      {/* Caption */}
      <p className="mt-4 min-h-[46px] border-l-2 border-[#42574E] pl-4 text-[15px] italic leading-relaxed text-[#4B564E]">{beat.script}</p>

      {/* Transcript */}
      <details className="mt-5 border-t border-[#E4E5DE] pt-4">
        <summary style={MONO} className="cursor-pointer text-[12px] uppercase tracking-[0.1em] text-[#42574E]">Read the full transcript</summary>
        <div className="mt-3 flex flex-col">
          {beats.map((b, idx) => (
            <div key={b.key} className="grid grid-cols-[40px_1fr] gap-4 border-t border-[#EEF0EA] py-3 first:border-t-0">
              <div style={MONO} className="text-[12px] text-[#9AA39B]">{String(idx + 1).padStart(2, '0')}</div>
              <div>
                <div style={MONO} className="text-[10.5px] uppercase tracking-[0.1em] text-[#7C8B6F]">{b.kicker}</div>
                <p className="mt-1 text-[14px] leading-relaxed text-[#4B564E]">{b.script}</p>
              </div>
            </div>
          ))}
        </div>
      </details>

      <audio ref={audioRef} preload="auto" onEnded={onEnded} />
    </div>
  );
}

// Allow only a single <em>…</em> emphasis span from the (vetted, non-user) lesson title.
function emphasize(html: string): string {
  return html.replace(/<(?!\/?em>)/g, '&lt;');
}
