// All date keys are local calendar dates formatted YYYY-MM-DD so that
// "completed today" matches the user's local day regardless of timezone.

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Date formatters are wrapped so an unexpected locale/Intl quirk on any device
// can never throw (which, with no fallback, would blank the whole screen).
export function formatLong(key: string): string {
  try {
    return fromDateKey(key).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return key; // safe fallback: raw YYYY-MM-DD
  }
}

export function formatShort(key: string): string {
  try {
    return fromDateKey(key).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    // Manual "D Mon" from the key, locale-independent.
    const [, m, d] = key.split('-').map(Number);
    if (Number.isFinite(d) && m >= 1 && m <= 12) return `${d} ${MONTHS_SHORT[m - 1]}`;
    return key;
  }
}

// Mon→Sun keys of the current calendar week, with single-letter labels.
export function currentWeekKeys(): { key: string; label: string }[] {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { key: toDateKey(d), label: labels[i] };
  });
}

// Consecutive days (ending today, or yesterday if today is empty) present in the set.
export function streakLength(dateSet: Set<string>): number {
  let count = 0;
  const d = new Date();
  if (!dateSet.has(toDateKey(d))) d.setDate(d.getDate() - 1);
  while (dateSet.has(toDateKey(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}
