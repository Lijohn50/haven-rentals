import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2 } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { reviewsApi } from '@/features/reviews/api';
import { useAdminReviews } from '@/features/host/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { RatingStars } from '@/components/patterns/Rating';
import { StatusBadge } from '@/components/ui';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Pagination,
  Skeleton,
  Textarea,
  TraceId,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { formatAbsolute, formatDateTimeLocal } from '@/lib/format';
import type { AdminReviewResponse, ReviewStatus } from '@/types/api';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'HIDDEN', label: 'Hidden (waiting to publish)' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REMOVED', label: 'Removed' },
];

const directionLabel = (review: AdminReviewResponse) =>
  review.direction === 'GUEST_TO_HOST' ? 'Guest → Host' : 'Host → Guest';

export const AdminReviewsPage: React.FC = () => {
  useDocumentTitle('Review moderation');

  const [status, setStatus] = useState<ReviewStatus | undefined>(undefined);
  const [term, setTerm] = useState('');
  const [submittedTerm, setSubmittedTerm] = useState('');
  const [page, setPage] = useState(0);
  const reviews = useAdminReviews(status, submittedTerm, page);

  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeTrace, setRemoveTrace] = useState<ApiError | null>(null);

  const removeReview = useMutation({
    mutationFn: ({ reviewId, reason: reasonText }: { reviewId: number; reason: string }) =>
      reviewsApi.removeByAdmin(reviewId, reasonText),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
      setRemovingId(null);
      setReason('');
    },
  });

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedTerm(term.trim());
    setPage(0);
  };

  const confirmRemove = (review: AdminReviewResponse) => {
    setRemoveError(null);
    setRemoveTrace(null);
    removeReview.mutate(
      { reviewId: review.id, reason: reason.trim() },
      {
        onError: (error: unknown) => {
          const api = error instanceof ApiError ? error : null;
          setRemoveError(api?.detail ?? 'Could not remove the review.');
          setRemoveTrace(api);
        },
      }
    );
  };

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: ROUTES.ADMIN_HOME }, { label: 'Reviews' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Review moderation</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Every review in the system, including hidden ones that are
          waiting for the review window to close.
        </p>
      </div>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={submitSearch}>
          <Field label="Status" className="min-w-[12rem]">
            <select
              value={status ?? 'ALL'}
              onChange={(e) => {
                const value = e.target.value;
                setStatus(value === 'ALL' ? undefined : (value as ReviewStatus));
                setPage(0);
              }}
              className="w-full rounded-control border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search" htmlFor="review-search" className="min-w-[16rem] flex-1" hint="Reviewer or listing title.">
            <Input
              id="review-search"
              value={term}
              placeholder="Name or listing title"
              onChange={(event) => setTerm(event.target.value)}
            />
          </Field>
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden />
            Search
          </Button>
        </form>
      </Card>

      {reviews.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {reviews.isError && (
        <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />
      )}

      {reviews.data && reviews.data.content.length === 0 && (
        <EmptyState title="No reviews match" description="Try a different status or search." />
      )}

      {reviews.data && reviews.data.content.length > 0 && (
        <ul className="flex flex-col gap-3">
          {reviews.data.content.map((review) => (
            <li key={review.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                      {review.reviewerName}
                      <span className="text-sm font-normal text-muted">→</span>
                      {review.revieweeName}
                      <StatusBadge status={review.status} kind="review" />
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      <Link
                        to={ROUTES.ADMIN_LISTING(review.listingId)}
                        className="text-primary underline underline-offset-2"
                      >
                        {review.listingTitle}
                      </Link>{' '}
                      · {directionLabel(review)} · booking{' '}
                      <span className="tabular">#{review.bookingId}</span>
                    </p>
                    <p className="tabular mt-0.5 text-xs text-muted">
                      Created {formatAbsolute(review.createdAt)}
                      {review.status === 'HIDDEN' &&
                        ` · publishes or lapses ${formatDateTimeLocal(review.publishDeadline)}`}
                      {review.publishedAt && ` · published ${formatAbsolute(review.publishedAt)}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RatingStars value={review.overallRating} />
                    {review.status !== 'REMOVED' && removingId !== review.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => { setRemovingId(review.id); setReason(''); }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                {review.cleanlinessRating !== null && (
                  <p className="mt-2 text-xs text-muted">
                    Cleanliness {review.cleanlinessRating}/5 · Communication{' '}
                    {review.communicationRating}/5 · Accuracy {review.accuracyRating}/5
                  </p>
                )}
                {review.comment && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{review.comment}</p>
                )}

                {removingId === review.id && (
                  <div className="mt-3 rounded-control border border-line bg-bg p-3">
                    <Field
                      label="Reason for removal"
                      htmlFor={`remove-reason-${review.id}`}
                      required
                      error={removeError}
                    >
                      <Textarea
                        id={`remove-reason-${review.id}`}
                        rows={2}
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </Field>
                    {removeTrace && <TraceId error={removeTrace} className="mt-1 block" />}
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemovingId(null)}
                        disabled={removeReview.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={reason.trim() === ''}
                        loading={removeReview.isPending}
                        onClick={() => confirmRemove(review)}
                      >
                        Confirm removal
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {reviews.data && reviews.data.totalPages > 1 && (
        <div className="mt-6">
          <Pagination page={page + 1} totalPages={reviews.data.totalPages} onChange={(p) => setPage(p - 1)} />
        </div>
      )}

      <InlineAlert tone="info">
        Hidden reviews are not public yet: they publish when the counterpart
        review arrives or the 14-day window closes. Removing a review withdraws
        it from the listing and recalculates the rating.
      </InlineAlert>
    </div>
  );
};
