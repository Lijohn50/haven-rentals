import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useListingMutations, useSeasonalRates } from '@/features/listings/api';
import { seasonalRateSchema } from '@/features/host/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Button, Card, ErrorState, Field, InlineAlert, Input, Skeleton, TraceId, applyFieldErrors } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/local-date';
import { todayIn, addDays } from '@/lib/local-date';
import { ApiError } from '@/api/errors';
import { toast } from 'sonner';
import type { ListingResponse } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(60),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick an end date'),
  nightlyPrice: z.string().trim().refine((v) => /^\d{1,7}(\.\d{1,2})?$/.test(v), 'Enter a valid price'),
});
type Values = z.infer<typeof schema>;

export const PricingTab: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Values | null>(null);
  const mutations = useListingMutations(listing.id);
  const seasons = useSeasonalRates(listing.id);
  const [localError, setLocalError] = useState<string | null>(null);

  const baseForm = useForm({
    defaultValues: {
      baseNightlyPrice: String(listing.baseNightlyPrice),
      weekendMultiplier: String(listing.weekendMultiplier ?? 1),
      cleaningFee: String(listing.cleaningFee ?? 0),
      weeklyDiscountPercent: String(listing.weeklyDiscountPercent ?? 0),
      monthlyDiscountPercent: String(listing.monthlyDiscountPercent ?? 0),
    },
  });

  const [baseMessage, setBaseMessage] = useState<string | null>(null);
  const [baseTrace, setBaseTrace] = useState<unknown>(null);

  const onBaseSubmit = async (values: Record<string, string>) => {
    setBaseMessage(null);
    setBaseTrace(null);
    const payload = {
      ...listing,
      baseNightlyPrice: Number(values.baseNightlyPrice),
      weekendMultiplier: Number(values.weekendMultiplier),
      cleaningFee: Number(values.cleaningFee),
      weeklyDiscountPercent: Number(values.weeklyDiscountPercent),
      monthlyDiscountPercent: Number(values.monthlyDiscountPercent),
    };
    try {
      await mutations.update.mutateAsync({ id: listing.id, payload });
      toast.success('Pricing updated');
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      setBaseMessage(api?.detail ?? 'Could not save pricing.');
      setBaseTrace(error);
    }
  };

  const startCreate = () => {
    setEditingId(null);
    setEditValues({ name: '', startDate: todayIn(), endDate: addDays(todayIn(), 1), nightlyPrice: '' });
    setLocalError(null);
  };

  const startEdit = (season: { id: number; name: string; startDate: string; endDate: string; nightlyPrice: number }) => {
    setEditingId(season.id);
    setEditValues({ name: season.name, startDate: season.startDate, endDate: season.endDate, nightlyPrice: String(season.nightlyPrice) });
    setLocalError(null);
  };

  const submitSeason = async () => {
    if (!editValues) return;
    const parsed = seasonalRateSchema.safeParse(editValues);
    if (!parsed.success) {
      setLocalError(parsed.error.errors[0]?.message ?? 'Invalid season');
      return;
    }
    setLocalError(null);
    // The form keeps prices as strings so the inputs stay controlled; the API contract
    // wants a number.
    const payload = { ...parsed.data, nightlyPrice: Number(parsed.data.nightlyPrice) };
    try {
      if (editingId === null) {
        await mutations.createSeasonalRate.mutateAsync({ id: listing.id, payload });
        toast.success('Season created');
      } else {
        await mutations.updateSeasonalRate.mutateAsync({ id: listing.id, rateId: editingId, payload });
        toast.success('Season updated');
      }
      setEditValues(null);
      setEditingId(null);
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      if (api?.code === 'DUPLICATE_RESOURCE') {
        setLocalError('This overlaps another season');
      } else {
        setLocalError(api?.detail ?? 'Could not save season');
      }
    }
  };

  const deleteSeason = async (rateId: number) => {
    try {
      await mutations.deleteSeasonalRate.mutateAsync({ id: listing.id, rateId });
      toast.success('Season removed');
    } catch {
      toast.error('Could not remove season');
    }
  };

  const { isSubmitting } = baseForm.formState;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Base pricing</h2>
        <p className="mt-1 text-sm text-muted">Seasonal prices don&apos;t change existing bookings.</p>

        <form className="mt-4 flex flex-col gap-4" onSubmit={baseForm.handleSubmit(onBaseSubmit)} noValidate>
          {baseMessage && (
            <InlineAlert tone="danger">
              {baseMessage}
              <TraceId error={baseTrace} className="mt-1 block" />
            </InlineAlert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nightly price" htmlFor="price-base" error={baseForm.formState.errors.baseNightlyPrice?.message} required>
              <Input id="price-base" type="text" inputMode="decimal" {...baseForm.register('baseNightlyPrice')} hasError={Boolean(baseForm.formState.errors.baseNightlyPrice)} />
            </Field>
            <Field label="Weekend multiplier" htmlFor="price-weekend" error={baseForm.formState.errors.weekendMultiplier?.message} required>
              <Input id="price-weekend" type="text" inputMode="decimal" {...baseForm.register('weekendMultiplier')} />
            </Field>
            <Field label="Cleaning fee" htmlFor="price-cleaning" error={baseForm.formState.errors.cleaningFee?.message}>
              <Input id="price-cleaning" type="text" inputMode="decimal" {...baseForm.register('cleaningFee')} />
            </Field>
            <Field label="Weekly discount %" htmlFor="price-weekly" error={baseForm.formState.errors.weeklyDiscountPercent?.message}>
              <Input id="price-weekly" type="text" inputMode="decimal" {...baseForm.register('weeklyDiscountPercent')} />
            </Field>
            <Field label="Monthly discount %" htmlFor="price-monthly" error={baseForm.formState.errors.monthlyDiscountPercent?.message}>
              <Input id="price-monthly" type="text" inputMode="decimal" {...baseForm.register('monthlyDiscountPercent')} />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting || mutations.update.isPending}>Save pricing</Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Seasonal rates</h2>
          <Button size="sm" onClick={startCreate} disabled={editingId !== null}>
            <Plus className="h-4 w-4" aria-hidden />
            Add season
          </Button>
        </div>

        {seasons.isLoading ? (
          <div className="mt-4"><Skeleton className="h-16 w-full" /></div>
        ) : seasons.error ? (
          <div className="mt-4"><ErrorState error={seasons.error} onRetry={() => void seasons.refetch()} /></div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {(seasons.data ?? []).map((season) => (
              <div key={season.id} className="flex flex-col gap-2 rounded-control border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{season.name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(season.startDate)} – {formatDate(season.endDate)} · {formatMoney(season.nightlyPrice)} / night
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(season)} disabled={editingId === season.id}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => deleteSeason(season.id)}>Delete</Button>
                </div>
              </div>
            ))}
            {(seasons.data ?? []).length === 0 && (
              <p className="text-sm text-muted">No seasonal rates yet.</p>
            )}
          </div>
        )}

        {editValues && (
          <div className="mt-6 rounded-card border border-line bg-bg p-4">
            <h3 className="text-sm font-semibold text-ink">{editingId === null ? 'New season' : 'Edit season'}</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="season-name" error={localError ? undefined : undefined}>
                <Input id="season-name" value={editValues.name} onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
              </Field>
              <Field label="Nightly price" htmlFor="season-price">
                <Input id="season-price" type="text" inputMode="decimal" value={editValues.nightlyPrice} onChange={(e) => setEditValues({ ...editValues, nightlyPrice: e.target.value })} />
              </Field>
              <Field label="Start date" htmlFor="season-start">
                <Input id="season-start" type="date" value={editValues.startDate} onChange={(e) => setEditValues({ ...editValues, startDate: e.target.value })} />
              </Field>
              <Field label="End date" htmlFor="season-end">
                <Input id="season-end" type="date" value={editValues.endDate} onChange={(e) => setEditValues({ ...editValues, endDate: e.target.value })} />
              </Field>
            </div>
            {localError && <InlineAlert tone="danger" className="mt-2">{localError}</InlineAlert>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditValues(null); setEditingId(null); }}>Cancel</Button>
              <Button size="sm" onClick={submitSeason} loading={mutations.createSeasonalRate.isPending || mutations.updateSeasonalRate.isPending}>
                {editingId === null ? 'Create' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
