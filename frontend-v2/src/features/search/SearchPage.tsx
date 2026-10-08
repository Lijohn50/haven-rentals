import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle, setCanonical } from '@/hooks/useSeo';
import { useAmenities, useSearch } from '@/features/search/api';
import { amenityIcon } from '@/lib/amenity-icons';
import { formatDateRange } from '@/lib/local-date';
import { formatMoney, isValidMoneyInput, normalizeMoneyInput, toMoneyNumber } from '@/lib/money';
import { propertyTypeLabels } from '@/lib/status';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ListingCard, ListingCardSkeleton, PropertyTypeStrip } from '@/components/patterns/ListingCard';
import { SearchBar } from '@/components/patterns/SearchBar';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Skeleton,
  Switch,
} from '@/components/ui';
import type { AmenityResponse, PropertyType, SearchParams, SearchSort } from '@/types/api';

const PAGE_SIZE = 20;
const MAX_AMENITIES = 15;

const SORTS: { value: SearchSort; label: string }[] = [
  { value: 'RATING_DESC', label: 'Best rated' },
  { value: 'PRICE_ASC', label: 'Price: low to high' },
  { value: 'PRICE_DESC', label: 'Price: high to low' },
  { value: 'NEWEST', label: 'Newest first' },
];

const PROPERTY_TYPES = (Object.keys(propertyTypeLabels) as PropertyType[]).map((value) => ({
  value,
  label: propertyTypeLabels[value],
}));

const BEDROOM_CHIPS: { value: number; label: string }[] = [
  { value: 1, label: '1+' },
  { value: 2, label: '2+' },
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
  { value: 5, label: '5+' },
];

const RATING_CHIPS: { value: number; label: string }[] = [
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
  { value: 4.5, label: '4.5+' },
];

/** Money never leaves the server untouched: these helpers only normalise what was typed. */
function moneyValue(raw: string): number | null {
  const normalized = normalizeMoneyInput(raw);
  return isValidMoneyInput(normalized) ? toMoneyNumber(normalized) : null;
}

function priceLabel(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${formatMoney(min)} to ${formatMoney(max)}`;
  if (min !== undefined) return `from ${formatMoney(min)}`;
  if (max !== undefined) return `up to ${formatMoney(max)}`;
  return 'any';
}

interface Filters {
  city?: string;
  country?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  amenityIds: number[];
  propertyType?: PropertyType;
  minBedrooms?: number;
  minRating?: number;
  instantBook: boolean;
  sort: SearchSort;
  /** 1-based, the way humans count */
  page: number;
  size: number;
}

function readNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort');
  const propertyType = params.get('propertyType');
  const amenityIds = (params.get('amenityIds') ?? '')
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, MAX_AMENITIES);
  const instantBook = params.get('instantBook');

  return {
    city: params.get('city') ?? undefined,
    country: params.get('country') ?? undefined,
    checkIn: params.get('checkIn') ?? undefined,
    checkOut: params.get('checkOut') ?? undefined,
    guests: readNumber(params.get('guests')),
    minPrice: readNumber(params.get('minPrice')),
    maxPrice: readNumber(params.get('maxPrice')),
    amenityIds,
    propertyType:
      propertyType && propertyType in propertyTypeLabels ? (propertyType as PropertyType) : undefined,
    minBedrooms: readNumber(params.get('minBedrooms')),
    minRating: readNumber(params.get('minRating')),
    instantBook: instantBook === 'true',
    sort: SORTS.some((option) => option.value === sort) ? (sort as SearchSort) : 'RATING_DESC',
    page: Math.max(1, readNumber(params.get('page')) ?? 1),
    size: PAGE_SIZE,
  };
}

function toApiParams(filters: Filters): SearchParams {
  return {
    city: filters.city,
    country: filters.country,
    checkIn: filters.checkIn,
    checkOut: filters.checkOut,
    guests: filters.guests,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    amenityIds: filters.amenityIds.length > 0 ? filters.amenityIds : undefined,
    propertyType: filters.propertyType,
    minBedrooms: filters.minBedrooms,
    minRating: filters.minRating,
    instantBook: filters.instantBook ? true : undefined,
    sort: filters.sort,
    page: filters.page - 1,
    size: filters.size,
  };
}

/** One active filter, in the shape the chip row, the empty state and the URL all need. */
interface ActiveFilter {
  key: string;
  label: string;
  clear: Record<string, string | null>;
}

function activeFilters(filters: Filters, amenities: AmenityResponse[]): ActiveFilter[] {
  const list: ActiveFilter[] = [];
  if (filters.city || filters.country) {
    list.push({
      key: 'place',
      label: [filters.city, filters.country].filter(Boolean).join(', '),
      clear: { city: null, country: null },
    });
  }
  if (filters.checkIn && filters.checkOut) {
    list.push({
      key: 'dates',
      label: formatDateRange(filters.checkIn, filters.checkOut),
      clear: { checkIn: null, checkOut: null },
    });
  }
  if (filters.guests && filters.guests > 1) {
    list.push({
      key: 'guests',
      label: pluralize(filters.guests, 'guest'),
      clear: { guests: null },
    });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    list.push({
      key: 'price',
      label: `Nightly price (base): ${priceLabel(filters.minPrice, filters.maxPrice)}`,
      clear: { minPrice: null, maxPrice: null },
    });
  }
  if (filters.minBedrooms !== undefined) {
    list.push({
      key: 'bedrooms',
      label: `${filters.minBedrooms}+ bedrooms`,
      clear: { minBedrooms: null },
    });
  }
  if (filters.minRating !== undefined) {
    list.push({
      key: 'rating',
      label: `${filters.minRating}+ rating`,
      clear: { minRating: null },
    });
  }
  if (filters.propertyType) {
    list.push({
      key: 'type',
      label: propertyTypeLabels[filters.propertyType],
      clear: { propertyType: null },
    });
  }
  if (filters.instantBook) {
    list.push({ key: 'instant', label: 'Instant Book', clear: { instantBook: null } });
  }
  for (const id of filters.amenityIds) {
    const amenity = amenities.find((entry) => entry.id === id);
    list.push({
      key: `amenity-${id}`,
      label: amenity?.name ?? `Amenity ${id}`,
      clear: { amenityIds: filters.amenityIds.filter((value) => value !== id).join(',') || null },
    });
  }
  return list;
}

const FilterChip: React.FC<{ filter: ActiveFilter; onRemove: (filter: ActiveFilter) => void }> = ({
  filter,
  onRemove,
}) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-sm text-ink">
    {filter.label}
    <button
      type="button"
      onClick={() => onRemove(filter)}
      className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-bg"
      aria-label={`Remove filter: ${filter.label}`}
    >
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  </span>
);

const AllFilters: React.FC<{
  filters: Filters;
  amenities: AmenityResponse[];
  onChange: (patch: Record<string, string | null>) => void;
}> = ({ filters, amenities, onChange }) => {
  const [minPrice, setMinPrice] = useState(filters.minPrice === undefined ? '' : String(filters.minPrice));
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice === undefined ? '' : String(filters.maxPrice));
  const [open, setOpen] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPriceError(null);
    setMinPrice(filters.minPrice === undefined ? '' : String(filters.minPrice));
    setMaxPrice(filters.maxPrice === undefined ? '' : String(filters.maxPrice));
  }, [open, filters.minPrice, filters.maxPrice]);

  const grouped = amenities.reduce<Record<string, AmenityResponse[]>>((accumulator, amenity) => {
    const key = amenity.category || 'Other';
    accumulator[key] = [...(accumulator[key] ?? []), amenity];
    return accumulator;
  }, {});

  const applyPrice = () => {
    const min = minPrice.trim() === '' ? null : moneyValue(minPrice);
    const max = maxPrice.trim() === '' ? null : moneyValue(maxPrice);
    if (min === null && minPrice.trim() !== '') {
      setPriceError('Minimum must be an amount such as 120 or 120.50.');
      return;
    }
    if (max === null && maxPrice.trim() !== '') {
      setPriceError('Maximum must be an amount such as 400 or 400.00.');
      return;
    }
    if (min !== null && max !== null && min > max) {
      setPriceError('Minimum cannot be higher than maximum.');
      return;
    }
    setPriceError(null);
    const nextMin = min === null ? null : String(min);
    const nextMax = max === null ? null : String(max);
    const currentMin = filters.minPrice === undefined ? null : String(filters.minPrice);
    const currentMax = filters.maxPrice === undefined ? null : String(filters.maxPrice);
    // Both bounds have to be compared. Checking only the minimum made a maximum-only
    // filter a no-op: both sides were null, the guard returned early, and typing a
    // ceiling silently did nothing.
    if (nextMin === currentMin && nextMax === currentMax) return;
    onChange({ minPrice: nextMin, maxPrice: nextMax });
  };

  const toggleAmenity = (id: number) => {
    const next = filters.amenityIds.includes(id)
      ? filters.amenityIds.filter((value) => value !== id)
      : [...filters.amenityIds, id].slice(0, MAX_AMENITIES);
    onChange({ amenityIds: next.join(',') });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={filters.amenityIds.length > 0 ? 'primary' : 'outline'} size="sm">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          All filters
          {filters.amenityIds.length > 0 && ` (${filters.amenityIds.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[80vh] w-[min(94vw,26rem)] overflow-y-auto">
        <fieldset className="border-b border-line pb-4">
          <legend className="text-sm font-semibold text-ink">Nightly price (base)</legend>
          <div className="mt-2 flex items-center gap-2">
            <Field label="Minimum" htmlFor="filter-min-price" className="flex-1">
              <Input
                id="filter-min-price"
                inputMode="decimal"
                placeholder="Any"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                onBlur={applyPrice}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </Field>
            <Field label="Maximum" htmlFor="filter-max-price" className="flex-1">
              <Input
                id="filter-max-price"
                inputMode="decimal"
                placeholder="Any"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                onBlur={applyPrice}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </Field>
          </div>
          {priceError && (
            <p role="alert" className="mt-2 text-xs font-medium text-danger-text">
              {priceError}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            Compared with the base nightly rate. The total is only known once dates are chosen.
          </p>
        </fieldset>

        <fieldset className="border-b border-line py-4">
          <legend className="text-sm font-semibold text-ink">Bedrooms</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <ChipButton
              active={filters.minBedrooms === undefined}
              onClick={() => onChange({ minBedrooms: null })}
              label="Any"
            />
            {BEDROOM_CHIPS.map((chip) => (
              <ChipButton
                key={chip.value}
                active={filters.minBedrooms === chip.value}
                onClick={() =>
                  onChange({ minBedrooms: filters.minBedrooms === chip.value ? null : String(chip.value) })
                }
                label={chip.label}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="border-b border-line py-4">
          <legend className="text-sm font-semibold text-ink">Guest rating</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <ChipButton
              active={filters.minRating === undefined}
              onClick={() => onChange({ minRating: null })}
              label="Any"
            />
            {RATING_CHIPS.map((chip) => (
              <ChipButton
                key={chip.value}
                active={filters.minRating === chip.value}
                onClick={() =>
                  onChange({ minRating: filters.minRating === chip.value ? null : String(chip.value) })
                }
                label={chip.label}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="border-b border-line py-4">
          <legend className="text-sm font-semibold text-ink">Booking</legend>
          <div className="mt-2">
            <Switch
              checked={filters.instantBook}
              onCheckedChange={(checked) => onChange({ instantBook: checked ? 'true' : null })}
              label="Instant Book only"
              description="Homes confirmed the moment you pay"
            />
          </div>
        </fieldset>

        <fieldset className="py-4">
          <legend className="text-sm font-semibold text-ink">
            Amenities {filters.amenityIds.length > 0 && `(${filters.amenityIds.length}/${MAX_AMENITIES})`}
          </legend>
          <p className="mt-1 text-xs text-muted">A home must have every amenity you pick.</p>
          {amenities.length === 0 && <Skeleton className="mt-3 h-24 w-full" />}
          <div className="mt-3 flex flex-col gap-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{category}</p>
                <div className="mt-1.5 grid gap-2">
                  {items.map((amenity) => {
                    const Icon = amenityIcon(amenity.icon);
                    return (
                      <label key={amenity.id} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-line text-primary focus:ring-2 focus:ring-primary/30"
                          checked={filters.amenityIds.includes(amenity.id)}
                          disabled={!filters.amenityIds.includes(amenity.id) && filters.amenityIds.length >= MAX_AMENITIES}
                          onChange={() => toggleAmenity(amenity.id)}
                        />
                        <Icon className="h-4 w-4 text-muted" aria-hidden />
                        {amenity.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ChipButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({
  active,
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'min-w-[3rem] rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
      active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink hover:border-primary'
    )}
  >
    {label}
  </button>
);

export const SearchPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const amenitiesQuery = useAmenities();
  const query = useSearch(toApiParams(filters));
  const repaired = useRef<string | null>(null);

  const change = useCallback(
    (patch: Record<string, string | null>, options?: { keepPage?: boolean }) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!options?.keepPage) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  const removeFilter = useCallback(
    (filter: ActiveFilter) => change(filter.clear),
    [change]
  );

  // A rejected parameter is dropped from the URL once, with the reason shown to the guest.
  useEffect(() => {
    const error = query.error;
    if (!(error instanceof ApiError)) return;
    if (error.code === 'INVALID_SORT' || error.code === 'INVALID_PAGE_SIZE') {
      if (repaired.current === error.code) return;
      repaired.current = error.code;
      change({ sort: null, page: null }, { keepPage: true });
      return;
    }
    if (error.code === 'INVALID_DATE_RANGE') {
      if (repaired.current === error.code) return;
      repaired.current = error.code;
      change({ checkIn: null, checkOut: null });
      return;
    }
    if (error.code === 'MALFORMED_REQUEST') {
      if (repaired.current === error.code) return;
      repaired.current = error.code;
      change({ minPrice: null, maxPrice: null, minBedrooms: null, minRating: null, amenityIds: null });
    }
  }, [query.error, change]);

  const chips = useMemo(
    () => activeFilters(filters, amenitiesQuery.data ?? []),
    [filters, amenitiesQuery.data]
  );

  const cityOnly = Boolean(filters.city) && chips.length === 1 && chips[0].key === 'place';
  const title = filters.city ? `Vacation rentals in ${filters.city}` : 'Search whole homes';
  const description = filters.city
    ? `Whole homes for rent in ${filters.city}${filters.country ? `, ${filters.country}` : ''}. Clear total prices, verified reviews and instant booking where available.`
    : 'Search whole vacation homes by city, dates, guests, price and amenities.';

  useDocumentTitle(title, description);
  useEffect(() => {
    setCanonical(filters.city ? `${ROUTES.SEARCH}?city=${encodeURIComponent(filters.city)}` : ROUTES.SEARCH);
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = cityOnly ? 'index,follow' : 'noindex,follow';
  }, [filters.city, cityOnly]);

  const error = query.error instanceof ApiError ? query.error : null;
  const rateLimited = error?.code === 'RATE_LIMITED';
  const repairable =
    Boolean(error) &&
    ['INVALID_SORT', 'INVALID_PAGE_SIZE', 'INVALID_DATE_RANGE', 'MALFORMED_REQUEST'].includes(
      error?.code ?? ''
    );

  return (
    <div className="pb-16">
      <div className="sticky top-16 z-30 border-b border-line bg-bg/95 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-content flex-col gap-3 px-4 sm:px-6">
          <SearchBar
            variant="compact"
            initialCity={filters.city}
            initialCountry={filters.country}
            initialCheckIn={filters.checkIn}
            initialCheckOut={filters.checkOut}
            initialGuests={filters.guests}
          />
          <div className="hidden md:block">
            <PropertyTypeStrip types={PROPERTY_TYPES} active={filters.propertyType} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-content px-4 py-5 sm:px-6">
        <div className="mb-4 md:hidden">
          <PropertyTypeStrip types={PROPERTY_TYPES} active={filters.propertyType} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <FilterChip key={chip.key} filter={chip} onRemove={removeFilter} />
          ))}
          <AllFilters filters={filters} amenities={amenitiesQuery.data ?? []} onChange={change} />
        </div>

        {error && repairable && (
          <InlineAlert tone="warning" className="mt-3">
            A filter was not valid, so we removed it: {error.detail}
          </InlineAlert>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {query.data
              ? `${pluralize(query.data.totalElements, 'home')}`
              : query.isPending
                ? 'Searching…'
                : 'No results yet'}
          </p>
          <div className="w-56">
            <label htmlFor="search-sort" className="sr-only">
              Sort results
            </label>
            <Select
              id="search-sort"
              value={filters.sort}
              onChange={(event) => change({ sort: event.target.value })}
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {rateLimited && (
          <InlineAlert tone="warning" className="mt-4">
            Too many searches. Try again in {error?.retryAfter ?? 60} seconds.
          </InlineAlert>
        )}

        {query.isPending && (
          <div className="mt-4 flex flex-col gap-4" aria-busy>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((slot) => (
              <ListingCardSkeleton key={slot} />
            ))}
          </div>
        )}

        {query.isError && !rateLimited && !repairable && (
          <ErrorState
            className="mt-4"
            title="Search is unavailable right now"
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        )}

        {query.data && query.data.content.length === 0 && (
          <EmptyState
            className="mt-4"
            title="No homes match"
            description="Nothing matches this combination. Removing one filter often helps."
            action={
              chips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <FilterChip key={chip.key} filter={chip} onRemove={removeFilter} />
                  ))}
                </div>
              ) : (
                <Button variant="outline" onClick={() => change({ city: null, country: null })}>
                  Clear the destination
                </Button>
              )
            }
          />
        )}

        {query.data && query.data.content.length > 0 && (
          <>
            <ul className="mt-4 flex flex-col gap-4">
              {query.data.content.map((listing) => (
                <li key={listing.id}>
                  <ListingCard
                    listing={listing}
                    checkIn={filters.checkIn}
                    checkOut={filters.checkOut}
                    guests={filters.guests}
                  />
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={filters.page}
              totalPages={query.data.totalPages}
              onChange={(page) => change({ page: String(page) }, { keepPage: true })}
            />
          </>
        )}

        <p className="mt-6 text-xs text-muted">
          Stays are limited to {BRAND.maxNights} nights and {BRAND.maxGuests} guests per booking.
        </p>
      </div>
    </div>
  );
};