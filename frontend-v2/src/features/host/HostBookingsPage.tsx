import React, { useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { ROUTES } from '@/config/routes';
import { bookingsApi } from '@/features/booking/api';
import { useHostListings } from '@/features/listings/api';
import { formatDeadline } from '@/components/patterns/Countdown';
import { useDocumentTitle } from '@/hooks/useSeo';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { formatDateRange } from '@/lib/local-date';
import { formatMoney } from '@/lib/money';
import {
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import type { BookingResponse, BookingStatus } from '@/types/api';

const PAGE_SIZE = 20;
const URGENT_RESPONSE_MS = 6 * 3_600_000;

type TabKey = 'requests' | 'upcoming' | 'past' | 'other';

const TABS: { key: TabKey; label: string; status: BookingStatus | null }[] = [
  { key: 'requests', label: 'Requests', status: 'PENDING_APPROVAL' },
  { key: 'upcoming', label: 'Upcoming', status: 'CONFIRMED' },
  { key: 'past', label: 'Past', status: 'COMPLETED' },
  { key: 'other', label: 'Cancelled and other', status: null },
];

const TimeLeft: React.FC<{ expiresAt: string | null }> = ({ expiresAt }) => {
  if (!expiresAt) return <span className="text-muted">—</span>;
  const urgent = new Date(expiresAt).getTime() - Date.now() <= URGENT_RESPONSE_MS;

  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        urgent ? 'bg-warning-soft text-warning-text' : 'bg-primary-soft text-primary-dark'
      )}
    >
      {formatDeadline(expiresAt)} left to respond
    </span>
  );
};

function useHostBookings(params: {
  status?: BookingStatus;
  listingId?: number;
  page: number;
  size: number;
}) {
  return useQuery({
    queryKey: queryKeys.hostBookings(params),
    queryFn: () => bookingsApi.hostBookings(params),
    placeholderData: (previous) => previous,
  });
}

export const HostBookingsPage: React.FC = () => {
  useDocumentTitle('Bookings');

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const requestedTab = searchParams.get('tab');
  const tab: TabKey = TABS.some((item) => item.key === requestedTab)
    ? (requestedTab as TabKey)
    : 'requests';
  const listingParam = searchParams.get('listingId');
  const listingId = listingParam && /^\d+$/.test(listingParam) ? Number(listingParam) : undefined;
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const active = TABS.find((item) => item.key === tab) ?? TABS[0];
  const query = useHostBookings({
    status: active.status ?? undefined,
    listingId,
    page: page - 1,
    size: PAGE_SIZE,
  });
  const listings = useHostListings();

  const change = useCallback(
    (patch: Record<string, string | null>, keepPage = false) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!keepPage) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const rows = query.data?.content ?? [];

  const columns: Column<BookingResponse>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => <span className="tabular">{row.reference}</span>,
    },
    { key: 'guest', header: 'Guest', render: (row) => row.guest.firstName },
    { key: 'listing', header: 'Listing', render: (row) => row.listing.title },
    {
      key: 'dates',
      header: 'Dates',
      render: (row) => (
        <span className="whitespace-nowrap">{formatDateRange(row.checkIn, row.checkOut)}</span>
      ),
    },
    { key: 'nights', header: 'Nights', numeric: true, render: (row) => row.nights },
    {
      key: 'payout',
      header: 'Your payout',
      numeric: true,
      render: (row) => formatMoney(row.hostPayoutAmount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} kind="booking" viewer="host" />,
    },
    ...(active.status === 'PENDING_APPROVAL'
      ? [
          {
            key: 'remaining',
            header: 'Time remaining',
            render: (row: BookingResponse) => <TimeLeft expiresAt={row.expiresAt} />,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Bookings</h1>
        <div className="w-full max-w-xs">
          <label htmlFor="host-bookings-listing" className="sr-only">
            Filter by listing
          </label>
          <Select
            id="host-bookings-listing"
            value={listingId === undefined ? '' : String(listingId)}
            onChange={(event) => change({ listingId: event.target.value || null })}
          >
            <option value="">All listings</option>
            {(listings.data?.content ?? []).map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => change({ tab: value })}>
        <TabsList>
          {TABS.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((item) => (
          <TabsContent key={item.key} value={item.key}>
            {query.isLoading && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            )}

            {query.isError && (
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            )}

            {query.data && rows.length === 0 && (
              <EmptyState
                title={item.key === 'requests' ? 'No booking requests' : 'Nothing here yet'}
                description={
                  item.key === 'requests'
                    ? 'Requests arrive here with 24 hours to respond, and you are notified.'
                    : 'Bookings in this state will show up here.'
                }
              />
            )}

            {rows.length > 0 && (
              <>
                <p className="mb-3 text-sm text-muted" aria-live="polite">
                  {pluralize(query.data?.totalElements ?? rows.length, 'booking')}
                </p>
                <DataTable
                  columns={columns}
                  rows={rows}
                  getRowKey={(row) => row.reference}
                  caption={item.label}
                  onRowClick={(row) => navigate(ROUTES.HOST_BOOKING(row.id))}
                />
                <Pagination
                  className="mt-6"
                  page={page}
                  totalPages={query.data?.totalPages ?? 1}
                  onChange={(value) => change({ page: String(value) }, true)}
                />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {listingId !== undefined && (
        <p className="text-xs text-muted">
          Filtered to one listing.{' '}
          <Link className="underline" to={ROUTES.HOST_BOOKINGS}>
            Show all bookings
          </Link>
        </p>
      )}
    </div>
  );
};