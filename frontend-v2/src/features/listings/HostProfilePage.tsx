import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle, setCanonical } from '@/hooks/useSeo';
import { useHostProfile } from '@/features/auth/api';
import { formatRating } from '@/lib/format';
import { Avatar, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';

export const HostProfilePage: React.FC = () => {
  const { id } = useParams();
  const userId = Number(id);
  const validId = Number.isInteger(userId) && userId > 0 ? userId : null;
  // Passing a dummy 0 without disabling the query fired a guaranteed 4xx on every
  // malformed /hosts/<garbage> link.
  const profile = useHostProfile(validId ?? 0, validId !== null);

  const displayName = profile.data?.displayName?.trim() || 'Haven host';

  useDocumentTitle(
    profile.data ? `${displayName} · Host profile` : 'Host profile',
    profile.data?.bio
      ? `${displayName} is a host on ${BRAND.name} with ${profile.data.activeListings} listed homes.`
      : undefined
  );

  // Writing to document.head during render is a side effect, and SearchPage/ListingPage
  // both wrap this call in an effect.
  useEffect(() => {
    if (validId !== null) setCanonical(ROUTES.HOST_PROFILE(validId));
  }, [validId]);

  if (validId === null) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-10 sm:px-6">
        <EmptyState title="We could not find that host" />
      </div>
    );
  }

  if (profile.isPending) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-10 sm:px-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="mt-6 h-24 w-full rounded-card" />
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-10 sm:px-6">
        <ErrorState
          title="This host profile could not be loaded"
          error={profile.error}
          onRetry={() => void profile.refetch()}
        />
      </div>
    );
  }

  const host = profile.data;
  const memberYear = new Date(host.memberSince).getFullYear();

  return (
    <div className="mx-auto max-w-narrow px-4 py-10 sm:px-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold text-ink">{displayName}</h1>
            <p className="text-sm text-muted">Member since {memberYear}</p>
          </div>
          {host.averageRating !== null && host.reviewCount > 0 && (
            <p className="ml-auto flex items-center gap-1 text-sm text-ink">
              <Star className="h-4 w-4 fill-ink" aria-hidden />
              <span className="tabular font-semibold">{formatRating(host.averageRating)}</span>
              <span className="text-muted">({host.reviewCount})</span>
            </p>
          )}
        </div>

        {host.bio && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink">{host.bio}</p>}

        <dl className="mt-6 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Homes listed</dt>
            <dd className="tabular mt-1 text-lg font-semibold text-ink">{host.activeListings}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Reviews</dt>
            <dd className="tabular mt-1 text-lg font-semibold text-ink">{host.reviewCount}</dd>
          </div>
        </dl>
      </Card>

      <p className="mt-4 text-xs text-muted">
        A host's email address, phone number and address are never shown on a public page.
      </p>

      <Button asChild variant="outline" className="mt-4">
        <Link to={ROUTES.SEARCH}>Browse homes</Link>
      </Button>
    </div>
  );
};