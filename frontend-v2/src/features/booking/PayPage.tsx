import React, { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, Lock, MessageSquare, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { BRAND } from '@/config/brand';
import { ENV } from '@/config/env';
import { ROUTES } from '@/config/routes';
import { useBooking, useBookingMutations, useBookingPaymentDetail } from '@/features/booking/api';
import {
  CardPaymentField,
  FakePaymentField,
  SslCommerzPaymentField,
} from '@/features/booking/PaymentMethodField';
import { CountdownPill } from '@/components/patterns/Countdown';
import { PriceBreakdown } from '@/components/patterns/PriceBreakdown';
import { ContactHostDialog } from '@/components/patterns/ContactHostDialog';
import { useCountdown } from '@/hooks/useUtilities';
import { useDocumentTitle } from '@/hooks/useSeo';
import { cn } from '@/lib/cn';
import { formatDateRange } from '@/lib/local-date';
import { formatMoney } from '@/lib/money';
import { mediaUrl, PLACEHOLDER_IMAGE } from '@/lib/media-url';
import {
  Banner,
  Button,
  Card,
  ErrorState,
  InlineAlert,
  Skeleton,
} from '@/components/ui';
import type { BookingResponse } from '@/types/api';

const FAILURE_COPY: Record<string, string> = {
  CARD_DECLINED: 'Your payment was declined by the card issuer.',
  INSUFFICIENT_FUNDS: 'The card did not have enough funds for this stay.',
  GATEWAY_TIMEOUT: 'The payment provider did not respond in time.',
};

function newAttemptKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const PayConfirmation: React.FC<{ booking: BookingResponse }> = ({ booking }) => {
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);
  const requested = booking.status === 'PENDING_APPROVAL';

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-5 px-4 py-10 sm:px-6">
      <div className="flex flex-col items-start gap-3">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <h1 className="text-2xl font-semibold text-ink">
          {requested ? 'Request sent' : "You're booked"}
        </h1>
        <p className="text-sm text-muted">
          {requested
            ? `${booking.host.displayName} has ${BRAND.hostResponseHours} hours to respond to your request.`
            : `${booking.host.displayName} knows you are coming and will get in touch before you arrive.`}
        </p>
        {requested && booking.expiresAt && (
          <CountdownPill
            target={booking.expiresAt}
            prefix="Host responds within"
            urgentMs={6 * 3_600_000}
          />
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Booking reference</p>
            <p className="tabular text-lg font-semibold text-ink">{booking.reference}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(booking.reference);
                toast.success('Reference copied');
              } catch {
                toast.error('Could not copy the reference');
              }
            }}
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copy reference
          </Button>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Home</dt>
            <dd className="text-ink">{booking.listing.title}</dd>
          </div>
          <div>
            <dt className="text-muted">Where</dt>
            <dd className="text-ink">
              {booking.listing.city}, {booking.listing.country}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Dates</dt>
            <dd className="text-ink">
              {formatDateRange(booking.checkIn, booking.checkOut)} · {booking.nights}{' '}
              {booking.nights === 1 ? 'night' : 'nights'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Host</dt>
            <dd className="text-ink">{booking.host.displayName}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4">
        <h2 className="text-base font-semibold text-ink">What happens next</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          {requested ? (
            <>
              <li>
                {booking.host.displayName} accepts or declines within{' '}
                {BRAND.hostResponseHours} hours.
              </li>
              <li>If they decline or do not answer, you are refunded in full automatically.</li>
              <li>Message the host any time from your inbox.</li>
            </>
          ) : (
            <>
              <li>Your dates are locked in and the host has been notified.</li>
              <li>Message the host any time from your inbox.</li>
              <li>
                After your stay you can leave a review, up to {BRAND.reviewWindowDays} days
                afterwards.
              </li>
            </>
          )}
        </ul>
      </Card>

      <PriceBreakdown breakdown={booking.priceBreakdown} nights={booking.nights} />

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={ROUTES.TRIP(booking.reference)}>View trip</Link>
        </Button>
        <Button variant="outline" onClick={() => setContactOpen(true)}>
          <MessageSquare className="h-4 w-4" aria-hidden />
          Message host
        </Button>
      </div>

      <ContactHostDialog
        listingId={booking.listing.id}
        open={contactOpen}
        onOpenChange={setContactOpen}
      />
    </div>
  );
};

export const PayPage: React.FC = () => {
  useDocumentTitle('Payment');

  const { reference } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const booking = useBooking(reference ?? null);
  const { pay, initiateSslCommerz } = useBookingMutations(reference ?? undefined);

  const paymentParam = searchParams.get('payment');
  const [paymentMethod, setPaymentMethod] = useState<'sslcommerz' | 'simulated'>('sslcommerz');
  const [paymentToken, setPaymentToken] = useState('tok_success');
  const [outcome, setOutcome] = useState<BookingResponse | null>(null);
  const [failure, setFailure] = useState<{ code: string; failureCode: string | null } | null>(null);
  const [stateNotice, setStateNotice] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  // The gate is decided once, on arrival: a hold that expires mid-page must not bounce the
  // guest away before the failure screen can explain what happened.
  const gate = useRef<boolean | null>(null);

  const cooldown = useCountdown(cooldownUntil);
  const cooling = cooldownUntil !== null && !cooldown.expired;
  const hold = useCountdown(booking.data?.expiresAt);

  if (booking.data && gate.current === null) {
    const expiresAt = booking.data.expiresAt;
    gate.current =
      booking.data.allowedActions.includes('PAY') &&
      expiresAt !== null &&
      new Date(expiresAt).getTime() > Date.now();
  }

  const payment = useBookingPaymentDetail(
    booking.data?.id ?? null,
    failure?.code === 'PAYMENT_FAILED' || booking.data?.status === 'PAYMENT_FAILED'
  );

  if (booking.isLoading) {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row">
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="lg:w-80">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (booking.isError) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-12 sm:px-6">
        <ErrorState error={booking.error} onRetry={() => void booking.refetch()} />
      </div>
    );
  }

  if (!booking.data || gate.current === false || !reference) {
    return <Navigate to={ROUTES.TRIP(reference ?? '')} replace />;
  }

  const stay = booking.data;
  const total = stay.priceBreakdown.totalAmount;
  const requested = !stay.instantBook;
  const expired = hold.expired;

  const startAgain = () => {
    const search = new URLSearchParams({
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guests: String(stay.guests),
      // A fresh hold needs a fresh key: the old one replays the failed booking.
      holdKey: newAttemptKey(),
    });
    navigate(`${ROUTES.CHECKOUT(stay.listing.id)}?${search.toString()}`);
  };

  const submit = async () => {
    setFailure(null);
    setStateNotice(null);
    setPaying(true);
    try {
      const result = await pay.mutateAsync({ id: stay.id, paymentToken });
      setOutcome(result);
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      const failureCode =
        api && typeof api.problem.failureCode === 'string' ? api.problem.failureCode : null;

      switch (api?.code) {
        case 'PAYMENT_FAILED':
          setFailure({ code: 'PAYMENT_FAILED', failureCode });
          break;
        case 'BOOKING_EXPIRED':
          setFailure({ code: 'BOOKING_EXPIRED', failureCode: null });
          break;
        case 'INVALID_STATE_TRANSITION':
          await booking.refetch();
          setStateNotice('That booking has already moved on. Here is its real state now.');
          break;
        case 'RATE_LIMITED':
          setCooldownUntil(new Date(Date.now() + api.retryAfter * 1000).toISOString());
          break;
        default:
          setFailure({ code: api?.code ?? 'UNKNOWN', failureCode });
      }
    } finally {
      setPaying(false);
    }
  };

  const submitSslCommerz = async () => {
    setFailure(null);
    setStateNotice(null);
    setPaying(true);
    try {
      const res = await initiateSslCommerz.mutateAsync(stay.id);
      if (res.status === 'SUCCESS' && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast.error(res.failedReason || 'Failed to initialize SSLCommerz gateway');
        setPaying(false);
      }
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      if (api?.code === 'BOOKING_EXPIRED') {
        setFailure({ code: 'BOOKING_EXPIRED', failureCode: null });
      } else {
        toast.error(api?.message || 'Could not connect to payment gateway');
      }
      setPaying(false);
    }
  };

  if (outcome) {
    return <PayConfirmation booking={outcome} />;
  }

  if (stateNotice) {
    return (
      <div className="mx-auto flex max-w-narrow flex-col gap-4 px-4 py-12 sm:px-6">
        <Banner tone="info" title={stateNotice}>
          Booking {stay.reference} is now "{stay.status.replace(/_/g, ' ').toLowerCase()}".
        </Banner>
        <div className="flex gap-2">
          <Button asChild>
            <Link to={ROUTES.TRIP(stay.reference)}>View trip</Link>
          </Button>
          <Button variant="outline" onClick={() => setStateNotice(null)}>
            Back to payment
          </Button>
        </div>
      </div>
    );
  }

  const failed = failure?.code === 'PAYMENT_FAILED';
  const gatewayFailure =
    failure?.failureCode ?? (payment.data?.failureCode ? payment.data.failureCode : null);
  const failureText = failure
    ? failed
      ? FAILURE_COPY[gatewayFailure ?? ''] ??
        'The payment did not go through and the dates have been released.'
      : failure.code === 'BOOKING_EXPIRED'
        ? 'Your hold expired. If you were charged, you are refunded automatically.'
        : failure.code === 'RATE_LIMITED'
          ? 'Too many attempts. Try again shortly.'
          : 'We could not take that payment. Nothing was charged.'
    : null;

  return (
    <div className="mx-auto grid max-w-content gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* Page Header with Step Indicator */}
      <div className="lg:col-span-2">
        <Link
          to={ROUTES.TRIP(stay.reference)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to trip {stay.reference}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Pay for your stay
          </h1>
          <div className="inline-flex items-center gap-2 rounded-pill bg-sand px-3.5 py-1 text-xs font-medium">
            <span className="flex items-center gap-1 text-primary font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              1 Review
            </span>
            <span className="text-muted/40">/</span>
            <span className="font-bold text-text">2 Payment</span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Reservation Hold Warning / Countdown Card */}
        {expired ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-danger/40 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex items-start gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger">
                <Timer className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-heading text-base font-semibold text-text">Your hold has expired</h2>
                <p className="mt-1 text-sm text-muted">
                  These dates are available to other guests again. Pick new dates or start a fresh hold.
                </p>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="rounded-pill">
                    <Link to={ROUTES.LISTING(stay.listing.id)}>Back to the listing</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-pill" onClick={startAgain}>
                    Start again
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            role="status"
            className={cn(
              'rounded-2xl bg-surface p-4 sm:p-5 shadow-card ring-1 transition-all',
              hold.urgent
                ? 'ring-accent/40 bg-accent/5'
                : 'ring-line/80'
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={cn(
                    'grid h-12 w-12 shrink-0 place-items-center rounded-2xl',
                    hold.urgent
                      ? 'bg-accent/15 text-accent'
                      : 'bg-primary-soft text-primary'
                  )}
                >
                  <Timer className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="font-heading text-base font-semibold text-text">
                    Dates reserved & held for you
                  </div>
                  <p className="mt-0.5 truncate text-xs sm:text-sm text-muted">
                    <span className="font-medium text-text">{stay.listing.title}</span> · {formatDateRange(stay.checkIn, stay.checkOut)}
                  </p>
                </div>
              </div>

              <div className="flex items-center sm:flex-col sm:items-end justify-between shrink-0 border-t sm:border-t-0 border-line/60 pt-2.5 sm:pt-0">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Hold expires in
                </span>
                <span
                  aria-live="polite"
                  className={cn(
                    'sm:mt-1 inline-flex items-center rounded-pill px-3.5 py-1 font-heading text-sm sm:text-base font-bold tabular-nums shadow-xs',
                    hold.urgent
                      ? 'bg-accent text-white animate-pulse'
                      : 'bg-primary-soft text-primary-dark ring-1 ring-primary/20'
                  )}
                >
                  {hold.label}
                </span>
              </div>
            </div>
          </div>
        )}

        {paymentParam === 'failed' && (
          <InlineAlert tone="danger" className="border border-danger/30">
            <span className="block font-semibold">Payment was not completed</span>
            Payment via SSLCommerz was declined or did not complete. Your dates are still reserved until the timer expires. You can retry with SSLCommerz or choose another option below.
          </InlineAlert>
        )}

        {paymentParam === 'cancelled' && (
          <InlineAlert tone="warning" className="border border-warning/30">
            <span className="block font-semibold">Payment session cancelled</span>
            The payment session was cancelled. Your dates remain held and you can complete payment anytime before the hold expires.
          </InlineAlert>
        )}

        {failure && failureText && (
          <InlineAlert tone={failed ? 'danger' : 'warning'} className="border border-line">
            <span className="block font-semibold">Payment error</span>
            {failureText}
            {failed && (
              <span className="mt-1 block text-xs">
                Booking {stay.reference} is now marked as payment failed and the dates are free
                again, so this hold cannot be paid. Starting again creates a new hold.
              </span>
            )}
          </InlineAlert>
        )}

        {cooling && (
          <p aria-live="polite" className="tabular text-sm text-warning-text">
            Too many attempts. Try again in {cooldown.label}
          </p>
        )}

        {/* Payment Method Selection Card */}
        <div className="rounded-2xl bg-surface p-6 shadow-card ring-1 ring-line/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line/70 pb-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-text">Payment method</h2>
              <p className="text-xs text-muted">Select how you'd like to pay</p>
            </div>
            <div className="inline-flex rounded-pill bg-sand p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaymentMethod('sslcommerz')}
                className={cn(
                  'rounded-pill px-4 py-1.5 transition-all',
                  paymentMethod === 'sslcommerz'
                    ? 'bg-surface font-semibold text-primary shadow-sm ring-1 ring-line/40'
                    : 'text-muted hover:text-text'
                )}
              >
                SSLCommerz
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('simulated')}
                className={cn(
                  'rounded-pill px-4 py-1.5 transition-all',
                  paymentMethod === 'simulated'
                    ? 'bg-surface font-semibold text-primary shadow-sm ring-1 ring-line/40'
                    : 'text-muted hover:text-text'
                )}
              >
                Test Sim
              </button>
            </div>
          </div>

          <div className="mt-5">
            {paymentMethod === 'sslcommerz' ? (
              <SslCommerzPaymentField />
            ) : ENV.PAYMENT_MODE === 'provider' ? (
              <CardPaymentField onTokenChange={setPaymentToken} />
            ) : (
              <FakePaymentField onTokenChange={setPaymentToken} />
            )}
          </div>
        </div>

        {requested && !expired && (
          <Banner tone="info" title="This is a request to book">
            The host has {BRAND.hostResponseHours} hours to accept. If they decline or do not
            answer, you are refunded in full.
          </Banner>
        )}
      </div>

      {/* Right Column: Trip Summary, Price Breakdown, and CTA */}
      <div className="lg:w-80 lg:shrink-0">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="rounded-2xl bg-surface p-4 sm:p-5 shadow-card ring-1 ring-line/70">
            <div className="flex items-start gap-3.5">
              <img
                src={mediaUrl(stay.listing.coverPhotoUrl) ?? PLACEHOLDER_IMAGE}
                alt={stay.listing.title}
                className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-line/70"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {stay.listing.city}, {stay.listing.country}
                </p>
                <h3 className="mt-0.5 line-clamp-2 font-heading text-sm font-semibold text-text leading-snug">
                  {stay.listing.title}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Hosted by <span className="font-medium text-text">{stay.host.displayName}</span>
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex items-center justify-between border-t border-line/60 pt-3 text-xs text-muted">
              <span>{formatDateRange(stay.checkIn, stay.checkOut)}</span>
              <span className="font-semibold text-text">
                {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}
              </span>
            </div>
          </div>

          <PriceBreakdown breakdown={stay.priceBreakdown} nights={stay.nights} />

          <button
            type="button"
            disabled={expired || cooling || (paymentMethod === 'simulated' && paymentToken === '') || paying}
            onClick={() => void (paymentMethod === 'sslcommerz' ? submitSslCommerz() : submit())}
            className="flex w-full items-center justify-center rounded-2xl bg-accent py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgb(217_92_46/0.7)] transition-all hover:bg-accent-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted disabled:shadow-none"
          >
            {paying
              ? 'Processing...'
              : paymentMethod === 'sslcommerz'
                ? `Pay ${formatMoney(total)} via SSLCommerz`
                : `Pay ${formatMoney(total)} and ${requested ? 'send request' : 'book'}`}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted">
            <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span>Guaranteed safe & secure payment</span>
          </div>

          {failed && (
            <Button variant="outline" block className="rounded-2xl" onClick={startAgain}>
              Start again
            </Button>
          )}

          <p className="text-center text-xs text-muted">
            The total amount is guaranteed from your reservation snapshot.
          </p>
        </div>
      </div>
    </div>
  );
};
