import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useTrips } from '@/features/booking/api';
import { usePendingReviews } from '@/features/reviews/api';
import { CountdownPill } from '@/components/patterns/Countdown';
import { PhotoThumb } from '@/components/patterns/PhotoGallery';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { useCountdown } from '@/hooks/useUtilities';
import { useDocumentTitle } from '@/hooks/useSeo';
import { formatDateRange } from '@/lib/local-date';
import { formatDateTimeLocal } from '@/lib/format';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import type { BookingResponse, MyTripsResponse } from '@/types/api';

type TabKey = 'upcoming' | 'past' | 'cancelled';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
];

const EMPTY: Record<TabKey, { title: string; description: string }> = {
  upcoming: {
    title: 'No upcoming trips',
    description: 'When you book a home it appears here, with everything you need for check-in.',
  },
  past: {
    title: 'No past stays',
    description: 'Stays you have completed show up here, and you can review them from here.',
  },
  cancelled: {
    title: 'Nothing cancelled',
    description: 'Cancelled bookings and refunds are kept here so the refund stays traceable.',
  },
};

const TripCard: React.FC<{ booking: BookingResponse }> = ({ booking }) => {
  // The scheduler flips an expired hold within a minute; the card must not wait for it.
  const hold = useCountdown(booking.status === 'PENDING_PAYMENT' ? booking.expiresAt : null);
  const holdExpired =
    booking.status === 'PENDING_PAYMENT' && (booking.expiresAt === null || hold.expired);

  const action = !holdExpired && booking.allowedActions.includes('PAY')
    ? 'pay'
    : booking.allowedActions.includes('REVIEW')
      ? 'review'
      : 'view';

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <PhotoThumb
          src={booking.listing.coverPhotoUrl}
          alt={booking.listing.title}
          className="aspect-[4/3] w-full shrink-0 sm:h-32 sm:w-48"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 truncate text-base font-semibold text-ink">
              <Link to={ROUTES.TRIP(booking.reference)} className="hover:underline">
                {booking.listing.title}
              </Link>
            </h2>
            {holdExpired ? (
              <Badge tone="neutral">Expired</Badge>
            ) : (
              <StatusBadge status={booking.status} kind="booking" viewer="guest" />
            )}
          </div>

          <p className="text-sm text-muted">
            {booking.listing.city}, {booking.listing.country}
          </p>
          <p className="mt-1 text-sm text-ink">
            {formatDateRange(booking.checkIn, booking.checkOut)} · {booking.nights}{' '}
            {booking.nights === 1 ? 'night' : 'nights'}
          </p>
          <p className="tabular mt-0.5 text-xs text-muted">Reference {booking.reference}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {action === 'pay' && (
              <>
                <CountdownPill target={booking.expiresAt} />
                <Button asChild variant="accent" size="sm">
                  <Link to={ROUTES.TRIP_PAY(booking.reference)}>Complete payment</Link>
                </Button>
              </>
            )}
            {action === 'review' && (
              <Button asChild variant="primary" size="sm">
                <Link to={ROUTES.TRIP_REVIEW(booking.reference)}>Write a review</Link>
              </Button>
            )}
            {action === 'view' && (
              <Button asChild variant="outline" size="sm">
                <Link to={ROUTES.TRIP(booking.reference)}>View trip</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export const TripsPage: React.FC = () => {
  useDocumentTitle('Your trips');

  const [searchParams, setSearchParams] = useSearchParams();
  const trips = useTrips();
  const pendingReviews = usePendingReviews();

  const param = searchParams.get('tab');
  const tab: TabKey = param === 'past' || param === 'cancelled' ? param : 'upcoming';

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'upcoming') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  const data: MyTripsResponse | undefined = trips.data;
  const counts = {
    upcoming: data?.upcoming.length ?? 0,
    past: data?.past.length ?? 0,
    cancelled: data?.cancelled.length ?? 0,
  };

  const reviewCount = pendingReviews.data?.length ?? 0;
  const reviewDeadline = pendingReviews.data
    ? [...pendingReviews.data].sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline))[0]
        ?.deadline
    : undefined;

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Trips' }]} />
      <h1 className="text-2xl font-semibold text-ink">Your trips</h1>

      {reviewCount > 0 && (
        <Banner
          tone="info"
          title={`${reviewCount} ${reviewCount === 1 ? 'stay is' : 'stays are'} waiting for your review`}
          action={
            <Button asChild size="sm" variant="outline">
              <Link to={ROUTES.REVIEWS}>Write a review</Link>
            </Button>
          }
        >
          {reviewDeadline
            ? `The window closes ${formatDateTimeLocal(reviewDeadline)}.`
            : 'Reviews stay private until both sides have written theirs.'}
        </Banner>
      )}

      {trips.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      {trips.isError && <ErrorState error={trips.error} onRetry={() => void trips.refetch()} />}

      {data && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {TABS.map((item) => (
              <TabsTrigger key={item.key} value={item.key}>
                {item.label}
                <span className="tabular ml-1.5 text-xs text-muted">{counts[item.key]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((item) => {
            const rows = data[item.key];
            return (
              <TabsContent key={item.key} value={item.key}>
                {rows.length === 0 ? (
                  <EmptyState
                    title={EMPTY[item.key].title}
                    description={EMPTY[item.key].description}
                    action={
                      <Button asChild>
                        <Link to={ROUTES.SEARCH}>Start exploring</Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {rows.map((booking) => (
                      <li key={booking.reference}>
                        <TripCard booking={booking} />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
};
