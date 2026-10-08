import React, { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { BRAND } from '@/config/brand';
import { ENV } from '@/config/env';
import { ROUTES } from '@/config/routes';
import { useBooking, useBookingMutations, useBookingPaymentDetail } from '@/features/booking/api';
import { CardPaymentField, FakePaymentField } from '@/features/booking/PaymentMethodField';
import { CountdownPill } from '@/components/patterns/Countdown';
import { PriceBreakdown } from '@/components/patterns/PriceBreakdown';
import { useCountdown } from '@/hooks/useUtilities';
import { useDocumentTitle } from '@/hooks/useSeo';
import { formatDateRange } from '@/lib/local-date';
import { formatMoney } from '@/lib/money';
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
        <Button asChild variant="outline">
          <Link to={ROUTES.INBOX}>Message host</Link>
        </Button>
      </div>
    </div>
  );
};

export const PayPage: React.FC = () => {
  useDocumentTitle('Payment');

  const { reference } = useParams();
  const navigate = useNavigate();
  const booking = useBooking(reference ?? null);
  const { pay } = useBookingMutations(reference ?? undefined);

  const [paymentToken, setPaymentToken] = useState('');
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
      {/* Spans both columns, for the same reason as on the checkout step: the pay button used
          to start above the payment card instead of level with it. */}
      <div className="lg:col-span-2">
        <Link
          to={ROUTES.TRIP(stay.reference)}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to trip {stay.reference}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Pay for your stay</h1>
        <p className="mt-1 text-sm text-muted">
          <span className="text-muted">1 Review · </span>
          <span className="font-medium text-primary-dark">2 Pay</span>
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {expired ? (
          <Banner tone="danger" title="Your hold expired">
            These dates are available to other guests again. Pick new dates or start a fresh hold.
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={ROUTES.LISTING(stay.listing.id)}>Back to the listing</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={startAgain}>
                Start again
              </Button>
            </div>
          </Banner>
        ) : (
          <Banner
            tone={hold.urgent ? 'warning' : 'info'}
            title={
              <span className="inline-flex items-center gap-2">
                <Timer className="h-4 w-4" aria-hidden />
                Your dates are held for{' '}
                <span aria-live="polite" className="tabular font-semibold">
                  {hold.label}
                </span>
              </span>
            }
          >
            {stay.listing.title} · {formatDateRange(stay.checkIn, stay.checkOut)}
          </Banner>
        )}

        {failure && failureText && (
          <InlineAlert tone={failed ? 'danger' : 'warning'}>
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

        <Card className="p-4">
          <h2 className="text-base font-semibold text-ink">Payment method</h2>
          <div className="mt-3">
            {ENV.PAYMENT_MODE === 'provider' ? (
              <CardPaymentField onTokenChange={setPaymentToken} />
            ) : (
              <FakePaymentField onTokenChange={setPaymentToken} />
            )}
          </div>
        </Card>

        {requested && !expired && (
          <Banner tone="info" title="This is a request to book">
            The host has {BRAND.hostResponseHours} hours to accept. If they decline or do not
            answer, you are refunded in full.
          </Banner>
        )}
      </div>

      <div className="lg:w-80 lg:shrink-0">
        <div className="flex flex-col gap-3 lg:sticky lg:top-24">
          <PriceBreakdown breakdown={stay.priceBreakdown} nights={stay.nights} />

          <Button
            variant="accent"
            size="lg"
            block
            loading={paying}
            disabled={expired || cooling || paymentToken === ''}
            onClick={() => void submit()}
          >
            Pay {formatMoney(total)} and {requested ? 'send request' : 'book'}
          </Button>

          {failed && (
            <Button variant="outline" block onClick={startAgain}>
              Start again
            </Button>
          )}

          <p className="text-xs text-muted">
            The amount above is the snapshot taken when your hold was created. The browser never
            sends an amount, only the payment token.
          </p>
        </div>
      </div>
    </div>
  );
};
