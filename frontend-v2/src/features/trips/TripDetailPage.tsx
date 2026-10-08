import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, MessageSquare, Printer, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useBooking, useBookingMutations, useBookingPaymentDetail } from '@/features/booking/api';
import { useBookingReviews } from '@/features/reviews/api';
import { useListing } from '@/features/listings/api';
import { isAiUnavailable, useTripPlan } from '@/features/ai/api';
import { BookingTimeline } from '@/components/patterns/BookingTimeline';
import { CancelBookingDialog } from '@/components/patterns/CancelBookingDialog';
import { CountdownPill } from '@/components/patterns/Countdown';
import { PriceBreakdown } from '@/components/patterns/PriceBreakdown';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { useCountdown } from '@/hooks/useUtilities';
import { useDocumentTitle } from '@/hooks/useSeo';
import { formatDate, formatDateRange, todayIn } from '@/lib/local-date';
import { formatInstantInZone, formatDateTimeLocal, guestsLabel } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { cancellationPolicyLabels } from '@/lib/status';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  InlineAlert,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import type { BookingHostSummary } from '@/types/api';

export const TripDetailPage: React.FC = () => {
  const { reference } = useParams();
  useDocumentTitle(reference ? `Trip ${reference}` : 'Trip');

  const navigate = useNavigate();
  const booking = useBooking(reference ?? null);
  const payment = useBookingPaymentDetail(booking.data?.id ?? null);
  const reviews = useBookingReviews(booking.data?.id ?? null);
  const listing = useListing(booking.data?.listing.id ?? null);
  const tripPlan = useTripPlan();
  const [cancelOpen, setCancelOpen] = useState(false);

  const stay = booking.data;
  const timeZone = listing.data?.timezone ?? null;
  const hold = useCountdown(stay?.status === 'PENDING_PAYMENT' ? stay.expiresAt : null);

  const actions = stay?.allowedActions ?? [];
  const canPlan =
    stay?.status === 'CONFIRMED' && stay.checkOut >= todayIn(listing.data?.timezone ?? undefined);

  // BookingHostSummary carries no phone in the contract: read it defensively so the block
  // fills in by itself if the backend starts returning one.
  const hostPhone =
    (stay?.host as (BookingHostSummary & { phone?: string | null }) | undefined)?.phone ?? null;

  const paymentMissing =
    payment.isError &&
    payment.error instanceof ApiError &&
    payment.error.code === 'RESOURCE_NOT_FOUND';

  if (booking.isLoading) {
    return (
      <div className="mx-auto flex max-w-narrow flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
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

  if (!stay) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-12 sm:px-6">
        <EmptyState
          title="We could not find that trip"
          description="The link may be wrong, or the booking may belong to another account."
          action={
            <Button asChild>
              <Link to={ROUTES.TRIPS}>Go to your trips</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(stay.reference);
      toast.success('Reference copied');
    } catch {
      toast.error('Could not copy the reference');
    }
  };

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Trips', to: ROUTES.TRIPS }, { label: stay.reference }]} />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{stay.listing.title}</h1>
            <p className="text-sm text-muted">
              {stay.listing.city}, {stay.listing.country} · hosted by {stay.host.displayName}
            </p>
          </div>
          <StatusBadge status={stay.status} kind="booking" viewer="guest" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            Reference <span className="tabular font-medium text-ink">{stay.reference}</span>
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyReference()}>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy
          </Button>
          {stay.status === 'PENDING_PAYMENT' && <CountdownPill target={stay.expiresAt} />}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 no-print">
        {actions.includes('PAY') && (
          <Button asChild variant="accent">
            <Link to={ROUTES.TRIP_PAY(stay.reference)}>
              {hold.expired ? 'Complete payment' : 'Pay and finish booking'}
            </Link>
          </Button>
        )}
        {actions.includes('CANCEL') && (
          <Button variant="outline" onClick={() => setCancelOpen(true)}>
            Cancel booking
          </Button>
        )}
        {actions.includes('REVIEW') && (
          <Button asChild variant="secondary">
            <Link to={ROUTES.TRIP_REVIEW(stay.reference)}>Write a review</Link>
          </Button>
        )}
        {actions.includes('MESSAGE') && (
          <Button variant="outline" onClick={() => navigate(ROUTES.INBOX)}>
            <MessageSquare className="h-4 w-4" aria-hidden />
            Message host
          </Button>
        )}
        {actions.includes('OPEN_DISPUTE') && (
          <Button asChild variant="outline">
            <Link to={ROUTES.TRIP_DISPUTE(stay.reference)}>Open a dispute</Link>
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          Print receipt
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-base font-semibold text-ink">Your stay</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Check-in</dt>
              <dd className="text-ink">{formatDate(stay.checkIn)}</dd>
            </div>
            <div>
              <dt className="text-muted">Check-out</dt>
              <dd className="text-ink">{formatDate(stay.checkOut)}</dd>
            </div>
            <div>
              <dt className="text-muted">Nights</dt>
              <dd className="text-ink">{stay.nights}</dd>
            </div>
            <div>
              <dt className="text-muted">Guests</dt>
              <dd className="text-ink">{guestsLabel(stay.guests)}</dd>
            </div>
            {timeZone && (
              <>
                <div>
                  <dt className="text-muted">Arrival</dt>
                  <dd className="text-ink">{formatInstantInZone(stay.checkInDateTime, timeZone)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Departure</dt>
                  <dd className="text-ink">{formatInstantInZone(stay.checkOutDateTime, timeZone)}</dd>
                </div>
              </>
            )}
          </dl>
          {timeZone && (
            <p className="mt-2 text-xs text-muted">Times shown in the local time of {stay.listing.city}.</p>
          )}
          <p className="mt-3 border-t border-line pt-3 text-sm text-ink">
            {formatDateRange(stay.checkIn, stay.checkOut)}
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold text-ink">Price</h2>
          <div className="mt-3">
            <PriceBreakdown breakdown={stay.priceBreakdown} nights={stay.nights} />
          </div>
          {stay.refundAmount != null && (
            <p className="mt-3 rounded-control bg-info-soft px-3 py-2 text-sm text-info-text">
              Refunded so far: <span className="tabular font-semibold">{formatMoney(stay.refundAmount)}</span>
            </p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold text-ink">Payment</h2>
          {payment.isLoading && (
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          )}
          {paymentMissing && (
            <p className="mt-3 text-sm text-muted">
              No payment has been taken for this booking yet.
            </p>
          )}
          {payment.isError && !paymentMissing && (
            <InlineAlert tone="warning" className="mt-3">
              {payment.error instanceof ApiError
                ? payment.error.detail
                : 'We could not load the payment details.'}
            </InlineAlert>
          )}
          {payment.data && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={payment.data.status} kind="payment" />
                <span className="tabular text-sm text-ink">{formatMoney(payment.data.amount)}</span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">Refunded</dt>
                  <dd className="tabular text-ink">{formatMoney(payment.data.refundedTotal)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">Still refundable</dt>
                  <dd className="tabular text-ink">{formatMoney(payment.data.refundableAmount)}</dd>
                </div>
              </dl>

              {payment.data.refunds.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
                  {payment.data.refunds.map((refund) => (
                    <li key={refund.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <StatusBadge status={refund.status} kind="refund" />
                      <span className="tabular text-ink">{formatMoney(refund.amount)}</span>
                      <span className="text-xs text-muted">
                        {refund.reason.replace(/_/g, ' ').toLowerCase()} ·{' '}
                        {formatDateTimeLocal(refund.createdAt)}
                      </span>
                      {refund.status === 'FAILED' && (
                        <span className="text-xs text-muted">
                          We are retrying this refund automatically.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold text-ink">Cancellation policy</h2>
          <p className="mt-1 text-sm text-ink">
            {cancellationPolicyLabels[stay.cancellationPolicy]}
          </p>
          <p className="mt-1 text-sm text-muted">{stay.cancellationPolicyDescription}</p>

          <h3 className="mt-5 text-sm font-semibold text-ink">Your host</h3>
          <p className="mt-1 text-sm text-ink">{stay.host.displayName}</p>
          {hostPhone ? (
            <p className="mt-1 text-sm text-ink">
              Phone <span className="tabular">{hostPhone}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Contact details are shared once your booking is confirmed.
            </p>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-base font-semibold text-ink">Progress</h2>
        <div className="mt-3">
          <BookingTimeline history={stay.history} />
        </div>
        {reviews.data && reviews.data.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <h3 className="text-sm font-semibold text-ink">Reviews on this stay</h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-muted">
              {reviews.data.map((review) => (
                <li key={review.id}>
                  <span className="font-medium text-ink">{review.reviewerName}</span> ·{' '}
                  <span className="tabular">{review.overallRating.toFixed(1)}/5</span>
                  {review.publishedAt === null && (
                    <span className="ml-1 text-xs">(hidden until both reviews are in)</span>
                  )}
                  {review.comment && <p className="mt-0.5">{review.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {canPlan && !isAiUnavailable(tripPlan.error) && (
        <Card className="p-4 no-print">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Plan your stay
          </h2>
          <p className="mt-1 text-sm text-muted">
            A short day-by-day sketch for {stay.nights}{' '}
            {stay.nights === 1 ? 'night' : 'nights'} in {stay.listing.city}.
          </p>
          {tripPlan.data && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{tripPlan.data.text}</p>
          )}
          {tripPlan.isError && !isAiUnavailable(tripPlan.error) && (
            <InlineAlert tone="warning" className="mt-3">
              We could not write a plan just now. Try again in a minute.
            </InlineAlert>
          )}
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            loading={tripPlan.isPending}
            onClick={() =>
              tripPlan.mutate({ city: stay.listing.city, days: stay.nights })
            }
          >
            {tripPlan.data ? 'Write another plan' : 'Generate a plan'}
          </Button>
        </Card>
      )}

      <div className="border-t border-line pt-4 text-xs text-muted">
        <p>Receipt for booking {stay.reference}.</p>
        <p className="tabular">
          {formatMoney(stay.priceBreakdown.totalAmount)} paid for{' '}
          {formatDateRange(stay.checkIn, stay.checkOut)} at {stay.listing.title}.
        </p>
        {stay.confirmedAt && <p>Confirmed {formatDateTimeLocal(stay.confirmedAt)}.</p>}
      </div>

      <CancelBookingDialog
        booking={stay}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={() => void booking.refetch()}
      />
    </div>
  );
};
