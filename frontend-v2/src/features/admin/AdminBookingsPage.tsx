import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useAdminBooking, useAdminBookingByReference } from '@/features/host/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { BookingTimeline } from '@/components/patterns/BookingTimeline';
import { PriceBreakdown } from '@/components/patterns/PriceBreakdown';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { formatDateRange } from '@/lib/local-date';
import { formatDateTimeLocal } from '@/lib/format';
import { cancellationPolicyLabels } from '@/lib/status';
import type { BookingResponse } from '@/types/api';

// Matches BookingReferenceGenerator: "BK-" + 8 chars from a Crockford-style
// alphabet that excludes 0/1/I/O to avoid transcription errors.
const REFERENCE_PATTERN = /^BK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-3 py-1.5 text-sm">
    <dt className="text-muted">{label}</dt>
    <dd className="text-right font-medium text-ink">{children}</dd>
  </div>
);

/** Read-only view: money on a booking is only ever changed through a dispute (architecture 13.5). */
const BookingView: React.FC<{ booking: BookingResponse; source: string }> = ({ booking, source }) => (
  <div className="flex flex-col gap-4">
    <InlineAlert tone="info">
      Read-only lookup by {source}. Nothing can be changed from here: cancellations, declines and
      refunds are handled on the trip page or in a dispute case.
    </InlineAlert>

    <Card as="section" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold text-ink">
            {booking.listing.title}
            <StatusBadge status={booking.status} kind="booking" />
          </h2>
          <p className="mt-1 text-sm text-muted">
            <span className="tabular">{booking.reference}</span> · booking id{' '}
            <span className="tabular">#{booking.id}</span> ·{' '}
            <Link
              to={ROUTES.ADMIN_LISTING(booking.listing.id)}
              className="text-primary underline underline-offset-2"
            >
              Listing #{booking.listing.id}
            </Link>
          </p>
        </div>
      </div>

      <dl className="mt-4 divide-y divide-line">
        <DetailRow label="Dates">
          {formatDateRange(booking.checkIn, booking.checkOut)} · {booking.nights}{' '}
          {booking.nights === 1 ? 'night' : 'nights'}
        </DetailRow>
        <DetailRow label="Guests">{booking.guests}</DetailRow>
        <DetailRow label="Guest">
          {booking.guest.firstName} {booking.guest.lastName ?? ''} (#{booking.guest.id})
        </DetailRow>
        <DetailRow label="Host">
          {booking.host.displayName} (#{booking.host.id})
        </DetailRow>
        <DetailRow label="Check-in">
          {formatDateTimeLocal(booking.checkInDateTime)}
        </DetailRow>
        <DetailRow label="Check-out">
          {formatDateTimeLocal(booking.checkOutDateTime)}
        </DetailRow>
        <DetailRow label="Cancellation">
          {cancellationPolicyLabels[booking.cancellationPolicy]}
        </DetailRow>
        <DetailRow label="Instant book">{booking.instantBook ? 'Yes' : 'No'}</DetailRow>
        <DetailRow label="Confirmed">{formatDateTimeLocal(booking.confirmedAt)}</DetailRow>
        <DetailRow label="Completed">{formatDateTimeLocal(booking.completedAt)}</DetailRow>
        <DetailRow label="Cancelled">{formatDateTimeLocal(booking.cancelledAt)}</DetailRow>
        <DetailRow label="Refunded to guest">
          <span className="tabular">{formatMoney(booking.refundAmount)}</span>
        </DetailRow>
        <DetailRow label="Host payout">
          <span className="tabular">{formatMoney(booking.hostPayoutAmount)}</span>
        </DetailRow>
      </dl>

      <p className="mt-4 max-w-prose text-sm text-muted">{booking.cancellationPolicyDescription}</p>
    </Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card as="section" className="p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Price snapshot
        </h3>
        <PriceBreakdown breakdown={booking.priceBreakdown} nights={booking.nights} viewer="admin" />
      </Card>

      <Card as="section" className="p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Full status history
        </h3>
        {booking.history.length === 0 ? (
          <p className="text-sm text-muted">No status change has been recorded yet.</p>
        ) : (
          <BookingTimeline history={booking.history} />
        )}
      </Card>
    </div>
  </div>
);

export const AdminBookingsPage: React.FC = () => {
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const trimmed = submitted.trim();
  const isReference = REFERENCE_PATTERN.test(trimmed);
  const isId = /^\d+$/.test(trimmed);
  const numericId = isId ? Number(trimmed) : null;
  const hasQuery = trimmed !== '';

  const byId = useAdminBooking(hasQuery && isId ? numericId : null);
  const byReference = useAdminBookingByReference(hasQuery && isReference ? trimmed : null);

  const active = hasQuery && isId ? byId : byReference;
  const booking = active.data ?? null;
  const source = isReference ? 'reference' : 'id';
  // A lookup miss is a result, not an error: only unexpected failures error out.
  const notFound =
    active.isError && active.error instanceof ApiError && active.error.status === 404;

  useDocumentTitle(booking ? `Booking ${booking.reference}` : 'Booking lookup');

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: ROUTES.ADMIN_HOME }, { label: 'Bookings' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Booking lookup</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Paste a booking reference such as <span className="tabular">BK-7Q2M4X9A</span> or a
          numeric booking id. Nothing on this page can be changed.
        </p>
      </div>

      <Card className="p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = term.trim();
            setLookupError(
              value === '' || REFERENCE_PATTERN.test(value) || /^\d+$/.test(value)
                ? null
                : 'Enter a booking reference starting with BK- or a numeric booking id.'
            );
            setSubmitted(value);
          }}
        >
          <Field
            label="Booking reference or id"
            htmlFor="admin-booking-lookup"
            hint="References are BK- followed by 8 characters; ids are numeric."
            error={lookupError}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="admin-booking-lookup"
                value={term}
                placeholder="BK-7Q2M4X9A or 4821"
                hasError={Boolean(lookupError)}
                aria-invalid={Boolean(lookupError)}
                onChange={(event) => setTerm(event.target.value)}
                className="min-w-[16rem] flex-1"
              />
              <Button type="submit" disabled={term.trim() === ''}>
                <Search className="h-4 w-4" aria-hidden />
                Look up
              </Button>
            </div>
          </Field>
        </form>
      </Card>

      {hasQuery && (isId || isReference) && active.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {hasQuery && (isId || isReference) && active.isError && !notFound && (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      )}

      {!hasQuery && (
        <EmptyState
          title="Look up a booking"
          description="Staff can read any booking by reference or id, including the full status history."
        />
      )}

      {notFound && (
        <EmptyState
          title="No booking found"
          description="No booking matches that reference or id. Check it and try again."
        />
      )}

      {booking && <BookingView booking={booking} source={source} />}
    </div>
  );
};