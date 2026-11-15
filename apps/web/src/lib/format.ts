const DAY = 24 * 3600 * 1000;

export function formatDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' },
): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString(undefined, options);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.round(diff / DAY);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = Math.round(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

export function untilDate(iso: string): string {
  const days = Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / DAY);
  if (days <= 0) return 'Ready to open';
  if (days === 1) return 'Opens tomorrow';
  if (days < 60) return `Opens in ${days} days`;
  const months = Math.round(days / 30);
  if (months < 24) return `Opens in ${months} months`;
  return `Opens in ${Math.round(days / 365)} years`;
}

export function timeOfDay(date = new Date()): 'dawn' | 'day' | 'dusk' | 'night' {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export function greeting(name: string): string {
  const part = timeOfDay();
  const lead =
    part === 'dawn'
      ? 'Early morning'
      : part === 'day'
        ? 'Hello'
        : part === 'dusk'
          ? 'Good evening'
          : 'Late night';
  return `${lead}, ${name}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function ageRangeLabel(ageMin: number | null, ageMax: number | null): string {
  if (ageMin === null) return 'Unplaced';
  if (ageMax === null || ageMax === ageMin) return `Age ${ageMin}`;
  return `Ages ${ageMin}–${ageMax}`;
}

export function formatMilestoneDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const when = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
  return when.toLocaleDateString(undefined, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    ...(day ? { day: 'numeric' } : {}),
  });
}
