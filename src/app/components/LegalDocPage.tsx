/**
 * Standalone, logged-out-accessible renderer for a legal document (Terms / Privacy).
 * Used by the /terms and /privacy routes. Matches the site's brand styling.
 */

import { WordMark } from './WordMark';
import type { LegalDoc } from '../constants/legalContent';

export function LegalDocPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen bg-[#f8f6ff] text-[#1B2623] antialiased">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#D3DED6] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <a href="/" className="flex items-center gap-2"><WordMark /></a>
          <a href="/" className="text-sm font-medium text-[#1B2623]/55 transition hover:text-[#1B2623]">Back to home</a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <h1 className="text-[28px] font-bold tracking-tight text-[#1B2623] sm:text-[34px]">{doc.title}</h1>
        <p className="mt-2 text-[13px] font-semibold text-[#42574E]">{doc.org}</p>
        <p className="text-[13px] text-[#1B2623]/50">{doc.effective}</p>
        <p className="mt-5 text-[15px] leading-relaxed text-[#1B2623]/70">{doc.intro}</p>

        <div className="mt-10 space-y-9">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-3 text-[18px] font-bold tracking-tight text-[#1B2623]">{section.heading}</h2>
              <div className="space-y-3">
                {section.blocks.map((block, i) => {
                  if (block.type === 'subhead') {
                    return (
                      <h3 key={i} className="pt-1 text-[14px] font-semibold text-[#1B2623]">{block.text}</h3>
                    );
                  }
                  if (block.type === 'bullets') {
                    return (
                      <ul key={i} className="space-y-1.5">
                        {block.items.map((item, j) => (
                          <li key={j} className="flex gap-2.5 text-[14.5px] leading-relaxed text-[#1B2623]/72">
                            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B6DFF]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={i} className="text-[14.5px] leading-relaxed text-[#1B2623]/72">{block.text}</p>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-[#D3DED6] pt-6 text-[12px] leading-relaxed text-[#1B2623]/40">
          one3seven is not a law firm and does not provide legal advice. Use of this platform does not create an attorney-client relationship.
        </div>
      </main>
    </div>
  );
}
