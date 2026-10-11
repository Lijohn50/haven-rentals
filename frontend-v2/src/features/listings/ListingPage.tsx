import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Sparkles, Users, Bed, BedSingle, Bath, Info, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle, setCanonical, setJsonLd } from '@/hooks/useSeo';
import { useAuth } from '@/providers/AuthProvider';
import { useListing } from '@/features/listings/api';
import { isAiUnavailable, useReviewSummary } from '@/features/ai/api';
import { useAdminMutations } from '@/features/host/api';
import { AmenityGroup } from '@/components/patterns/AmenityIcon';
import { BookingCard } from '@/components/patterns/BookingCard';
import { ContactHostDialog } from '@/components/patterns/ContactHostDialog';
import { MapView } from '@/components/patterns/MapView';
import { PhotoGallery } from '@/components/patterns/PhotoGallery';
import { PolicyCard } from '@/components/patterns/PolicyCard';
import { ReviewsSection } from '@/components/patterns/ReviewsSection';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { localTimeToDisplay } from '@/lib/cancellation';
import { formatBathrooms, formatRating, pluralize, truncate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { propertyTypeLabels } from '@/lib/status';
import { cn } from '@/lib/cn';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DrawerContent,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Skeleton,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import type { CancellationPolicy, ListingResponse } from '@/types/api';

/** `ListingResponse` has no `cancellationPolicyDescription`, so the enum drives the wording. */
function policyDescription(policy: CancellationPolicy): string {
  switch (policy) {
    case 'FLEXIBLE':
      return 'Cancel up to 24 hours before check-in for a full refund of the accommodation, fees and taxes.';
    case 'MODERATE':
      return 'Cancel up to 5 days (120 hours) before check-in for a full refund, or up to 24 hours before for 50%.';
    case 'STRICT':
      return 'Cancel up to 7 days (168 hours) before check-in for 50%. Inside that window no refund is possible.';
    default:
      return '';
  }
}

const Description: React.FC<{ text: string }> = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  const collapsible = text.split('\n').length > 6 || text.length > 600;

  return (
    <div>
      <p
        className={cn('whitespace-pre-line text-sm leading-relaxed text-ink', !expanded && collapsible && 'line-clamp-6')}
      >
        {text}
      </p>
      {collapsible && (
        <Button variant="link" className="mt-1" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
};

const ReviewSummary: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  const summary = useReviewSummary(listing.id, listing.reviewCount);
  if (summary.isPending || summary.isError || isAiUnavailable(summary.error) || !summary.data) return null;

  return (
    <div className="rounded-card border border-line bg-primary-soft/40 p-5 ring-1 ring-line/60">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="h-4 w-4" aria-hidden />
        What guests say
      </p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text">{summary.data.summary}</p>
      <p className="mt-2 text-xs text-muted">
        Generated from {pluralize(summary.data.reviewCount, 'review')}.
      </p>
    </div>
  );
};

const HouseRules: React.FC<{ listing: ListingResponse }> = ({ listing }) => (
  <section aria-label="House rules and times" className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-7">
    <h2 className="font-heading text-xl font-semibold text-text">House rules & times</h2>
    {listing.houseRules.length > 0 && (
      <ul className="mt-4 space-y-2 text-sm text-text">
        {[...listing.houseRules]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((rule) => (
            <li key={`${rule.sortOrder}-${rule.text}`} className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>{rule.text}</span>
            </li>
          ))}
      </ul>
    )}
    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line/70 pt-5">
      <div className="rounded-2xl bg-sand p-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Check-in</div>
        <div className="mt-1 font-heading text-xl font-semibold text-text">{localTimeToDisplay(listing.checkInTime)}</div>
      </div>
      <div className="rounded-2xl bg-sand p-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Check-out</div>
        <div className="mt-1 font-heading text-xl font-semibold text-text">{localTimeToDisplay(listing.checkOutTime)}</div>
      </div>
    </div>
    <p className="mt-3 text-xs text-muted">Times are local to {listing.timezone}.</p>
  </section>
);

const HostBlock: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  const name = listing.hostDisplayName ?? 'Your host';

  return (
    <section aria-label="Your host" className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-7">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-lg font-semibold text-white shadow-sm ring-2 ring-white">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="font-heading text-xl font-semibold text-text">Hosted by {name}</h2>
          <p className="mt-0.5 text-sm text-muted">
            Message {name.split(' ')[0]} before you book; questions are answered in the inbox.
          </p>
        </div>
      </div>
      {listing.hostId && (
        <div className="mt-4 border-t border-line/70 pt-4">
          <Link
            to={ROUTES.HOST_PROFILE(listing.hostId)}
            className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface px-4 py-2 text-sm font-semibold text-text shadow-sm transition-colors hover:border-primary hover:text-primary"
          >
            See host profile →
          </Link>
        </div>
      )}
    </section>
  );
};

const ReasonDialog: React.FC<{
  title: string;
  description: string;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
}> = ({ title, description, open, pending, onOpenChange, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = reason.trim();
            if (trimmed.length < 10 || trimmed.length > 500) {
              setError('Write between 10 and 500 characters.');
              return;
            }
            setError(null);
            onSubmit(trimmed);
          }}
        >
          <Field label="Reason" htmlFor="listing-reason" required error={error}>
            <Textarea
              id="listing-reason"
              rows={4}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={pending}>
              Confirm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const OwnerBar: React.FC<{ listing: ListingResponse }> = ({ listing }) => (
  <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
    <StatusBadge status={listing.status} kind="listing" />
    <span className="text-sm text-muted">This is your listing.</span>
    <div className="ml-auto flex gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={ROUTES.HOST_LISTING(listing.id)}>
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link to={`${ROUTES.LISTING(listing.id)}?preview=guest`}>
          <Eye className="h-4 w-4" aria-hidden />
          Preview as guest
        </Link>
      </Button>
    </div>
  </div>
);

const AdminBar: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  const { approveListing, rejectListing, suspendListing, reinstateListing } = useAdminMutations();
  const [dialog, setDialog] = useState<'reject' | 'suspend' | null>(null);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : 'That action could not be completed.');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
      <StatusBadge status={listing.status} kind="listing" />
      <span className="text-sm text-muted">Administrator actions</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {listing.status === 'PENDING_REVIEW' && (
          <>
            <Button
              size="sm"
              loading={approveListing.isPending}
              onClick={() => void run(() => approveListing.mutateAsync(listing.id), 'Listing approved')}
            >
              Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDialog('reject')}>
              Reject
            </Button>
          </>
        )}
        {listing.status === 'ACTIVE' && (
          <Button size="sm" variant="destructive" onClick={() => setDialog('suspend')}>
            Suspend
          </Button>
        )}
        {(listing.status === 'SUSPENDED' || listing.status === 'REJECTED') && (
          <Button
            size="sm"
            loading={reinstateListing.isPending}
            onClick={() => void run(() => reinstateListing.mutateAsync(listing.id), 'Listing reinstated')}
          >
            Reinstate
          </Button>
        )}
      </div>

      <ReasonDialog
        title="Reject this listing"
        description="The host sees this reason and can edit the listing to resubmit it."
        open={dialog === 'reject'}
        pending={rejectListing.isPending}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        onSubmit={(reason) => {
          void run(() => rejectListing.mutateAsync({ id: listing.id, reason }), 'Listing rejected').finally(() =>
            setDialog(null)
          );
        }}
      />
      <ReasonDialog
        title="Suspend this listing"
        description="The listing is hidden from search. Existing bookings are not cancelled."
        open={dialog === 'suspend'}
        pending={suspendListing.isPending}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        onSubmit={(reason) => {
          void run(() => suspendListing.mutateAsync({ id: listing.id, reason }), 'Listing suspended').finally(() =>
            setDialog(null)
          );
        }}
      />
    </div>
  );
};

const AnchorNav: React.FC<{ reviewCount: number }> = ({ reviewCount }) => {
  const [active, setActive] = useState(() => typeof window !== 'undefined' ? window.location.hash : '');

  const links = [
    { href: '#overview', label: 'Overview' },
    { href: '#amenities', label: 'Amenities' },
    { href: '#policies', label: 'Policies' },
    { href: '#reviews', label: `Reviews (${reviewCount})` },
    { href: '#location', label: 'Location' },
  ];

  return (
    <nav aria-label="Sections on this page" className="flex gap-2 overflow-x-auto border-b border-line/70 pb-1">
      {links.map((link) => {
        const isActive = active === link.href;
        return (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setActive(link.href)}
            className={cn(
              'relative shrink-0 px-3.5 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'font-semibold text-primary after:absolute after:inset-x-2 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted hover:text-primary'
            )}
          >
            {link.label}
          </a>
        );
      })}
    </nav>
  );
};

const ListingSkeleton: React.FC = () => (
  <div className="mx-auto max-w-content px-4 py-6 sm:px-6">
    <Skeleton className="h-4 w-64" />
    <Skeleton className="mt-4 h-[22rem] w-full rounded-card" />
    <Skeleton className="mt-4 h-8 w-3/4" />
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full rounded-card" />
      </div>
      <Skeleton className="h-80 w-full rounded-card" />
    </div>
  </div>
);

export const ListingPage: React.FC = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const listingId = Number(id);
  const previewAsGuest = params.get('preview') === 'guest';
  const listingQuery = useListing(Number.isFinite(listingId) ? listingId : null);
  const [authRetried, setAuthRetried] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const retried = useRef(false);

  const notFound = listingQuery.error instanceof ApiError && listingQuery.error.status === 404;

  // Non-ACTIVE listings 404 for anonymous callers; the owner and an admin get them with a token.
  useEffect(() => {
    if (!notFound || !isAuthenticated || retried.current) return;
    retried.current = true;
    setAuthRetried(true);
    void listingQuery.refetch().finally(() => setAuthRetried(false));
  }, [notFound, isAuthenticated, listingQuery]);

  const listing = listingQuery.data;

  const title = listing
    ? `${listing.title}, ${listing.city}`
    : notFound
      ? 'Home Not Available'
      : !Number.isFinite(listingId) || listingId <= 0
        ? 'Home Not Found'
        : 'Loading Home…';
  const description = listing ? truncate(listing.description.replace(/\s+/g, ' '), 155) : undefined;
  useDocumentTitle(title, description);

  useEffect(() => {
    if (!listing) {
      setCanonical(ROUTES.LISTING(listingId));
      setJsonLd(null);
      return;
    }
    setCanonical(ROUTES.LISTING(listing.id));
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'VacationRental',
      name: listing.title,
      description: truncate(listing.description.replace(/\s+/g, ' '), 300),
      image: listing.photos.slice(0, 5).map((photo) => photo.url),
      address: {
        '@type': 'PostalAddress',
        addressLocality: listing.city,
        addressRegion: listing.stateRegion ?? undefined,
        addressCountry: listing.country,
      },
      ...(listing.reviewCount > 0 && listing.averageRating !== null
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: listing.averageRating,
              reviewCount: listing.reviewCount,
            },
          }
        : {}),
    });
    const active = listing.status === 'ACTIVE';
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = active && !previewAsGuest ? 'index,follow' : 'noindex,nofollow';
  }, [listing, listingId, previewAsGuest]);

  const ownListing = useMemo(
    () => Boolean(listing && user && listing.hostId && user.id === listing.hostId),
    [listing, user]
  );

  if (!Number.isFinite(listingId) || listingId <= 0) {
    return (
      <div className="mx-auto max-w-content px-4 py-10 sm:px-6">
        <EmptyState title="We could not find that home" description="The link may be broken." />
      </div>
    );
  }

  if (listingQuery.isPending || authRetried) return <ListingSkeleton />;

  if (notFound) {
    return (
      <div className="mx-auto max-w-content px-4 py-10 sm:px-6">
        <EmptyState
          title="This home is not available"
          description="It may be under review, paused or removed. Listings that are not live are only visible to their host."
          action={
            <Button asChild variant="primary">
              <Link to={ROUTES.SEARCH}>Back to search</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (listingQuery.isError || !listing) {
    return (
      <div className="mx-auto max-w-content px-4 py-10 sm:px-6">
        <ErrorState
          title="This home could not be loaded"
          error={listingQuery.error}
          onRetry={() => void listingQuery.refetch()}
        />
      </div>
    );
  }

  const topRated = (listing.averageRating ?? 0) >= 4.8 && listing.reviewCount >= 5;
  const showOwnerBar = ownListing && !previewAsGuest;
  const showAdminBar = isAdmin && !previewAsGuest;

  return (
    <div className="pb-20 lg:pb-8">
      <div className="mx-auto max-w-content px-4 pt-4 sm:px-6">
        <Breadcrumbs
          items={[
            { label: 'Home', to: ROUTES.HOME },
            { label: listing.city, to: `${ROUTES.SEARCH}?city=${encodeURIComponent(listing.city)}` },
            { label: listing.title },
          ]}
        />

        {showOwnerBar && <OwnerBar listing={listing} />}
        {showAdminBar && (
          <div className="mb-3">
            <AdminBar listing={listing} />
          </div>
        )}

        <PhotoGallery photos={listing.photos} title={listing.title} />

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[.12em] text-muted">
              <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
              {propertyTypeLabels[listing.propertyType]} · {listing.city}, {listing.country}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-text sm:text-4xl">
              {listing.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {listing.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-sand px-3 py-1 text-xs font-semibold text-text">
                ★ <span className="tabular">{formatRating(listing.averageRating)}</span> ({listing.reviewCount})
              </span>
            ) : (
              <span className="rounded-pill bg-highlight px-3 py-1 text-xs font-semibold text-accent-dark">
                New
              </span>
            )}
            {topRated && <Badge tone="success">Top rated</Badge>}
            {listing.instantBook && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                ⚡ Instant Book
              </span>
            )}
          </div>
        </div>

        {/* 4 Stat tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line/70">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="font-heading text-lg font-semibold text-text">{listing.maxGuests}</div>
              <div className="text-xs text-muted">Sleeps</div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line/70">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <Bed className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="font-heading text-lg font-semibold text-text">{listing.bedrooms}</div>
              <div className="text-xs text-muted">{listing.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line/70">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <BedSingle className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="font-heading text-lg font-semibold text-text">{listing.beds}</div>
              <div className="text-xs text-muted">{listing.beds === 1 ? 'Bed' : 'Beds'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line/70">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <Bath className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="font-heading text-lg font-semibold text-text">{formatBathrooms(listing.bathrooms)}</div>
              <div className="text-xs text-muted">{listing.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <AnchorNav reviewCount={listing.reviewCount} />
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-content gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <section id="overview" aria-label="About this home" className="scroll-mt-32 rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-7">
            <h2 className="mb-3 font-heading text-xl font-semibold text-text">Overview</h2>
            <Description text={listing.description} />
            {listing.rejectionReason && showOwnerBar && (
              <InlineAlert tone="danger" className="mt-3">
                Rejected: {listing.rejectionReason}
              </InlineAlert>
            )}
          </section>

          <HostBlock listing={listing} />

          <div className="flex items-center gap-3 rounded-2xl bg-primary-soft/60 p-4 ring-1 ring-primary/20">
            <Info className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm text-primary-dark">
              From <span className="font-semibold tabular">{formatMoney(listing.baseNightlyPrice)}</span> per night
              {Number(listing.weekendMultiplier) > 1 ? (
                <> (weekend rate: <span className="font-semibold tabular">{formatMoney(Number(listing.baseNightlyPrice) * Number(listing.weekendMultiplier))}</span> per night for Fri–Sat)</>
              ) : null}
              , plus the cleaning fee, service fee and taxes shown before you pay.
            </p>
          </div>

          <ReviewSummary listing={listing} />

          <section id="amenities" aria-label="Amenities" className="scroll-mt-32 rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-7">
            <h2 className="mb-4 font-heading text-xl font-semibold text-text">
              What this home offers {listing.amenities.length > 0 && `(${listing.amenities.length})`}
            </h2>
            {listing.amenities.length > 0 ? (
              <AmenityGroup amenities={listing.amenities} />
            ) : (
              <p className="text-sm text-muted">The host has not listed amenities yet.</p>
            )}
          </section>

          <HouseRules listing={listing} />

          <div id="policies" className="scroll-mt-32">
            <PolicyCard policy={listing.cancellationPolicy} description={policyDescription(listing.cancellationPolicy)} />
          </div>

          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <ReviewsSection
              listingId={listing.id}
              reviewCount={listing.reviewCount}
              averageRating={listing.averageRating}
            />
          </div>

          <section id="location" aria-label="Location" className="scroll-mt-32 rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-7">
            <h2 className="mb-2 font-heading text-xl font-semibold text-text">Where you will be</h2>
            <p className="mb-4 text-sm text-muted">
              The map shows an approximate area in {listing.city}. The exact address is shared after you book.
            </p>
            <div className="h-80 w-full overflow-hidden rounded-2xl ring-1 ring-line/70">
              <MapView latitude={listing.latitude} longitude={listing.longitude} label={listing.city} />
            </div>
          </section>
        </div>

        <div className="hidden lg:sticky lg:top-24 lg:block">
          <BookingCard listing={listing} />
        </div>
      </div>

      {!ownListing && listing.status === 'ACTIVE' && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 lg:hidden no-print">
          <div>
            <p className="tabular text-base font-semibold text-ink">
              {formatMoney(listing.baseNightlyPrice)}{' '}
              <span className="text-xs font-normal text-muted">per night</span>
            </p>
            {Number(listing.weekendMultiplier) > 1 && (
              <p className="text-[11px] text-muted">
                Weekend: {formatMoney(Number(listing.baseNightlyPrice) * Number(listing.weekendMultiplier))}/night
              </p>
            )}
            <button
              type="button"
              className="text-xs font-medium text-primary underline underline-offset-4"
              onClick={() => setContactOpen(true)}
            >
              Message host
            </button>
          </div>
          <Button variant="accent" onClick={() => setSheetOpen(true)}>
            Check availability
          </Button>
        </div>
      )}

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">Dates and price</DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => setSheetOpen(false)}>
              Close
            </Button>
          </div>
          <div className="mt-3">
            <BookingCard listing={listing} />
          </div>
        </DrawerContent>
      </Dialog>

      <ContactHostDialog listingId={listing.id} open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};