import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useBooking } from '@/features/booking/api';
import { useBookingReviews, useCreateReview } from '@/features/reviews/api';
import { StarInput } from '@/components/patterns/Rating';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { useDocumentTitle } from '@/hooks/useSeo';
import { addDays, formatDate } from '@/lib/local-date';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Skeleton,
  StatusBadge,
  Textarea,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';

const reviewSchema = z.object({
  overallRating: z.number().int().min(1, 'Choose a rating out of 5').max(5),
  cleanlinessRating: z.number().int().min(0).max(5),
  communicationRating: z.number().int().min(0).max(5),
  accuracyRating: z.number().int().min(0).max(5),
  comment: z.string().trim().max(2000, 'Keep your review to 2000 characters'),
});
type ReviewValues = z.infer<typeof reviewSchema>;

export const ReviewFormPage: React.FC = () => {
  useDocumentTitle('Write a review');

  const { reference } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const booking = useBooking(reference ?? null);
  const reviews = useBookingReviews(booking.data?.id ?? null);
  const createReview = useCreateReview(booking.data?.id ?? 0);

  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      overallRating: 0,
      cleanlinessRating: 0,
      communicationRating: 0,
      accuracyRating: 0,
      comment: '',
    },
  });

  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [submitted, setSubmitted] = useState(false);

  const { errors, isSubmitting } = form.formState;
  const comment = form.watch('comment') ?? '';
  const stay = booking.data;
  // The server decides the direction; the caller only learns which form it may send.
  const asHost = Boolean(stay && user && stay.host.id === user.id);
  const publishDate = stay ? formatDate(addDays(stay.checkOut, BRAND.reviewWindowDays)) : null;
  const mine = reviews.data?.find((review) => review.reviewerId === user?.id);

  const onSubmit = async (values: ReviewValues) => {
    setMessage(null);
    setTrace(null);
    try {
      await createReview.mutateAsync({
        overallRating: values.overallRating,
        // The API rejects sub-ratings from a host, so they are only sent by a guest.
        ...(asHost
          ? {}
          : {
              cleanlinessRating: values.cleanlinessRating || undefined,
              communicationRating: values.communicationRating || undefined,
              accuracyRating: values.accuracyRating || undefined,
            }),
        comment: values.comment.trim() === '' ? undefined : values.comment.trim(),
      });
      setSubmitted(true);
      setConfirming(false);
      toast.success('Thanks for the review');
    } catch (error) {
      const api = error instanceof ApiError ? error : null;

      if (api?.code === 'DUPLICATE_RESOURCE') {
        setMessage('You already reviewed this stay.');
        setConfirming(false);
        return;
      }

      const unmatched = applyFieldErrors(
        error,
        (name, text) => form.setError(name as keyof ReviewValues, { message: text }),
        ['overallRating', 'cleanlinessRating', 'communicationRating', 'accuracyRating', 'comment']
      );
      setMessage(
        unmatched[0] ??
          (api?.detail ??
            'This stay is not open for reviews yet. Reviews open after check-out and stay open for a limited time.')
      );
      setTrace(error);
      setConfirming(false);
    }
  };

  if (booking.isLoading) {
    return (
      <div className="mx-auto flex max-w-narrow flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full" />
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

  if (!stay || !reference) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-12 sm:px-6">
        <EmptyState
          title="We could not find that stay"
          action={
            <Button asChild>
              <Link to={ROUTES.TRIPS}>Go to your trips</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const open = stay.allowedActions.includes('REVIEW');

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Trips', to: ROUTES.TRIPS },
          { label: stay.reference, to: ROUTES.TRIP(stay.reference) },
          { label: 'Review' },
        ]}
      />
      <h1 className="text-2xl font-semibold text-ink">Write a review</h1>
      <p className="text-sm text-muted">
        {stay.listing.title} · {stay.listing.city} · booking {stay.reference}
      </p>

      {!open && !submitted && (
        <EmptyState
          title="Reviews are not open for this trip yet"
          description="Reviews open once the stay is over and stay open for a limited window. You will get a reminder when yours is ready."
          action={
            <Button asChild>
              <Link to={ROUTES.TRIP(stay.reference)}>Back to the trip</Link>
            </Button>
          }
        />
      )}

      {(open || submitted) && (
        <Card className="p-5">
          {publishDate && (
            <p className="rounded-control bg-info-soft px-3 py-2 text-sm text-info-text">
              Your review stays private until {asHost ? 'your guest' : 'the host'} has written
              theirs, or until {publishDate}.
            </p>
          )}

          {submitted && (
            <div className="mt-4 flex flex-col gap-3">
              <InlineAlert tone="success">
                Thanks! We will publish it when both reviews are in or on {publishDate}.
              </InlineAlert>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={ROUTES.TRIP(stay.reference)}>Back to the trip</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={ROUTES.REVIEWS}>Other reviews</Link>
                </Button>
              </div>
            </div>
          )}

          {mine && (
            <div className="mt-4 rounded-control border border-line bg-bg p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-ink">
                Your review
                <StatusBadge status={mine.publishedAt ? 'PUBLISHED' : 'HIDDEN'} kind="review" />
              </p>
              <p className="tabular mt-1 text-muted">{mine.overallRating.toFixed(1)} out of 5</p>
              {mine.comment && <p className="mt-1 whitespace-pre-wrap text-muted">{mine.comment}</p>}
            </div>
          )}

          {!submitted && (
            <form
              className="mt-4 flex flex-col gap-5"
              onSubmit={form.handleSubmit((values) =>
                confirming ? onSubmit(values) : setConfirming(true)
              )}
              noValidate
            >
              {message && (
                <InlineAlert tone="danger">
                  {message}
                  <TraceId error={trace} className="mt-1 block" />
                </InlineAlert>
              )}

              {errors.overallRating && (
                <p role="alert" className="text-xs text-danger-text">
                  {errors.overallRating.message}
                </p>
              )}

              <StarInput
                name="overallRating"
                legend={asHost ? 'How was your guest?' : 'How was your stay?'}
                value={form.watch('overallRating')}
                onChange={(value) => form.setValue('overallRating', value, { shouldValidate: true })}
                required
              />

              {!asHost && (
                <div className="grid gap-5 sm:grid-cols-3">
                  <StarInput
                    name="cleanlinessRating"
                    legend="Cleanliness"
                    value={form.watch('cleanlinessRating')}
                    onChange={(value) => form.setValue('cleanlinessRating', value)}
                  />
                  <StarInput
                    name="communicationRating"
                    legend="Communication"
                    value={form.watch('communicationRating')}
                    onChange={(value) => form.setValue('communicationRating', value)}
                  />
                  <StarInput
                    name="accuracyRating"
                    legend="Accuracy"
                    value={form.watch('accuracyRating')}
                    onChange={(value) => form.setValue('accuracyRating', value)}
                  />
                </div>
              )}

              <Field
                label="Your review (optional)"
                htmlFor="review-comment"
                error={errors.comment?.message}
                hint={`${comment.length}/2000 characters. Reviews cannot be edited once they are in.`}
              >
                <Textarea
                  id="review-comment"
                  maxLength={2000}
                  hasError={Boolean(errors.comment)}
                  aria-invalid={Boolean(errors.comment)}
                  {...form.register('comment')}
                />
              </Field>

              {confirming ? (
                <div className="rounded-control border border-line bg-bg p-4">
                  <p className="text-sm font-medium text-ink">Ready to send?</p>
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                    <li>
                      Overall rating:{' '}
                      <span className="tabular">{form.getValues('overallRating')} out of 5</span>
                    </li>
                    <li>
                      {form.getValues('comment').trim() === ''
                        ? 'No written comment'
                        : `${form.getValues('comment').trim().length} characters of comment`}
                    </li>
                    <li>Published once both reviews are in, or on {publishDate}.</li>
                  </ul>
                  <p className="mt-2 text-sm text-muted">
                    Reviews cannot be edited or deleted afterwards.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirming(false)}
                      disabled={createReview.isPending}
                    >
                      Keep editing
                    </Button>
                    <Button type="submit" loading={isSubmitting || createReview.isPending}>
                      Send review
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button type="submit" size="lg">
                    Continue
                  </Button>
                </div>
              )}
            </form>
          )}
        </Card>
      )}
    </div>
  );
};
