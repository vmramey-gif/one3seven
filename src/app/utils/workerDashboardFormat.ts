/** Compact last-activity label for worker dashboard intake cards. */
export function formatWorkerIntakeLastActivity(updatedAt: string | null | undefined): string | null {
  const raw = (updatedAt ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const dayMs = 86_400_000;
  if (diffMs < dayMs) return 'Updated today';
  if (diffMs < dayMs * 2) return 'Updated yesterday';
  if (diffMs < dayMs * 7) {
    const days = Math.floor(diffMs / dayMs);
    return `Updated ${days}d ago`;
  }
  return `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
