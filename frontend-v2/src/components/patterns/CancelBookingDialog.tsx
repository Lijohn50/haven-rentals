import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { formatMoney } from '@/lib/money';
import {
  useBookingMutations,
  useCancellationPreview,
} from '@/features/booking/api';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  InlineAlert,
  Skeleton,
  Textarea,
  TraceId,
} from '@/components/ui';
import type { BookingResponse } from '@/types/api';

/**
 * Shared by the guest and host booking screens. Every figure comes from the server's
 * cancellation preview; the browser never derives a refund amount.
 */
export const CancelBookingDialog: React.FC<{
  booking: BookingResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
  /** the host variant posts a mandatory reason (10-500 characters) */
  viewer?: 'guest' | 'host';
}> = ({ booking, open, onOpenChange, onCancelled, viewer = 'guest' }) => {
  const preview = useCancellationPreview(booking.id, open);
  const { cancel, hostCancel } = useBookingMutations(booking.reference, booking.listing.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const reasonRequired = viewer === 'host';
  const trimmed = reason.trim();
  const reasonLength = trimmed.length;
  const reasonInvalid = reasonRequired && (reasonLength < 10 || reasonLength > 500);
  const pending = cancel.isPending || hostCancel.isPending;

  const refused =
    preview.isError &&
    preview.error instanceof ApiError &&
    (preview.error.code === 'CANCELLATION_NOT_ALLOWED' ||
      preview.error.code === 'INVALID_STATE_TRANSITION');

  const confirm = async () => {
    if (reasonInvalid) return;
    setError(null);
    try {
      const result =
        viewer === 'host'
          ? await hostCancel.mutateAsync({ id: booking.id, reason: trimmed })
          : await cancel.mutateAsync({
              id: booking.id,
              reason: trimmed === '' ? undefined : trimmed,
            });
      onOpenChange(false);
      onCancelled();
      toast.success(
        result.refundAmount
          ? `Booking cancelled. ${formatMoney(result.refundAmount)} will be refunded.`
          : 'Booking cancelled.'
      );
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent>
        <DialogTitle>Cancel this booking?</DialogTitle>
        <DialogDescription>
          {booking.listing.title} · {booking.reference}
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-3">
          {preview.isLoading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {refused && (
            <InlineAlert tone="warning">
              <p className="font-medium">This booking can no longer be cancelled.</p>
              <p className="mt-1">{(preview.error as ApiError).detail}</p>
              <Link className="mt-2 inline-block underline" to={ROUTES.TRIP_DISPUTE(booking.reference)}>
                Open a dispute instead
              </Link>
            </InlineAlert>
          )}

          {preview.isError && !refused && (
            <InlineAlert tone="danger">
              <p>We could not load the cancellation terms.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void preview.refetch()}
              >
                Try again
              </Button>
            </InlineAlert>
          )}

          {preview.data && (
            <>
              <dl className="divide-y divide-line rounded-card border border-line">
                <div className="flex items-baseline justify-between gap-4 px-3 py-2 text-sm">
                  <dt className="text-muted">Policy</dt>
                  <dd className="font-medium text-ink">{preview.data.policyName}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 px-3 py-2 text-sm">
                  <dt className="text-muted">You get back</dt>
                  <dd className="tabular font-semibold text-ink">
                    {formatMoney(preview.data.refundAmount)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 px-3 py-2 text-sm">
                  <dt className="text-muted">We keep</dt>
                  <dd className="tabular font-semibold text-ink">
                    {formatMoney(preview.data.nonRefundableAmount)}
                  </dd>
                </div>
              </dl>
              {preview.data.explanation && (
                <p className="text-sm text-muted">{preview.data.explanation}</p>
              )}
            </>
          )}

          <Field
            label={reasonRequired ? 'Reason for cancelling' : 'Reason (optional)'}
            htmlFor="cancel-reason"
            required={reasonRequired}
            hint={
              reasonRequired
                ? `${reasonLength}/500 characters. At least 10 are required.`
                : 'Up to 500 characters. It is shared with the host.'
            }
            error={
              reasonInvalid
                ? 'Write between 10 and 500 characters so the host understands why'
                : null
            }
          >
            <Textarea
              id="cancel-reason"
              value={reason}
              maxLength={500}
              hasError={reasonInvalid}
              aria-invalid={reasonInvalid}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>

          {error != null && (
            <InlineAlert tone="danger">
              {error instanceof ApiError ? error.detail : 'We could not cancel the booking.'}
              <TraceId error={error} className="mt-1 block" />
            </InlineAlert>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Keep booking
          </Button>
          <Button
            variant="destructive"
            loading={pending}
            disabled={reasonInvalid || preview.isLoading}
            onClick={() => void confirm()}
          >
            Cancel booking
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
