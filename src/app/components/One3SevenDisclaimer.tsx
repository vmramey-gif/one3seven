import { ONE3SEVEN_UNIVERSAL_DISCLAIMER } from '../constants/one3sevenProduct';

type One3SevenDisclaimerProps = {
  /** Full paragraph or expandable footer. */
  variant?: 'full' | 'compact';
  className?: string;
  summaryClassName?: string;
  bodyClassName?: string;
  summary?: string;
};

export function One3SevenDisclaimer({
  variant = 'full',
  className = '',
  summaryClassName = 'text-[10px] text-slate-500',
  bodyClassName = 'text-[10px] leading-relaxed text-slate-500',
  summary = 'About one3seven',
}: One3SevenDisclaimerProps) {
  if (variant === 'compact') {
    return (
      <details className={className}>
        <summary className={`cursor-pointer list-none ${summaryClassName}`}>
          <span className="underline decoration-slate-400/40 underline-offset-2">{summary}</span>
        </summary>
        <p className={`mt-2 ${bodyClassName}`}>{ONE3SEVEN_UNIVERSAL_DISCLAIMER}</p>
      </details>
    );
  }

  return <p className={`text-xs leading-relaxed ${className}`}>{ONE3SEVEN_UNIVERSAL_DISCLAIMER}</p>;
}
