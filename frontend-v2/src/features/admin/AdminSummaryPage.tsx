import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BarChart3, ClipboardList, Gavel, Table2 } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useAdminPendingListings, useAdminSummary } from '@/features/host/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Skeleton,
  StatCard,
  StatusBadge,
  type Column,
  type StatusKind,
} from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { addDays, dayNumber, formatDate, todayIn } from '@/lib/local-date';
import {
  bookingStatus,
  disputeStatus,
  statusEntry,
  type StatusEntry,
  type Tone,
} from '@/lib/status';
import type { CityStats } from '@/types/api';

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;

const TONE_BAR: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-neutral',
};

interface StatusRow {
  status: string;
  entry: StatusEntry;
  count: number;
}

function toRows(counts: Record<string, number>, map: Record<string, StatusEntry>): StatusRow[] {
  return Object.entries(counts)
    .map(([status, count]) => ({ status, count, entry: statusEntry(map, status) }))
    .sort((a, b) => b.count - a.count);
}

/** Bars are a ratio between server counts; no business figure is computed here. */
const StatusBars: React.FC<{
  rows: StatusRow[];
  kind: StatusKind;
  emptyLabel: string;
}> = ({ rows, kind, emptyLabel }) => {
  const [asTable, setAsTable] = useState(false);
  const max = rows.reduce((highest, row) => Math.max(highest, row.count), 0);

  if (rows.length === 0) return <p className="text-sm text-muted">{emptyLabel}</p>;

  const columns: Column<StatusRow>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} kind={kind} />,
    },
    {
      key: 'count',
      header: 'Count',
      numeric: true,
      render: (row) => <span className="tabular">{row.count}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={asTable}
          onClick={() => setAsTable((value) => !value)}
        >
          {asTable ? (
            <BarChart3 className="h-4 w-4" aria-hidden />
          ) : (
            <Table2 className="h-4 w-4" aria-hidden />
          )}
          {asTable ? 'Show bars' : 'Show as a table'}
        </Button>
      </div>

      {asTable ? (
        <DataTable
          caption="Counts by status"
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.status}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.status} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-sm text-ink">{row.entry.label}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-control bg-bg">
                <span
                  className={`block h-full rounded-control ${TONE_BAR[row.entry.tone]}`}
                  style={{ width: `${max > 0 ? Math.round((row.count / max) * 100) : 0}%` }}
                />
              </span>
              <span className="tabular w-10 shrink-0 text-right text-sm text-muted">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AdminSummaryPage: React.FC = () => {
  useDocumentTitle('Platform summary');

  const [params, setParams] = useSearchParams();
  const today = todayIn();
  const defaultFrom = addDays(today, -(DEFAULT_RANGE_DAYS - 1));
  const from = params.get('from') ?? defaultFrom;
  const to = params.get('to') ?? today;
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  const rangeInverted = from > to;
  const rangeTooLong = dayNumber(to) - dayNumber(from) > MAX_RANGE_DAYS;

  const summary = useAdminSummary(from, to);
  const pending = useAdminPendingListings(0);

  const bookingRows = useMemo(
    () => toRows(summary.data?.bookingsByStatus ?? {}, bookingStatus),
    [summary.data]
  );
  const disputeRows = useMemo(
    () => toRows(summary.data?.disputesByStatus ?? {}, disputeStatus),
    [summary.data]
  );

  const cities = summary.data?.topCities ?? [];
  const isEmpty =
    bookingRows.length === 0 && disputeRows.length === 0 && cities.length === 0;

  const applyRange = (nextFrom: string, nextTo: string) => {
    const next = new URLSearchParams(params);
    next.set('from', nextFrom);
    next.set('to', nextTo);
    setParams(next, { replace: true });
  };

  const applyPreset = (days: number) => {
    const end = todayIn();
    const start = addDays(end, -(days - 1));
    applyRange(start, end);
  };

  const cityColumns: Column<CityStats>[] = [
    {
      key: 'city',
      header: 'City',
      render: (row) => <span className="font-medium text-ink">{row.city}</span>,
    },
    {
      key: 'bookings',
      header: 'Bookings',
      numeric: true,
      render: (row) => <span className="tabular">{row.bookingsCount}</span>,
    },
    {
      key: 'revenue',
      header: 'Gross value',
      numeric: true,
      render: (row) => <span className="tabular">{formatMoney(row.totalGmv)}</span>,
    },
  ];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: ROUTES.ADMIN_HOME }, { label: 'Summary' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Platform summary</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Every figure is calculated by the server for the selected range. A range cannot be longer
          than {MAX_RANGE_DAYS} days.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor="summary-from" className="w-40">
            <Input
              id="summary-from"
              type="date"
              value={draftFrom}
              max={to}
              onChange={(event) => setDraftFrom(event.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="summary-to" className="w-40">
            <Input
              id="summary-to"
              type="date"
              value={draftTo}
              min={from}
              onChange={(event) => setDraftTo(event.target.value)}
            />
          </Field>
          <Button
            disabled={rangeInverted || rangeTooLong}
            onClick={() => applyRange(draftFrom, draftTo)}
          >
            Apply range
          </Button>
          <div className="flex flex-wrap gap-1">
            {[7, 30, 90, 365].map((days) => (
              <Button key={days} variant="outline" size="sm" onClick={() => applyPreset(days)}>
                Last {days} days
              </Button>
            ))}
          </div>
        </div>

        {(rangeInverted || rangeTooLong) && (
          <InlineAlert tone="warning" className="mt-3">
            {rangeInverted
              ? 'The start date must be on or before the end date.'
              : `Pick a range of ${MAX_RANGE_DAYS} days or fewer.`}
          </InlineAlert>
        )}

        <p className="mt-3 text-xs text-muted">
          Showing {formatDate(from)} – {formatDate(to)}
        </p>
      </Card>

      {summary.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      )}

      {summary.isError && (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      )}

      {summary.data && isEmpty && (
        <EmptyState
          title="No activity in this range"
          description="No bookings or disputes were recorded between these dates. Try a wider range."
        />
      )}

      {summary.data && !isEmpty && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Gross merchandise value"
              value={formatMoney(summary.data.grossMerchandiseValue)}
              tone="accent"
            />
            <StatCard
              label="Platform revenue"
              value={formatMoney(summary.data.platformRevenue)}
              tone="accent"
            />
            <StatCard
              label="New users"
              value={<span className="tabular">{summary.data.newUsers}</span>}
            />
            <StatCard
              label="New listings"
              value={<span className="tabular">{summary.data.newListings}</span>}
            />
            <StatCard
              label="Avg host response"
              value={
                <span className="tabular">
                  {summary.data.averageHostResponseHours === null
                    ? '—'
                    : `${summary.data.averageHostResponseHours.toFixed(1)} h`}
                </span>
              }
              hint="Time for a host to answer a request"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Bookings by status
              </h2>
              <StatusBars
                rows={bookingRows}
                kind="booking"
                emptyLabel="No bookings were created in this range."
              />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Disputes by status
              </h2>
              <StatusBars
                rows={disputeRows}
                kind="dispute"
                emptyLabel="No disputes were opened in this range."
              />
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Top cities
            </h2>
            {cities.length === 0 ? (
              <p className="text-sm text-muted">No bookings were confirmed in this range.</p>
            ) : (
              <DataTable
                caption="Top cities by bookings"
                columns={cityColumns}
                rows={cities}
                getRowKey={(row) => row.city}
              />
            )}
          </Card>
        </>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Work queues
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-auto justify-between py-3">
            <Link to={ROUTES.ADMIN_LISTINGS}>
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" aria-hidden />
                Pending listings
                {pending.data && (
                  <span className="tabular rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-text">
                    {pending.data.totalElements}
                  </span>
                )}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto justify-between py-3">
            <Link to={`${ROUTES.SUPPORT_DISPUTES}?status=OPEN`}>
              <span className="flex items-center gap-2">
                <Gavel className="h-4 w-4" aria-hidden />
                Open disputes
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
        {pending.isError && (
          <InlineAlert tone="warning" className="mt-3">
            The queue size could not be loaded, but the links still work.
          </InlineAlert>
        )}
      </Card>
    </div>
  );
};