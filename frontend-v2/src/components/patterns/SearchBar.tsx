import React, { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { CalendarDays, MapPin, Search, Users } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useDebouncedValue } from '@/hooks/useUtilities';
import { useCitySuggestions } from '@/features/search/api';
import { cn } from '@/lib/cn';
import { recallSearch, rememberSearch } from '@/lib/idempotency';
import { formatDateRange, isBefore, nightsBetween, todayIn, type LocalDate } from '@/lib/local-date';
import {
  Button,
  InlineAlert,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Stepper,
} from '@/components/ui';

function toPickerDate(value: LocalDate): Date {
  return new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
}

function fromPickerDate(date: Date): LocalDate {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface Prefill {
  city: string;
  country: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
}

function readPrefill(props: SearchBarProps): Prefill {
  const remembered = recallSearch();
  const guests = props.initialGuests ?? Number(remembered.guests);
  return {
    city: props.initialCity ?? remembered.city ?? '',
    country: props.initialCountry ?? remembered.country ?? '',
    checkIn: props.initialCheckIn ?? remembered.checkIn ?? undefined,
    checkOut: props.initialCheckOut ?? remembered.checkOut ?? undefined,
    guests: Number.isFinite(guests) && guests > 0 ? Math.min(guests, BRAND.maxGuests) : 1,
  };
}

export interface SearchBarProps {
  variant?: 'hero' | 'compact';
  initialCity?: string;
  initialCountry?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  variant = 'hero',
  initialCity,
  initialCountry,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
}) => {
  const navigate = useNavigate();
  const prefill = useMemo(
    () => readPrefill({ initialCity, initialCountry, initialCheckIn, initialCheckOut, initialGuests }),
    [initialCity, initialCountry, initialCheckIn, initialCheckOut, initialGuests]
  );

  const [destination, setDestination] = useState(prefill.city);
  const [city, setCity] = useState(prefill.city);
  const [country, setCountry] = useState(prefill.country);
  const [range, setRange] = useState<DateRange>({
    from: prefill.checkIn ? toPickerDate(prefill.checkIn) : undefined,
    to: prefill.checkOut ? toPickerDate(prefill.checkOut) : undefined,
  });
  const [guests, setGuests] = useState(prefill.guests);
  const [dateError, setDateError] = useState<string | null>(null);

  // `useState` only reads `prefill` on the first render, so a URL-driven change (a filter
  // chip clearing the city, the back button) left the boxes showing the old search.
  useEffect(() => {
    setDestination(prefill.city);
    setCity(prefill.city);
    setCountry(prefill.country);
    setGuests(prefill.guests);
    setRange({
      from: prefill.checkIn ? toPickerDate(prefill.checkIn) : undefined,
      to: prefill.checkOut ? toPickerDate(prefill.checkOut) : undefined,
    });
  }, [prefill]);

  const debouncedDestination = useDebouncedValue(destination, 250);
  const suggestions = useCitySuggestions(debouncedDestination, true);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const inputId = useId();
  const listId = useId();

  const options = suggestions.data ?? [];
  // `options.length` has to be part of this: the combobox declared aria-expanded="true"
// while the listbox it points at via aria-controls was not in the DOM (still loading, or
// no matches).
const showList = destination.trim().length >= 2 && !dismissed && options.length > 0;

  useEffect(() => {
    setActive(-1);
    setDismissed(false);
  }, [debouncedDestination]);

  useEffect(() => {
    setDateError(null);
  }, [range.from, range.to]);

  const checkIn = range.from ? fromPickerDate(range.from) : undefined;
  const checkOut = range.to ? fromPickerDate(range.to) : undefined;

  const choose = (option: (typeof options)[number]) => {
    setDestination(option.city);
    setCity(option.city);
    setCountry(option.country);
    setDismissed(true);
    setActive(-1);
  };

  const submit = (withDates: boolean) => {
    if (withDates && Boolean(range.from) !== Boolean(range.to)) {
      setDateError('Choose both dates or search without dates');
      setDatesOpen(true);
      return;
    }
    const params = new URLSearchParams();
    if (city.trim()) params.set('city', city.trim());
    if (country.trim()) params.set('country', country.trim());
    if (withDates && checkIn && checkOut) {
      params.set('checkIn', checkIn);
      params.set('checkOut', checkOut);
    }
    params.set('guests', String(guests));
    rememberSearch({
      city: city.trim(),
      country: country.trim(),
      checkIn: withDates ? checkIn : undefined,
      checkOut: withDates ? checkOut : undefined,
      guests,
    });
    navigate(`${ROUTES.SEARCH}?${params.toString()}`);
  };

  const today = todayIn();
  const datesDisabled = (date: Date): boolean => {
    const iso = fromPickerDate(date);
    if (isBefore(iso, today)) return true;
    if (range.from && !range.to) {
      const nights = nightsBetween(fromPickerDate(range.from), iso);
      return nights < 1 || nights > BRAND.maxNights;
    }
    return false;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!showList || options.length === 0) return;
      event.preventDefault();
      setDismissed(false);
      setActive((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        return Math.max(-1, Math.min(options.length - 1, next));
      });
      return;
    }
    if (event.key === 'Enter') {
      if (showList && active >= 0 && options[active]) {
        event.preventDefault();
        choose(options[active]);
        return;
      }
      event.preventDefault();
      submit(true);
      return;
    }
    if (event.key === 'Escape') {
      setDismissed(true);
      setActive(-1);
    }
  };

  const hero = variant === 'hero';
  const shell = hero ? 'max-w-[52rem]' : 'max-w-[46rem]';
  const segmentHeight = hero ? 'lg:h-[4.25rem]' : 'lg:h-16';
  const segmentLabel = 'text-[0.6875rem] font-semibold uppercase leading-4 tracking-wide text-muted';
  const segmentValue = 'flex items-center gap-2 truncate text-sm font-medium leading-6 text-ink';
  const datesLabel = checkIn && checkOut ? formatDateRange(checkIn, checkOut) : 'Add dates';

  return (
    <div className={cn('w-full', shell)}>
      <div className={cn('rounded-hero border border-line bg-surface p-2 shadow-pop', hero && 'sm:p-2.5')}>
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] lg:items-stretch lg:gap-0">
          <div className={cn('relative flex min-w-0 flex-col justify-center rounded-control px-3 transition-shadow focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary/30', segmentHeight)}>
            <label htmlFor={inputId} className={segmentLabel}>
              Where to?
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id={inputId}
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
                autoComplete="off"
                className={cn(
                  'h-6 rounded-none border-0 bg-transparent pl-6 pr-0 leading-6 placeholder:text-muted/70 focus:border-transparent focus:ring-0 focus:outline-none',
                  hero ? 'text-base' : 'text-sm'
                )}
                placeholder="City or town"
                value={destination}
                onChange={(event) => {
                  setDestination(event.target.value);
                  setCity(event.target.value);
                  setCountry('');
                }}
                onKeyDown={onKeyDown}
                onFocus={() => setDismissed(false)}
              />
            </div>
            {showList && options.length > 0 && (
              <ul
                id={listId}
                role="listbox"
                aria-label="Destination suggestions"
                className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-auto rounded-card border border-line bg-surface p-1 shadow-pop"
              >
                {options.map((option, index) => (
                  <li
                    key={`${option.city}-${option.country}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2 text-sm',
                      index === active ? 'bg-primary-soft text-primary-dark' : 'text-ink'
                    )}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(option);
                    }}
                  >
                    <span>
                      {option.city}
                      <span className="block text-xs text-muted">{option.country}</span>
                    </span>
                    <span className="text-xs text-muted">
                      {option.listingCount} {option.listingCount === 1 ? 'home' : 'homes'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Popover open={datesOpen} onOpenChange={setDatesOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex min-w-0 flex-col justify-center rounded-control border-l border-line px-3 text-left transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40',
                  segmentHeight
                )}
              >
                <span className={segmentLabel}>Dates</span>
                <span className={segmentValue}>
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  {datesLabel}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto max-w-[min(94vw,40rem)]">
              <p className="mb-2 text-sm font-semibold text-ink">
                {checkIn && checkOut
                  ? formatDateRange(checkIn, checkOut)
                  : checkIn
                    ? 'Now choose a check-out date'
                    : 'Choose your check-in date'}
              </p>
              {dateError && <InlineAlert tone="warning">{dateError}</InlineAlert>}
              <DayPicker
                mode="range"
                numberOfMonths={2}
                selected={range}
                onSelect={(next) => {
                  setRange(next ?? { from: undefined, to: undefined });
                }}
                disabled={datesDisabled}
                className="[--rdp-accent-color:rgb(var(--color-primary))] [--rdp-day_selected-background-color:rgb(var(--color-primary))] [--rdp-day_selected-color:white] [--rdp-range_middle-background-color:rgb(var(--color-highlight))] [--rdp-range_middle-color:rgb(var(--color-text))]"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  className="text-sm font-medium text-primary underline underline-offset-4"
                  onClick={() => {
                    setRange({ from: undefined, to: undefined });
                    setDateError(null);
                  }}
                >
                  Clear dates
                </button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDatesOpen(false)}>
                    Close
                  </Button>
                  <Button size="sm" onClick={() => setDatesOpen(false)} disabled={Boolean(range.from) !== Boolean(range.to)}>
                    Apply dates
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                Both dates or neither. The check-out day is not charged. Up to {BRAND.maxNights} nights.
              </p>
            </PopoverContent>
          </Popover>

          <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex min-w-0 flex-col justify-center rounded-control border-l border-line px-3 text-left transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40',
                  segmentHeight
                )}
              >
                <span className={segmentLabel}>Guests</span>
                <span className={segmentValue}>
                  <Users className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  {guests} {guests === 1 ? 'guest' : 'guests'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
              <Stepper
                label="Guests"
                value={guests}
                min={1}
                max={BRAND.maxGuests}
                onChange={setGuests}
                suffix={guests === 1 ? ' guest' : ' guests'}
              />
              <p className="mt-2 text-xs text-muted">
                Up to {BRAND.maxGuests} guests. The exact limit for each home is shown on its page.
              </p>
            </PopoverContent>
          </Popover>

          <div className="flex items-stretch lg:border-l lg:border-line lg:pl-2">
            <Button
              size={hero ? 'lg' : 'md'}
              onClick={() => submit(true)}
              className="w-full shrink-0 lg:w-auto"
            >
              <Search className="h-4 w-4" aria-hidden />
              Search
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
          {dateError && !datesOpen ? (
            <InlineAlert tone="warning">{dateError}</InlineAlert>
          ) : (
            <span className="text-xs text-muted">
              {checkIn && checkOut
                ? `${nightsBetween(checkIn, checkOut)} ${nightsBetween(checkIn, checkOut) === 1 ? 'night' : 'nights'} · ${guests} ${guests === 1 ? 'guest' : 'guests'}`
                : 'Flexible dates? Search every home and pick later.'}
            </span>
          )}
          <button
            type="button"
            className="shrink-0 rounded-control px-1 text-sm font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            onClick={() => submit(false)}
          >
            Search without dates
          </button>
        </div>
      </div>
    </div>
  );
};