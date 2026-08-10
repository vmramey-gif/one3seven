import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { loadRecordVerificationRows, type RecordVerificationRow } from '../../services/intakeDataService';

/**
 * Surfaces the content hash + upload timestamp one3seven already computes at upload time for
 * dedup (fileUploadIntegrity.ts) — a plain fact ("this file, this hash, uploaded at this time"),
 * never a claim about what the record shows or is worth. Organizes and reflects, same as
 * everything else; this just makes an already-computed fact visible instead of internal-only.
 */

const MONO = { fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' } as const;

function formatUploadedAt(iso: string): string {
  if (!iso) return 'Date unavailable';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function RecordVerificationCard({ intakeId }: { intakeId: string | null }) {
  const [rows, setRows] = useState<RecordVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!intakeId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setRows(await loadRecordVerificationRows(intakeId));
      setLoading(false);
    })();
  }, [intakeId]);

  if (loading || rows.length === 0) return null;

  return (
    <section className="rounded-[18px] border border-[#CBD6CF] bg-white/80 p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#42574E]">
        <ShieldCheck className="h-3.5 w-3.5" /> Record verification
      </div>
      <p className="mt-1.5 max-w-[58ch] text-[12.5px] leading-relaxed text-[#5a5f58]">
        Each file below is fingerprinted the moment it&rsquo;s uploaded. This is a fact about the
        file itself — when it arrived, unchanged since — not a statement about what it contains.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r, i) => (
          <li
            key={`${r.fileName}-${i}`}
            className="flex flex-col gap-0.5 rounded-[12px] border border-[#E4E5DE] bg-[#FBFBFA] px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#20242a]">{r.fileName}</span>
            <span className="flex flex-none items-center gap-3 text-[11px] text-[#6A6D66]">
              <span>{formatUploadedAt(r.uploadedAt)}</span>
              {r.contentHash ? (
                <span
                  style={MONO}
                  title={`Full SHA-256: ${r.contentHash}`}
                  className="rounded border border-[#D8E0CF] bg-white px-1.5 py-0.5 text-[10.5px] text-[#42574E]"
                >
                  {r.contentHash.slice(0, 10)}&hellip;
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
