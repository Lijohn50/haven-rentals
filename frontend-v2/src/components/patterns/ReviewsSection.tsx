import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/errors';
import { useListingReviews } from '@/features/listings/api';
import { reviewsApi } from '@/features/reviews/api';
import { useAuth } from '@/providers/AuthProvider';
import { formatDateTimeLocal, formatRating } from '@/lib/format';
import { BRAND } from '@/config/brand';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Pagination,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { RatingStars } from '@/components/patterns/Rating';
import type { ReviewResponse, ReviewSort } from '@/types/api';

const PAGE_SIZE = 20;

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'NEWEST', label: 'Newest first' },
  { value: 'HIGHEST', label: 'Highest rated' },
  { value: 'LOWEST', label: 'Lowest rated' },
];

const subRatingLabels: { read: (review: ReviewResponse) => number | null; label: string }[] = [
  { read: (review) => review.cleanlinessRating, label: 'Cleanliness' },
  { read: (review) => review.communicationRating, label: 'Communication' },
  { read: (review) => review.accuracyRating, label: 'Accuracy' },
];

function RemoveReviewDialog({
  review,
  open,
  onOpenChange,
  onRemoved,
}: {
  review: ReviewResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => reviewsApi.removeByAdmin(review.id, reason.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listingReviews'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.listing(review.listingId) });
      setReason('');
      onRemoved();
    },
    onError: (caught) => {
      if (caught instanceof ApiError) setError(caught.detail);
      else setError('That review could not be removed.');
    },
  });

  const trimmed = reason.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Remove this review</DialogTitle>
        <DialogDescription>
          The review is hidden from the listing page. The reason is stored in the audit log and must be 10 to 500
          characters.
        </DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (trimmed.length < 10 || trimmed.length > 500) {
              setError('Write between 10 and 500 characters.');
              return;
            }
            remove.mutate();
          }}
        >
          <Field label="Reason" htmlFor="remove-review-reason" required error={error}>
            <Textarea
              id="remove-review-reason"
              rows={4}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Personal information shared in the review"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={remove.isPending}>
              Remove review
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const ReviewsSection: React.FC<{
  listingId: number;
  reviewCount: number;
  averageRating: number | null;
}> = ({ listingId, reviewCount, averageRating }) => {
  const { isAdmin } = useAuth();
  const [sort, setSort] = useState<ReviewSort>('NEWEST');
  const [page, setPage] = useState(0);
  const [removing, setRemoving] = useState<ReviewResponse | null>(null);

  const reviews = useListingReviews(listingId, sort, page);

  const changeSort = (next: ReviewSort) => {
    setSort(next);
    setPage(0);
  };

  return (
    <section id="reviews" aria-label="Reviews" className="scroll-mt-32 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {reviewCount > 0 ? (
              <>
                <Star className="mr-1 inline h-4 w-4 fill-ink" aria-hidden />
                {formatRating(averageRating)} · {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
              </>
            ) : (
              'Reviews'
            )}
          </h2>
          <p className="text-sm text-muted">
            {reviewCount > 0
              ? 'Guests and hosts review each other, and both sides are revealed together.'
              : 'This home has no reviews yet.'}
          </p>
        </div>
        <div className="w-48">
          <label htmlFor="review-sort" className="sr-only">
            Sort reviews
          </label>
          <Select
            id="review-sort"
            value={sort}
            onChange={(event) => changeSort(event.target.value as ReviewSort)}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {reviews.isPending && (
        <div className="mt-4 flex flex-col gap-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex flex-col gap-2 border-t border-line pt-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      )}

      {reviews.isError && (
        <ErrorState
          className="mt-4"
          title="Reviews could not be loaded"
          error={reviews.error}
          onRetry={() => void reviews.refetch()}
        />
      )}

      {reviews.data && reviews.data.content.length === 0 && (
        <EmptyState
          className="mt-4"
          title="New"
          description="Nobody has reviewed this home yet. Guests can review from their trip page after a stay."
        />
      )}

      {reviews.data && reviews.data.content.length > 0 && (
        <ul className="mt-4 flex flex-col">
          {reviews.data.content.map((review) => (
            <li key={review.id} className="border-t border-line py-4 first:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{review.reviewerName}</p>
                  <div className="flex items-center gap-2">
                    <RatingStars value={review.overallRating} />
                    <span className="text-xs text-muted">
                      {formatRating(review.overallRating)} out of 5
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted">
                    {review.direction === 'HOST_TO_GUEST' ? 'Host review' : 'Guest review'} ·{' '}
                    {formatDateTimeLocal(review.publishedAt)}
                  </p>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(review)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {review.comment && (
                <p className="mt-2 whitespace-pre-line text-sm text-ink">{review.comment}</p>
              )}

              <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                {subRatingLabels.map(({ read, label }) => {
                  const value = read(review);
                  if (value === null || value === undefined) return null;
                  return (
                    <div key={label} className="flex items-center gap-1 text-xs text-muted">
                      <dt>{label}</dt>
                      <dd className="tabular font-medium text-ink">{value.toFixed(1)}</dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {reviews.data && (
        <Pagination
          className="mt-2"
          page={page + 1}
          totalPages={reviews.data.totalPages}
          onChange={(next) => {
            setPage(Math.max(0, next - 1));
            document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      )}

      <p className="mt-4 text-xs text-muted">
        Reviews can be left {BRAND.reviewWindowDays} days after check-out. A question about a review? Contact
        support.
      </p>

      {removing && (
        <RemoveReviewDialog
          review={removing}
          open
          onOpenChange={(next) => {
            if (!next) setRemoving(null);
          }}
          onRemoved={() => setRemoving(null)}
        />
      )}
    </section>
  );
};