import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useListingMutations } from '@/features/listings/api';
import { basicsSchema, locationSchema, spaceSchema, bookingRulesSchema, toListingRequest } from '@/features/host/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { AiDescriptionHelper } from './AiDescriptionHelper';
import { Button, Card, Dialog, DialogContent, DialogDescription, DialogTitle, Field, InlineAlert, Input, Select, Skeleton, Switch, Textarea, TraceId, applyFieldErrors } from '@/components/ui';
import { MapView } from '@/components/patterns/MapView';
import { ApiError } from '@/api/errors';
import { toast } from 'sonner';
import { ROUTES } from '@/config/routes';
import { useNavigate } from 'react-router-dom';
import { propertyTypeLabels, cancellationPolicyLabels } from '@/lib/status';
import { BRAND } from '@/config/brand';
import type { ListingResponse } from '@/types/api';

const schema = z.object({
  basics: basicsSchema,
  location: locationSchema,
  space: spaceSchema,
  rules: bookingRulesSchema,
});
type Values = z.infer<typeof schema>;

const COUNTRIES = ['US','CA','GB','FR','DE','ES','IT','AU','BR','MX','JP','KR','IN','OTHER'];

export const DetailsTab: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  useDocumentTitle('Details');
  const mutations = useListingMutations(listing.id);
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [reviewConfirm, setReviewConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Values | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      basics: { propertyType: listing.propertyType, title: listing.title, description: listing.description },
      location: { addressLine: listing.addressLine, city: listing.city, stateRegion: listing.stateRegion ?? undefined, country: listing.country, postalCode: listing.postalCode ?? undefined, latitude: String(listing.latitude), longitude: String(listing.longitude), timezone: listing.timezone },
      space: { maxGuests: listing.maxGuests, bedrooms: listing.bedrooms, beds: listing.beds, bathrooms: listing.bathrooms },
      rules: { minNights: listing.minNights, maxNights: listing.maxNights, advanceNoticeDays: listing.advanceNoticeDays, bookingWindowDays: listing.bookingWindowDays, checkInTime: listing.checkInTime?.slice(0,5) ?? '15:00', checkOutTime: listing.checkOutTime?.slice(0,5) ?? '11:00', cancellationPolicy: listing.cancellationPolicy, instantBook: listing.instantBook },
    },
  });

  useEffect(() => {
    form.reset({
      basics: { propertyType: listing.propertyType, title: listing.title, description: listing.description },
      location: { addressLine: listing.addressLine, city: listing.city, stateRegion: listing.stateRegion ?? undefined, country: listing.country, postalCode: listing.postalCode ?? undefined, latitude: String(listing.latitude), longitude: String(listing.longitude), timezone: listing.timezone },
      space: { maxGuests: listing.maxGuests, bedrooms: listing.bedrooms, beds: listing.beds, bathrooms: listing.bathrooms },
      rules: { minNights: listing.minNights, maxNights: listing.maxNights, advanceNoticeDays: listing.advanceNoticeDays, bookingWindowDays: listing.bookingWindowDays, checkInTime: listing.checkInTime?.slice(0,5) ?? '15:00', checkOutTime: listing.checkOutTime?.slice(0,5) ?? '11:00', cancellationPolicy: listing.cancellationPolicy, instantBook: listing.instantBook },
    });
  }, [listing, form]);

  // toListingRequest always builds a complete ListingRequest, but this tab only owns
  // basics/location/space/rules. Carry the listing's current pricing through untouched so
  // saving the details tab cannot blank out the Pricing tab's work.
  const currentPricing = {
    baseNightlyPrice: String(listing.baseNightlyPrice),
    weekendMultiplier: String(listing.weekendMultiplier ?? 1),
    cleaningFee: String(listing.cleaningFee ?? 0),
    weeklyDiscountPercent: String(listing.weeklyDiscountPercent ?? 0),
    monthlyDiscountPercent: String(listing.monthlyDiscountPercent ?? 0),
  };

  const buildRequest = (values: Values) =>
    toListingRequest({ ...values, pricing: currentPricing });

  const dirtyFields = (): string[] => {
    const changed: string[] = [];
    const v = form.getValues();
    if (v.basics.propertyType !== listing.propertyType) changed.push('propertyType');
    if (v.location.city !== listing.city) changed.push('city');
    if (v.location.country !== listing.country) changed.push('country');
    if (Number(v.location.latitude) !== listing.latitude) changed.push('latitude');
    if (Number(v.location.longitude) !== listing.longitude) changed.push('longitude');
    if (v.location.addressLine !== listing.addressLine) changed.push('addressLine');
    return changed;
  };

  const onSubmit = async (values: Values) => {
    const changed = dirtyFields();
    if (changed.length > 0 && listing.status === 'ACTIVE') {
      setPendingPayload(values);
      setReviewConfirm(true);
      return;
    }
    setMessage(null);
    setTrace(null);
    try {
      await mutations.update.mutateAsync({ id: listing.id, payload: buildRequest(values) });
      toast.success('Listing updated');
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      if (api?.code === 'CONCURRENT_MODIFICATION') { setMessage('Someone changed this listing. Reload'); setTrace(error); return; }
      const setFieldError = (name: string, text: string) => form.setError(name as any, { message: text });
      const unmatched = applyFieldErrors(error, setFieldError, ['basics.propertyType','location.city','location.country','location.latitude','location.longitude','location.addressLine']);
      setMessage(unmatched[0] ?? (api?.detail ?? 'Could not save.'));
      setTrace(error);
    }
  };

  const confirmReview = async () => {
    if (!pendingPayload) return;
    setReviewConfirm(false);
    setMessage(null);
    setTrace(null);
    try {
      await mutations.update.mutateAsync({ id: listing.id, payload: buildRequest(pendingPayload) });
      toast.success('Listing updated and moved to review');
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      if (api?.code === 'CONCURRENT_MODIFICATION') { setMessage('Someone changed this listing. Reload'); setTrace(error); return; }
      setMessage(api?.detail ?? 'Could not save.');
      setTrace(error);
    }
  };

  const { isSubmitting } = form.formState;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Details</h2>
        <form className="mt-4 flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {message && <InlineAlert tone="danger">{message}<TraceId error={trace} className="mt-1 block" /></InlineAlert>}

          <AiDescriptionHelper propertyType={form.watch('basics.propertyType')} city={form.watch('location.city')} onUse={(text) => form.setValue('basics.description', text)} />

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Basics</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Property type" htmlFor="det-prop" error={form.formState.errors.basics?.propertyType?.message} required>
              <Select id="det-prop" {...form.register('basics.propertyType')} hasError={Boolean(form.formState.errors.basics?.propertyType)}>
                {Object.entries(propertyTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Title" htmlFor="det-title" error={form.formState.errors.basics?.title?.message} required>
              <Input id="det-title" {...form.register('basics.title')} hasError={Boolean(form.formState.errors.basics?.title)} />
            </Field>
          </div>
          <Field label="Description" htmlFor="det-desc" error={form.formState.errors.basics?.description?.message} required>
            <Textarea id="det-desc" {...form.register('basics.description')} hasError={Boolean(form.formState.errors.basics?.description)} />
          </Field>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Location</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Address" htmlFor="det-addr" error={form.formState.errors.location?.addressLine?.message} required>
              <Input id="det-addr" {...form.register('location.addressLine')} />
            </Field>
            <Field label="City" htmlFor="det-city" error={form.formState.errors.location?.city?.message} required>
              <Input id="det-city" {...form.register('location.city')} />
            </Field>
            <Field label="State / region" htmlFor="det-state" error={form.formState.errors.location?.stateRegion?.message}>
              <Input id="det-state" {...form.register('location.stateRegion')} />
            </Field>
            <Field label="Country" htmlFor="det-country" error={form.formState.errors.location?.country?.message} required>
              <Select id="det-country" {...form.register('location.country')}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Postal code" htmlFor="det-post" error={form.formState.errors.location?.postalCode?.message}>
              <Input id="det-post" {...form.register('location.postalCode')} />
            </Field>
            <Field label="Timezone" htmlFor="det-tz" error={form.formState.errors.location?.timezone?.message} required>
              <Select id="det-tz" {...form.register('location.timezone')}>
                {(Intl.supportedValuesOf('timeZone') ?? []).map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Latitude" htmlFor="det-lat" error={form.formState.errors.location?.latitude?.message} required>
              <Input id="det-lat" type="text" inputMode="decimal" {...form.register('location.latitude')} />
            </Field>
            <Field label="Longitude" htmlFor="det-lng" error={form.formState.errors.location?.longitude?.message} required>
              <Input id="det-lng" type="text" inputMode="decimal" {...form.register('location.longitude')} />
            </Field>
          </div>

          <div className="h-64 w-full overflow-hidden rounded-card">
            <MapView latitude={Number(form.watch('location.latitude') || listing.latitude)} longitude={Number(form.watch('location.longitude') || listing.longitude)} label={form.watch('location.addressLine') || listing.addressLine} className="h-full w-full" />
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Space</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Max guests" htmlFor="det-guests" error={form.formState.errors.space?.maxGuests?.message} required>
              <Input id="det-guests" type="number" {...form.register('space.maxGuests')} />
            </Field>
            <Field label="Bedrooms" htmlFor="det-bed" error={form.formState.errors.space?.bedrooms?.message}>
              <Input id="det-bed" type="number" {...form.register('space.bedrooms')} />
            </Field>
            <Field label="Beds" htmlFor="det-beds" error={form.formState.errors.space?.beds?.message} required>
              <Input id="det-beds" type="number" {...form.register('space.beds')} />
            </Field>
            <Field label="Bathrooms" htmlFor="det-bath" error={form.formState.errors.space?.bathrooms?.message}>
              <Input id="det-bath" type="number" step="0.5" {...form.register('space.bathrooms')} />
            </Field>
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Booking rules</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Minimum nights" htmlFor="det-min" error={form.formState.errors.rules?.minNights?.message} required>
              <Input id="det-min" type="number" {...form.register('rules.minNights')} />
            </Field>
            <Field label="Maximum nights" htmlFor="det-max" error={form.formState.errors.rules?.maxNights?.message} required>
              <Input id="det-max" type="number" {...form.register('rules.maxNights')} />
            </Field>
            <Field label="Advance notice (days)" htmlFor="det-adv" error={form.formState.errors.rules?.advanceNoticeDays?.message} required>
              <Input id="det-adv" type="number" {...form.register('rules.advanceNoticeDays')} />
            </Field>
            <Field label="Booking window (days)" htmlFor="det-win" error={form.formState.errors.rules?.bookingWindowDays?.message} required>
              <Input id="det-win" type="number" {...form.register('rules.bookingWindowDays')} />
            </Field>
            <Field label="Check-in time" htmlFor="det-ci" error={form.formState.errors.rules?.checkInTime?.message} required>
              <Input id="det-ci" type="time" {...form.register('rules.checkInTime')} />
            </Field>
            <Field label="Check-out time" htmlFor="det-co" error={form.formState.errors.rules?.checkOutTime?.message} required>
              <Input id="det-co" type="time" {...form.register('rules.checkOutTime')} />
            </Field>
          </div>

          <Field label="Cancellation policy" htmlFor="det-cancel" error={form.formState.errors.rules?.cancellationPolicy?.message} required>
            <Select id="det-cancel" {...form.register('rules.cancellationPolicy')}>
              {(['FLEXIBLE','MODERATE','STRICT'] as const).map((p) => <option key={p} value={p}>{cancellationPolicyLabels[p]}</option>)}
            </Select>
          </Field>

          <Switch label="Instant Book" description="Guests can book without waiting for your approval." checked={form.watch('rules.instantBook')} onCheckedChange={(v) => form.setValue('rules.instantBook', v, { shouldDirty: true })} />

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting || mutations.update.isPending}>Save details</Button>
          </div>
        </form>
      </Card>

      <Dialog open={reviewConfirm} onOpenChange={setReviewConfirm}>
        <DialogContent>
          <DialogTitle>Relist for review?</DialogTitle>
          <DialogDescription>
            Changing these fields will send this listing back to review and remove it from search: {dirtyFields().join(', ')}.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReviewConfirm(false)}>Cancel</Button>
            <Button onClick={confirmReview} loading={mutations.update.isPending}>Save and review</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
