import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useHostReviews, useHostReviewExchanges } from '@/features/host/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from '@/components/ui';
import { PhotoThumb } from '@/components/patterns/PhotoGallery';
import { RatingStars } from '@/components/patterns/Rating';
import { ROUTES } from '@/config/routes';
import { formatAbsolute, formatDateTimeLocal } from '@/lib/format';
import { formatDate } from '@/lib/local-date';
import type { ReviewSort } from '@/types/api';

export const HostReviewsPage: React.FC = () => {
  useDocumentTitle('Reviews');

  const [sort, setSort] = useState<ReviewSort>('NEWEST');
  const [page, setPage] = useState(0);
  const reviews = useHostReviews(sort, page);
  const exchanges = useHostReviewExchanges();

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Hosting', to: ROUTES.HOST_DASHBOARD }, { label: 'Reviews' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Reviews</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Guest reviews of your listings, and stays where a review is still
          waiting on either side.
        </p>
      </div>

      <section aria-labelledby="exchange-heading">
        <h2 id="exchange-heading" className="text-lg font-semibold text-ink">
          Awaiting a review
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          Reviews stay private until both sides have written theirs, or until
          the window closes.
        </p>

        {exchanges.isLoading && (
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {exchanges.isError && (
          <ErrorState error={exchanges.error} onRetry={() => void exchanges.refetch()} />
        )}

        {exchanges.data && exchanges.data.length === 0 && (
          <p className="mt-4 text-sm text-muted">
            Every completed stay has both reviews, or the window has closed.
          </p>
        )}

        {exchanges.data && exchanges.data.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {exchanges.data.map((item) => (
              <li key={item.bookingId}>
                <Card className="flex flex-col gap-4 p-4 sm:flex-row">
                  <PhotoThumb
                    src={item.coverPhotoUrl}
                    alt={item.listingTitle}
                    className="aspect-[4/3] w-full shrink-0 sm:h-28 sm:w-40"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="truncate text-base font-semibold text-ink">
                      {item.listingTitle}
                    </h3>
                    <p className="tabular text-xs text-muted">
                      Booking {item.reference} · stay ended {formatDate(item.checkOut)}
                    </p>
                    <p className="text-xs text-muted">
                      Window closes {formatDateTimeLocal(item.deadline)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={
                          item.guestReviewed
                            ? 'rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark'
                            : 'rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text'
                        }
                      >
                        {item.guestReviewed ? 'Guest reviewed' : 'Guest review pending'}
                      </span>
                      <span
                        className={
                          item.hostReviewed
                            ? 'rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark'
                            : 'rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text'
                        }
                      >
                        {item.hostReviewed ? 'Your review sent' : 'You still owe a review'}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Link
                        to={ROUTES.HOST_BOOKING(item.bookingId)}
                        className="text-sm text-primary underline underline-offset-2"
                      >
                        View booking
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reviews-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="reviews-heading" className="text-lg font-semibold text-ink">
              Guest reviews
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Published reviews guests left for your listings.
            </p>
          </div>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as ReviewSort); setPage(0); }}
            className="rounded-control border border-line bg-bg px-3 py-1.5 text-sm text-ink"
            aria-label="Sort reviews"
          >
            <option value="NEWEST">Newest</option>
            <option value="HIGHEST">Highest</option>
            <option value="LOWEST">Lowest</option>
          </select>
        </div>

        {reviews.isLoading && (
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {reviews.isError && (
          <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />
        )}

        {reviews.data && reviews.data.content.length === 0 && (
          <EmptyState
            title="No published reviews yet"
            description="Reviews appear here after the stay ends and both sides have written theirs, or the window closes."
          />
        )}

        {reviews.data && reviews.data.content.length > 0 && (
          <ul className="mt-4 flex flex-col gap-4">
            {reviews.data.content.map((review) => (
              <li key={review.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{review.reviewerName}</p>
                    <p className="text-xs text-muted">
                      {review.listingTitle} · {formatAbsolute(review.publishedAt)}
                    </p>
                  </div>
                  <RatingStars value={review.overallRating} />
                </div>
                {review.cleanlinessRating !== null && (
                  <p className="mt-1 text-xs text-muted">
                    Cleanliness {review.cleanlinessRating}/5 · Communication{' '}
                    {review.communicationRating}/5 · Accuracy {review.accuracyRating}/5
                  </p>
                )}
                {review.comment && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {reviews.data && reviews.data.totalPages > 1 && (
          <div className="mt-6">
            <Pagination page={page + 1} totalPages={reviews.data.totalPages} onChange={(p) => setPage(p - 1)} />
          </div>
        )}
      </section>

      <div className="rounded-card border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-muted">
            Ratings feed your listing's average only after the review is
            published. Private reviews never count until then.
          </p>
        </div>
      </div>
    </div>
  );
};
