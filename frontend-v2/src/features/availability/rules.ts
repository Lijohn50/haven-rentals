import type { CalendarDayResponse, CalendarResponse, ListingResponse } from '@/types/api';
import { addDays, nightsBetween, todayIn, type LocalDate } from '@/lib/local-date';

export type CalendarDay = CalendarDayResponse;

export function daysOf(calendar: CalendarResponse | undefined): CalendarDay[] {
  return calendar?.days ?? [];
}

export function dayMap(calendar: CalendarResponse | undefined): Map<LocalDate, CalendarDay> {
  return new Map(daysOf(calendar).map((day) => [day.date, day]));
}

/**
 * Latest valid check-out for a check-in: the first unavailable NIGHT after it.
 * Check-out is exclusive, so that day may itself be unavailable and still be a valid
 * departure day (architecture Appendix E).
 */
export function maxCheckOut(days: CalendarDay[], checkIn: LocalDate): LocalDate | null {
  const start = days.findIndex((day) => day.date === checkIn);
  if (start < 0) return null;
  for (let i = start; i < days.length; i += 1) {
    if (!days[i].available) return days[i].date;
  }
  return null;
}

export interface SelectableResult {
  ok: boolean;
  reason?: string;
}

export function isCheckInSelectable(
  days: CalendarDay[],
  date: LocalDate,
  listing: Pick<ListingResponse, 'minNights' | 'maxNights' | 'advanceNoticeDays' | 'timezone'>
): SelectableResult {
  const day = days.find((entry) => entry.date === date);
  if (!day) return { ok: false, reason: 'Outside the loaded calendar' };
  if (!day.available) return { ok: false, reason: reasonLabel(day) };
  if (nightsBetween(date, addDays(date, listing.minNights)) > listing.maxNights) {
    return { ok: false, reason: `This home has a ${listing.minNights}-night minimum stay` };
  }
  const earliest = addDays(todayIn(listing.timezone), listing.advanceNoticeDays);
  if (nightsBetween(earliest, date) < 0) {
    return { ok: false, reason: `Needs ${listing.advanceNoticeDays} days' notice` };
  }
  return { ok: true };
}

export function isCheckOutSelectable(
  days: CalendarDay[],
  checkIn: LocalDate,
  candidate: LocalDate,
  listing: Pick<ListingResponse, 'minNights' | 'maxNights'>
): SelectableResult {
  const nights = nightsBetween(checkIn, candidate);
  if (nights < listing.minNights) {
    return { ok: false, reason: `Minimum stay is ${listing.minNights} nights` };
  }
  if (nights > listing.maxNights) {
    return { ok: false, reason: `Maximum stay is ${listing.maxNights} nights` };
  }
  const limit = maxCheckOut(days, checkIn);
  if (limit && candidate > limit) {
    return { ok: false, reason: 'A night in this range is not available' };
  }
  return { ok: true };
}

export function isNightAvailable(days: CalendarDay[], date: LocalDate): boolean {
  return days.find((entry) => entry.date === date)?.available ?? false;
}

function reasonLabel(day: CalendarDay): string {
  switch (day.reason) {
    case 'BOOKED':
      return 'Already booked';
    case 'BLOCKED':
      return 'Blocked by the host';
    case 'PAST':
      return 'In the past';
    case 'OUTSIDE_WINDOW':
      return 'Outside the booking window';
    default:
      return 'Not available';
  }
}

export function calendarReasonLabel(day: CalendarDay | undefined): string | null {
  if (!day || day.available) return null;
  return reasonLabel(day);
}