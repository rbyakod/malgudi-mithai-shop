// Relative-time formatting for the admin dashboard.
// Hardcoded English vocabulary — admin-only, no i18n requirement.
// Pure function, no external date libraries.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  date: Date | string,
  now: Date = new Date()
): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = target.getTime() - now.getTime();

  if (diffMs > 0) return "in the future";

  const absMs = Math.abs(diffMs);
  if (absMs < MINUTE) return "just now";

  if (absMs < HOUR) {
    const minutes = Math.round(absMs / MINUTE);
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }

  if (absMs < DAY) {
    const hours = Math.round(absMs / HOUR);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.round(absMs / DAY);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
