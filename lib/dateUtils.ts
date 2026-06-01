/**
 * Shared date and display utilities used across multiple screens.
 */

/** Returns the number of days from now until the given date string. */
export function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Formats a date string as a relative time (e.g. "5m ago", "2d ago").
 * Pass a translation function `t` to localise the "Just now" label;
 * if omitted the plain English string is returned.
 */
export function formatRelativeDate(
  dateStr: string,
  t: (s: string) => string = (s) => s,
): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return t('Just now');
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Maps a Supabase role string to its user-facing label. */
export function getRoleLabel(
  role: string,
  t: (s: string) => string = (s) => s,
): string {
  if (role === 'owner') return t('Barn Manager');
  if (role === 'staff') return t('Staff');
  return t('Horse Owner');
}
