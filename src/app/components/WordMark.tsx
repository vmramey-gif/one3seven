/** Canonical brand name: one3seven with purple 3. Use this everywhere the name appears in UI. */
export function WordMark({ className }: { className?: string }) {
  return (
    <span className={className}>
      one<span style={{ color: '#6d4aff' }}>3</span>seven
    </span>
  );
}
