import React, { useMemo } from 'react';
import { DayPicker, DayButton } from 'react-day-picker';
import 'react-day-picker/style.css';
import { cn } from '@/lib/cn';
import { formatDateRange, nightsBetween } from '@/lib/local-date';
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
}> = ({ days, listing, value, onChange, months = 1, className }) => {
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
      if (iso <= value.from) {
        return isCheckInSelectable(days, iso, listing).reason ?? null;
      }
      return isCheckOutSelectable(days, value.from, iso, listing).reason ?? null;
    }
    return isCheckInSelectable(days, iso, listing).reason ?? null;
  };

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line/70 bg-surface p-4 shadow-sm', className)}>
      <style>{`
        .rdp-month_caption {
          padding-left: 0.625rem;
          padding-right: 0.625rem;
          padding-bottom: 0.5rem;
          display: flex;
          align-items: center;
          height: 2.5rem;
        }
        .rdp-caption_label {
          font-size: 1.05rem;
          font-weight: 600;
          color: rgb(var(--color-text));
          font-family: var(--font-heading);
        }
        .rdp-nav {
          position: absolute;
          top: 0;
          right: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          height: 2.5rem;
        }
        .rdp-button_previous, .rdp-button_next {
          width: 2rem;
          height: 2rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.5rem;
          transition: background-color 0.15s;
        }
        .rdp-button_previous:hover, .rdp-button_next:hover {
          background-color: rgb(var(--color-sand));
        }
        .rdp-selected .rdp-day_button,
        .rdp-range_start .rdp-day_button,
        .rdp-range_end .rdp-day_button {
          background-color: rgb(var(--color-primary)) !important;
          color: #ffffff !important;
          border-radius: 9999px !important;
          font-weight: 600 !important;
        }
        .rdp-range_middle {
          background-color: rgb(var(--color-primary-soft)) !important;
        }
        .rdp-range_middle .rdp-day_button {
          color: rgb(var(--color-primary-dark)) !important;
        }
      `}</style>
      {listing.advanceNoticeDays > 0 && (
        <div className="mb-2 rounded-lg bg-sand/80 px-2.5 py-1 text-xs text-muted">
          ⓘ Advance notice: reservations require at least {listing.advanceNoticeDays}{' '}
          {listing.advanceNoticeDays === 1 ? 'day' : 'days'} lead time.
        </div>
      )}
      <DayPicker
        mode="range"
        numberOfMonths={months}
        selected={selected}
        onSelect={(_range, triggerDate) => {
          if (!triggerDate) return;
          const clicked = fromPickerDate(triggerDate);

          // 1. If both from and to are already set: start a new selection
          if (value.from && value.to) {
            onChange({ from: clicked, to: undefined });
            return;
          }

          // 2. If check-in is set and check-out is not:
          if (value.from && !value.to) {
            if (clicked === value.from) {
              // Clicking the check-in date again clears the selection
              onChange({ from: undefined, to: undefined });
              return;
            }
            if (clicked < value.from) {
              // Clicking an earlier date moves check-in
              onChange({ from: clicked, to: undefined });
              return;
            }
            // Clicking a date after check-in selects check-out!
            onChange({ from: value.from, to: clicked });
            return;
          }

          // 3. No dates set: select check-in
          onChange({ from: clicked, to: undefined });
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
        className="mx-auto flex w-full justify-center [--rdp-accent-color:rgb(var(--color-primary))] [--rdp-day-width:2.2rem] [--rdp-day-height:2.2rem] [&_.rdp-month]:w-full [&_.rdp-month]:max-w-full [&_.rdp-table]:w-full [&_.rdp-weeks]:w-full [&_.rdp-weekdays]:w-full"
      />
      <div className="mt-2.5 flex items-center justify-between border-t border-line/60 pt-2 text-xs">
        <div className="min-w-0 font-medium text-text">
          {value.from && value.to ? (
            <span>
              {formatDateRange(value.from, value.to)}{' '}
              <span className="text-muted">
                ({nightsBetween(value.from, value.to)} {nightsBetween(value.from, value.to) === 1 ? 'night' : 'nights'})
              </span>
            </span>
          ) : value.from ? (
            <span className="text-muted">Select check-out date</span>
          ) : (
            <span className="text-muted">Pick check-in and check-out</span>
          )}
        </div>
        {(value.from || value.to) && (
          <button
            type="button"
            onClick={() => onChange({ from: undefined, to: undefined })}
            className="ml-2 shrink-0 font-semibold text-primary hover:underline"
          >
            Clear dates
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-line/40 pt-1.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-line bg-surface" aria-hidden /> Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sand" aria-hidden /> Unavailable
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