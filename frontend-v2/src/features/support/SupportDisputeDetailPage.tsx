import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useSupportDispute, useSupportDisputeMutations } from '@/features/disputes/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { useAuth } from '@/providers/AuthProvider';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { BookingTimeline } from '@/components/patterns/BookingTimeline';
import { PriceBreakdown } from '@/components/patterns/PriceBreakdown';
import {
  Banner,
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
  Input,
  RadioGroup,
  Skeleton,
  StatusBadge,
  Textarea,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import { formatMoney, isValidMoneyInput, normalizeMoneyInput, toMoneyNumber } from '@/lib/money';
import { formatDateRange } from '@/lib/local-date';
import { formatDateTimeLocal } from '@/lib/format';
import { disputeCategoryLabels, resolutionTypeLabels } from '@/lib/status';
import type { ResolutionType } from '@/types/api';

const RESOLUTION_TYPES: ResolutionType[] = ['FULL_REFUND', 'PARTIAL_REFUND', 'NO_REFUND'];

function resolveSchema(refundableAmount: number) {
  return z
    .object({
      resolutionType: z.enum(['FULL_REFUND', 'PARTIAL_REFUND', 'NO_REFUND']),
      refundAmount: z.string().optional(),
      note: z
        .string()
        .trim()
        .min(10, 'Write at least 10 characters so both parties understand the outcome')
        .max(2000, 'Keep the note to 2000 characters'),
    })
    .superRefine((values, ctx) => {
      if (values.resolutionType !== 'PARTIAL_REFUND') return;
      const raw = (values.refundAmount ?? '').trim();
      if (!isValidMoneyInput(raw)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['refundAmount'],
          message: 'Enter an amount with at most 2 decimals',
        });
        return;
      }
      const amount = Number(raw);
      if (amount < 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['refundAmount'],
          message: 'Refund at least 0.01',
        });
      }
      if (amount > refundableAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['refundAmount'],
          message: `Refund cannot be more than the remaining ${formatMoney(refundableAmount)}`,
        });
      }
    });
}

const rejectSchema = z.object({
  note: z
    .string()
    .trim()
    .min(10, 'Write at least 10 characters so the guest understands the outcome')
    .max(2000, 'Keep the note to 2000 characters'),
});

type ResolveValues = z.infer<ReturnType<typeof resolveSchema>>;
type RejectValues = z.infer<typeof rejectSchema>;

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-3 py-1.5 text-sm">
    <dt className="text-muted">{label}</dt>
    <dd className="text-right font-medium text-ink">{children}</dd>
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className,
}) => (
  <Card as="section" className={`p-5 ${className ?? ''}`}>
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
    {children}
  </Card>
);

export const SupportDisputeDetailPage: React.FC = () => {
  const { id } = useParams();
  const disputeId = Number(id);
  const { user, isAdmin } = useAuth();

  const query = useSupportDispute(Number.isFinite(disputeId) ? disputeId : null);
  const mutations = useSupportDisputeMutations(Number.isFinite(disputeId) ? disputeId : null);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<ResolveValues | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const payment = query.data?.payment ?? null;
  const refundableAmount = payment?.refundableAmount ?? 0;
  const dispute = query.data?.dispute ?? null;

  const resolveForm = useForm<ResolveValues>({
    resolver: zodResolver(resolveSchema(refundableAmount)),
    defaultValues: { resolutionType: 'FULL_REFUND', refundAmount: '', note: '' },
  });
  const rejectForm = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { note: '' },
  });

  const resolutionType = resolveForm.watch('resolutionType');
  const amountField = resolveForm.register('refundAmount');
  const noteValue = resolveForm.watch('note') ?? '';
  const rejectNote = rejectForm.watch('note') ?? '';

  const isAssignee = Boolean(dispute && user && dispute.assignedAgentId === user.id);
  const underReview = dispute?.status === 'UNDER_REVIEW';
  const canDecide = Boolean(underReview && (isAssignee || isAdmin));
  const canAssign = Boolean(
    dispute && (dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW')
  );

  let blockedReason: string | null = null;
  if (dispute && !canDecide) {
    if (!underReview) {
      blockedReason =
        `This case is ${dispute.status.replaceAll('_', ' ').toLowerCase()}. ` +
        'Assign it to yourself first: only a case under review can be resolved or rejected.';
    } else if (!isAssignee && !isAdmin) {
      blockedReason =
        `This case is assigned to agent #${dispute.assignedAgentId}. ` +
        'Ask them to reassign it, or ask an administrator to step in.';
    }
  }

  const exactRefund = useMemo(() => {
    if (!pendingValues) return 0;
    if (pendingValues.resolutionType === 'FULL_REFUND') return refundableAmount;
    if (pendingValues.resolutionType === 'PARTIAL_REFUND') {
      return toMoneyNumber(pendingValues.refundAmount ?? '0');
    }
    return 0;
  }, [pendingValues, refundableAmount]);

  // The message is always the server's own wording; the code only adds context.
  const errorHeading = (error: unknown): string | null => {
    if (!(error instanceof ApiError)) return null;
    if (error.code === 'BUSINESS_RULE_VIOLATION') return 'The server refused this decision';
    if (error.code === 'INVALID_STATE_TRANSITION') {
      return 'This case has moved on since you opened it';
    }
    if (error.code === 'FORBIDDEN') return 'You are not allowed to act on this case';
    return null;
  };

  const describeServerError = (error: unknown): string =>
    error instanceof ApiError ? error.detail : 'We could not save that decision. Try again.';

  const onAssign = async () => {
    setActionError(null);
    try {
      await mutations.assign.mutateAsync(disputeId);
      toast.success('Case assigned to you and moved to under review.');
    } catch (error) {
      setActionError(error);
      toast.error(error instanceof ApiError ? error.detail : 'The case could not be assigned.');
    }
  };

  const onConfirmResolve = async () => {
    if (!pendingValues) return;
    setActionError(null);
    try {
      await mutations.resolve.mutateAsync({
        disputeId,
        payload: {
          resolutionType: pendingValues.resolutionType,
          refundAmount:
            pendingValues.resolutionType === 'PARTIAL_REFUND'
              ? toMoneyNumber(pendingValues.refundAmount ?? '0')
              : null,
          note: pendingValues.note.trim(),
        },
      });
      setConfirmOpen(false);
      setResolveOpen(false);
      setPendingValues(null);
      resolveForm.reset();
      toast.success('Case resolved. Both parties have been notified.');
    } catch (error) {
      setConfirmOpen(false);
      setActionError(error);
      const unmatched = applyFieldErrors(
        error,
        (name, message) => resolveForm.setError(name as keyof ResolveValues, { message }),
        ['resolutionType', 'refundAmount', 'note']
      );
      if (unmatched.length > 0) toast.error(unmatched[0]);
    }
  };

  const onReject = async (values: RejectValues) => {
    setActionError(null);
    try {
      await mutations.reject.mutateAsync({ disputeId, payload: { note: values.note.trim() } });
      setRejectOpen(false);
      rejectForm.reset();
      toast.success('Case rejected. The guest has been told why.');
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => rejectForm.setError(name as keyof RejectValues, { message }),
        ['note']
      );
      setActionError(error);
      if (unmatched.length > 0) toast.error(unmatched[0]);
    }
  };

  useDocumentTitle(dispute ? `Dispute #${dispute.id}` : 'Dispute case');

  if (!Number.isFinite(disputeId)) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 sm:px-6">
        <EmptyState title="That case link is not valid" description="Cases are opened by numeric id." />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
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

  const { dispute: case_, booking: stay, statusHistory, messages } = query.data;
  const isParty = Boolean(
    user && (stay.guest.id === user.id || stay.host.id === user.id)
  );

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Support', to: ROUTES.SUPPORT_DISPUTES },
          { label: 'Disputes', to: ROUTES.SUPPORT_DISPUTES },
          { label: `#${case_.id}` },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-ink">
            Case #{case_.id}
            <StatusBadge status={case_.status} kind="dispute" />
          </h1>
          <p className="mt-1 text-sm text-muted">
            {disputeCategoryLabels[case_.category]} · booking{' '}
            <Link
              to={ROUTES.TRIP(stay.reference)}
              className="tabular text-primary underline underline-offset-2"
            >
              {stay.reference}
            </Link>{' '}
            · raised {formatDateTimeLocal(case_.createdAt)}
          </p>
        </div>
      </div>

      <Banner tone="warning" title="Viewing this case is recorded in the audit log">
        Every load of this page writes a{' '}
        <span className="tabular">DISPUTE_CONVERSATION_VIEWED</span> audit entry, so the case is never
        reloaded automatically. Use your browser reload when you want a fresh copy.
      </Banner>

      <Card as="section" className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Actions</h2>
            <p className="mt-1 text-sm text-muted">
              {case_.assignedAgentId === null
                ? 'No agent has taken this case yet.'
                : isAssignee
                  ? 'You are the assigned agent.'
                  : `Assigned to agent #${case_.assignedAgentId}.`}
            </p>
            {blockedReason && (
              <p className="mt-2 max-w-prose text-xs text-warning-text">{blockedReason}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!canAssign || isParty}
              loading={mutations.assign.isPending}
              onClick={() => void onAssign()}
            >
              Assign to me
            </Button>
            <Button disabled={!canDecide || isParty} onClick={() => setResolveOpen(true)}>
              Resolve
            </Button>
            <Button
              variant="destructive"
              disabled={!canDecide || isParty}
              onClick={() => setRejectOpen(true)}
            >
              Reject
            </Button>
          </div>
        </div>

        {isParty && (
          <p className="mt-3 text-xs text-danger-text">
            You are a party to this booking, so the server will refuse any assignment or decision.
          </p>
        )}

        {actionError != null && (
          <InlineAlert tone="danger" className="mt-4">
            {errorHeading(actionError) && (
              <p className="font-medium">{errorHeading(actionError)}</p>
            )}
            <p className={errorHeading(actionError) ? 'mt-0.5' : undefined}>
              {describeServerError(actionError)}
            </p>
            <TraceId error={actionError} className="mt-1 block" />
          </InlineAlert>
        )}

        {case_.status === 'RESOLVED' && (
          <div className="mt-4 rounded-control border border-line bg-bg px-3 py-2 text-sm">
            <p className="font-medium text-ink">
              Resolved
              {case_.resolutionType ? ` · ${resolutionTypeLabels[case_.resolutionType]}` : ''}
              {case_.refundAmount != null && (
                <>
                  {' · '}
                  <span className="tabular">{formatMoney(case_.refundAmount)} refunded</span>
                </>
              )}
            </p>
            {case_.resolutionNote && <p className="mt-1 text-muted">{case_.resolutionNote}</p>}
          </div>
        )}

        {case_.status === 'REJECTED' && case_.resolutionNote && (
          <div className="mt-4 rounded-control border border-line bg-bg px-3 py-2 text-sm">
            <p className="font-medium text-ink">Rejected</p>
            <p className="mt-1 text-muted">{case_.resolutionNote}</p>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Summary">
          <dl className="divide-y divide-line">
            <DetailRow label="Category">
              {disputeCategoryLabels[case_.category] ?? case_.category}
            </DetailRow>
            <DetailRow label="Raised by">User #{case_.raisedById}</DetailRow>
            <DetailRow label="Raised">{formatDateTimeLocal(case_.createdAt)}</DetailRow>
            <DetailRow label="Resolved">
              {case_.resolvedAt ? formatDateTimeLocal(case_.resolvedAt) : 'Still open'}
            </DetailRow>
          </dl>
          <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{case_.description}</p>
        </Panel>

        <Panel title="Booking">
          <dl className="divide-y divide-line">
            <DetailRow label="Reference">
              <span className="tabular">{stay.reference}</span>
            </DetailRow>
            <DetailRow label="Status">
              <StatusBadge status={stay.status} kind="booking" viewer="host" />
            </DetailRow>
            <DetailRow label="Dates">
              {formatDateRange(stay.checkIn, stay.checkOut)} · {stay.nights}{' '}
              {stay.nights === 1 ? 'night' : 'nights'}
            </DetailRow>
            <DetailRow label="Guest">
              {stay.guest.firstName} {stay.guest.lastName ?? ''} (#{stay.guest.id})
            </DetailRow>
            <DetailRow label="Host">
              {stay.host.displayName} (#{stay.host.id})
            </DetailRow>
            <DetailRow label="Check-in">{formatDateTimeLocal(stay.checkInDateTime)}</DetailRow>
            <DetailRow label="Check-out">{formatDateTimeLocal(stay.checkOutDateTime)}</DetailRow>
          </dl>
          <div className="mt-3">
            <PriceBreakdown breakdown={stay.priceBreakdown} nights={stay.nights} viewer="host" />
          </div>
        </Panel>

        <Panel title="Payment">
          {!payment ? (
            <p className="text-sm text-muted">
              No payment is recorded for this booking, so there is nothing to refund.
            </p>
          ) : (
            <>
              <dl className="divide-y divide-line">
                <DetailRow label="Status">
                  <StatusBadge status={payment.status} kind="payment" />
                </DetailRow>
                <DetailRow label="Amount paid">
                  <span className="tabular">{formatMoney(payment.amount)}</span>
                </DetailRow>
                <DetailRow label="Already refunded">
                  <span className="tabular">{formatMoney(payment.refundedTotal)}</span>
                </DetailRow>
                <DetailRow label="Refundable now">
                  <span className="tabular font-semibold text-accent">
                    {formatMoney(payment.refundableAmount)}
                  </span>
                </DetailRow>
              </dl>
              {payment.refunds.length > 0 ? (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {payment.refunds.map((refund) => (
                    <li
                      key={refund.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="tabular font-medium text-ink">
                          {formatMoney(refund.amount)}
                        </span>
                        <StatusBadge status={refund.status} kind="refund" />
                      </span>
                      <span className="text-xs text-muted">
                        {refund.reason.replaceAll('_', ' ').toLowerCase()} ·{' '}
                        {formatDateTimeLocal(refund.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No refunds have been issued.</p>
              )}
            </>
          )}
        </Panel>

        <Panel title="History">
          {statusHistory.length === 0 ? (
            <p className="text-sm text-muted">This booking has no status changes yet.</p>
          ) : (
            <BookingTimeline history={statusHistory} />
          )}
        </Panel>
      </div>

      <Panel title="Conversation">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">
            Neither party has written anything about this booking yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const mine = message.senderId === stay.guest.id;
              return (
                <li
                  key={message.id}
                  className={
                    mine
                      ? 'rounded-card rounded-br-control bg-primary-soft px-4 py-2'
                      : 'rounded-card rounded-bl-control bg-bg px-4 py-2'
                  }
                >
                  <p className="text-xs font-medium text-muted">
                    {mine ? 'Guest' : 'Host'} #{message.senderId} ·{' '}
                    {formatDateTimeLocal(message.sentAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{message.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="max-w-xl">
          <DialogTitle>Resolve case #{case_.id}</DialogTitle>
          <DialogDescription>
            The resolution is final. Both parties are notified as soon as you confirm.
          </DialogDescription>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={resolveForm.handleSubmit((values) => {
              setPendingValues(values);
              setConfirmOpen(true);
            })}
            noValidate
          >
            <RadioGroup
              name="resolutionType"
              value={resolutionType}
              onChange={(value) => resolveForm.setValue('resolutionType', value as ResolutionType)}
              options={RESOLUTION_TYPES.map((type) => ({
                value: type,
                label: resolutionTypeLabels[type],
                description:
                  type === 'FULL_REFUND'
                    ? `Refunds the full remaining amount: ${formatMoney(refundableAmount)}`
                    : type === 'PARTIAL_REFUND'
                      ? `Enter an amount between 0.01 and ${formatMoney(refundableAmount)}.`
                      : 'Nothing is refunded and the host keeps the payout.',
              }))}
            />

            {resolutionType === 'PARTIAL_REFUND' && (
              <Field
                label="Refund amount"
                htmlFor="resolve-amount"
                required
                hint={`Between 0.01 and ${formatMoney(refundableAmount)}. At most two decimals.`}
                error={resolveForm.formState.errors.refundAmount?.message}
              >
                <Input
                  id="resolve-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  hasError={Boolean(resolveForm.formState.errors.refundAmount)}
                  aria-invalid={Boolean(resolveForm.formState.errors.refundAmount)}
                  {...amountField}
                  onBlur={(event) => {
                    amountField.onBlur(event);
                    if (isValidMoneyInput(event.target.value)) {
                      resolveForm.setValue(
                        'refundAmount',
                        normalizeMoneyInput(event.target.value),
                        { shouldValidate: true }
                      );
                    }
                  }}
                />
              </Field>
            )}

            <Field
              label="Resolution note"
              htmlFor="resolve-note"
              required
              hint={`${noteValue.length}/2000 characters. Both parties read this, so be specific.`}
              error={resolveForm.formState.errors.note?.message}
            >
              <Textarea
                id="resolve-note"
                maxLength={2000}
                className="min-h-[120px]"
                hasError={Boolean(resolveForm.formState.errors.note)}
                aria-invalid={Boolean(resolveForm.formState.errors.note)}
                {...resolveForm.register('note')}
              />
            </Field>

            {actionError != null && (
              <InlineAlert tone="danger">
                {errorHeading(actionError) && (
                  <p className="font-medium">{errorHeading(actionError)}</p>
                )}
                <p className={errorHeading(actionError) ? 'mt-0.5' : undefined}>
                  {describeServerError(actionError)}
                </p>
                <TraceId error={actionError} className="mt-1 block" />
              </InlineAlert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setResolveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Review resolution</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPendingValues(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Confirm this resolution</DialogTitle>
          <DialogDescription>
            Resolution is final. Both parties will be notified.
          </DialogDescription>

          <dl className="mt-4 divide-y divide-line rounded-card border border-line">
            <DetailRow label="Resolution">
              {pendingValues ? resolutionTypeLabels[pendingValues.resolutionType] : '—'}
            </DetailRow>
            <DetailRow label="Refund issued">
              <span className="tabular font-semibold text-accent">{formatMoney(exactRefund)}</span>
            </DetailRow>
            <DetailRow label="Refundable before this decision">
              <span className="tabular">{formatMoney(refundableAmount)}</span>
            </DetailRow>
            <DetailRow label="Host payout">
              {exactRefund > 0
                ? 'Reduced, or cancelled if the payout has already been paid'
                : 'Unchanged'}
            </DetailRow>
          </dl>

          {actionError != null && (
            <InlineAlert tone="danger" className="mt-4">
              {errorHeading(actionError) && (
                <p className="font-medium">{errorHeading(actionError)}</p>
              )}
              <p className={errorHeading(actionError) ? 'mt-0.5' : undefined}>
                {describeServerError(actionError)}
              </p>
              <TraceId error={actionError} className="mt-1 block" />
            </InlineAlert>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
                setPendingValues(null);
              }}
            >
              Go back
            </Button>
            <Button
              variant="accent"
              loading={mutations.resolve.isPending}
              onClick={() => void onConfirmResolve()}
            >
              Confirm and notify
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogTitle>Reject case #{case_.id}</DialogTitle>
          <DialogDescription>
            Rejecting closes the case with no refund. The guest is told why.
          </DialogDescription>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={rejectForm.handleSubmit(onReject)}
            noValidate
          >
            <Field
              label="Why is this claim not upheld?"
              htmlFor="reject-note"
              required
              hint={`${rejectNote.length}/2000 characters.`}
              error={rejectForm.formState.errors.note?.message}
            >
              <Textarea
                id="reject-note"
                maxLength={2000}
                className="min-h-[120px]"
                hasError={Boolean(rejectForm.formState.errors.note)}
                aria-invalid={Boolean(rejectForm.formState.errors.note)}
                {...rejectForm.register('note')}
              />
            </Field>

            {actionError != null && (
              <InlineAlert tone="danger">
                {errorHeading(actionError) && (
                  <p className="font-medium">{errorHeading(actionError)}</p>
                )}
                <p className={errorHeading(actionError) ? 'mt-0.5' : undefined}>
                  {describeServerError(actionError)}
                </p>
                <TraceId error={actionError} className="mt-1 block" />
              </InlineAlert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                loading={rejectForm.formState.isSubmitting}
              >
                Reject case
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};