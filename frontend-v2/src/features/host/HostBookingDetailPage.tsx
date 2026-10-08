import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Check, MessageSquare, Scale, Star, X } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useBookingById, useBookingMutations } from '@/features/booking/api';
import { useCreateReview } from '@/features/reviews/api';
import { BookingTimeline } from '@/components/patterns/BookingTimeline';
import { CancelBookingDialog } from '@/components/patterns/CancelBookingDialog';
import { CountdownPill } from '@/components/patterns/Countdown';
import { PriceBreakdown } from '@/components/patterns/PriceBreakdown';
import { StarInput } from '@/components/patterns/Rating';
import { useDocumentTitle } from '@/hooks/useSeo';
import { formatInstant, guestsLabel, nightsLabel } from '@/lib/format';
import { formatDateRange } from '@/lib/local-date';
import { cancellationPolicyLabels } from '@/lib/status';
import { declineReasonSchema } from '@/features/host/schemas';
import {
  Banner,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorState,
  Field,
  InlineAlert,
  Skeleton,
  StatusBadge,
  Textarea,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import type { BookingResponse } from '@/types/api';

const hostReviewSchema = z.object({
  overallRating: z.number().int().min(1, 'Choose a rating out of 5').max(5),
  comment: z.string().trim().max(2000, 'Keep your review to 2000 characters'),
});

type HostReviewValues = z.infer<typeof hostReviewSchema>;

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
    <dt className="text-muted">{label}</dt>
    <dd className="text-right text-ink">{children}</dd>
  </div>
);

const GuestBlock: React.FC<{ booking: BookingResponse }> = ({ booking }) => {
  const { firstName, lastName, phone } = booking.guest;
  const gated = lastName === null && phone === null;

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-ink">Guest</h2>
      <dl className="mt-2 divide-y divide-line">
        <Detail label="Name">{lastName ? `${firstName} ${lastName}` : firstName}</Detail>
        {phone && <Detail label="Phone">{phone}</Detail>}
      </dl>
      {gated && (
        <p className="mt-3 rounded-control bg-primary-soft px-3 py-2 text-sm text-primary-dark">
          Full name and phone are shared once the booking is confirmed
        </p>
      )}
    </Card>
  );
};

const ApproveDialog: React.FC<{
  booking: BookingResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}> = ({ booking, open, onOpenChange, onApproved }) => {
  const { approve } = useBookingMutations(booking.reference, booking.listing.id);
  const [failure, setFailure] = useState<unknown>(null);
  const expired = failure instanceof ApiError && failure.code === 'BOOKING_EXPIRED';

  const confirm = async () => {
    setFailure(null);
    try {
      await approve.mutateAsync(booking.id);
      onOpenChange(false);
      onApproved();
      toast.success('Booking confirmed. The guest has been notified.');
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Confirm this booking?</DialogTitle>
        <DialogDescription>
          {booking.listing.title} · {booking.reference}
        </DialogDescription>
        <p className="mt-3 text-sm text-ink">
          The guest is notified right away and their full name and phone number are shared with you.
          {booking.expiresAt && (
            <> The request expires on {formatInstant(booking.expiresAt)}.</>
          )}
        </p>

        {expired && (
          <div className="mt-3">
            <InlineAlert tone="danger">
              <span className="font-semibold">This request expired</span>
              <span className="mt-0.5 block">
                The guest&apos;s 24 hours ran out, so the request can no longer be confirmed.
              </span>
              <TraceId error={failure} className="mt-1 block" />
            </InlineAlert>
          </div>
        )}

        {!expired && failure != null && (
          <div className="mt-3">
            <InlineAlert tone="danger">
              {failure instanceof ApiError
                ? failure.detail
                : 'We could not confirm this booking. Try again.'}
              <TraceId error={failure} className="mt-1 block" />
            </InlineAlert>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={approve.isPending} onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button loading={approve.isPending} onClick={() => void confirm()}>
            <Check className="h-4 w-4" aria-hidden />
            Confirm booking
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DeclineDialog: React.FC<{
  booking: BookingResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeclined: () => void;
}> = ({ booking, open, onOpenChange, onDeclined }) => {
  const { decline } = useBookingMutations(booking.reference, booking.listing.id);
  const [failure, setFailure] = useState<unknown>(null);
  const form = useForm<z.infer<typeof declineReasonSchema>>({
    resolver: zodResolver(declineReasonSchema),
    defaultValues: { reason: '' },
  });
  const reason = form.watch('reason') ?? '';

  const submit = async (values: z.infer<typeof declineReasonSchema>) => {
    setFailure(null);
    try {
      await decline.mutateAsync({ id: booking.id, reason: values.reason });
      form.reset();
      onOpenChange(false);
      onDeclined();
      toast.success('Request declined. The guest has been refunded in full.');
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => form.setError('reason', { message }),
        ['reason']
      );
      setFailure(unmatched.length > 0 ? null : error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Decline this request?</DialogTitle>
        <DialogDescription>
          {booking.listing.title} · {booking.reference}
        </DialogDescription>

        <form className="mt-4 flex flex-col gap-3" onSubmit={form.handleSubmit(submit)} noValidate>
          <p className="text-sm text-ink">The guest is refunded in full and can search again.</p>

          <Field
            label="Why are you declining?"
            htmlFor="decline-reason"
            required
            error={form.formState.errors.reason?.message}
            hint={`${reason.trim().length}/500 characters. At least 5 are required.`}
          >
            <Textarea
              id="decline-reason"
              maxLength={500}
              hasError={Boolean(form.formState.errors.reason)}
              aria-invalid={Boolean(form.formState.errors.reason)}
              {...form.register('reason')}
            />
          </Field>

          {failure != null && (
            <InlineAlert tone="danger">
              {failure instanceof ApiError ? failure.detail : 'We could not decline this request.'}
              <TraceId error={failure} className="mt-1 block" />
            </InlineAlert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={decline.isPending}
              onClick={() => onOpenChange(false)}
            >
              Keep the request
            </Button>
            <Button type="submit" variant="destructive" loading={decline.isPending}>
              Decline request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ReviewDialog: React.FC<{
  booking: BookingResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
}> = ({ booking, open, onOpenChange, onReviewed }) => {
  const createReview = useCreateReview(booking.id);
  const [failure, setFailure] = useState<unknown>(null);
  const form = useForm<HostReviewValues>({
    resolver: zodResolver(hostReviewSchema),
    defaultValues: { overallRating: 0, comment: '' },
  });
  const comment = form.watch('comment') ?? '';

  const submit = async (values: HostReviewValues) => {
    setFailure(null);
    try {
      // Sub-ratings are rejected by the API for a host, so only the overall score is sent.
      await createReview.mutateAsync({
        overallRating: values.overallRating,
        comment: values.comment.trim() === '' ? undefined : values.comment.trim(),
      });
      form.reset();
      onOpenChange(false);
      onReviewed();
      toast.success('Thanks for your review');
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => form.setError(name as keyof HostReviewValues, { message }),
        ['overallRating', 'comment']
      );
      setFailure(unmatched.length > 0 ? null : error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Rate your guest</DialogTitle>
        <DialogDescription>
          {booking.guest.firstName} · {booking.reference}
        </DialogDescription>

        <form className="mt-4 flex flex-col gap-4" onSubmit={form.handleSubmit(submit)} noValidate>
          <p className="text-sm text-muted">
            Only an overall rating is asked for here. Reviews stay private until both sides have
            written theirs.
          </p>

          <div>
            <StarInput
              name="overallRating"
              legend="How was your guest?"
              value={form.watch('overallRating')}
              onChange={(value) =>
                form.setValue('overallRating', value, { shouldValidate: true })
              }
              required
            />
            {form.formState.errors.overallRating && (
              <p role="alert" className="mt-1 text-xs text-danger-text">
                {form.formState.errors.overallRating.message}
              </p>
            )}
          </div>

          <Field
            label="Comment (optional)"
            htmlFor="host-review-comment"
            error={form.formState.errors.comment?.message}
            hint={`${comment.trim().length}/2000 characters. Reviews cannot be edited afterwards.`}
          >
            <Textarea
              id="host-review-comment"
              maxLength={2000}
              hasError={Boolean(form.formState.errors.comment)}
              aria-invalid={Boolean(form.formState.errors.comment)}
              {...form.register('comment')}
            />
          </Field>

          {failure != null && (
            <InlineAlert tone="danger">
              {failure instanceof ApiError ? failure.detail : 'We could not save your review.'}
              <TraceId error={failure} className="mt-1 block" />
            </InlineAlert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={createReview.isPending}
              onClick={() => onOpenChange(false)}
            >
              Not now
            </Button>
            <Button type="submit" loading={createReview.isPending}>
              Send review
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const MessageDialog: React.FC<{
  booking: BookingResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ booking, open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogTitle>No conversation yet</DialogTitle>
      <DialogDescription>
        {booking.guest.firstName} has not started a thread for this booking.
      </DialogDescription>
      <p className="mt-3 text-sm text-muted">
        Messages open when a guest writes first, so there is nothing to reply to here yet. Once
        they write, the conversation appears in your inbox.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button asChild>
          <Link to={ROUTES.INBOX}>Open your inbox</Link>
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

export const HostBookingDetailPage: React.FC = () => {
  useDocumentTitle('Booking');

  const { id } = useParams();
  const bookingId = Number(id);
  const query = useBookingById(Number.isFinite(bookingId) ? bookingId : null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const booking = query.data;
  if (!booking) {
    return <ErrorState message="We could not find that booking." />;
  }

  const allowed = booking.allowedActions;
  const refetch = () => void query.refetch();
  const isRequest = booking.status === 'PENDING_APPROVAL';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{booking.listing.title}</h1>
          <p className="tabular mt-1 text-sm text-muted">
            {booking.reference} · {booking.listing.city}, {booking.listing.country}
          </p>
        </div>
        <StatusBadge status={booking.status} kind="booking" viewer="host" />
      </div>

      {isRequest && booking.expiresAt && (
        <Banner tone="warning" title="This request needs your response">
          <span className="flex flex-wrap items-center gap-2">
            Approve or decline before the deadline.
            <CountdownPill
              target={booking.expiresAt}
              prefix="Time remaining"
              urgentMs={6 * 3_600_000}
            />
          </span>
        </Banner>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-5">
          <GuestBlock booking={booking} />

          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Stay</h2>
            <dl className="mt-2 divide-y divide-line">
              <Detail label="Dates">{formatDateRange(booking.checkIn, booking.checkOut)}</Detail>
              <Detail label="Nights">{nightsLabel(booking.nights)}</Detail>
              <Detail label="Guests">{guestsLabel(booking.guests)}</Detail>
              <Detail label="Check-in">{formatInstant(booking.checkInDateTime)}</Detail>
              <Detail label="Check-out">{formatInstant(booking.checkOutDateTime)}</Detail>
              <Detail label="Cancellation policy">
                {cancellationPolicyLabels[booking.cancellationPolicy]}
              </Detail>
              <Detail label="Booking type">
                {booking.instantBook ? 'Instant book' : 'Request to book'}
              </Detail>
            </dl>
            <p className="mt-3 text-xs text-muted">{booking.cancellationPolicyDescription}</p>
          </Card>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-ink">Money</h2>
            <PriceBreakdown
              breakdown={booking.priceBreakdown}
              nights={booking.nights}
              viewer="host"
            />
          </section>

          {booking.history.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-base font-semibold text-ink">Timeline</h2>
              <BookingTimeline history={booking.history} />
            </Card>
          )}
        </div>

        <Card className="flex h-fit flex-col gap-3 p-5">
          <h2 className="text-base font-semibold text-ink">Actions</h2>

          {allowed.length === 0 && (
            <p className="text-sm text-muted">
              There is nothing to do on this booking. We will notify you if that changes.
            </p>
          )}

          {allowed.includes('APPROVE') && (
            <Button onClick={() => setApproveOpen(true)}>
              <Check className="h-4 w-4" aria-hidden />
              Approve request
            </Button>
          )}

          {allowed.includes('DECLINE') && (
            <Button variant="outline" onClick={() => setDeclineOpen(true)}>
              <X className="h-4 w-4" aria-hidden />
              Decline
            </Button>
          )}

          {allowed.includes('CANCEL') && (
            <>
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
              <p className="text-xs text-muted">
                The guest is refunded in full, and cancellations count on your record.
              </p>
            </>
          )}

          {allowed.includes('REVIEW') && (
            <Button variant="secondary" onClick={() => setReviewOpen(true)}>
              <Star className="h-4 w-4" aria-hidden />
              Rate your guest
            </Button>
          )}

          {allowed.includes('OPEN_DISPUTE') && (
            <Button asChild variant="outline">
              <Link to={ROUTES.TRIP_DISPUTE(booking.reference)}>
                <Scale className="h-4 w-4" aria-hidden />
                Open a dispute
              </Link>
            </Button>
          )}

          {allowed.includes('MESSAGE') && (
            <Button variant="outline" onClick={() => setMessageOpen(true)}>
              <MessageSquare className="h-4 w-4" aria-hidden />
              Message guest
            </Button>
          )}

          <Button asChild variant="ghost" size="sm" className="mt-1">
            <Link to={`${ROUTES.HOST_BOOKINGS}?listingId=${booking.listing.id}`}>
              See this listing&apos;s bookings
            </Link>
          </Button>
        </Card>
      </div>

      <ApproveDialog
        booking={booking}
        open={approveOpen}
        onOpenChange={setApproveOpen}
        onApproved={refetch}
      />
      <DeclineDialog
        booking={booking}
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        onDeclined={refetch}
      />
      <CancelBookingDialog
        booking={booking}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={refetch}
        viewer="host"
      />
      <ReviewDialog
        booking={booking}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onReviewed={refetch}
      />
      <MessageDialog booking={booking} open={messageOpen} onOpenChange={setMessageOpen} />
    </div>
  );
};