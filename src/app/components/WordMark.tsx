/** Canonical brand name: one3seven with a sage 3. Use this everywhere the name appears in UI. */
export function WordMark({ className }: { className?: string }) {
  return (
    <span className={className}>
      one<span style={{ color: '#42574e' }}>3</span>seven
    </span>
  );
}
