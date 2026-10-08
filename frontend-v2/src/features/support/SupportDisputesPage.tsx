import React, { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useSupportDisputes } from '@/features/disputes/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { useAuth } from '@/providers/AuthProvider';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { disputeCategoryLabels } from '@/lib/status';
import { formatDateTimeLocal, formatRelative } from '@/lib/format';
import type { DisputeCategory, DisputeResponse, DisputeStatus } from '@/types/api';

const TABS: { label: string; status: DisputeStatus | undefined }[] = [
  { label: 'All', status: undefined },
  { label: 'Open', status: 'OPEN' },
  { label: 'Under review', status: 'UNDER_REVIEW' },
  { label: 'Resolved', status: 'RESOLVED' },
  { label: 'Rejected', status: 'REJECTED' },
];

const TAB_ACTIVE =
  'rounded-control border-b-2 border-primary px-3 py-2 text-sm font-medium text-primary';
const TAB_IDLE =
  'rounded-control border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted ' +
  'transition-colors hover:text-ink';

function assigneeLabel(assignedAgentId: number | null, myId: number | undefined): string {
  if (assignedAgentId === null) return 'Unassigned';
  if (myId !== undefined && assignedAgentId === myId) return 'You';
  return `Agent #${assignedAgentId}`;
}

export const SupportDisputesPage: React.FC = () => {
  useDocumentTitle('Dispute queue');

  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const statusParam = params.get('status');
  const status = TABS.some((tab) => tab.status === statusParam)
    ? (statusParam as DisputeStatus | null)
    : null;
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const query = useSupportDisputes(status ?? undefined, page);

  const change = useCallback(
    (patch: Record<string, string | null>, keepPage = false) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!keepPage) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  const columns: Column<DisputeResponse>[] = [
    {
      key: 'id',
      header: 'Case',
      render: (row) => <span className="tabular font-medium text-ink">#{row.id}</span>,
      className: 'w-20',
    },
    {
      key: 'reference',
      header: 'Booking',
      render: (row) => <span className="tabular">{row.bookingReference}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => disputeCategoryLabels[row.category as DisputeCategory] ?? row.category,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} kind="dispute" />,
    },
    {
      key: 'raised',
      header: 'Raised',
      render: (row) => (
        <div className="whitespace-nowrap">
          <div className="text-ink">{formatDateTimeLocal(row.createdAt)}</div>
          <div className="text-xs text-muted">{formatRelative(row.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (row) => (
        <span className={row.assignedAgentId === null ? 'text-muted' : 'text-ink'}>
          {assigneeLabel(row.assignedAgentId, user?.id)}
        </span>
      ),
    },
    ];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[{ label: 'Support', to: ROUTES.SUPPORT_DISPUTES }, { label: 'Disputes' }]}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dispute queue</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Opening a case holds the host payout. Assign a case to yourself before you review it.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line" aria-label="Case status">
        {TABS.map((tab) => {
          const active = (tab.status ?? null) === status;
          return (
            <button
              key={tab.label}
              type="button"
              aria-pressed={active}
              onClick={() => change({ status: tab.status ?? null })}
              className={active ? TAB_ACTIVE : TAB_IDLE}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {query.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}

      {query.data && query.data.content.length === 0 && (
        <EmptyState
          title={status ? `No ${status.replaceAll('_', ' ').toLowerCase()} cases` : 'No disputes'}
          description="Nothing is waiting in this part of the queue right now."
          action={
            status ? (
              <Button variant="outline" onClick={() => change({ status: null })}>
                Show every case
              </Button>
            ) : undefined
          }
        />
      )}

      {query.data && query.data.content.length > 0 && (
        <>
          <DataTable
            caption="Dispute queue"
            columns={columns}
            rows={query.data.content}
            getRowKey={(row) => row.id}
            onRowClick={(row) => navigate(ROUTES.SUPPORT_DISPUTE(row.id))}
          />
          <Pagination
            page={query.data.page + 1}
            totalPages={query.data.totalPages}
            onChange={(next) => change({ page: String(Math.max(0, next - 1)) }, true)}
          />
        </>
      )}
    </div>
  );
};