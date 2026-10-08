/**
 * Calendar dates are plain `yyyy-MM-dd` strings, never `Date` objects: `new Date('2026-01-10')`
 * is UTC midnight and shifts a day in the Americas. All arithmetic runs in UTC day numbers
 * so DST can never move a booking by a day (architecture 2.2, Appendix E).
 */
export type LocalDate = string;

const DAY_MS = 86_400_000;

function parts(date: LocalDate): [number, number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
}

export function dayNumber(date: LocalDate): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromDayNumber(day: number): LocalDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, amount: number): LocalDate {
  return fromDayNumber(dayNumber(date) + amount);
}

export function addMonths(date: LocalDate, amount: number): LocalDate {
  const [y, m, d] = parts(date);
  const target = new Date(Date.UTC(y, m - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return fromDayNumber(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)) / DAY_MS
  );
}

/** Nights in `[checkIn, checkOut)`; check-out day is exclusive. */
export function nightsBetween(checkIn: LocalDate, checkOut: LocalDate): number {
  return dayNumber(checkOut) - dayNumber(checkIn);
}

export function todayIn(timeZone?: string): LocalDate {
  if (timeZone) {
    try {
      // en-CA formats as yyyy-mm-dd
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      /* fall through to UTC */
    }
  }
  return new Date().toISOString().slice(0, 10);
}

export function isBefore(a: LocalDate, b: LocalDate): boolean {
  return dayNumber(a) < dayNumber(b);
}

export function isAfter(a: LocalDate, b: LocalDate): boolean {
  return dayNumber(a) > dayNumber(b);
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return isBefore(a, b) ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return isAfter(a, b) ? a : b;
}

export function clampDate(date: LocalDate, min: LocalDate, max: LocalDate): LocalDate {
  if (isBefore(date, min)) return min;
  if (isAfter(date, max)) return max;
  return date;
}

/** `2026-10-03` → `Oct 3, 2026`, always in the listing's own calendar. */
export function formatDate(date: LocalDate | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = parts(date);
  const value = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

export function formatDateRange(checkIn: LocalDate, checkOut: LocalDate): string {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const fmt = (d: Date, withYear: boolean) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    }).format(d);
  return sameMonth
    ? `${fmt(start, false)} – ${fmt(end, true)}`
    : `${fmt(start, true)} – ${fmt(end, true)}`;
}

/** The month a calendar window should open on. */
export function monthStart(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function rangeDays(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let day = dayNumber(from); day < dayNumber(to); day += 1) out.push(fromDayNumber(day));
  return out;
}