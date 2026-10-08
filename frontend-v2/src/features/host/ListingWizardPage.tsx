import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useListingMutations, useHostListing } from '@/features/listings/api';
import { queryKeys } from '@/api/queryKeys';
import { useAmenities } from '@/features/search/api';
import { basicsSchema, locationSchema, spaceSchema, pricingSchema, bookingRulesSchema, toListingRequest } from '@/features/host/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { AiDescriptionHelper } from './components/AiDescriptionHelper';
import { Button, Card, ErrorState, Field, InlineAlert, Input, RadioGroup, Select, Skeleton, Stepper, Switch, Textarea, TraceId } from '@/components/ui';
import { MapView } from '@/components/patterns/MapView';
import { ApiError } from '@/api/errors';
import { toast } from 'sonner';
import { applyFieldErrors } from '@/components/ui';
import { propertyTypeLabels, cancellationPolicyLabels } from '@/lib/status';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/cn';
import { PhotosTab } from './components/PhotosTab';

const STEPS = ['Basics','Location','Space','Pricing','Booking rules','Amenities','House rules','Photos','Review'];

type Draft = { basics: z.infer<typeof basicsSchema>; location: z.infer<typeof locationSchema>; space: z.infer<typeof spaceSchema>; pricing: z.infer<typeof pricingSchema>; rules: z.infer<typeof bookingRulesSchema> };

const COUNTRIES = ['US','CA','GB','FR','DE','ES','IT','AU','BR','MX','JP','KR','IN','OTHER'];

export const ListingWizardPage: React.FC = () => {
  useDocumentTitle('List your property');
  const navigate = useNavigate();
  const { user } = useAuth();
  const mutations = useListingMutations();
  const amenitiesQuery = useAmenities();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  // The draft is served from the cache so photo/amenity mutations invalidate
  // into it: local state here would go stale and hide newly uploaded photos.
  const { data: draftListing } = useHostListing(draftId);

  const basicsForm = useForm<z.infer<typeof basicsSchema>>({ resolver: zodResolver(basicsSchema), defaultValues: { propertyType: 'APARTMENT', title: '', description: '' } });
  const locationForm = useForm<z.infer<typeof locationSchema>>({ resolver: zodResolver(locationSchema), defaultValues: { addressLine: '', city: '', stateRegion: '', country: 'US', postalCode: '', latitude: '', longitude: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
  const spaceForm = useForm<z.infer<typeof spaceSchema>>({ resolver: zodResolver(spaceSchema), defaultValues: { maxGuests: 2, bedrooms: 1, beds: 1, bathrooms: 1 } });
  const pricingForm = useForm<z.infer<typeof pricingSchema>>({ resolver: zodResolver(pricingSchema), defaultValues: { baseNightlyPrice: '', weekendMultiplier: '1', cleaningFee: '0', weeklyDiscountPercent: '0', monthlyDiscountPercent: '0' } });
  const bookingForm = useForm<z.infer<typeof bookingRulesSchema>>({ resolver: zodResolver(bookingRulesSchema), defaultValues: { minNights: 1, maxNights: 7, advanceNoticeDays: 1, bookingWindowDays: 365, checkInTime: '15:00', checkOutTime: '11:00', cancellationPolicy: 'MODERATE', instantBook: false } });

  const [selectedAmenities, setSelectedAmenities] = useState<number[]>([]);
  const [rules, setRules] = useState<{ text: string; sortOrder: number }[]>([{ text: '', sortOrder: 0 }]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('haven.wizard.draft');
      if (!raw) return;
      const draft = JSON.parse(raw) as Draft;
      basicsForm.reset(draft.basics);
      locationForm.reset(draft.location);
      spaceForm.reset(draft.space);
      pricingForm.reset(draft.pricing);
      bookingForm.reset(draft.rules);
    } catch { /* ignore */ }
  }, []);

  const saveDraft = () => {
    const draft: Draft = { basics: basicsForm.getValues(), location: locationForm.getValues(), space: spaceForm.getValues(), pricing: pricingForm.getValues(), rules: bookingForm.getValues() };
    try { localStorage.setItem('haven.wizard.draft', JSON.stringify(draft)); } catch { /* ignore */ }
  };

  const onNext = async () => {
    setError(null);
    setTrace(null);
    if (step === 0) { const ok = await basicsForm.trigger(); if (!ok) return; saveDraft(); }
    else if (step === 1) { const ok = await locationForm.trigger(); if (!ok) return; saveDraft(); }
    else if (step === 2) { const ok = await spaceForm.trigger(); if (!ok) return; saveDraft(); }
    else if (step === 3) { const ok = await pricingForm.trigger(); if (!ok) return; saveDraft(); }
    else if (step === 4) {
      const ok = await bookingForm.trigger();
      if (!ok) return;
      saveDraft();
      const payload = toListingRequest({
        basics: basicsForm.getValues(),
        location: locationForm.getValues(),
        space: spaceForm.getValues(),
        pricing: pricingForm.getValues(),
        rules: bookingForm.getValues(),
      });
      try {
        const res = await mutations.createDraft.mutateAsync(payload);
        queryClient.setQueryData(queryKeys.hostListing(res.id), res);
        setDraftId(res.id);
        localStorage.removeItem('haven.wizard.draft');
        toast.success('Draft created');
      } catch (e) {
        const api = e instanceof ApiError ? e : null;
        setError(api?.detail ?? 'Could not create draft.');
        setTrace(e);
        return;
      }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const onBack = () => setStep((s) => Math.max(0, s - 1));

  const onFinish = async () => {
    if (!draftId) return;
    setError(null);
    try {
      await mutations.submit.mutateAsync(draftId);
      toast.success('Submitted. We\'ll review it and notify you.');
      navigate(ROUTES.HOST_LISTINGS);
    } catch (e) {
      const api = e instanceof ApiError ? e : null;
      if (api?.code === 'BUSINESS_RULE_VIOLATION') {
        setError(api.detail ?? 'Please check the required fields.');
      } else {
        setError(api?.detail ?? 'Could not submit.');
      }
      setTrace(e);
    }
  };

  const isDraftStep = step === 4;

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-ink">List your property</h1>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-56 shrink-0">
          <ol className="flex flex-col gap-2 lg:sticky lg:top-24">
            {STEPS.map((label, idx) => (
              <li key={label} className={cn('flex items-center gap-2 text-sm', idx === step ? 'text-ink font-medium' : 'text-muted')}>
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border text-xs tabular', idx === step ? 'border-primary bg-primary text-white' : 'border-line')}>{idx + 1}</span>
                <span className="hidden sm:inline">{label}</span>
              </li>
            ))}
          </ol>
        </aside>
        <div className="flex-1">
          {step === 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">Basics</h2>
              <div className="mt-4 flex flex-col gap-4">
                <AiDescriptionHelper propertyType={basicsForm.watch('propertyType')} city={locationForm.watch('city')} onUse={(text) => basicsForm.setValue('description', text)} />
                <Field label="Property type" htmlFor="w-basics-prop" error={basicsForm.formState.errors.propertyType?.message} required>
                  <Select id="w-basics-prop" {...basicsForm.register('propertyType')}>
                    {Object.entries(propertyTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
                <Field label="Title" htmlFor="w-basics-title" error={basicsForm.formState.errors.title?.message} required>
                  <Input id="w-basics-title" {...basicsForm.register('title')} />
                </Field>
                <Field label="Description" htmlFor="w-basics-desc" error={basicsForm.formState.errors.description?.message} required>
                  <Textarea id="w-basics-desc" {...basicsForm.register('description')} />
                </Field>
              </div>
            </Card>
          )}
          {step === 1 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">Location</h2>
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Address" htmlFor="w-loc-addr" error={locationForm.formState.errors.addressLine?.message} required>
                    <Input id="w-loc-addr" {...locationForm.register('addressLine')} />
                  </Field>
                  <Field label="City" htmlFor="w-loc-city" error={locationForm.formState.errors.city?.message} required>
                    <Input id="w-loc-city" {...locationForm.register('city')} />
                  </Field>
                  <Field label="State / region" htmlFor="w-loc-state" error={locationForm.formState.errors.stateRegion?.message}>
                    <Input id="w-loc-state" {...locationForm.register('stateRegion')} />
                  </Field>
                  <Field label="Country" htmlFor="w-loc-country" error={locationForm.formState.errors.country?.message} required>
                    <Select id="w-loc-country" {...locationForm.register('country')}>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                  <Field label="Postal code" htmlFor="w-loc-post" error={locationForm.formState.errors.postalCode?.message}>
                    <Input id="w-loc-post" {...locationForm.register('postalCode')} />
                  </Field>
                  <Field label="Timezone" htmlFor="w-loc-tz" error={locationForm.formState.errors.timezone?.message} required>
                    <Select id="w-loc-tz" {...locationForm.register('timezone')}>
                      {(Intl.supportedValuesOf('timeZone') ?? []).map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Latitude" htmlFor="w-loc-lat" error={locationForm.formState.errors.latitude?.message} required>
                    <Input id="w-loc-lat" type="text" inputMode="decimal" {...locationForm.register('latitude')} />
                  </Field>
                  <Field label="Longitude" htmlFor="w-loc-lng" error={locationForm.formState.errors.longitude?.message} required>
                    <Input id="w-loc-lng" type="text" inputMode="decimal" {...locationForm.register('longitude')} />
                  </Field>
                </div>
                <div className="h-64 w-full overflow-hidden rounded-card">
                  <MapView latitude={Number(locationForm.watch('latitude') || 0)} longitude={Number(locationForm.watch('longitude') || 0)} label={locationForm.watch('addressLine') || ''} className="h-full w-full" />
                </div>
              </div>
            </Card>
          )}
          {step === 2 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">Space</h2>
              <div className="mt-4 flex flex-col gap-5">
                <Stepper label="Max guests" value={spaceForm.watch('maxGuests')} min={1} max={50} onChange={(v) => spaceForm.setValue('maxGuests', v)} />
                <Stepper label="Bedrooms" value={spaceForm.watch('bedrooms')} min={0} max={50} onChange={(v) => spaceForm.setValue('bedrooms', v)} />
                <Stepper label="Beds" value={spaceForm.watch('beds')} min={1} max={100} onChange={(v) => spaceForm.setValue('beds', v)} />
                <Stepper label="Bathrooms" value={spaceForm.watch('bathrooms')} min={0} max={50} onChange={(v) => spaceForm.setValue('bathrooms', v)} />
              </div>
            </Card>
          )}
          {step === 3 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">Pricing</h2>
              <p className="mt-1 text-sm text-muted">Guests also pay a service fee and tax set by the platform.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nightly price" htmlFor="w-price-base" error={pricingForm.formState.errors.baseNightlyPrice?.message} required>
                  <Input id="w-price-base" type="text" inputMode="decimal" {...pricingForm.register('baseNightlyPrice')} />
                </Field>
                <Field label="Weekend multiplier" htmlFor="w-price-weekend" error={pricingForm.formState.errors.weekendMultiplier?.message} required>
                  <Input id="w-price-weekend" type="text" inputMode="decimal" {...pricingForm.register('weekendMultiplier')} />
                </Field>
                <Field label="Cleaning fee" htmlFor="w-price-clean" error={pricingForm.formState.errors.cleaningFee?.message}>
                  <Input id="w-price-clean" type="text" inputMode="decimal" {...pricingForm.register('cleaningFee')} />
                </Field>
                <Field label="Weekly discount %" htmlFor="w-price-weekly" error={pricingForm.formState.errors.weeklyDiscountPercent?.message}>
                  <Input id="w-price-weekly" type="text" inputMode="decimal" {...pricingForm.register('weeklyDiscountPercent')} />
                </Field>
                <Field label="Monthly discount %" htmlFor="w-price-monthly" error={pricingForm.formState.errors.monthlyDiscountPercent?.message}>
                  <Input id="w-price-monthly" type="text" inputMode="decimal" {...pricingForm.register('monthlyDiscountPercent')} />
                </Field>
              </div>
            </Card>
          )}
          {step === 4 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">Booking rules</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Minimum nights" htmlFor="w-rules-min" error={bookingForm.formState.errors.minNights?.message} required>
                  <Input id="w-rules-min" type="number" {...bookingForm.register('minNights')} />
                </Field>
                <Field label="Maximum nights" htmlFor="w-rules-max" error={bookingForm.formState.errors.maxNights?.message} required>
                  <Input id="w-rules-max" type="number" {...bookingForm.register('maxNights')} />
                </Field>
                <Field label="Advance notice (days)" htmlFor="w-rules-adv" error={bookingForm.formState.errors.advanceNoticeDays?.message} required>
                  <Input id="w-rules-adv" type="number" {...bookingForm.register('advanceNoticeDays')} />
                </Field>
                <Field label="Booking window (days)" htmlFor="w-rules-win" error={bookingForm.formState.errors.bookingWindowDays?.message} required>
                  <Input id="w-rules-win" type="number" {...bookingForm.register('bookingWindowDays')} />
                </Field>
                <Field label="Check-in time" htmlFor="w-rules-ci" error={bookingForm.formState.errors.checkInTime?.message} required>
                  <Input id="w-rules-ci" type="time" {...bookingForm.register('checkInTime')} />
                </Field>
                <Field label="Check-out time" htmlFor="w-rules-co" error={bookingForm.formState.errors.checkOutTime?.message} required>
                  <Input id="w-rules-co" type="time" {...bookingForm.register('checkOutTime')} />
                </Field>
              </div>
              <Field label="Cancellation policy" htmlFor="w-rules-cancel" error={bookingForm.formState.errors.cancellationPolicy?.message} required>
                <RadioGroup name="cancel" value={bookingForm.watch('cancellationPolicy')} onChange={(v) => bookingForm.setValue('cancellationPolicy', v as any)} options={([
                  { value: 'FLEXIBLE', label: 'Flexible', description: 'Full refund up to 24 hours before check-in.' },
                  { value: 'MODERATE', label: 'Moderate', description: 'Full refund up to 5 days before check-in.' },
                  { value: 'STRICT', label: 'Strict', description: 'Half refund up to 1 week before check-in.' },
                ])} />
              </Field>
              <div className="mt-4">
                <Switch label="Instant Book" description="Guests can book without waiting for your approval." checked={bookingForm.watch('instantBook')} onCheckedChange={(v) => bookingForm.setValue('instantBook', v)} />
              </div>
            </Card>
          )}
          {step === 5 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">Amenities</h2>
              <p className="mt-1 text-sm text-muted">Select up to 50 amenities. {selectedAmenities.length} selected.</p>
              {amenitiesQuery.isLoading ? (
                <div className="mt-4"><Skeleton className="h-6 w-full" /></div>
              ) : amenitiesQuery.error ? (
                <ErrorState error={amenitiesQuery.error} onRetry={() => void amenitiesQuery.refetch()} />
              ) : (
                <div className="mt-4 flex flex-col gap-5">
                  {(() => {
                    const amenities = amenitiesQuery.data ?? [];
                    const groups = amenities.reduce<Record<string, typeof amenities>>((acc, a) => { const k = a.category || 'Other'; acc[k] = [...(acc[k] ?? []), a]; return acc; }, {});
                    return Object.entries(groups).map(([cat, items]) => (
                      <div key={cat}>
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{cat}</h3>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {items.map((a) => {
                            const checked = selectedAmenities.includes(a.id);
                            return (
                              <label key={a.id} className={cn('flex cursor-pointer items-start gap-3 rounded-control border p-3', checked ? 'border-primary bg-primary-soft/40' : 'border-line hover:bg-bg')}>
                                <input type="checkbox" checked={checked} onChange={(e) => setSelectedAmenities(e.target.checked ? [...selectedAmenities, a.id] : selectedAmenities.filter((id) => id !== a.id))} className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-2 focus:ring-primary/30" />
                                <span className="text-sm text-ink">{a.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Card>
          )}
          {step === 6 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">House rules</h2>
              <p className="mt-1 text-sm text-muted">Up to 15 rules, each 200 characters or fewer.</p>
              <div className="mt-4 flex flex-col gap-3">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-2 text-xs text-muted tabular">{i + 1}.</span>
                    <Input value={rule.text} maxLength={200} onChange={(e) => { const next = [...rules]; next[i] = { text: e.target.value, sortOrder: i }; setRules(next); }} placeholder="e.g. No smoking" className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRules(rules.filter((_, idx) => idx !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {rules.length < 15 && <Button type="button" variant="outline" size="sm" onClick={() => setRules([...rules, { text: '', sortOrder: rules.length }])}>Add rule</Button>}
              </div>
            </Card>
          )}
          {step === 7 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">Photos</h2>
              <p className="mt-1 text-sm text-muted">Upload at least {BRAND.minPhotosToSubmit} photos. Max {BRAND.maxPhotosPerListing}.</p>
              {draftId ? (
                draftListing ? (
                  <PhotosTab listing={draftListing} />
                ) : (
                  <div className="mt-4"><Skeleton className="h-48 w-full" /></div>
                )
              ) : (
                <p className="mt-4 text-sm text-muted">Save a draft first to upload photos.</p>
              )}
            </Card>
          )}
          {step === 8 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-ink">Review and submit</h2>
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                <li className={cn('flex items-center gap-2', basicsForm.getValues().title.length >= 10 ? 'text-success-text' : 'text-danger-text')}><Check className="h-4 w-4" />Basics filled</li>
                <li className={cn('flex items-center gap-2', locationForm.getValues().addressLine ? 'text-success-text' : 'text-danger-text')}><Check className="h-4 w-4" />Location provided</li>
                <li className={cn('flex items-center gap-2', selectedAmenities.length > 0 ? 'text-success-text' : 'text-danger-text')}><Check className="h-4 w-4" />{selectedAmenities.length} amenit{selectedAmenities.length === 1 ? 'y' : 'ies'} selected</li>
                <li className={cn('flex items-center gap-2', rules.some((r) => r.text.trim()) ? 'text-success-text' : 'text-danger-text')}><Check className="h-4 w-4" />{rules.filter((r) => r.text.trim()).length} house rule{rules.filter((r) => r.text.trim()).length === 1 ? '' : 's'} added</li>
                <li className={cn('flex items-center gap-2', draftListing?.photos && draftListing.photos.length >= BRAND.minPhotosToSubmit ? 'text-success-text' : 'text-danger-text')}><Check className="h-4 w-4" />{draftListing?.photos?.length ?? 0} photo{((draftListing?.photos?.length ?? 0) === 1) ? '' : 's'} uploaded</li>
                <li className={cn('flex items-center gap-2', user?.emailVerified ? 'text-success-text' : 'text-danger-text')}><Check className="h-4 w-4" />Email verified</li>
              </ul>
              {error && <InlineAlert tone="danger" className="mt-4">{error}<TraceId error={trace} className="mt-1 block" /></InlineAlert>}
              <div className="mt-6 flex justify-end">
                <Button size="lg" onClick={onFinish} loading={mutations.submit.isPending} disabled={!draftId || !draftListing?.photos || draftListing.photos.length < BRAND.minPhotosToSubmit}>Submit listing</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-content items-center justify-between px-4 sm:px-6">
        <Button variant="outline" onClick={onBack} disabled={step === 0}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</Button>
        <span className="text-sm text-muted">Step {step + 1} of {STEPS.length}</span>
        {step < STEPS.length - 1 && (
          <Button onClick={onNext} loading={isDraftStep && mutations.createDraft.isPending}>
            {isDraftStep ? 'Create draft' : <><ArrowRight className="h-4 w-4" aria-hidden /> Next</>}
          </Button>
        )}
      </div>
    </div>
  );
};
