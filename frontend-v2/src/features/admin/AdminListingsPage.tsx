import React, { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useAdminPendingListings } from '@/features/host/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { formatDateTimeLocal, formatRelative } from '@/lib/format';
import { propertyTypeLabels } from '@/lib/status';
import type { ListingSummaryResponse } from '@/types/api';

export const AdminListingsPage: React.FC = () => {
  useDocumentTitle('Listing moderation');

  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const queue = useAdminPendingListings(page);
  const [lookup, setLookup] = useState('');

  const goToPage = useCallback(
    (next: number) => {
      const updated = new URLSearchParams(params);
      updated.set('page', String(next));
      setParams(updated, { replace: true });
    },
    [params, setParams]
  );

  // There is no admin listing search, so an id box is the only way in (architecture 13.3).
  const openById = (event: React.FormEvent) => {
    event.preventDefault();
    const id = Number(lookup.trim());
    if (!Number.isInteger(id) || id <= 0) return;
    navigate(ROUTES.ADMIN_LISTING(id));
  };

  // The queue DTO carries no host, so the host column stays empty by contract.
  const columns: Column<ListingSummaryResponse>[] = [
    {
      key: 'id',
      header: 'Id',
      numeric: true,
      render: (row) => <span className="tabular">{row.id}</span>,
      className: 'w-16',
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{row.title}</p>
          <p className="text-xs text-muted">{propertyTypeLabels[row.propertyType]}</p>
        </div>
      ),
    },
    {
      key: 'host',
      header: 'Host',
      render: () => (
        <span className="text-muted" title="Not returned by the queue endpoint">
          —
        </span>
      ),
    },
    {
      key: 'city',
      header: 'City',
      render: (row) => (
        <span className="whitespace-nowrap">
          {row.city}
          {row.country ? `, ${row.country}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} kind="listing" />,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (row) => (
        <div className="whitespace-nowrap">
          <div className="text-ink">{formatDateTimeLocal(row.createdAt)}</div>
          <div className="text-xs text-muted">{formatRelative(row.createdAt)}</div>
        </div>
      ),
    },
  ];

  const lookupInvalid = lookup.trim() !== '' && !/^\d+$/.test(lookup.trim());

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: ROUTES.ADMIN_HOME }, { label: 'Listings' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Listing moderation</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Oldest submissions first. Approving a listing publishes it to search immediately.
        </p>
      </div>

      <Card className="p-4">
        <form className="flex flex-col gap-1.5" onSubmit={openById}>
          <label htmlFor="admin-listing-id" className="text-sm font-medium text-ink">
            Open a listing by id
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="admin-listing-id"
              inputMode="numeric"
              placeholder="e.g. 128"
              value={lookup}
              hasError={lookupInvalid}
              aria-invalid={lookupInvalid}
              onChange={(event) => setLookup(event.target.value)}
              className="flex-1 min-w-[16rem]"
            />
            <Button type="submit" disabled={lookupInvalid || lookup.trim() === ''}>
              <Search className="h-4 w-4" aria-hidden />
              Open listing
            </Button>
          </div>
          {lookupInvalid ? (
            <p role="alert" className="text-xs text-danger-text">
              Enter the numeric listing id
            </p>
          ) : (
            <p className="text-xs text-muted">
              There is no search for the moderation queue, so paste the id here.
            </p>
          )}
        </form>
      </Card>

      {queue.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {queue.isError && <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />}

      {queue.data && queue.data.content.length === 0 && (
        <EmptyState
          title="The queue is clear"
          description="No listing is waiting for review. Use the box above to open one by id."
        />
      )}

      {queue.data && queue.data.content.length > 0 && (
        <>
          <DataTable
            caption="Listings awaiting review"
            columns={columns}
            rows={queue.data.content}
            getRowKey={(row) => row.id}
            onRowClick={(row) => navigate(ROUTES.ADMIN_LISTING(row.id))}
          />
          <Pagination
            page={queue.data.page + 1}
            totalPages={queue.data.totalPages}
            onChange={(next) => goToPage(Math.max(0, next - 1))}
          />
        </>
      )}
    </div>
  );
};