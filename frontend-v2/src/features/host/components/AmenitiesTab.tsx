import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAmenities } from '@/features/search/api';
import { useListingMutations } from '@/features/listings/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Button, Card, ErrorState, Field, InlineAlert, Skeleton, TraceId, applyFieldErrors } from '@/components/ui';
import { AmenityIcon } from '@/components/patterns/AmenityIcon';
import { ApiError } from '@/api/errors';
import { BRAND } from '@/config/brand';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

const schema = z.object({ amenityIds: z.array(z.number()).max(50, 'Select at most 50 amenities') });
type Values = z.infer<typeof schema>;

export const AmenitiesTab: React.FC<{ listing: { id: number; amenities: { id: number }[] } }> = ({ listing }) => {
  const amenities = useAmenities();
  const mutations = useListingMutations(listing.id);

  const form = useForm<Values>({
    defaultValues: { amenityIds: listing.amenities.map((a) => a.id) },
  });

  React.useEffect(() => {
    form.reset({ amenityIds: listing.amenities.map((a) => a.id) });
  }, [listing.amenities, form]);

  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);

  const onSubmit = async (values: Values) => {
    setMessage(null);
    setTrace(null);
    try {
      await mutations.setAmenities.mutateAsync({ id: listing.id, amenityIds: values.amenityIds });
      toast.success('Amenities updated');
    } catch (error) {
      const setFieldError = (name: string, text: string) => form.setError(name as keyof Values, { message: text });
      const unmatched = applyFieldErrors(error, setFieldError, ['amenityIds']);
      setMessage(unmatched[0] ?? (error instanceof ApiError ? error.detail : 'Could not save amenities.'));
      setTrace(error);
    }
  };

  const groups = React.useMemo(() => {
    if (!amenities.data) return [];
    const map = new Map<string, typeof amenities.data>();
    for (const a of amenities.data) {
      const key = a.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [amenities.data]);

  const selectedIds = new Set(form.watch('amenityIds'));

  if (amenities.isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </Card>
    );
  }

  if (amenities.error) {
    return (
      <Card className="p-6">
        <ErrorState error={amenities.error} onRetry={() => void amenities.refetch()} />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-ink">Amenities</h2>
      <p className="mt-1 text-sm text-muted">Select up to {BRAND.maxPhotosPerListing} amenities that guests can filter by.</p>

      <form className="mt-4 flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {message && (
          <InlineAlert tone="danger">
            {message}
            <TraceId error={trace} className="mt-1 block" />
          </InlineAlert>
        )}

        {groups.map((group) => (
          <div key={group.category}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{group.category}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.items.map((amenity) => {
                const checked = selectedIds.has(amenity.id);
                return (
                  <label
                    key={amenity.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors',
                      checked ? 'border-primary bg-primary-soft/40' : 'border-line hover:bg-bg'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = form.getValues('amenityIds');
                        const next = e.target.checked
                          ? [...current, amenity.id]
                          : current.filter((id) => id !== amenity.id);
                        form.setValue('amenityIds', next, { shouldDirty: true });
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <AmenityIcon name={amenity.name} icon={amenity.icon} showLabel />
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <Button type="submit" loading={mutations.setAmenities.isPending}>
            Save amenities
          </Button>
        </div>
      </form>
    </Card>
  );
};
