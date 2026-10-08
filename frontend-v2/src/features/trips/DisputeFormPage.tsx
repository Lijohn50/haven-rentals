import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useBooking } from '@/features/booking/api';
import { useOpenDispute } from '@/features/disputes/api';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { useDocumentTitle } from '@/hooks/useSeo';
import { disputeCategoryLabels } from '@/lib/status';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Select,
  Skeleton,
  Textarea,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import type { DisputeCategory } from '@/types/api';

const CATEGORIES = Object.keys(disputeCategoryLabels) as DisputeCategory[];

const disputeSchema = z.object({
  category: z.enum(['PROPERTY_NOT_AS_DESCRIBED', 'CLEANLINESS', 'HOST_NO_SHOW', 'GUEST_DAMAGE', 'SAFETY', 'BILLING', 'OTHER'], {
    errorMap: () => ({ message: 'Choose what the dispute is about' }),
  }),
  description: z
    .string()
    .trim()
    .min(20, 'Describe the problem in at least 20 characters')
    .max(2000, 'Keep the description to 2000 characters'),
});
type DisputeValues = z.infer<typeof disputeSchema>;

export const DisputeFormPage: React.FC = () => {
  useDocumentTitle('Open a dispute');

  const { reference } = useParams();
  const navigate = useNavigate();
  const booking = useBooking(reference ?? null);
  const openDispute = useOpenDispute(booking.data?.id ?? 0);

  const form = useForm<DisputeValues>({
    resolver: zodResolver(disputeSchema),
    defaultValues: { category: 'OTHER', description: '' },
  });

  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const description = form.watch('description') ?? '';
  const { errors, isSubmitting } = form.formState;

  const onSubmit = async (values: DisputeValues) => {
    setMessage(null);
    setTrace(null);
    try {
      await openDispute.mutateAsync({
        category: values.category,
        description: values.description.trim(),
      });
      toast.success('Dispute opened. Our team will review it.');
      navigate(ROUTES.TRIP(reference ?? ''), { replace: true });
    } catch (error) {
      const api = error instanceof ApiError ? error : null;

      if (api?.code === 'DUPLICATE_RESOURCE') {
        setMessage('A dispute is already open for this booking.');
        return;
      }

      const unmatched = applyFieldErrors(
        error,
        (name, text) => form.setError(name as keyof DisputeValues, { message: text }),
        ['category', 'description']
      );
      setMessage(
        unmatched[0] ??
          (api?.detail ??
            'This booking is outside the window for opening a dispute. Contact support if something is wrong.')
      );
      setTrace(error);
    }
  };

  if (booking.isLoading) {
    return (
      <div className="mx-auto flex max-w-narrow flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (booking.isError) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-12 sm:px-6">
        <ErrorState error={booking.error} onRetry={() => void booking.refetch()} />
      </div>
    );
  }

  const stay = booking.data;
  if (!stay || !reference) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-12 sm:px-6">
        <EmptyState
          title="We could not find that stay"
          action={
            <Button asChild>
              <Link to={ROUTES.TRIPS}>Go to your trips</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const canOpen = stay.allowedActions.includes('OPEN_DISPUTE');

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Trips', to: ROUTES.TRIPS },
          { label: stay.reference, to: ROUTES.TRIP(stay.reference) },
          { label: 'Dispute' },
        ]}
      />
      <h1 className="text-2xl font-semibold text-ink">Open a dispute</h1>
      <p className="text-sm text-muted">
        {stay.listing.title} · booking {stay.reference}
      </p>

      {!canOpen ? (
        <EmptyState
          title="A dispute cannot be opened for this booking"
          description="Disputes are only available shortly after a stay, and only while the booking is still active. If something is wrong, message the host or write to support."
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={ROUTES.TRIP(stay.reference)}>Back to the trip</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={ROUTES.INBOX}>Message the host</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <Card className="p-5">
          <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-text">
            Opening a dispute pauses the host payout while our team reviews the case. Resolution is
            final, so describe exactly what happened.
          </p>

          <form className="mt-4 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {message && (
              <InlineAlert tone="danger">
                {message}
                <TraceId error={trace} className="mt-1 block" />
              </InlineAlert>
            )}

            <Field
              label="What is the problem?"
              htmlFor="dispute-category"
              error={errors.category?.message}
              required
            >
              <Select
                id="dispute-category"
                hasError={Boolean(errors.category)}
                aria-invalid={Boolean(errors.category)}
                {...form.register('category')}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {disputeCategoryLabels[category]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Describe what happened"
              htmlFor="dispute-description"
              error={errors.description?.message}
              required
              hint={`${description.length}/2000 characters. Include dates, what was agreed and what you would like to happen next.`}
            >
              <Textarea
                id="dispute-description"
                maxLength={2000}
                className="min-h-[160px]"
                hasError={Boolean(errors.description)}
                aria-invalid={Boolean(errors.description)}
                {...form.register('description')}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={isSubmitting || openDispute.isPending}>
                Open dispute
              </Button>
              <Button asChild variant="ghost">
                <Link to={ROUTES.TRIP(stay.reference)}>Cancel</Link>
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};
