import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Pencil } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { BRAND } from '@/config/brand';
import { useAuth } from '@/providers/AuthProvider';
import { useDebouncedValue } from '@/hooks/useUtilities';
import { useCalendar, useQuote } from '@/features/listings/api';
import { ApiError } from '@/api/errors';
import { daysOf } from '@/features/availability/rules';
import { DateRangePicker, rangeUnavailableReason, type DateRangeValue } from '@/components/patterns/DateRangePicker';
import { PriceBreakdown } from '@/components/patterns/PriceBreakdown';
import { ContactHostDialog } from '@/components/patterns/ContactHostDialog';
import { freeCancellationUntil } from '@/lib/cancellation';
import { formatInstant, pluralize } from '@/lib/format';
import { addDays, todayIn } from '@/lib/local-date';
import { formatMoney } from '@/lib/money';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorState,
  InlineAlert,
  Skeleton,
  Stepper,
} from '@/components/ui';
import type { ListingResponse, PriceBreakdownResponse } from '@/types/api';

const MIN_CALENDAR_DAYS = 61;
const MAX_CALENDAR_DAYS = 366;
const QUOTE_DEBOUNCE_MS = 300;

export const BookingCard: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const today = todayIn(listing.timezone);

  const [range, setRange] = useState<DateRangeValue>({});
  const [guests, setGuests] = useState(1);
  const [contactOpen, setContactOpen] = useState(false);
  const [verifyPrompt, setVerifyPrompt] = useState(false);

  const windowDays = Math.min(
    MAX_CALENDAR_DAYS,
    Math.max(MIN_CALENDAR_DAYS, listing.bookingWindowDays || MIN_CALENDAR_DAYS)
  );
  const calendarFrom = today;
  const calendarTo = addDays(today, windowDays);

  const calendar = useCalendar(listing.id, calendarFrom, calendarTo);
  const days = daysOf(calendar.data);

  const debouncedCheckIn = useDebouncedValue(range.from, QUOTE_DEBOUNCE_MS);
  const debouncedCheckOut = useDebouncedValue(range.to, QUOTE_DEBOUNCE_MS);
  const debouncedGuests = useDebouncedValue(guests, QUOTE_DEBOUNCE_MS);

  const canQuote = Boolean(debouncedCheckIn) && Boolean(debouncedCheckOut);
  const quote = useQuote(
    listing.id,
    { checkIn: debouncedCheckIn, checkOut: debouncedCheckOut, guests: debouncedGuests },
    canQuote
  );

  // `calendar` is a fresh object on every render, so depending on it re-ran this effect
// after each refetch and hammered the calendar endpoint forever. A boolean plus the
// referentially stable `refetch` fires exactly once per conflict.
const datesTaken = quote.error instanceof ApiError && quote.error.code === 'BOOKING_CONFLICT';
const { refetch: refetchCalendar } = calendar;

useEffect(() => {
  if (datesTaken) void refetchCalendar();
}, [datesTaken, refetchCalendar]);

  const ownListing = Boolean(user && listing.hostId && user.id === listing.hostId);
  const checkoutUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('checkIn', range.from);
    if (range.to) params.set('checkOut', range.to);
    if (range.from && range.to) params.set('guests', String(guests));
    const query = params.toString();
    return `${ROUTES.CHECKOUT(listing.id)}${query ? `?${query}` : ''}`;
  }, [listing.id, range.from, range.to, guests]);

  const rangeProblem = rangeUnavailableReason(days, listing, range);
  const freeUntil = range.from
    ? freeCancellationUntil(listing.cancellationPolicy, range.from, listing.checkInTime, listing.timezone)
    : null;

  const cta = () => {
    if (rangeProblem) return;
    if (!isAuthenticated) {
      navigate(`${ROUTES.LOGIN}?next=${encodeURIComponent(checkoutUrl)}`);
      return;
    }
    if (user && !user.emailVerified) {
      setVerifyPrompt(true);
      return;
    }
    navigate(checkoutUrl);
  };

  if (ownListing) {
    return (
      <aside aria-label="Booking" className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold text-ink">This is your listing</h2>
        <p className="mt-1 text-sm text-muted">
          Guests cannot book your own home, so the booking card is hidden here.
        </p>
        <Button asChild className="mt-4">
          <Link to={ROUTES.HOST_LISTING(listing.id)}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit listing
          </Link>
        </Button>
      </aside>
    );
  }

  const ctaLabel = listing.instantBook ? 'Book now' : 'Request to book';
  const ctaDisabled = !range.from || !range.to || Boolean(rangeProblem);

  return (
    <aside aria-label="Booking" className="rounded-card border border-line bg-surface p-5 shadow-card">
      <p className="tabular text-2xl font-semibold text-ink">
        {formatMoney(listing.baseNightlyPrice)}{' '}
        <span className="text-sm font-normal text-muted">per night</span>
      </p>
      <p className="text-xs text-muted">
        {pluralize(listing.minNights, 'night')} minimum
        {listing.maxNights < BRAND.maxNights
          ? ` · ${pluralize(listing.maxNights, 'night')} maximum`
          : ''}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {calendar.isPending && <Skeleton className="h-64 w-full" />}
        {calendar.isError && (
          <ErrorState
            title="Availability could not be loaded"
            error={calendar.error}
            onRetry={() => void calendar.refetch()}
          />
        )}
        {calendar.data && (
          <DateRangePicker days={days} listing={listing} value={range} onChange={setRange} months={2} />
        )}
      </div>

      {rangeProblem && <InlineAlert tone="warning" className="mt-3">{rangeProblem}</InlineAlert>}

      <div className="mt-3 border-t border-line pt-3">
        <Stepper
          label="Guests"
          value={guests}
          min={1}
          max={listing.maxGuests}
          onChange={setGuests}
          suffix={guests === 1 ? ' guest' : ' guests'}
        />
        <p className="text-xs text-muted">This home sleeps up to {listing.maxGuests}.</p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {canQuote && quote.isPending && <Skeleton className="h-32 w-full" />}
        {quote.data && (
          // The quote runtime guard omits `seasonName`, so the parsed shape needs the contract type.
          <PriceBreakdown
            breakdown={quote.data.priceBreakdown as PriceBreakdownResponse}
            nights={quote.data.nights}
          />
        )}
        {!canQuote && (
          <p className="text-sm text-muted">Choose your dates to see the full price, including fees and taxes.</p>
        )}
        {canQuote && quote.isError && <BookingError error={quote.error} />}
      </div>

      <Button
        variant="accent"
        size="lg"
        block
        className="mt-4"
        disabled={ctaDisabled}
        onClick={cta}
      >
        {ctaLabel}
      </Button>
      {!listing.instantBook && (
        <p className="mt-2 text-xs text-muted">
          You will be charged now. The host has {BRAND.hostResponseHours} hours to respond; if they decline or do
          not answer, you are refunded in full.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        {freeUntil ? (
          <>
            Free cancellation until {formatInstant(freeUntil.toISOString(), listing.timezone)} (
            {listing.timezone}).
          </>
        ) : (
          <>
            {listing.cancellationPolicy === 'STRICT'
              ? 'Strict cancellation: 50% refund up to 168 hours before check-in.'
              : 'Free cancellation deadlines are shown once you pick dates.'}{' '}
            <Link className="text-primary underline underline-offset-4" to={ROUTES.CANCELLATION_POLICIES}>
              Policies
            </Link>
          </>
        )}
      </p>

      <Button variant="outline" block className="mt-4" onClick={() => setContactOpen(true)}>
        <MessageSquare className="h-4 w-4" aria-hidden />
        Message host
      </Button>

      <ContactHostDialog listingId={listing.id} open={contactOpen} onOpenChange={setContactOpen} />

      <Dialog open={verifyPrompt} onOpenChange={setVerifyPrompt}>
        <DialogContent className="max-w-md">
          <DialogTitle>Confirm your email address</DialogTitle>
          <DialogDescription>
            Booking needs a confirmed email address. We sent you a link when you registered; resend it from your
            account if it has expired.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setVerifyPrompt(false)}>
              Not now
            </Button>
            <Button asChild>
              <Link to={ROUTES.VERIFY_EMAIL}>Confirm my email</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
};

const BookingError: React.FC<{ error: unknown }> = ({ error }) => {
  if (!(error instanceof ApiError)) {
    return <InlineAlert tone="danger">That price could not be loaded. Try again.</InlineAlert>;
  }
  switch (error.code) {
    case 'BOOKING_CONFLICT':
      return (
        <InlineAlert tone="danger">
          Those dates were just taken. Pick another range; the calendar has been refreshed.
        </InlineAlert>
      );
    case 'BUSINESS_RULE_VIOLATION':
      return <InlineAlert tone="warning">{error.detail}</InlineAlert>;
    case 'INVALID_DATE_RANGE':
      return (
        <InlineAlert tone="warning">
          That is not a valid stay. Pick a check-out after your check-in, within the minimum and maximum stay for
          this home.
        </InlineAlert>
      );
    case 'LISTING_NOT_BOOKABLE':
      return <InlineAlert tone="danger">This home is not available to book at the moment.</InlineAlert>;
    case 'RATE_LIMITED':
      return (
        <InlineAlert tone="warning">Too many requests. Try again in {error.retryAfter} seconds.</InlineAlert>
      );
    default:
      return <InlineAlert tone="danger">{error.detail}</InlineAlert>;
  }
};