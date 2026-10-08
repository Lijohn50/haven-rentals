import React, { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { cn } from '@/lib/cn';
import { formatDateRange } from '@/lib/local-date';
import { calendarReasonLabel, isCheckInSelectable, isCheckOutSelectable, type CalendarDay } from '@/features/availability/rules';
import type { LocalDate } from '@/lib/local-date';
import type { ListingResponse } from '@/types/api';

type ListingRules = Pick<ListingResponse, 'minNights' | 'maxNights' | 'advanceNoticeDays' | 'timezone'>;

function toPickerDate(value: LocalDate): Date {
  return new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
}

function fromPickerDate(date: Date): LocalDate {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface DateRangeValue {
  from?: LocalDate;
  to?: LocalDate;
}

/**
 * Range picker driven by the listing's real availability. Check-out is exclusive, so a day
 * may be an invalid night and still be a valid departure day (architecture 10.2.2).
 */
export const DateRangePicker: React.FC<{
  days: CalendarDay[];
  listing: ListingRules;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  months?: 1 | 2;
  className?: string;
}> = ({ days, listing, value, onChange, months = 2, className }) => {
  const selected = useMemo(
    () =>
      value.from
        ? { from: toPickerDate(value.from), to: value.to ? toPickerDate(value.to) : undefined }
        : undefined,
    [value.from, value.to]
  );

  const reasonFor = (date: Date): string | null => {
    const iso = fromPickerDate(date);
    if (value.from && !value.to) {
      return isCheckOutSelectable(days, value.from, iso, listing).reason ?? null;
    }
    return isCheckInSelectable(days, iso, listing).reason ?? null;
  };

  return (
    <div className={cn('rounded-card border border-line bg-surface p-3', className)}>
      <DayPicker
        mode="range"
        numberOfMonths={months}
        selected={selected}
        onSelect={(range) =>
          onChange({
            from: range?.from ? fromPickerDate(range.from) : undefined,
            to: range?.to ? fromPickerDate(range.to) : undefined,
          })
        }
        disabled={(date: Date) => reasonFor(date) !== null}
        modifiers={{
          unavailable: (date: Date) => reasonFor(date) !== null,
          booked: (date: Date) =>
            days.find((day) => day.date === fromPickerDate(date))?.reason === 'BOOKED',
          blocked: (date: Date) =>
            days.find((day) => day.date === fromPickerDate(date))?.reason === 'BLOCKED',
        }}
        modifiersClassNames={{
          unavailable: 'text-muted/50 line-through',
          booked: 'text-muted/50 line-through',
          blocked: 'text-muted/50 line-through',
        }}
        className="[--rdp-accent-color:rgb(var(--color-primary))] [--rdp-day_selected-background-color:rgb(var(--color-primary))] [--rdp-day_selected-color:white] [--rdp-range_middle-background-color:rgb(var(--color-highlight))] [--rdp-range_middle-color:rgb(var(--color-text))] [--rdp-day-width:2.5rem] [--rdp-day-height:2.5rem]"
      />
      <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
        {value.from && value.to
          ? `${formatDateRange(value.from, value.to)} · check-out day is not charged`
          : 'Check-in and check-out are both required to quote a stay.'}
      </p>
    </div>
  );
};

/** Reason text for the selected range, used next to the quote button. */
export function rangeUnavailableReason(
  days: CalendarDay[],
  listing: ListingRules,
  value: DateRangeValue
): string | null {
  if (!value.from || !value.to) return null;
  if (!isCheckOutSelectable(days, value.from, value.to, listing).ok) {
    return isCheckOutSelectable(days, value.from, value.to, listing).reason ?? 'Those nights are not available';
  }
  const blocking = days.find(
    (day) => day.date >= value.from! && day.date < value.to! && !day.available
  );
  return blocking ? calendarReasonLabel(blocking) : null;
}