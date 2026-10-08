import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, Timer } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useHostDashboard } from '@/features/host/api';
import { PhotoThumb } from '@/components/patterns/PhotoGallery';
import { RatingStars } from '@/components/patterns/Rating';
import { useCountdown } from '@/hooks/useUtilities';
import { useDocumentTitle } from '@/hooks/useSeo';
import { addDays, formatDateRange, nightsBetween, todayIn } from '@/lib/local-date';
import { formatOccupancy, formatRating, formatRelative } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import {
  type Column,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  InlineAlert,
  Input,
  Skeleton,
  StatCard,
  StatusBadge,
  Tooltip,
} from '@/components/ui';
import type { BookingResponse, ListingMetricsResponse } from '@/types/api';

type RangeKey = 'month' | '30d' | '90d' | 'ytd' | 'custom';

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'custom', label: 'Custom' },
];

const MAX_RANGE_DAYS = 366;
const URGENT_REQUEST_MS = 6 * 3_600_000;

function isLocalDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function presetRange(key: RangeKey, today: string): { from: string; to: string } {
  switch (key) {
    case '30d':
      return { from: addDays(today, -29), to: today };
    case '90d':
      return { from: addDays(today, -89), to: today };
    case 'ytd':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'month':
    default:
      return { from: `${today.slice(0, 7)}-01`, to: today };
  }
}

const AttentionCard: React.FC<{
  label: string;
  value: number;
  hint?: React.ReactNode;
  to: string;
  action: string;
}> = ({ label, value, hint, to, action }) => (
  <Card className="flex flex-col p-4">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <p className="tabular mt-1 text-2xl font-semibold text-ink">{value}</p>
    {hint && <div className="mt-1">{hint}</div>}
    <Button asChild variant="outline" size="sm" className="mt-3 self-start">
      <Link to={to}>{action}</Link>
    </Button>
  </Card>
);

const RevenueBars: React.FC<{ listings: ListingMetricsResponse[] }> = ({ listings }) => {
  const highest = Math.max(...listings.map((listing) => listing.revenue), 0);

  return (
    <div className="flex flex-col gap-2">
      {listings.map((listing) => {
        const share = highest > 0 ? Math.max(2, Math.round((listing.revenue / highest) * 100)) : 0;
        return (
          <div key={listing.listingId} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-xs text-muted" title={listing.title}>
              {listing.title}
            </span>
            <span className="h-3 flex-1 overflow-hidden rounded-control bg-neutral-soft">
              <span
                className="block h-3 rounded-control bg-primary"
                style={{ width: `${share}%` }}
              />
            </span>
            <span className="tabular w-20 shrink-0 text-right text-xs text-ink">
              {formatMoney(listing.revenue)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const HostDashboardPage: React.FC = () => {
  useDocumentTitle('Hosting overview');

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const today = todayIn();

  const active: RangeKey = (() => {
    const requested = searchParams.get('range');
    return PRESETS.some((preset) => preset.key === requested) ? (requested as RangeKey) : 'month';
  })();

  const preset = presetRange(active === 'custom' ? 'month' : active, today);
  const from = active === 'custom' && isLocalDate(searchParams.get('from'))
    ? (searchParams.get('from') as string)
    : preset.from;
  const to = active === 'custom' && isLocalDate(searchParams.get('to'))
    ? (searchParams.get('to') as string)
    : preset.to;

  const rangeError =
    to < from
      ? 'The start date must be on or before the end date.'
      : nightsBetween(from, to) + 1 > MAX_RANGE_DAYS
        ? `Choose a range of at most ${MAX_RANGE_DAYS} days.`
        : null;

  const query = useHostDashboard(from, to, rangeError === null);

  const countdown = useCountdown(
    query.data?.oldestPendingRequestExpiry ?? null,
    URGENT_REQUEST_MS
  );

  const [draft, setDraft] = useState({ from, to });
  const [draftError, setDraftError] = useState<string | null>(null);
  useEffect(() => setDraft({ from, to }), [from, to]);

  const choose = (key: RangeKey) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'custom') {
      next.set('range', 'custom');
      if (!isLocalDate(next.get('from'))) next.set('from', addDays(today, -29));
      if (!isLocalDate(next.get('to'))) next.set('to', today);
    } else {
      next.delete('range');
      next.delete('from');
      next.delete('to');
    }
    setSearchParams(next, { replace: true });
  };

  const applyCustom = () => {
    if (draft.to < draft.from) {
      setDraftError('The start date must be on or before the end date.');
      return;
    }
    if (nightsBetween(draft.from, draft.to) + 1 > MAX_RANGE_DAYS) {
      setDraftError(`Choose a range of at most ${MAX_RANGE_DAYS} days.`);
      return;
    }
    setDraftError(null);
    const next = new URLSearchParams(searchParams);
    next.set('range', 'custom');
    next.set('from', draft.from);
    next.set('to', draft.to);
    setSearchParams(next, { replace: true });
  };

  const bookingColumns = useMemo<Column<BookingResponse>[]>(
    () => [
      {
        key: 'reference',
        header: 'Reference',
        render: (row) => <span className="tabular">{row.reference}</span>,
      },
      { key: 'listing', header: 'Listing', render: (row) => row.listing.title },
      { key: 'guest', header: 'Guest', render: (row) => row.guest.firstName },
      {
        key: 'dates',
        header: 'Dates',
        render: (row) => (
          <span className="whitespace-nowrap">{formatDateRange(row.checkIn, row.checkOut)}</span>
        ),
      },
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
    ],
    []
  );

  const listingColumns = useMemo<Column<ListingMetricsResponse>[]>(
    () => [
      {
        key: 'listing',
        header: 'Listing',
        render: (row) => (
          <div className="flex min-w-0 items-center gap-3">
            <PhotoThumb
              src={row.coverPhotoUrl}
              alt={row.title}
              className="h-10 w-14 shrink-0"
            />
            <span className="min-w-0 truncate font-medium text-ink">{row.title}</span>
          </div>
        ),
      },
      { key: 'bookings', header: 'Bookings', numeric: true, render: (row) => row.bookings },
      { key: 'booked', header: 'Booked nights', numeric: true, render: (row) => row.bookedNights },
      {
        key: 'blocked',
        header: 'Blocked nights',
        numeric: true,
        render: (row) => row.blockedNights,
      },
      {
        key: 'occupancy',
        header: 'Occupancy',
        numeric: true,
        render: (row) => formatOccupancy(row.occupancyRate),
      },
      {
        key: 'revenue',
        header: 'Revenue',
        numeric: true,
        render: (row) => formatMoney(row.revenue),
      },
      {
        key: 'rating',
        header: 'Rating',
        numeric: true,
        render: (row) =>
          row.averageRating === null ? (
            <span className="text-muted">New</span>
          ) : (
            <span className="inline-flex items-center justify-end gap-1">
              <RatingStars value={row.averageRating} />
              {formatRating(row.averageRating)}
            </span>
          ),
      },
    ],
    []
  );

  const data = query.data;
  const updated = data ? formatRelative(new Date(query.dataUpdatedAt).toISOString()) : 'just now';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Hosting overview</h1>
          <p className="text-sm text-muted">
            {from} to {to}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted">Updated {updated}</p>
          <Button
            variant="outline"
            size="sm"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((option) => {
            const isActive = active === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => choose(option.key)}
                className={cn(
                  'min-w-[3rem] rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-white'
                    : 'border-line bg-surface text-ink hover:border-primary'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {active === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="dashboard-from" className="block text-xs font-medium text-ink">
                From
              </label>
              <Input
                id="dashboard-from"
                type="date"
                value={draft.from}
                max={draft.to}
                onChange={(event) => setDraft((value) => ({ ...value, from: event.target.value }))}
                className="mt-1 w-auto"
              />
            </div>
            <div>
              <label htmlFor="dashboard-to" className="block text-xs font-medium text-ink">
                To
              </label>
              <Input
                id="dashboard-to"
                type="date"
                value={draft.to}
                min={draft.from}
                onChange={(event) => setDraft((value) => ({ ...value, to: event.target.value }))}
                className="mt-1 w-auto"
              />
            </div>
            <Button variant="primary" size="md" onClick={applyCustom}>
              Apply
            </Button>
          </div>
        )}

        {draftError && <InlineAlert tone="danger">{draftError}</InlineAlert>}
        {rangeError && <InlineAlert tone="danger">{rangeError}</InlineAlert>}
        {!rangeError && (
          <p className="text-xs text-muted">The range covers at most {MAX_RANGE_DAYS} days.</p>
        )}
      </Card>

      {query.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {query.isError && (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      )}

      {data && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Needs your attention</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <AttentionCard
                label="Booking requests"
                value={data.pendingRequests}
                to={`${ROUTES.HOST_BOOKINGS}?tab=requests`}
                action="Review requests"
                hint={
                  data.pendingRequests === 0 ? (
                    <p className="text-xs text-muted">Nothing is waiting on you.</p>
                  ) : data.oldestPendingRequestExpiry === null ? (
                    <p className="text-xs text-muted">
                      Requests are answered in the order they arrive.
                    </p>
                  ) : (
                    <span
                      className={cn(
                        'tabular inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        countdown.expired || countdown.urgent
                          ? 'bg-warning-soft text-warning-text'
                          : 'bg-primary-soft text-primary-dark'
                      )}
                    >
                      <Timer className="h-3.5 w-3.5" aria-hidden />
                      {countdown.expired
                        ? 'The oldest request has expired'
                        : `${countdown.label} left on the oldest request`}
                    </span>
                  )
                }
              />
              <AttentionCard
                label="Check-ins in the next 7 days"
                value={data.upcomingCheckIns}
                to={`${ROUTES.HOST_BOOKINGS}?tab=upcoming`}
                action="Open bookings"
                hint={
                  <p className="text-xs text-muted">
                    Guests arrive at the listing&apos;s check-in time.
                  </p>
                }
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Earnings</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Paid" value={formatMoney(data.earnings.paidTotal)} />
              <StatCard label="Pending" value={formatMoney(data.earnings.pendingTotal)} />
              <StatCard
                label="Held"
                value={formatMoney(data.earnings.heldTotal)}
                hint={
                  <Tooltip content="Held while a dispute is open">
                    <span className="cursor-help underline decoration-dotted">
                      Why is money held?
                    </span>
                  </Tooltip>
                }
              />
              <StatCard
                label="Paid this month"
                value={formatMoney(data.earnings.thisMonthPaid)}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Performance</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                label="Occupancy"
                value={formatOccupancy(data.overallOccupancyRate)}
                hint="Booked nights over the nights you could have sold."
              />
              <StatCard
                label="Average rating"
                value={
                  data.averageRating === null ? (
                    <span className="text-muted">New</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <RatingStars value={data.averageRating} size="md" />
                      {formatRating(data.averageRating)}
                    </span>
                  )
                }
                hint="Across every listing you host."
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Recent bookings</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to={ROUTES.HOST_BOOKINGS}>All bookings</Link>
              </Button>
            </div>
            {data.recentBookings.length === 0 ? (
              <EmptyState
                title="No bookings in this range"
                description="Once a guest books one of your homes it shows up here."
              />
            ) : (
              <DataTable
                columns={bookingColumns}
                rows={data.recentBookings}
                getRowKey={(row) => row.reference}
                caption="Recent bookings"
                onRowClick={(row) => navigate(ROUTES.HOST_BOOKING(row.id))}
              />
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Listings</h2>
            {data.listings.length === 0 ? (
              <EmptyState
                title="You have no listings yet"
                description="Publish your first home and it will appear here with its bookings."
                action={
                  <Button asChild>
                    <Link to={ROUTES.HOST_LISTING_NEW}>Create a listing</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <DataTable
                  columns={listingColumns}
                  rows={data.listings}
                  getRowKey={(row) => row.listingId}
                  caption="Listing performance"
                />
                <Card className="flex flex-col gap-3 p-4">
                  <h3 className="text-sm font-semibold text-ink">Revenue per listing</h3>
                  <RevenueBars listings={data.listings} />
                </Card>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};