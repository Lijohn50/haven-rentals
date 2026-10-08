import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { usePendingReviews } from '@/features/reviews/api';
import { PhotoThumb } from '@/components/patterns/PhotoGallery';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { useDocumentTitle } from '@/hooks/useSeo';
import { formatDate } from '@/lib/local-date';
import { formatDateTimeLocal } from '@/lib/format';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui';

export const ReviewsPage: React.FC = () => {
  useDocumentTitle('Reviews');

  const pending = usePendingReviews();

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Reviews' }]} />
      <div>
        <h1 className="text-2xl font-semibold text-ink">Reviews waiting for you</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Reviews stay private until both sides have written theirs, or until the window closes.
          They cannot be edited once they are in.
        </p>
      </div>

      {pending.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}

      {pending.isError && (
        <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
      )}

      {pending.data && pending.data.length === 0 && (
        <EmptyState
          title="Nothing to review right now"
          description="After a stay finishes you get a reminder here, and the review window stays open for a couple of weeks."
          action={
            <Button asChild>
              <Link to={ROUTES.TRIPS}>Go to your trips</Link>
            </Button>
          }
        />
      )}

      {pending.data && pending.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {pending.data.map((item) => (
            <li key={`${item.bookingId}-${item.reference}`}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row">
                <PhotoThumb
                  src={item.coverPhotoUrl}
                  alt={item.listingTitle}
                  className="aspect-[4/3] w-full shrink-0 sm:h-28 sm:w-40"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 className="truncate text-base font-semibold text-ink">{item.listingTitle}</h2>
                  <p className="tabular text-xs text-muted">Reference {item.reference}</p>
                  <p className="mt-1 text-sm text-ink">Stay ended {formatDate(item.checkOut)}</p>
                  <p className="text-xs text-muted">
                    Window closes {formatDateTimeLocal(item.deadline)}
                  </p>
                  <div className="mt-3">
                    <Button asChild size="sm">
                      <Link to={ROUTES.TRIP_REVIEW(item.reference)}>Write review</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
