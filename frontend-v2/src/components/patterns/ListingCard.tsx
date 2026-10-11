import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Star, Zap, Users, Bed, Info, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { formatRating } from '@/lib/format';
import { mediaUrl, PLACEHOLDER_IMAGE } from '@/lib/media-url';
import { propertyTypeLabels } from '@/lib/status';
import { ROUTES } from '@/config/routes';
import { Badge } from '@/components/ui';
import type { ListingSummaryResponse, SearchResultResponse } from '@/types/api';

type CardListing = SearchResultResponse | ListingSummaryResponse;

interface ListingCardProps {
  listing: CardListing;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  /**
   * `row` is for full-width search results. `stack` is for grid/carousel cards.
   */
  layout?: 'row' | 'stack';
  className?: string;
}

/** `Top rated` is presentational only: thresholds live here, not in the API. */
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

  // Grid / Stack variant (used on Home page and compact grids)
  if (stacked) {
    return (
      <Link
        to={href}
        className={cn(
          'group flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/70',
          'transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
          className
        )}
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-t-card bg-sand">
          <img
            src={mediaUrl(listing.coverPhotoUrl) ?? PLACEHOLDER_IMAGE}
            alt={`${listing.title}, ${listing.city}`}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE;
            }}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />

          {instantBook && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm backdrop-blur">
              <Zap className="h-3 w-3 fill-primary" aria-hidden />
              Instant Book
            </span>
          )}

          <div className="absolute right-3 top-3">
            {listing.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-text shadow-sm backdrop-blur">
                <Star className="h-3 w-3 fill-star text-star" aria-hidden />
                <span className="tabular">{formatRating(listing.averageRating)}</span>
                <span className="text-[10px] text-muted">({listing.reviewCount})</span>
              </span>
            ) : (
              <span className="inline-flex items-center rounded-pill bg-highlight px-2.5 py-1 text-[11px] font-semibold text-accent-dark shadow-sm backdrop-blur">
                New
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[.12em] text-muted">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              {propertyTypeLabels[listing.propertyType]} · {listing.city}, {listing.country}
            </span>
          </p>

          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-text transition-colors group-hover:text-primary">
            {listing.title}
          </h3>

          {(maxGuests !== null || bedrooms !== null) && (
            <div className="flex items-center gap-3 text-xs text-muted">
              {maxGuests !== null && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden /> Sleeps {maxGuests}
                </span>
              )}
              {bedrooms !== null && (
                <span className="inline-flex items-center gap-1">
                  <Bed className="h-3.5 w-3.5" aria-hidden /> {bedrooms} {bedrooms === 1 ? 'bed' : 'beds'}
                </span>
              )}
            </div>
          )}

          {amenities.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {amenities.slice(0, 3).map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-pill bg-sand px-2 py-0.5 text-[11px] text-text"
                >
                  {amenity}
                </span>
              ))}
              {amenities.length > 3 && (
                <span className="rounded-pill bg-sand px-2 py-0.5 text-[11px] text-muted">
                  +{amenities.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="mt-auto flex items-baseline justify-between border-t border-line/70 pt-3">
            {total !== null && total !== undefined ? (
              <div>
                <span className="font-heading text-base font-semibold tabular-nums text-text">
                  {formatMoney(total)}
                </span>{' '}
                <span className="text-xs text-muted">
                  total ({nights} {nights === 1 ? 'night' : 'nights'})
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-muted">From</span>
                <span className="font-heading text-base font-semibold tabular-nums text-text">
                  {formatMoney(listing.baseNightlyPrice)}
                </span>
                <span className="text-xs text-muted">/ night</span>
              </div>
            )}
            {total === null && (
              <span
                className="cursor-help text-muted transition-colors hover:text-text"
                title="Total shown at checkout"
                aria-label="Total shown at checkout"
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Row variant (search results page)
  return (
    <Link
      to={href}
      className={cn(
        'group grid gap-0 overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/70 sm:grid-cols-[280px_1fr_auto]',
        'transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-t-card bg-sand sm:aspect-auto sm:h-full sm:rounded-l-card sm:rounded-tr-none">
        <img
          src={mediaUrl(listing.coverPhotoUrl) ?? PLACEHOLDER_IMAGE}
          alt={`${listing.title}, ${listing.city}`}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE;
          }}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        {instantBook && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm backdrop-blur">
            <Zap className="h-3 w-3 fill-primary" aria-hidden />
            Instant Book
          </span>
        )}
      </div>

      <div className="flex flex-col justify-between gap-3 p-5">
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[.12em] text-muted">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span>
              {propertyTypeLabels[listing.propertyType]} · {listing.city}, {listing.country}
            </span>
          </p>

          <h3 className="mt-1 text-lg font-semibold leading-snug text-text transition-colors group-hover:text-primary">
            {listing.title}
          </h3>

          {(maxGuests !== null || bedrooms !== null) && (
            <div className="mt-2 flex items-center gap-3 text-sm text-muted">
              {maxGuests !== null && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4" aria-hidden /> Sleeps {maxGuests}
                </span>
              )}
              {bedrooms !== null && (
                <span className="inline-flex items-center gap-1">
                  <Bed className="h-4 w-4" aria-hidden /> {bedrooms} {bedrooms === 1 ? 'bedroom' : 'bedrooms'}
                </span>
              )}
            </div>
          )}

          {amenities.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {amenities.slice(0, 4).map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-pill bg-sand px-2.5 py-0.5 text-xs text-text"
                >
                  {amenity}
                </span>
              ))}
              {amenities.length > 4 && (
                <span className="rounded-pill bg-sand px-2 py-0.5 text-xs text-muted">
                  +{amenities.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-row items-end justify-between border-t border-line/70 p-5 sm:min-w-[180px] sm:flex-col sm:border-l sm:border-t-0">
        <div>
          {listing.reviewCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-sand px-2.5 py-1 text-xs font-semibold text-text">
              <Star className="h-3.5 w-3.5 fill-star text-star" aria-hidden />
              <span className="tabular">{formatRating(listing.averageRating)}</span>
              <span className="text-muted">({listing.reviewCount})</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded-pill bg-highlight px-2.5 py-1 text-xs font-semibold text-accent-dark">
              New
            </span>
          )}
          {topRated && (
            <div className="mt-1 hidden sm:block">
              <Badge tone="success">Top rated</Badge>
            </div>
          )}
        </div>

        <div className="text-right">
          {total !== null && total !== undefined ? (
            <div>
              <div className="font-heading text-xl font-semibold tabular-nums text-text">
                {formatMoney(total)}
              </div>
              <div className="text-xs text-muted">
                {nights} {nights === 1 ? 'night' : 'nights'} total
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs text-muted">From</div>
              <div className="font-heading text-xl font-semibold tabular-nums text-text">
                {formatMoney(listing.baseNightlyPrice)}{' '}
                <span className="text-xs font-normal text-muted">/ night</span>
              </div>
            </div>
          )}

          <div className="mt-3 hidden sm:inline-flex items-center gap-1 rounded-control border border-primary/30 px-3 py-1.5 text-sm font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-white">
            View home <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </div>
        </div>
      </div>
    </Link>
  );
};

export const ListingCardSkeleton: React.FC<{ layout?: 'row' | 'stack' }> = ({ layout = 'row' }) => {
  const stacked = layout === 'stack';
  if (stacked) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/70">
        <div className="aspect-[4/3] w-full bg-sand animate-pulse" />
        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="h-3 w-28 rounded-pill bg-sand animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-sand animate-pulse" />
          <div className="h-3 w-36 rounded-pill bg-sand animate-pulse" />
          <div className="mt-auto flex justify-between border-t border-line/70 pt-3">
            <div className="h-5 w-24 rounded bg-sand animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-0 overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/70 sm:grid-cols-[280px_1fr_auto]">
      <div className="aspect-[4/3] w-full bg-sand animate-pulse sm:aspect-auto sm:h-full" />
      <div className="flex flex-col gap-3 p-5">
        <div className="h-3 w-32 rounded-pill bg-sand animate-pulse" />
        <div className="h-5 w-2/3 rounded bg-sand animate-pulse" />
        <div className="h-3 w-40 rounded-pill bg-sand animate-pulse" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-pill bg-sand animate-pulse" />
          <div className="h-5 w-16 rounded-pill bg-sand animate-pulse" />
        </div>
      </div>
      <div className="flex min-w-[170px] items-end justify-between border-t border-line/70 p-5 sm:flex-col sm:border-l sm:border-t-0">
        <div className="h-6 w-16 rounded-pill bg-sand animate-pulse" />
        <div className="h-6 w-24 rounded bg-sand animate-pulse" />
      </div>
    </div>
  );
};

export const PropertyTypeStrip: React.FC<{
  types: { value: string; label: string }[];
  active?: string;
  className?: string;
}> = ({ types, active, className }) => {
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
    <nav
      aria-label="Property types"
      className={cn(
        'flex gap-2 overflow-x-auto pb-2 scrollbar-none [mask-image:linear-gradient(90deg,#000_90%,transparent)] sm:[mask-image:none]',
        className
      )}
    >
      {types.map((type) => (
        <Link
          key={type.value}
          to={hrefFor(type.value)}
          className={cn(
            'inline-flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium shadow-card ring-1 transition-all hover:-translate-y-0.5',
            active === type.value
              ? 'bg-ink text-white ring-ink shadow-md'
              : 'bg-surface text-text ring-line/70 hover:ring-primary/40'
          )}
        >
          {type.label}
        </Link>
      ))}
    </nav>
  );
};

const CITY_PHOTOS: Record<string, string> = {
  'New York': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80',
  'Miami': 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&w=800&q=80',
  'San Francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80',
  'Austin': 'https://images.unsplash.com/photo-1531218150217-54595bc2b934?auto=format&fit=crop&w=800&q=80',
  'San Diego': 'https://images.unsplash.com/photo-1538688423619-a81d3f23454b?auto=format&fit=crop&w=800&q=80',
  'Denver': 'https://images.unsplash.com/photo-1546156929-a4c0ac411f47?auto=format&fit=crop&w=800&q=80',
  'Portland': 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?auto=format&fit=crop&w=800&q=80',
  'Nashville': 'https://images.unsplash.com/photo-1545418182-019a58406f5c?auto=format&fit=crop&w=800&q=80',
};

export const DestinationTile: React.FC<{
  city: string;
  country: string;
  homes: number;
  className?: string;
}> = ({ city, country, homes, className }) => {
  const photo = CITY_PHOTOS[city];
  return (
    <Link
      to={`${ROUTES.SEARCH}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`}
      className={cn(
        'group relative aspect-[3/4] overflow-hidden rounded-card shadow-card ring-1 ring-line/70 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover sm:aspect-[4/5]',
        className
      )}
    >
      {photo ? (
        <img
          src={photo}
          alt={`${city}, ${country}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-brand" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white">
        <div>
          <h3 className="font-heading text-2xl font-semibold tracking-tight text-white drop-shadow-sm">
            {city}
          </h3>
          <p className="text-sm text-white/80">
            {country} · {homes} {homes === 1 ? 'home' : 'homes'}
          </p>
        </div>
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-all group-hover:bg-white group-hover:text-ink"
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
};