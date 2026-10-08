import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { useHostListing } from '@/features/listings/api';
import { DetailsTab } from './components/DetailsTab';
import { PhotosTab } from './components/PhotosTab';
import { AmenitiesTab } from './components/AmenitiesTab';
import { HouseRulesTab } from './components/HouseRulesTab';
import { PricingTab } from './components/PricingTab';
import { CalendarTab } from './components/CalendarTab';
import { ReviewsTab } from './components/ReviewsTab';
import { StatusBadge } from '@/components/ui';
import { Banner, Button, Skeleton } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useSeo';
import { ErrorState } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import type { ListingResponse } from '@/types/api';

const TABS = [
  { key: 'details', label: 'Details', title: 'Details', component: DetailsTab },
  { key: 'photos', label: 'Photos', title: 'Photos', component: PhotosTab },
  { key: 'amenities', label: 'Amenities', title: 'Amenities', component: AmenitiesTab },
  { key: 'rules', label: 'House rules', title: 'House rules', component: HouseRulesTab },
  { key: 'pricing', label: 'Pricing and seasons', title: 'Pricing and seasons', component: PricingTab },
  { key: 'calendar', label: 'Calendar', title: 'Calendar and blocks', component: CalendarTab },
  { key: 'reviews', label: 'Reviews', title: 'Reviews', component: ReviewsTab },
] as const;

type TabKey = typeof TABS[number]['key'];

export const HostListingPage: React.FC = () => {
  useDocumentTitle('Manage listing');
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const listingId = Number(id);
  const tab = (searchParams.get('tab') || 'details') as TabKey;
  const validTab = TABS.some((t) => t.key === tab) ? tab : 'details';

  const listing = useHostListing(Number.isFinite(listingId) && listingId > 0 ? listingId : null);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  if (listing.isLoading) {
    return (
      <div className="mx-auto max-w-content px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-12 w-full" />
        <Skeleton className="mt-4 h-96 w-full" />
      </div>
    );
  }

  if (listing.error || !listing.data) {
    return (
      <div className="mx-auto max-w-content px-4 py-8 sm:px-6">
        <ErrorState error={listing.error} onRetry={() => void listing.refetch()} />
      </div>
    );
  }

  const data = listing.data;
  const isReadOnly = data.status === 'PENDING_REVIEW';
  const TabComponent = TABS.find((t) => t.key === validTab)?.component ?? DetailsTab;
  const activeTitle = TABS.find((t) => t.key === validTab)?.title ?? 'Manage listing';

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">{data.title}</h1>
          <StatusBadge status={data.status} kind="listing" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.HOST_LISTINGS}>All listings</Link>
          </Button>
        </div>
      </div>

      {isReadOnly && (
        <Banner tone="warning" className="mt-4">
          Editing is locked while we review this listing.
        </Banner>
      )}

      {!user?.emailVerified && (
        <Banner tone="warning" className="mt-4">
          Confirm your email to submit or edit listings. <Button variant="link" size="sm" asChild><Link to={ROUTES.ACCOUNT_SECURITY}>Resend verification</Link></Button>
        </Banner>
      )}

      <Tabs value={validTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={validTab} className="mt-5">
          {isReadOnly ? (
            <div className="opacity-70">
              <TabComponent listing={data} />
            </div>
          ) : (
            <TabComponent listing={data} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
