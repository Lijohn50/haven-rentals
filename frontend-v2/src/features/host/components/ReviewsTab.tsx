import React, { useState } from 'react';
import { useListingReviews } from '@/features/listings/api';
import { useReviewSummary } from '@/features/ai/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Card, ErrorState, Pagination, Skeleton } from '@/components/ui';
import { RatingStars } from '@/components/patterns/Rating';
import { formatAbsolute, formatRating } from '@/lib/format';
import type { ListingResponse } from '@/types/api';

export const ReviewsTab: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  const [sort, setSort] = useState<'NEWEST' | 'HIGHEST' | 'LOWEST'>('NEWEST');
  const [page, setPage] = useState(0);
  const reviews = useListingReviews(listing.id, sort, page);
  const summary = useReviewSummary(listing.id, listing.reviewCount);

  if (reviews.isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (reviews.error) {
    return (
      <Card className="p-6">
        <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />
      </Card>
    );
  }

  const data = reviews.data;
  const totalPages = data?.totalPages ?? 0;

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Guest reviews</h2>
          <p className="mt-0.5 text-sm text-muted">
            {listing.reviewCount} review{listing.reviewCount === 1 ? '' : 's'} ·{' '}
            <span className="tabular">{formatRating(listing.averageRating)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as typeof sort); setPage(0); }}
            className="rounded-control border border-line bg-bg px-3 py-1.5 text-sm text-ink"
          >
            <option value="NEWEST">Newest</option>
            <option value="HIGHEST">Highest</option>
            <option value="LOWEST">Lowest</option>
          </select>
        </div>
      </div>

      {summary.data && (
        <div className="mt-4 rounded-control bg-primary-soft/40 p-3 text-sm text-primary-dark">
          {summary.data.summary}
        </div>
      )}

      {!data || data.content.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No published reviews yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {data.content.map((review) => (
            <li key={review.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{review.reviewerName}</p>
                  <p className="text-xs text-muted">{formatAbsolute(review.publishedAt)}</p>
                </div>
                <RatingStars value={review.overallRating} />
              </div>
              {review.comment && <p className="mt-2 text-sm text-ink">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination page={page + 1} totalPages={totalPages} onChange={(p) => setPage(p - 1)} />
        </div>
      )}
    </Card>
  );
};
