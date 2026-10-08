import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { formatRating } from '@/lib/format';
import { mediaUrl, PLACEHOLDER_IMAGE } from '@/lib/media-url';
import { propertyTypeLabels } from '@/lib/status';
import { ROUTES } from '@/config/routes';
import { Badge, Skeleton } from '@/components/ui';
import type { ListingSummaryResponse, SearchResultResponse } from '@/types/api';

type CardListing = SearchResultResponse | ListingSummaryResponse;

interface ListingCardProps {
  listing: CardListing;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  /**
   * `row` is for full-width results. `stack` is for narrow carousel tiles: the
   * viewport breakpoints below cannot see how wide the slot actually is, so a
   * `row` card inside a ~345px carousel column renders a 224px image beside
   * ~120px of text.
   */
  layout?: 'row' | 'stack';
  className?: string;
}

/** `Top rated` is presentational only: thresholds live here, not in the API (10.1). */
const TOP_RATED_RATING = 4.8;
const TOP_RATED_REVIEWS = 5;

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  checkIn,
  checkOut,
  guests,
  layout = 'row',
  className,
}) => {
  const stacked = layout === 'stack';
  const search = new URLSearchParams();
  if (checkIn) search.set('checkIn', checkIn);
  if (checkOut) search.set('checkOut', checkOut);
  if (guests) search.set('guests', String(guests));
  const query = search.toString();
  const href = `${ROUTES.LISTING(listing.id)}${query ? `?${query}` : ''}`;

  const isSearchResult = 'totalPrice' in listing;
  const total = isSearchResult ? (listing as SearchResultResponse).totalPrice : null;
  const nights = isSearchResult ? (listing as SearchResultResponse).nights : null;
  const amenities = isSearchResult ? (listing as SearchResultResponse).amenitiesPreview : [];
  const instantBook = 'instantBook' in listing ? listing.instantBook : false;
  const maxGuests = 'maxGuests' in listing ? listing.maxGuests : null;
  const bedrooms = 'bedrooms' in listing ? listing.bedrooms : null;
  const topRated =
    (listing.averageRating ?? 0) >= TOP_RATED_RATING && listing.reviewCount >= TOP_RATED_REVIEWS;

  return (
    <Link
      to={href}
      className={cn(
        'group flex h-full overflow-hidden rounded-card border border-line bg-surface transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        stacked ? 'flex-col' : 'flex-col sm:flex-row',
        className
      )}
    >
      <div
        className={cn(
          'relative w-full shrink-0 overflow-hidden bg-neutral-soft',
          stacked ? 'aspect-[4/3]' : 'aspect-[4/3] sm:aspect-auto sm:h-44 sm:w-56'
        )}
      >
        <img
          src={mediaUrl(listing.coverPhotoUrl) ?? PLACEHOLDER_IMAGE}
          alt={`${listing.title}, ${listing.city}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {instantBook && (
          <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-2 py-0.5 text-xs font-medium text-primary-dark shadow-sm">
            Instant Book
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs uppercase tracking-wide text-muted">
          {propertyTypeLabels[listing.propertyType]} · {listing.city}, {listing.country}
        </p>
        <h3 className="truncate text-base font-semibold text-ink group-hover:text-primary-dark">
          {listing.title}
        </h3>
        {/* ListingSummaryResponse carries neither field, so without this guard the row
            rendered empty and left a blank line of height under the title. */}
        {(maxGuests !== null || bedrooms !== null) && (
          <p className="flex items-center gap-1 text-sm text-muted">
            {maxGuests !== null && <span>Sleeps {maxGuests}</span>}
            {maxGuests !== null && bedrooms !== null && <span>·</span>}
            {bedrooms !== null && (
              <span>
                {bedrooms} {bedrooms === 1 ? 'bedroom' : 'bedrooms'}
              </span>
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm text-ink">
            <Star className="h-3.5 w-3.5 fill-ink" aria-hidden />
            <span className="tabular">{formatRating(listing.averageRating)}</span>
            <span className="text-muted">({listing.reviewCount})</span>
          </span>
          {topRated && <Badge tone="success">Top rated</Badge>}
        </div>

        {amenities.length > 0 && (
          <p className="truncate text-xs text-muted">{amenities.join(' · ')}</p>
        )}

        <div className="mt-auto pt-2">
          {total !== null && total !== undefined ? (
            <>
              <p className="tabular text-base font-semibold text-ink">
                {formatMoney(total)} total
              </p>
              <p className="text-xs text-muted">
                {nights} {nights === 1 ? 'night' : 'nights'} · includes taxes and fees
              </p>
            </>
          ) : (
            <>
              <p className="tabular text-base font-semibold text-ink">
                From {formatMoney(listing.baseNightlyPrice)}{' '}
                <span className="text-sm font-normal text-muted">/ night</span>
              </p>
              <p className="text-xs text-muted">Total shown at checkout</p>
            </>
          )}
        </div>
      </div>
    </Link>
  );
};

export const ListingCardSkeleton: React.FC<{ layout?: 'row' | 'stack' }> = ({ layout = 'row' }) => {
  const stacked = layout === 'stack';
  return (
    <div
      className={cn(
        'flex h-full overflow-hidden rounded-card border border-line bg-surface',
        stacked ? 'flex-col' : 'flex-col sm:flex-row'
      )}
    >
      <Skeleton
        className={cn(
          'w-full rounded-none',
          stacked ? 'aspect-[4/3]' : 'aspect-[4/3] sm:h-44 sm:w-56'
        )}
      />
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-auto h-4 w-28" />
      </div>
    </div>
  );
};

export const PropertyTypeStrip: React.FC<{
  types: { value: string; label: string }[];
  active?: string;
  className?: string;
}> = ({ types, active, className }) => {
  // Carry the rest of the query across. Building the href from ROUTES.SEARCH alone threw
  // away city, dates, guests, price and amenities every time a type was picked.
  const [searchParams] = useSearchParams();

  const hrefFor = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (next.get('propertyType') === value) next.delete('propertyType');
    else next.set('propertyType', value);
    next.delete('page');
    const query = next.toString();
    return query ? `${ROUTES.SEARCH}?${query}` : ROUTES.SEARCH;
  };

  return (
    <nav aria-label="Property types" className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {types.map((type) => (
        <Link
          key={type.value}
          to={hrefFor(type.value)}
          className={cn(
            'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            active === type.value
              ? 'border-primary bg-primary text-white'
              : 'border-line bg-surface text-ink hover:border-primary hover:text-primary'
          )}
        >
          {type.label}
        </Link>
      ))}
    </nav>
  );
};

export const DestinationTile: React.FC<{
  city: string;
  country: string;
  homes: number;
}> = ({ city, country, homes }) => (
  <Link
    to={`${ROUTES.SEARCH}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`}
    className="flex items-center justify-between rounded-card border border-line bg-surface p-4 transition-colors hover:border-primary"
  >
    <span>
      <span className="block text-sm font-semibold text-ink">{city}</span>
      <span className="block text-xs text-muted">{country}</span>
    </span>
    <span className="flex items-center gap-1 text-xs text-muted">
      <MapPin className="h-3.5 w-3.5" aria-hidden />
      {homes} {homes === 1 ? 'home' : 'homes'}
    </span>
  </Link>
);