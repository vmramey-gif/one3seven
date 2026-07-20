import { useRef, useState } from 'react';
import { ArrowLeft, FileText, X } from 'lucide-react';

/**
 * Attorney-side engine — a firm organizes its OWN case documents (not a worker intake).
 * Purpose-built and clean: no worker-oriented copy or questions. Reuses the same organizing
 * engine downstream (persist -> process -> Decision Card packet). Attorney-uploaded material is
 * privileged, so the confidentiality framing is explicit.
 */
interface FirmCaseIntakeScreenProps {
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  /** Persist + process the uploaded files through the engine, then advance to processing. */
  onOrganize: (caseReference: string) => void;
  onBack: () => void;
  organizing?: boolean;
}

const PAGE = 'min-h-screen bg-[#F2F4EC]';

export function FirmCaseIntakeScreen({
  uploadedFiles,
  setUploadedFiles,
  onOrganize,
  onBack,
  organizing = false,
}: FirmCaseIntakeScreenProps) {
  const [caseReference, setCaseReference] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (pdfs.length) setUploadedFiles([...uploadedFiles, ...pdfs]);
  };

  const removeAt = (i: number) => setUploadedFiles(uploadedFiles.filter((_, idx) => idx !== i));

  const canOrganize = uploadedFiles.length > 0 && acknowledged && !organizing;

  return (
    <div className={PAGE}>
      <nav className="border-b border-[#E4E5DE] bg-white/90">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1B2623]/65 transition-colors hover:bg-[#F2F4EC] hover:text-[#1B2623]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-[#1B2623]">
          Organize a case file
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#1B2623]/65">
          Upload the documents for a matter and one3seven will organize them into a source-linked
          timeline and review packet for your firm. It infers document types automatically — no
          sorting or labeling needed.
        </p>

        {/* Case reference */}
        <div className="mt-8">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#42574E]">
            Case reference <span className="font-normal normal-case text-[#1B2623]/40">(optional)</span>
          </label>
          <input
            type="text"
            value={caseReference}
            onChange={(e) => setCaseReference(e.target.value)}
            placeholder="e.g. Delgado v. Golden Coast — matter #1042"
            className="w-full rounded-xl border border-[#E4E5DE] bg-white px-4 py-3 text-sm text-[#1B2623] outline-none focus:border-[#7C8B6F]"
          />
        </div>

        {/* Upload */}
        <div className="mt-6">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#42574E]">
            Case documents
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? 'border-[#42574E] bg-[#EAF0EC]' : 'border-[#D8E0DA] bg-white'
            }`}
          >
            <p className="text-sm text-[#1B2623]/70">Drag and drop PDF files here, or</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#E4E5DE] bg-white px-5 py-2 text-sm font-semibold text-[#42574E] shadow-sm transition hover:border-[#7C8B6F] hover:bg-[#F2F4EC]"
            >
              Browse files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <p className="mt-3 text-[11px] text-[#1B2623]/45">PDF files only.</p>
          </div>

          {uploadedFiles.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {uploadedFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-[#E4E5DE] bg-white px-4 py-2.5"
                >
                  <FileText className="h-4 w-4 shrink-0 text-[#42574E]" />
                  <span className="flex-1 truncate text-sm text-[#1B2623]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="rounded-md p-1 text-[#1B2623]/40 transition hover:bg-[#F2F4EC] hover:text-[#1B2623]"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Confidentiality acknowledgment — attorney-uploaded material is privileged */}
        <label className="mt-6 flex items-start gap-3 rounded-xl border border-[#E4E5DE] bg-[#F2F4EC] p-4">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#42574E]"
          />
          <span className="text-[12px] leading-relaxed text-[#1B2623]/70">
            These are your firm's own records, uploaded for internal organization and review.
            one3seven organizes them and does not provide legal advice, case scoring, or outcome
            predictions. Your firm remains responsible for verifying the organized output against the
            source records. Upload only material you are authorized to process.
          </span>
        </label>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={!canOrganize}
            onClick={() => onOrganize(caseReference.trim())}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#42574E] px-8 py-3 text-[14px] font-semibold text-white shadow-sm transition enabled:hover:bg-[#374A42] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {organizing ? 'Organizing…' : 'Begin organizing'}
          </button>
        </div>
      </main>
    </div>
  );
}
