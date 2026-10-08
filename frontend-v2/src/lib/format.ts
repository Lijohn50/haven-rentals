/** Formatting rules live in one place (architecture 14.7). */

const instantLocal = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatInstant(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Check-in and check-out times are always shown in the listing's own zone. */
export function formatInstantInZone(iso: string | null | undefined, timeZone: string | null): string {
  if (!iso || !timeZone) return '—';
  return formatInstant(iso, timeZone);
}

export function formatDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return instantLocal.format(date);
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const delta = time - now;
  const abs = Math.abs(delta);
  if (abs < 45_000) return 'just now';
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return relative.format(Math.round(delta / ms), unit);
  }
  return 'just now';
}

export function formatAbsolute(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'New';
  if (value === 0) return 'New';
  return value.toFixed(1);
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, '');
}

export function formatOccupancy(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function nightsLabel(nights: number): string {
  return pluralize(nights, 'night');
}

export function guestsLabel(guests: number): string {
  return pluralize(guests, 'guest');
}

/** `1.5` bathrooms must not collapse to `1.5 baths` -> keep halves visible. */
export function formatBathrooms(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function initials(firstName: string, lastName?: string | null): string {
  const first = firstName?.trim()?.[0] ?? '';
  const last = lastName?.trim()?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

export function describeNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}