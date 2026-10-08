import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useCommissionHistory, useAdminMutations } from '@/features/host/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { useAuth } from '@/providers/AuthProvider';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Pagination,
  Skeleton,
  TraceId,
  applyFieldErrors,
  type Column,
} from '@/components/ui';
import { formatInstant } from '@/lib/format';
import { isValidMoneyInput } from '@/lib/money';
import type { CommissionSettingResponse } from '@/types/api';

/** The API rejects anything less than a minute ahead and never backdates; 2 minutes is safer. */
const MINIMUM_LEAD_MS = 120_000;

const percentField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => isValidMoneyInput(value), `${label} needs at most 2 decimals`)
    .refine((value) => Number(value) >= 0, `${label} cannot be negative`)
    .refine((value) => Number(value) <= 30, `${label} must be 30 or less`);

const commissionSchema = z.object({
  guestServiceFeePercent: percentField('Guest service fee'),
  hostCommissionPercent: percentField('Host commission'),
  taxPercent: percentField('Tax'),
  effectiveFrom: z
    .string()
    .min(1, 'Pick the moment these rates start applying')
    .refine(
      (value) => new Date(value).getTime() >= Date.now() + MINIMUM_LEAD_MS,
      'Choose a moment at least two minutes from now'
    ),
});

type CommissionValues = z.infer<typeof commissionSchema>;

function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function percentText(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

export const AdminCommissionPage: React.FC = () => {
  useDocumentTitle('Commission settings');

  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const history = useCommissionHistory(page);
  const admin = useAdminMutations();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useForm<CommissionValues>({
    resolver: zodResolver(commissionSchema),
    defaultValues: {
      guestServiceFeePercent: '',
      hostCommissionPercent: '',
      taxPercent: '',
      effectiveFrom: toLocalInput(new Date(Date.now() + 60 * 60_000)),
    },
  });

  const rows = history.data?.content ?? [];
  const now = useMemo(() => Date.now(), []);

  // The row in force is the greatest effectiveFrom at or before now, within the loaded page.
  const currentId = useMemo(() => {
    const eligible = rows.filter((row) => new Date(row.effectiveFrom).getTime() <= now);
    if (eligible.length === 0) return null;
    return eligible.reduce((best, row) =>
      new Date(row.effectiveFrom).getTime() > new Date(best.effectiveFrom).getTime() ? row : best
    ).id;
  }, [rows, now]);

  const current = rows.find((row) => row.id === currentId) ?? null;

  const draft = form.watch();
  const draftFee = Number(draft.guestServiceFeePercent);
  const draftCommission = Number(draft.hostCommissionPercent);
  const draftTax = Number(draft.taxPercent);
  const effectiveFromIso = draft.effectiveFrom
    ? new Date(draft.effectiveFrom).toISOString()
    : null;

  const diff = useMemo(() => {
    if (!current || !effectiveFromIso) return null;
    const fee = isValidMoneyInput(draft.guestServiceFeePercent)
      ? Number(draft.guestServiceFeePercent)
      : null;
    const commission = isValidMoneyInput(draft.hostCommissionPercent)
      ? Number(draft.hostCommissionPercent)
      : null;
    const tax = isValidMoneyInput(draft.taxPercent) ? Number(draft.taxPercent) : null;
    return {
      takesEffect: new Date(effectiveFromIso).getTime() > now,
      fee: fee === null ? null : fee === current.guestServiceFeePercent,
      commission: commission === null ? null : commission === current.hostCommissionPercent,
      tax: tax === null ? null : tax === current.taxPercent,
    };
  }, [
    current,
    draft.guestServiceFeePercent,
    draft.hostCommissionPercent,
    draft.taxPercent,
    effectiveFromIso,
    now,
  ]);

  const columns: Column<CommissionSettingResponse>[] = [
    {
      key: 'effectiveFrom',
      header: 'Effective from',
      render: (row) => (
        <span className="whitespace-nowrap tabular">
          {formatInstant(row.effectiveFrom)}
          {row.id === currentId && (
            <Badge tone="success" className="ml-2">
              Current
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'guestServiceFeePercent',
      header: 'Guest fee',
      numeric: true,
      render: (row) => <span className="tabular">{percentText(row.guestServiceFeePercent)}</span>,
    },
    {
      key: 'hostCommissionPercent',
      header: 'Host commission',
      numeric: true,
      render: (row) => <span className="tabular">{percentText(row.hostCommissionPercent)}</span>,
    },
    {
      key: 'taxPercent',
      header: 'Tax',
      numeric: true,
      render: (row) => <span className="tabular">{percentText(row.taxPercent)}</span>,
    },
    {
      key: 'createdBy',
      header: 'Created by',
      render: (row) =>
        row.createdBy === null ? (
          <span className="text-muted">System</span>
        ) : (
          <span className="tabular">
            {row.createdBy === user?.id ? 'You' : `#${row.createdBy}`}
          </span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Recorded',
      render: (row) => <span className="whitespace-nowrap">{formatInstant(row.createdAt)}</span>,
    },
  ];

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await admin.createCommission.mutateAsync({
        guestServiceFeePercent: Number(values.guestServiceFeePercent),
        hostCommissionPercent: Number(values.hostCommissionPercent),
        taxPercent: Number(values.taxPercent),
        effectiveFrom: new Date(values.effectiveFrom).toISOString(),
      });
      form.reset({
        guestServiceFeePercent: '',
        hostCommissionPercent: '',
        taxPercent: '',
        effectiveFrom: toLocalInput(new Date(Date.now() + 60 * 60_000)),
      });
      setPage(0);
      toast.success('New commission settings scheduled.');
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => form.setError(name as keyof CommissionValues, { message }),
        ['guestServiceFeePercent', 'hostCommissionPercent', 'taxPercent', 'effectiveFrom']
      );
      setSubmitError(error);
      if (error instanceof ApiError && error.code === 'DUPLICATE_RESOURCE') {
        toast.error('A setting already starts at that moment. Choose a different one.');
        return;
      }
      if (unmatched.length > 0) toast.error(unmatched[0]);
    }
  });

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[{ label: 'Admin', to: ROUTES.ADMIN_HOME }, { label: 'Commission' }]}
      />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Commission settings</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Rates are scheduled, never edited. Each row records the three percentages and the moment
          they start applying to new bookings.
        </p>
      </div>

      {history.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {history.isError && (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      )}

      {history.data && rows.length === 0 && (
        <EmptyState
          title="No commission settings yet"
          description="Until a setting exists the platform falls back to its built-in default rates."
        />
      )}

      {rows.length > 0 && (
        <>
          <DataTable
            caption="Commission settings history"
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
          />
          <Pagination
            page={(history.data?.page ?? 0) + 1}
            totalPages={history.data?.totalPages ?? 0}
            onChange={(next) => setPage(Math.max(0, next - 1))}
          />
        </>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Schedule new rates
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Applies to new bookings only. Existing bookings keep the rates they were made with.
        </p>

        <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Guest service fee %"
              htmlFor="fee-percent"
              required
              error={form.formState.errors.guestServiceFeePercent?.message}
            >
              <Input
                id="fee-percent"
                inputMode="decimal"
                placeholder="10.00"
                hasError={Boolean(form.formState.errors.guestServiceFeePercent)}
                aria-invalid={Boolean(form.formState.errors.guestServiceFeePercent)}
                {...form.register('guestServiceFeePercent')}
              />
            </Field>
            <Field
              label="Host commission %"
              htmlFor="commission-percent"
              required
              error={form.formState.errors.hostCommissionPercent?.message}
            >
              <Input
                id="commission-percent"
                inputMode="decimal"
                placeholder="15.00"
                hasError={Boolean(form.formState.errors.hostCommissionPercent)}
                aria-invalid={Boolean(form.formState.errors.hostCommissionPercent)}
                {...form.register('hostCommissionPercent')}
              />
            </Field>
            <Field
              label="Tax %"
              htmlFor="tax-percent"
              required
              error={form.formState.errors.taxPercent?.message}
            >
              <Input
                id="tax-percent"
                inputMode="decimal"
                placeholder="8.00"
                hasError={Boolean(form.formState.errors.taxPercent)}
                aria-invalid={Boolean(form.formState.errors.taxPercent)}
                {...form.register('taxPercent')}
              />
            </Field>
          </div>

          <Field
            label="Effective from"
            htmlFor="effective-from"
            required
            hint={`At least two minutes from now. Your local time is ${
              effectiveFromIso ? formatInstant(effectiveFromIso) : '—'
            } (UTC ${effectiveFromIso ?? '—'}).`}
            error={form.formState.errors.effectiveFrom?.message}
          >
            <Input
              id="effective-from"
              type="datetime-local"
              min={toLocalInput(new Date(Date.now() + MINIMUM_LEAD_MS))}
              hasError={Boolean(form.formState.errors.effectiveFrom)}
              aria-invalid={Boolean(form.formState.errors.effectiveFrom)}
              {...form.register('effectiveFrom')}
            />
          </Field>

          {current && (
            <div className="rounded-card border border-line bg-bg p-4">
              <p className="text-sm font-medium text-ink">
                Against the row in force (effective {formatInstant(current.effectiveFrom)})
              </p>
              <dl className="mt-2 divide-y divide-line text-sm">
                <DiffRow
                  label="Guest service fee"
                  before={percentText(current.guestServiceFeePercent)}
                  after={
                    Number.isFinite(draftFee) && draft.guestServiceFeePercent !== ''
                      ? percentText(draftFee)
                      : '—'
                  }
                  unchanged={diff?.fee}
                />
                <DiffRow
                  label="Host commission"
                  before={percentText(current.hostCommissionPercent)}
                  after={
                    Number.isFinite(draftCommission) && draft.hostCommissionPercent !== ''
                      ? percentText(draftCommission)
                      : '—'
                  }
                  unchanged={diff?.commission}
                />
                <DiffRow
                  label="Tax"
                  before={percentText(current.taxPercent)}
                  after={
                    Number.isFinite(draftTax) && draft.taxPercent !== '' ? percentText(draftTax) : '—'
                  }
                  unchanged={diff?.tax}
                />
              </dl>
              {diff?.takesEffect === false && (
                <p className="mt-2 text-xs text-warning-text">
                  That moment is already in the past, so the server will refuse it.
                </p>
              )}
            </div>
          )}

          {submitError != null && (
            <InlineAlert tone="danger">
              {submitError instanceof ApiError
                ? submitError.detail
                : 'The new settings could not be saved.'}
              <TraceId error={submitError} className="mt-1 block" />
            </InlineAlert>
          )}

          <div>
            <Button
              type="submit"
              loading={form.formState.isSubmitting || admin.createCommission.isPending}
            >
              Schedule these rates
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

interface DiffRowProps {
  label: string;
  before: string;
  after: string;
  unchanged: boolean | null | undefined;
}

const DiffRow: React.FC<DiffRowProps> = ({ label, before, after, unchanged }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <dt className="text-muted">{label}</dt>
    <dd className="flex items-baseline gap-2 tabular">
      <span className="text-muted">{before}</span>
      <span aria-hidden>→</span>
      <span
        className={
          unchanged === false
            ? 'font-semibold text-warning-text'
            : 'font-medium text-ink'
        }
      >
        {after}
      </span>
      {unchanged === true && <span className="text-xs text-muted">no change</span>}
    </dd>
  </div>
);