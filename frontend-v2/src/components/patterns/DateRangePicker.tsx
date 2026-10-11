import React, { useMemo } from 'react';
import { DayPicker, DayButton } from 'react-day-picker';
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
      {listing.advanceNoticeDays > 0 && (
        <div className="mb-2 rounded bg-sand/60 px-2.5 py-1 text-xs text-muted">
          ⓘ Advance notice: reservations require at least {listing.advanceNoticeDays}{' '}
          {listing.advanceNoticeDays === 1 ? 'day' : 'days'} lead time.
        </div>
      )}
      <DayPicker
        mode="range"
        numberOfMonths={months}
        selected={selected}
        onSelect={(range, triggerDate) => {
          if (value.from && value.to && triggerDate) {
            const nextCheckIn = fromPickerDate(triggerDate);
            onChange({ from: nextCheckIn, to: undefined });
            return;
          }
          onChange({
            from: range?.from ? fromPickerDate(range.from) : undefined,
            to: range?.to ? fromPickerDate(range.to) : undefined,
          });
        }}
        disabled={(date: Date) => reasonFor(date) !== null}
        modifiers={{
          unavailable: (date: Date) => reasonFor(date) !== null,
          booked: (date: Date) =>
            days.find((day) => day.date === fromPickerDate(date))?.reason === 'BOOKED',
          blocked: (date: Date) =>
            days.find((day) => day.date === fromPickerDate(date))?.reason === 'BLOCKED',
        }}
        modifiersClassNames={{
          unavailable: 'text-muted/35 font-normal',
          booked: 'text-muted/35 font-normal',
          blocked: 'text-muted/35 font-normal',
        }}
        components={{
          DayButton: (props) => {
            const date = props.day.date;
            const reason = reasonFor(date);
            const dateStr = fromPickerDate(date);
            const tooltip = reason ? `${dateStr}: ${reason}` : dateStr;
            return <DayButton {...props} title={tooltip} aria-label={tooltip} />;
          },
        }}
        className="[--rdp-accent-color:rgb(var(--color-primary))] [--rdp-day_selected-background-color:rgb(var(--color-primary))] [--rdp-day_selected-color:white] [--rdp-range_middle-background-color:rgb(var(--color-primary-soft))] [--rdp-range_middle-color:rgb(var(--color-primary-dark))] [--rdp-day-width:2.35rem] [--rdp-day-height:2.35rem]"
      />
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
        <span>
          {value.from && value.to
            ? `${formatDateRange(value.from, value.to)} · check-out day is not charged`
            : value.from
              ? 'Select check-out date'
              : 'Check-in and check-out are both required to quote a stay.'}
        </span>
        {(value.from || value.to) && (
          <button
            type="button"
            onClick={() => onChange({ from: undefined, to: undefined })}
            className="ml-2 shrink-0 font-medium text-primary hover:underline"
          >
            Clear dates
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 border-t border-line/40 pt-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" /> Selected
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border border-line bg-surface" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sand" /> Unavailable (hover for reason)
        </span>
      </div>
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