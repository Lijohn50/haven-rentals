import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Pause, Pencil, Play, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useHostListing, useHostListings, useListingMutations } from '@/features/listings/api';
import { PhotoThumb } from '@/components/patterns/PhotoGallery';
import { RatingStars } from '@/components/patterns/Rating';
import { useDocumentTitle } from '@/hooks/useSeo';
import { cn } from '@/lib/cn';
import { formatRating } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { listingStatus } from '@/lib/status';
import {
  Banner,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  InlineAlert,
  Skeleton,
  StatusBadge,
  TraceId,
} from '@/components/ui';
import type { ListingStatus, ListingSummaryResponse } from '@/types/api';

const FILTERS: { value: ListingStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'ACTIVE', label: 'Live' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

type ConfirmKind = 'submit' | 'pause' | 'resume' | 'delete';

const EDITABLE: ListingStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'REJECTED'];
const VIEW_ONLY: ListingStatus[] = ['PENDING_REVIEW', 'SUSPENDED'];

const CONFIRM_COPY: Record<
  ConfirmKind,
  { title: string; body: string; confirm: string; success: string }
> = {
  submit: {
    title: 'Send this listing for review?',
    body: 'Editing is locked while we review it. We will notify you when a decision is made.',
    confirm: 'Submit for review',
    success: 'Submitted. We will review it and notify you.',
  },
  pause: {
    title: 'Pause this listing?',
    body: 'It leaves search and no new guest can book it. Bookings already confirmed stay valid.',
    confirm: 'Pause listing',
    success: 'Listing paused.',
  },
  resume: {
    title: 'Resume this listing?',
    body: 'It goes back into search and can receive new bookings straight away.',
    confirm: 'Resume listing',
    success: 'Listing is live again.',
  },
  delete: {
    title: 'Delete this listing?',
    body: 'This removes the listing for good. It cannot be undone and reviews stay on your record.',
    confirm: 'Delete listing',
    success: 'Listing deleted.',
  },
};

/** The summary endpoint carries no rejection reason, so a rejected row loads its own detail. */
const RejectionNotice: React.FC<{ id: number }> = ({ id }) => {
  const listing = useHostListing(id);

  if (listing.isLoading) return <Skeleton className="h-12 w-full" />;

  return (
    <Banner tone="danger" title="This listing was rejected">
      {listing.data?.rejectionReason ??
        'Our team could not approve this listing. Edit it and submit it again.'}
    </Banner>
  );
};

interface RowProps {
  listing: ListingSummaryResponse;
  busy: boolean;
  onConfirm: (listing: ListingSummaryResponse, kind: ConfirmKind) => void;
}

const ListingRow: React.FC<RowProps> = ({ listing, busy, onConfirm }) => {
  const status = listing.status;
  const editPath = ROUTES.HOST_LISTING(listing.id);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <PhotoThumb
          src={listing.coverPhotoUrl}
          alt={listing.title}
          className="aspect-[4/3] w-full shrink-0 sm:h-24 sm:w-32"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 text-base font-semibold text-ink">
              <Link to={editPath} className="hover:underline">
                {listing.title}
              </Link>
            </h2>
            <StatusBadge status={status} kind="listing" />
          </div>

          <p className="text-sm text-muted">
            {listing.city}, {listing.country}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="tabular text-ink">
              {formatMoney(listing.baseNightlyPrice)}{' '}
              <span className="text-muted">per night</span>
            </span>
            <span className="inline-flex items-center gap-1 text-muted">
              <RatingStars value={listing.averageRating} />
              {formatRating(listing.averageRating)}
              <span className="text-xs">
                ({listing.reviewCount} {listing.reviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </span>
          </div>
        </div>
      </div>

      {status === 'PENDING_REVIEW' && (
        <Banner tone="info" title="Under review">
          We are checking this listing. Editing is locked until a decision is made.
        </Banner>
      )}

      {status === 'SUSPENDED' && (
        <Banner tone="danger" title="Suspended by an administrator">
          Only an administrator can put this listing back into search.
        </Banner>
      )}

      {status === 'REJECTED' && <RejectionNotice id={listing.id} />}

      <div className="flex flex-wrap gap-2">
        {EDITABLE.includes(status) && (
          <Button asChild variant="outline" size="sm">
            <Link to={editPath}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </Link>
          </Button>
        )}

        {(VIEW_ONLY.includes(status)) && (
          <Button asChild variant="outline" size="sm">
            <Link to={editPath}>
              <Eye className="h-4 w-4" aria-hidden />
              View
            </Link>
          </Button>
        )}

        {(status === 'DRAFT' || status === 'REJECTED') && (
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => onConfirm(listing, 'submit')}
          >
            <Send className="h-4 w-4" aria-hidden />
            {status === 'REJECTED' ? 'Resubmit' : 'Submit'}
          </Button>
        )}

        {status === 'ACTIVE' && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onConfirm(listing, 'pause')}
          >
            <Pause className="h-4 w-4" aria-hidden />
            Pause
          </Button>
        )}

        {status === 'PAUSED' && (
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => onConfirm(listing, 'resume')}
          >
            <Play className="h-4 w-4" aria-hidden />
            Resume
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onConfirm(listing, 'delete')}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete
        </Button>
      </div>
    </Card>
  );
};

export const HostListingsPage: React.FC = () => {
  useDocumentTitle('Your listings');

  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('status');
  const status = FILTERS.some((filter) => filter.value === requested)
    ? (requested as ListingStatus)
    : null;

  const query = useHostListings(status ?? undefined);
  // A second, unfiltered read of the same endpoint. It is deduped against `query` while no
  // filter is active, and it is what makes the per-status counts possible. Without them a
  // host filtered to "Live" saw only those rows with no hint that the rest still existed.
  const allQuery = useHostListings(undefined);
  const mutations = useListingMutations();
  const [pendingAction, setPendingAction] = useState<{
    listing: ListingSummaryResponse;
    kind: ConfirmKind;
  } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  const chooseStatus = (value: ListingStatus | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete('status');
    else next.set('status', value);
    setSearchParams(next, { replace: true });
  };

  const openConfirm = (listing: ListingSummaryResponse, kind: ConfirmKind) => {
    setFailure(null);
    setPendingAction({ listing, kind });
  };

  const busy =
    mutations.remove.isPending ||
    mutations.pause.isPending ||
    mutations.resume.isPending ||
    mutations.submit.isPending;

  const confirm = async () => {
    if (!pendingAction) return;
    const { listing, kind } = pendingAction;
    setFailure(null);
    try {
      if (kind === 'delete') await mutations.remove.mutateAsync(listing.id);
      if (kind === 'pause') await mutations.pause.mutateAsync(listing.id);
      if (kind === 'resume') await mutations.resume.mutateAsync(listing.id);
      if (kind === 'submit') await mutations.submit.mutateAsync(listing.id);
      toast.success(CONFIRM_COPY[kind].success);
      setPendingAction(null);
    } catch (error) {
      setFailure(error);
    }
  };

  const blocked =
    failure instanceof ApiError && failure.code === 'LISTING_HAS_ACTIVE_BOOKINGS';

  const listings = query.data?.content ?? [];
  const allListings = allQuery.data?.content ?? [];
  const totalCount = allQuery.data?.totalElements ?? 0;

  // Recomputed from the unfiltered set so the numbers stay correct whichever tab is open.
  const countFor = (value: ListingStatus | null) =>
    value === null
      ? allListings.length
      : allListings.filter((listing) => listing.status === value).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Your listings</h1>
          <p className="mt-0.5 text-sm text-muted">
            {totalCount === 0
              ? 'No listings yet'
              : status === null
                ? `${totalCount} listing${totalCount === 1 ? '' : 's'}`
                : `Showing ${listings.length} of ${totalCount} listing${totalCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.HOST_LISTING_NEW}>
            <Plus className="h-4 w-4" aria-hidden />
            New listing
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const isActive = (status ?? null) === filter.value;
          const count = countFor(filter.value);
            return (
              <button
                key={filter.label}
                type="button"
                aria-pressed={isActive}
                onClick={() => chooseStatus(filter.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-white'
                    : 'border-line bg-surface text-ink hover:border-primary'
                )}
              >
                {filter.label}
                <span className={cn('ml-1.5 tabular', isActive ? 'text-white/80' : 'text-muted')}>
                  {count}
                </span>
              </button>
            );
        })}
      </div>

      {query.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}

      {query.data && listings.length === 0 && (
        <EmptyState
          title={
            status === null
              ? 'You have no listings yet'
              : `No ${listingStatus[status].label.toLowerCase()} listings`
          }
          description={
            status === null
              ? 'Create your first listing, add photos and send it for review.'
              : 'Try another status, or create a listing to fill this view.'
          }
          action={
            status === null ? (
              <Button asChild>
                <Link to={ROUTES.HOST_LISTING_NEW}>Create your first listing</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => chooseStatus(null)}>
                Show all listings
              </Button>
            )
          }
        />
      )}

      {listings.length > 0 && (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingRow listing={listing} busy={busy} onConfirm={openConfirm} />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingAction(null);
        }}
      >
        <DialogContent>
          {pendingAction && (
            <>
              <DialogTitle>{CONFIRM_COPY[pendingAction.kind].title}</DialogTitle>
              <DialogDescription>
                {pendingAction.listing.title} · {pendingAction.listing.city}
              </DialogDescription>

              <p className="mt-3 text-sm text-ink">{CONFIRM_COPY[pendingAction.kind].body}</p>

              {failure != null && (
                <div className="mt-3">
                  {blocked ? (
                    <InlineAlert tone="danger">
                      <p className="font-medium">You still have active bookings for this listing</p>
                      <p className="mt-1">
                        {failure instanceof ApiError
                          ? failure.detail
                          : 'The listing cannot be deleted yet.'}
                      </p>
                      <Link
                        className="mt-2 inline-block underline"
                        to={`${ROUTES.HOST_BOOKINGS}?listingId=${pendingAction.listing.id}`}
                      >
                        See the bookings for this listing
                      </Link>
                      <TraceId error={failure} className="mt-1 block" />
                    </InlineAlert>
                  ) : (
                    <InlineAlert tone="danger">
                      {failure instanceof ApiError
                        ? failure.detail
                        : 'We could not complete that change. Try again.'}
                      <TraceId error={failure} className="mt-1 block" />
                    </InlineAlert>
                  )}
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" disabled={busy} onClick={() => setPendingAction(null)}>
                  Keep listing
                </Button>
                <Button
                  variant={pendingAction.kind === 'delete' ? 'destructive' : 'primary'}
                  loading={busy}
                  onClick={() => void confirm()}
                >
                  {CONFIRM_COPY[pendingAction.kind].confirm}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};