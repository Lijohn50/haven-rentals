import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '@/lib/money';
import { disputeCategoryLabels, resolutionTypeLabels } from '@/lib/status';
import { formatDateTimeLocal } from '@/lib/format';
import { ROUTES } from '@/config/routes';
import { useMyDisputes } from '@/features/disputes/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import type { DisputeCategory, ResolutionType } from '@/types/api';

export const MyDisputesPage: React.FC = () => {
  useDocumentTitle('My disputes');

  const [page, setPage] = useState(0);
  const disputes = useMyDisputes(page);

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Account', to: ROUTES.ACCOUNT }, { label: 'My disputes' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">My disputes</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Every case you opened, with the outcome once our team has finished reviewing it. Opening a
          dispute pauses the host payout while the case is open.
        </p>
      </div>

      {disputes.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}

      {disputes.isError && (
        <ErrorState error={disputes.error} onRetry={() => void disputes.refetch()} />
      )}

      {disputes.data && disputes.data.content.length === 0 && (
        <EmptyState
          title="No disputes"
          description="If something goes wrong with a stay, open a dispute from the trip page and it will appear here."
          action={
            <Button asChild>
              <Link to={ROUTES.TRIPS}>Go to your trips</Link>
            </Button>
          }
        />
      )}

      {disputes.data && disputes.data.content.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">
            {disputes.data.content.map((dispute) => (
              <li key={dispute.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-ink">
                        {disputeCategoryLabels[dispute.category as DisputeCategory] ?? dispute.category}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted">
                        Booking{' '}
                        <Link
                          to={ROUTES.TRIP(dispute.bookingReference)}
                          className="tabular text-primary underline underline-offset-2"
                        >
                          {dispute.bookingReference}
                        </Link>{' '}
                        · opened {formatDateTimeLocal(dispute.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={dispute.status} kind="dispute" />
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm text-muted">{dispute.description}</p>

                  {dispute.status === 'RESOLVED' && (
                    <div className="mt-3 rounded-control border border-line bg-bg px-3 py-2 text-sm">
                      <p className="font-medium text-ink">
                        Outcome:{' '}
                        {dispute.resolutionType
                          ? resolutionTypeLabels[dispute.resolutionType as ResolutionType]
                          : 'Resolved'}
                        {dispute.refundAmount != null && (
                          <>
                            {' · '}
                            <span className="tabular">
                              {formatMoney(dispute.refundAmount)} refunded
                            </span>
                          </>
                        )}
                      </p>
                      {dispute.resolutionNote && (
                        <p className="mt-1 text-muted">{dispute.resolutionNote}</p>
                      )}
                      <p className="mt-1 text-xs text-muted">
                        Resolution is final.
                        {dispute.resolvedAt ? ` Decided ${formatDateTimeLocal(dispute.resolvedAt)}.` : ''}
                      </p>
                    </div>
                  )}

                  {dispute.status === 'REJECTED' && dispute.resolutionNote && (
                    <p className="mt-3 text-sm text-muted">{dispute.resolutionNote}</p>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          <Pagination
            page={disputes.data.page + 1}
            totalPages={disputes.data.totalPages}
            onChange={(next) => setPage(Math.max(0, next - 1))}
          />
        </>
      )}
    </div>
  );
};
