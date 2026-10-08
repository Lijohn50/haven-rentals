import React, { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { usePayouts, usePayoutSummary } from '@/features/reviews/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { formatInstant, pluralize } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import {
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  Tooltip,
} from '@/components/ui';
import type { PayoutResponse, PayoutStatus } from '@/types/api';

const STATUSES: { value: PayoutStatus | ''; label: string }[] = [
  { value: '', label: 'All payouts' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'HELD', label: 'Held' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const HostPayoutsPage: React.FC = () => {
  useDocumentTitle('Payouts');

  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('status');
  const status = STATUSES.some((option) => option.value === requested)
    ? ((requested || '') as PayoutStatus | '')
    : '';
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const summary = usePayoutSummary();
  const payouts = usePayouts(status === '' ? undefined : status);

  const change = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!('page' in patch)) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const size = payouts.data?.size ?? 20;
  const rows = payouts.data?.content ?? [];
  const visible = rows.slice((page - 1) * size, page * size);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));

  const columns: Column<PayoutResponse>[] = [
    {
      key: 'booking',
      header: 'Booking',
      render: (row) => (
        <Link className="underline" to={ROUTES.HOST_BOOKING(row.bookingId)}>
          Booking #{row.bookingId}
        </Link>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (row) => formatMoney(row.amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} kind="payout" />,
    },
    {
      key: 'scheduledFor',
      header: 'Scheduled for',
      render: (row) => <span className="whitespace-nowrap">{formatInstant(row.scheduledFor)}</span>,
    },
    {
      key: 'paidAt',
      header: 'Paid at',
      render: (row) => <span className="whitespace-nowrap">{formatInstant(row.paidAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-ink">Payouts</h1>

      {summary.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {summary.isError && (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      )}

      {summary.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Pending"
            value={formatMoney(summary.data.pendingAmount)}
            hint="Booked but not released yet."
          />
          <StatCard
            label="Paid"
            value={formatMoney(summary.data.paidAmount)}
            hint="Paid out to you."
          />
          <StatCard
            label="Held"
            value={formatMoney(summary.data.heldAmount)}
            hint={
              <Tooltip content="Held while a dispute is open">
                <span className="cursor-help underline decoration-dotted">Why is money held?</span>
              </Tooltip>
            }
          />
          <StatCard
            label="Scheduled"
            value={summary.data.scheduledCount}
            hint="Payouts waiting for their release date."
          />
        </div>
      )}

      <div className="flex items-start gap-3 rounded-control bg-info-soft px-4 py-3 text-sm text-info-text">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Payouts are scheduled {BRAND.payoutDelayHours} hours after check-in.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Payout history</h2>
        <div className="w-full max-w-[12rem]">
          <label htmlFor="payout-status" className="sr-only">
            Filter payouts by status
          </label>
          <Select
            id="payout-status"
            value={status}
            onChange={(event) => change({ status: event.target.value })}
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {payouts.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {payouts.isError && (
        <ErrorState error={payouts.error} onRetry={() => void payouts.refetch()} />
      )}

      {payouts.data && rows.length === 0 && (
        <EmptyState
          title="No payouts here yet"
          description={
            status === ''
              ? 'Once a stay is confirmed the payout shows up here with its release date.'
              : 'No payouts with this status. Try another filter.'
          }
        />
      )}

      {visible.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {pluralize(payouts.data?.totalElements ?? rows.length, 'payout')}
          </p>
          <DataTable
            columns={columns}
            rows={visible}
            getRowKey={(row) => row.id}
            caption="Payouts"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(value) => change({ page: String(value) })}
          />
        </>
      )}
    </div>
  );
};