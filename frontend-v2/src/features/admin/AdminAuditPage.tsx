import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useAuditLog } from '@/features/host/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  Select,
  Skeleton,
  type Column,
} from '@/components/ui';
import { formatInstant } from '@/lib/format';
import type { Tone } from '@/lib/status';
import type { AuditLogResponse } from '@/types/api';

const PAGE_SIZE = 50;

const ACTIONS = [
  'USER_SUSPENDED',
  'USER_UNSUSPENDED',
  'ROLE_CHANGED',
  'HOST_ONBOARDED',
  'LISTING_SUBMITTED',
  'LISTING_APPROVED',
  'LISTING_REJECTED',
  'LISTING_SUSPENDED',
  'LISTING_REINSTATED',
  'LISTING_DELETED',
  'COMMISSION_CHANGED',
  'BOOKING_CANCELLED_BY_HOST',
  'REFUND_ISSUED',
  'PAYOUT_PAID',
  'DISPUTE_OPENED',
  'DISPUTE_ASSIGNED',
  'DISPUTE_RESOLVED',
  'DISPUTE_CONVERSATION_VIEWED',
  'REVIEW_REMOVED',
  'PLATFORM_ABSORBED_REFUND',
];

const SUCCESS_ACTIONS = new Set([
  'LISTING_APPROVED',
  'LISTING_REINSTATED',
  'USER_UNSUSPENDED',
  'HOST_ONBOARDED',
  'DISPUTE_RESOLVED',
]);

const DANGER_ACTIONS = new Set([
  'LISTING_REJECTED',
  'LISTING_SUSPENDED',
  'USER_SUSPENDED',
  'REVIEW_REMOVED',
  'BOOKING_CANCELLED_BY_HOST',
  'PLATFORM_ABSORBED_REFUND',
]);

const INFO_ACTIONS = new Set(['COMMISSION_CHANGED', 'ROLE_CHANGED']);
const WARNING_ACTIONS = new Set(['LISTING_SUBMITTED', 'REFUND_ISSUED']);

function actionTone(action: string): Tone {
  if (SUCCESS_ACTIONS.has(action)) return 'success';
  if (DANGER_ACTIONS.has(action)) return 'danger';
  if (INFO_ACTIONS.has(action)) return 'info';
  if (WARNING_ACTIONS.has(action)) return 'warning';
  return 'neutral';
}

function actionLabel(action: string): string {
  return action.replaceAll('_', ' ').toLowerCase();
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isDiffPair(value: unknown): value is { before: unknown; after: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'before' in value &&
    'after' in value &&
    !Array.isArray(value)
  );
}

/** Only entities with a staff screen are linked; anything else stays plain text. */
function entityPath(entry: AuditLogResponse): string | null {
  if (entry.entityId === null) return null;
  switch (entry.entityType.toUpperCase()) {
    case 'LISTING':
      return ROUTES.ADMIN_LISTING(entry.entityId);
    case 'USER':
      return ROUTES.ADMIN_USER(entry.entityId);
    case 'DISPUTE':
      return ROUTES.SUPPORT_DISPUTE(entry.entityId);
    default:
      return null;
  }
}

const DetailsCell: React.FC<{ details: Record<string, unknown> }> = ({ details }) => {
  const keys = Object.keys(details);
  if (keys.length === 0) return <span className="text-muted">No details recorded</span>;

  return (
    <dl className="flex flex-col gap-1">
      {keys.map((key) => {
        const value = details[key];
        return (
          <div key={key} className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <dt className="font-medium text-muted">{key.replaceAll('_', ' ')}</dt>
            {isDiffPair(value) ? (
              <dd className="flex flex-wrap items-baseline gap-1.5 tabular">
                <span className="text-muted line-through">{scalarText(value.before)}</span>
                <span aria-hidden>→</span>
                <span className="font-medium text-ink">{scalarText(value.after)}</span>
              </dd>
            ) : (
              <dd className="tabular text-ink">{scalarText(value)}</dd>
            )}
          </div>
        );
      })}
    </dl>
  );
};

export const AdminAuditPage: React.FC = () => {
  useDocumentTitle('Audit log');

  const [params, setParams] = useSearchParams();
  const [expanded, setExpanded] = useState<number | null>(null);

  const actorRaw = params.get('actor') ?? '';
  const actor = /^\d+$/.test(actorRaw) ? Number(actorRaw) : undefined;
  const entityType = params.get('entityType') ?? '';
  const action = params.get('action') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);

  const [draftActor, setDraftActor] = useState(actorRaw);
  const [draftEntity, setDraftEntity] = useState(entityType);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  // The URL is the source of truth, so deep links from other screens fill the boxes correctly.
  useEffect(() => {
    setDraftActor(actorRaw);
    setDraftEntity(entityType);
    setDraftFrom(from);
    setDraftTo(to);
  }, [actorRaw, entityType, from, to]);

  // The endpoint takes date-times for the range, not plain calendar dates.
  const fromInstant = from ? new Date(`${from}T00:00:00`).toISOString() : undefined;
  const toInstant = to ? new Date(`${to}T23:59:59`).toISOString() : undefined;

  const log = useAuditLog({
    actor,
    entityType: entityType === '' ? undefined : entityType,
    action: action === '' ? undefined : action,
    from: fromInstant,
    to: toInstant,
    page,
    size: PAGE_SIZE,
  });

  const change = useCallback(
    (patch: Record<string, string | null>, keepPage = false) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!keepPage) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  const actorInvalid = draftActor.trim() !== '' && !/^\d+$/.test(draftActor.trim());

  const applyFilters = () => {
    if (actorInvalid) return;
    const value = draftActor.trim();
    change({
      actor: value === '' ? null : value,
      entityType: draftEntity.trim() === '' ? null : draftEntity.trim(),
      from: draftFrom === '' ? null : draftFrom,
      to: draftTo === '' ? null : draftTo,
    });
  };

  const clearAll = () => {
    change({ actor: null, entityType: null, action: null, from: null, to: null });
    setExpanded(null);
  };

  const hasFilters =
    actorRaw !== '' || entityType !== '' || action !== '' || from !== '' || to !== '';

  const columns: Column<AuditLogResponse>[] = [
    {
      key: 'time',
      header: 'When',
      render: (row) => (
        <span className="whitespace-nowrap tabular">{formatInstant(row.createdAt)}</span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      numeric: true,
      render: (row) =>
        row.actorId === null ? (
          <span className="text-muted">System</span>
        ) : (
          <span className="tabular">#{row.actorId}</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <Badge tone={actionTone(row.action)}>{actionLabel(row.action)}</Badge>,
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (row) => {
        const path = entityPath(row);
        return (
          <span className="whitespace-nowrap">
            {row.entityType}
            {row.entityId !== null && (
              <>
                {' '}
                {path ? (
                  <Link to={path} className="tabular text-primary underline underline-offset-2">
                    #{row.entityId}
                  </Link>
                ) : (
                  <span className="tabular">#{row.entityId}</span>
                )}
              </>
            )}
          </span>
        );
      },
    },
    {
      key: 'details',
      header: 'Details',
      render: (row) => (
        <div className="min-w-[12rem]">
          <button
            type="button"
            aria-expanded={expanded === row.id}
            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark"
          >
            {expanded === row.id ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
            {expanded === row.id ? 'Hide details' : 'Show details'}
          </button>
          {expanded === row.id && (
            <div className="mt-2 rounded-control border border-line bg-bg px-3 py-2">
              <DetailsCell details={row.details} />
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: ROUTES.ADMIN_HOME }, { label: 'Audit log' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Audit log</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          An immutable record of every administrative and support action. Nothing here can be edited
          or removed.
        </p>
      </div>

      <Card className="p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <Field
            label="Actor id"
            htmlFor="audit-actor"
            className="w-32"
            error={actorInvalid ? 'Enter a numeric user id' : null}
          >
            <Input
              id="audit-actor"
              inputMode="numeric"
              placeholder="e.g. 7"
              value={draftActor}
              hasError={actorInvalid}
              aria-invalid={actorInvalid}
              onChange={(event) => setDraftActor(event.target.value)}
            />
          </Field>

          <Field label="Entity type" htmlFor="audit-entity" className="w-44">
            <Input
              id="audit-entity"
              placeholder="Listing, User, Dispute…"
              value={draftEntity}
              onChange={(event) => setDraftEntity(event.target.value)}
            />
          </Field>

          <Field label="Action" htmlFor="audit-action" className="w-56">
            <Select
              id="audit-action"
              value={action}
              onChange={(event) => change({ action: event.target.value || null })}
            >
              <option value="">Any action</option>
              {ACTIONS.map((item) => (
                <option key={item} value={item}>
                  {actionLabel(item)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="From" htmlFor="audit-from" className="w-40">
            <Input
              id="audit-from"
              type="date"
              value={draftFrom}
              max={to === '' ? undefined : to}
              onChange={(event) => setDraftFrom(event.target.value)}
            />
          </Field>

          <Field label="To" htmlFor="audit-to" className="w-40">
            <Input
              id="audit-to"
              type="date"
              value={draftTo}
              min={from === '' ? undefined : from}
              onChange={(event) => setDraftTo(event.target.value)}
            />
          </Field>

          <Button type="submit" disabled={actorInvalid}>
            Apply filters
          </Button>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={clearAll}>
              <X className="h-4 w-4" aria-hidden />
              Clear
            </Button>
          )}
        </form>
      </Card>

      {log.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {log.isError && <ErrorState error={log.error} onRetry={() => void log.refetch()} />}

      {log.data && log.data.content.length === 0 && (
        <EmptyState
          title="No audit entries match"
          description="Widen the date range or clear the filters."
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearAll}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {log.data && log.data.content.length > 0 && (
        <>
          <DataTable
            caption="Audit log"
            columns={columns}
            rows={log.data.content}
            getRowKey={(row) => row.id}
          />
          <Pagination
            page={log.data.page + 1}
            totalPages={log.data.totalPages}
            onChange={(next) => change({ page: String(next - 1) }, true)}
          />
        </>
      )}
    </div>
  );
};