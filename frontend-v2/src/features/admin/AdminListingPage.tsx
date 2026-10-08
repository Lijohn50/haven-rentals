import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { BRAND } from '@/config/brand';
import { useAdminListing, useAdminMutations } from '@/features/host/api';
import { adminReasonSchema } from '@/features/host/schemas';
import { useListingReviews } from '@/features/listings/api';
import { reviewsApi } from '@/features/reviews/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { PhotoGallery } from '@/components/patterns/PhotoGallery';
import { RatingStars } from '@/components/patterns/Rating';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Skeleton,
  StatusBadge,
  Textarea,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { formatDateTimeLocal, formatInstant } from '@/lib/format';
import { cancellationPolicyLabels, propertyTypeLabels } from '@/lib/status';
import type { ReviewResponse } from '@/types/api';

type ReasonValues = { reason: string };

type ActionKind = 'approve' | 'reject' | 'suspend' | 'reinstate' | 'remove-review';
type ModerationAction = Exclude<ActionKind, 'remove-review'>;

interface AvailableAction {
  kind: ModerationAction;
  label: string;
  variant: 'primary' | 'destructive';
}

const MARK_BASE =
  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs';
const MARK_MET = `${MARK_BASE} bg-success-soft text-success-text`;
const MARK_UNMET = `${MARK_BASE} bg-danger-soft text-danger-text`;

const CONSEQUENCE: Record<Exclude<ActionKind, 'remove-review'>, string> = {
  approve: 'Approving publishes this listing to search straight away and tells the host.',
reject:
  'Rejecting closes this submission and tells the host the reason. The host must then edit and resubmit.',
suspend:
  'Suspending hides this listing from search immediately. Bookings already confirmed are not cancelled.',
  reinstate: 'Reinstatement puts this listing back into search immediately.',
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-3 py-1.5 text-sm">
    <dt className="text-muted">{label}</dt>
    <dd className="text-right font-medium text-ink">{children}</dd>
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card as="section" className="p-5">
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
    {children}
  </Card>
);

export const AdminListingPage: React.FC = () => {
  const { id } = useParams();
  const listingId = Number(id);
  const validId = Number.isFinite(listingId) ? listingId : null;

  const query = useAdminListing(validId);
  const reviews = useListingReviews(validId, 'NEWEST', 0);
  const admin = useAdminMutations();

  const [action, setAction] = useState<ActionKind | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewResponse | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const reasonForm = useForm<ReasonValues>({
    resolver: zodResolver(adminReasonSchema),
    defaultValues: { reason: '' },
  });
  const reasonValue = reasonForm.watch('reason') ?? '';

  const describeError = (error: unknown): string => {
    if (error instanceof ApiError) return error.detail;
    return 'That action could not be completed. Try again.';
  };

  const closeDialog = () => {
    setAction(null);
    setReviewTarget(null);
    setActionError(null);
    reasonForm.reset();
  };

  const runListingAction = async (kind: ModerationAction) => {
    if (!validId) return;
    setActionError(null);
    try {
      if (kind === 'approve') await admin.approveListing.mutateAsync(validId);
      if (kind === 'reject') {
        await admin.rejectListing.mutateAsync({ id: validId, reason: reasonValue.trim() });
      }
      if (kind === 'suspend') {
        await admin.suspendListing.mutateAsync({ id: validId, reason: reasonValue.trim() });
      }
      if (kind === 'reinstate') await admin.reinstateListing.mutateAsync(validId);
      closeDialog();
      toast.success(`${kind[0].toUpperCase()}${kind.slice(1)}d.`);
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => reasonForm.setError(name as keyof ReasonValues, { message }),
        ['reason']
      );
      setActionError(error);
      if (unmatched.length > 0) toast.error(unmatched[0]);
    }
  };

  const removeReview = async () => {
    if (!reviewTarget) return;
    setActionError(null);
    try {
      await reviewsApi.removeByAdmin(reviewTarget.id, reasonValue.trim());
      closeDialog();
      await reviews.refetch();
      toast.success('Review removed. The listing rating has been recalculated.');
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => reasonForm.setError(name as keyof ReasonValues, { message }),
        ['reason']
      );
      setActionError(error);
      if (unmatched.length > 0) toast.error(unmatched[0]);
    }
  };

  useDocumentTitle(query.data ? `Review listing #${query.data.id}` : 'Listing review');

  if (!validId) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 sm:px-6">
        <EmptyState title="That listing link is not valid" description="Listings are opened by numeric id." />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 sm:px-6">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const listing = query.data;
  const checklist = [
    { label: `At least ${BRAND.minPhotosToSubmit} photos`, met: listing.photos.length >= BRAND.minPhotosToSubmit },
    { label: 'A cover photo is set', met: listing.photos.some((photo) => photo.isCover) },
    { label: 'Base nightly price is greater than zero', met: listing.baseNightlyPrice > 0 },
    {
      label: 'Title, description and address are filled in',
      met:
        listing.title.trim().length > 0 &&
        listing.description.trim().length > 0 &&
        listing.addressLine.trim().length > 0 &&
        listing.city.trim().length > 0 &&
        listing.country.trim().length > 0 &&
        listing.timezone.trim().length > 0,
    },
  ];

  const available: AvailableAction[] = [];
  if (listing.status === 'PENDING_REVIEW') {
    available.push({ kind: 'approve', label: 'Approve', variant: 'primary' });
    available.push({ kind: 'reject', label: 'Reject', variant: 'destructive' });
  }
  if (listing.status === 'ACTIVE' || listing.status === 'PAUSED') {
    available.push({ kind: 'suspend', label: 'Suspend', variant: 'destructive' });
  }
  if (listing.status === 'SUSPENDED') {
    available.push({ kind: 'reinstate', label: 'Reinstate', variant: 'primary' });
  }

  const reasonRequired = action === 'reject' || action === 'suspend' || action === 'remove-review';

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', to: ROUTES.ADMIN_HOME },
          { label: 'Listings', to: ROUTES.ADMIN_LISTINGS },
          { label: `#${listing.id}` },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-ink">
            {listing.title}
            <StatusBadge status={listing.status} kind="listing" />
          </h1>
          <p className="mt-1 text-sm text-muted">
            Listing <span className="tabular">#{listing.id}</span> ·{' '}
            {listing.city}
            {listing.country ? `, ${listing.country}` : ''} ·{' '}
            {propertyTypeLabels[listing.propertyType]}
          </p>
        </div>
      </div>

      {listing.rejectionReason && (
          <InlineAlert tone="danger">
            <span className="font-semibold">Rejection reason</span>
            <span className="mt-0.5 block">{listing.rejectionReason}</span>
          </InlineAlert>
        )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Moderation actions
          </h2>
          <div className="flex flex-wrap gap-2">
            {available.map((entry) => (
              <Button
                key={entry.kind}
                variant={entry.variant}
                onClick={() => {
                  reasonForm.reset();
                  setActionError(null);
                  setAction(entry.kind);
                }}
              >
                {entry.label}
              </Button>
            ))}
            {available.length === 0 && (
              <p className="text-sm text-muted">
                This listing is {listing.status.replaceAll('_', ' ').toLowerCase()}, so there is
                nothing to moderate right now.
              </p>
            )}
          </div>
        </div>

        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <span className={item.met ? MARK_MET : MARK_UNMET} aria-hidden>
                {item.met ? '✓' : '✕'}
              </span>
              <span className={item.met ? 'text-ink' : 'text-muted'}>{item.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <PhotoGallery photos={listing.photos} title={listing.title} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Property">
          <dl className="divide-y divide-line">
            <DetailRow label="Type">{propertyTypeLabels[listing.propertyType]}</DetailRow>
            <DetailRow label="Sleeps">{listing.maxGuests} guests</DetailRow>
            <DetailRow label="Rooms">
              {listing.bedrooms} bedrooms · {listing.beds} beds · {listing.bathrooms} bathrooms
            </DetailRow>
            <DetailRow label="Stay rules">
              {listing.minNights}–{listing.maxNights} nights
            </DetailRow>
            <DetailRow label="Notice">{listing.advanceNoticeDays} days</DetailRow>
            <DetailRow label="Booking window">{listing.bookingWindowDays} days</DetailRow>
            <DetailRow label="Check-in / out">
              {(listing.checkInTime ?? '').slice(0, 5)} / {(listing.checkOutTime ?? '').slice(0, 5)}
            </DetailRow>
            <DetailRow label="Cancellation">
              {cancellationPolicyLabels[listing.cancellationPolicy]}
            </DetailRow>
            <DetailRow label="Instant book">{listing.instantBook ? 'Yes' : 'No'}</DetailRow>
          </dl>
          <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{listing.description}</p>
        </Panel>

        <Panel title="Location and pricing">
          <dl className="divide-y divide-line">
            <DetailRow label="Address">{listing.addressLine}</DetailRow>
            <DetailRow label="City">
              {listing.city}
              {listing.stateRegion ? `, ${listing.stateRegion}` : ''} {listing.country}
            </DetailRow>
            <DetailRow label="Postcode">{listing.postalCode ?? '—'}</DetailRow>
            <DetailRow label="Coordinates">
              <span className="tabular">
                {listing.latitude}, {listing.longitude}
              </span>
            </DetailRow>
            <DetailRow label="Timezone">{listing.timezone}</DetailRow>
            <DetailRow label="Nightly price">
              <span className="tabular">{formatMoney(listing.baseNightlyPrice)}</span>
            </DetailRow>
            <DetailRow label="Weekend multiplier">
              <span className="tabular">{listing.weekendMultiplier ?? '—'}</span>
            </DetailRow>
            <DetailRow label="Cleaning fee">
              <span className="tabular">{formatMoney(listing.cleaningFee)}</span>
            </DetailRow>
            <DetailRow label="Weekly / monthly discount">
              <span className="tabular">
                {listing.weeklyDiscountPercent ?? 0}% / {listing.monthlyDiscountPercent ?? 0}%
              </span>
            </DetailRow>
          </dl>
        </Panel>

        <Panel title="Host">
          <dl className="divide-y divide-line">
            <DetailRow label="Host">
              {listing.hostDisplayName ?? 'Unknown host'}
            </DetailRow>
            <DetailRow label="Host id">
              {listing.hostId === null ? (
                '—'
              ) : (
                <Link
                  to={ROUTES.ADMIN_USER(listing.hostId)}
                  className="tabular text-primary underline underline-offset-2"
                >
                  #{listing.hostId}
                </Link>
              )}
            </DetailRow>
            <DetailRow label="Rating">
              <span className="flex items-center gap-2">
                <RatingStars value={listing.averageRating} />
                <span className="tabular text-muted">
                  {listing.averageRating === null ? 'New' : listing.averageRating.toFixed(1)} ·{' '}
                  {listing.reviewCount} reviews
                </span>
              </span>
            </DetailRow>
            <DetailRow label="Created">{formatDateTimeLocal(listing.createdAt)}</DetailRow>
            <DetailRow label="Last change">{formatDateTimeLocal(listing.updatedAt)}</DetailRow>
          </dl>
        </Panel>

        <Panel title="Amenities and rules">
          {listing.amenities.length === 0 ? (
            <p className="text-sm text-muted">No amenities were selected.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {listing.amenities.map((amenity) => (
                <li
                  key={amenity.id}
                  className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary-dark"
                >
                  {amenity.name}
                </li>
              ))}
            </ul>
          )}
          {listing.houseRules.length > 0 && (
            <>
              <h3 className="mt-4 mb-2 text-xs uppercase tracking-wide text-muted">House rules</h3>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
                {listing.houseRules.map((rule, index) => (
                  <li key={`${rule.sortOrder}-${index}`}>{rule.text}</li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Reviews">
        {reviews.isLoading && <Skeleton className="h-16 w-full" />}
        {reviews.isError && (
          <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />
        )}
        {reviews.data && reviews.data.content.length === 0 && (
          <p className="text-sm text-muted">This listing has no reviews yet.</p>
        )}
        {reviews.data && reviews.data.content.length > 0 && (
          <ul className="divide-y divide-line">
            {reviews.data.content.map((review) => (
              <li key={review.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {review.reviewerName}
                    <span className="tabular text-muted">
                      {review.overallRating}/5 overall
                    </span>
                    <span className="text-xs text-muted">
                      {review.direction === 'GUEST_TO_HOST' ? 'Guest to host' : 'Host to guest'}
                    </span>
                  </p>
                  {review.comment && (
                    <p className="mt-1 max-w-prose text-sm text-muted">{review.comment}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    Published {formatInstant(review.publishedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    reasonForm.reset();
                    setActionError(null);
                    setReviewTarget(review);
                    setAction('remove-review');
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={action !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          {action === 'remove-review' ? (
            <>
              <DialogTitle>Remove this review?</DialogTitle>
              <DialogDescription>
                The review disappears from the listing and the average rating is recalculated
                straight away. The author is not told.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>
                {action ? `${action[0].toUpperCase()}${action.slice(1)} this listing?` : ''}
              </DialogTitle>
              <DialogDescription>
                {action ? CONSEQUENCE[action] : ''}
              </DialogDescription>
            </>
          )}

          {reasonRequired && (
            <form
              className="mt-4 flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void reasonForm.handleSubmit(() =>
                  action === 'remove-review' ? removeReview() : runListingAction(action)
                )();
              }}
              noValidate
            >
              <Field
                label="Reason"
                htmlFor="listing-action-reason"
                required
                hint={`${reasonValue.length}/500 characters. It is shown to the host.`}
                error={reasonForm.formState.errors.reason?.message}
              >
                <Textarea
                  id="listing-action-reason"
                  maxLength={500}
                  hasError={Boolean(reasonForm.formState.errors.reason)}
                  aria-invalid={Boolean(reasonForm.formState.errors.reason)}
                  {...reasonForm.register('reason')}
                />
              </Field>

              {actionError != null && (
                <InlineAlert tone="danger">
                  {describeError(actionError)}
                  <TraceId error={actionError} className="mt-1 block" />
                </InlineAlert>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" loading={reasonForm.formState.isSubmitting}>
                  {action === 'remove-review' ? 'Remove review' : `${action} listing`}
                </Button>
              </div>
            </form>
          )}

          {action !== null && !reasonRequired && (
            <>
              {actionError != null && (
                <InlineAlert tone="danger" className="mt-4">
                  {describeError(actionError)}
                  <TraceId error={actionError} className="mt-1 block" />
                </InlineAlert>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  variant={action === 'reinstate' ? 'primary' : 'destructive'}
                  loading={admin.approveListing.isPending || admin.reinstateListing.isPending}
                  onClick={() => void runListingAction(action)}
                >
                  Confirm
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};