import { fromZonedTime } from 'date-fns-tz';
import type { CancellationPolicy } from '@/types/api';
import type { LocalDate } from './local-date';

/**
 * Display-only helper for the "free cancellation until ..." line on the booking card.
 * The authoritative refund figure always comes from the server's cancellation-preview.
 */
const FREE_WINDOW_HOURS: Record<Exclude<CancellationPolicy, 'STRICT'>, number> = {
  FLEXIBLE: 24,
  MODERATE: 120,
};

/** `HH:mm:ss` or `HH:mm` as stored by the backend, in 24-hour form. */
export function localTimeToDisplay(time: string | null | undefined): string {
  if (!time) return '—';
  const [h, m] = time.split(':');
  const hour = Number(h);
  const minute = Number(m ?? '0');
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;
  const suffix = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function freeCancellationUntil(
  policy: CancellationPolicy,
  checkIn: LocalDate,
  checkInTime: string | null | undefined,
  timeZone: string
): Date | null {
  if (policy === 'STRICT' || !checkInTime) return null;
  const time = checkInTime.length === 5 ? `${checkInTime}:00` : checkInTime;
  try {
    const checkInInstant = fromZonedTime(`${checkIn}T${time}`, timeZone);
    return new Date(checkInInstant.getTime() - FREE_WINDOW_HOURS[policy] * 3_600_000);
  } catch {
    return null;
  }
}