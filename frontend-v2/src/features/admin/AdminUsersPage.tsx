import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useAdminUsers } from '@/features/host/api';
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
  StatusBadge,
  type Column,
} from '@/components/ui';
import { formatInstant } from '@/lib/format';
import type { AdminUserResponse, Role, UserStatus } from '@/types/api';

const ROLES: Role[] = ['GUEST', 'HOST', 'SUPPORT_AGENT', 'ADMIN'];
const STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'DELETED'];

const ROLE_LABELS: Record<Role, string> = {
  GUEST: 'Guest',
  HOST: 'Host',
  SUPPORT_AGENT: 'Support agent',
  ADMIN: 'Admin',
};

const ROLE_CHIP: Record<Role, string> = {
  GUEST: 'bg-neutral-soft text-neutral-text',
  HOST: 'bg-info-soft text-info-text',
  SUPPORT_AGENT: 'bg-warning-soft text-warning-text',
  ADMIN: 'bg-primary-soft text-primary-dark',
};

export const AdminUsersPage: React.FC = () => {
  useDocumentTitle('Users');

  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const query = params.get('query') ?? '';
  const role = (ROLES.includes(params.get('role') as Role) ? params.get('role') : null) as Role | null;
  const status = (STATUSES.includes(params.get('status') as UserStatus)
    ? params.get('status')
    : null) as UserStatus | null;
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);

  const [draftQuery, setDraftQuery] = useState(query);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  const users = useAdminUsers({
    query: query === '' ? undefined : query,
    role: role ?? undefined,
    status: status ?? undefined,
    page,
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

  // The admin user DTO has no host display name, so the column stays empty by contract.
  const columns: Column<AdminUserResponse>[] = [
    {
      key: 'id',
      header: 'Id',
      numeric: true,
      render: (row) => <span className="tabular">{row.id}</span>,
      className: 'w-16',
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span className="font-medium text-ink">
          {row.firstName} {row.lastName}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="flex items-center gap-1.5">
          {row.email}
          {!row.emailVerified && (
            <Badge tone="warning" title="Email address not verified">
              Unverified
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {ROLES.filter((item) => row.roles.includes(item)).map((item) => (
            <Badge key={item} className={ROLE_CHIP[item]}>
              {ROLE_LABELS[item]}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} kind="user" />,
    },
    {
      key: 'host',
      header: 'Host name',
      render: () => <span className="text-muted">—</span>,
    },
    {
      key: 'created',
      header: 'Created',
      render: (row) => (
        <span className="whitespace-nowrap">{formatInstant(row.createdAt)}</span>
      ),
    },
  ];

  const hasFilters = query !== '' || role !== null || status !== null;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: ROUTES.ADMIN_HOME }, { label: 'Users' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Users</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Search by name or email. Every suspension and role change is written to the audit log.
        </p>
      </div>

      <Card className="p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            change({ query: draftQuery.trim() === '' ? null : draftQuery.trim() });
          }}
        >
          <Field label="Search" htmlFor="admin-user-query" className="min-w-[14rem] flex-1">
            <Input
              id="admin-user-query"
              type="search"
              placeholder="Name or email"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
            />
          </Field>
          <Field label="Role" htmlFor="admin-user-role" className="w-44">
            <Select
              id="admin-user-role"
              value={role ?? ''}
              onChange={(event) => change({ role: event.target.value || null })}
            >
              <option value="">Any role</option>
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="admin-user-status" className="w-40">
            <Select
              id="admin-user-status"
              value={status ?? ''}
              onChange={(event) => change({ status: event.target.value || null })}
            >
              <option value="">Any status</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0) + item.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden />
            Search
          </Button>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => change({ query: null, role: null, status: null })}
            >
              <X className="h-4 w-4" aria-hidden />
              Clear
            </Button>
          )}
        </form>
      </Card>

      {users.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {users.isError && <ErrorState error={users.error} onRetry={() => void users.refetch()} />}

      {users.data && users.data.content.length === 0 && (
        <EmptyState
          title="No accounts match"
          description="Try a shorter search, or clear the role and status filters."
          action={
            hasFilters ? (
              <Button variant="outline" onClick={() => change({ query: null, role: null, status: null })}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {users.data && users.data.content.length > 0 && (
        <>
          <DataTable
            caption="User accounts"
            columns={columns}
            rows={users.data.content}
            getRowKey={(row) => row.id}
            onRowClick={(row) => navigate(ROUTES.ADMIN_USER(row.id))}
          />
          <Pagination
            page={users.data.page + 1}
            totalPages={users.data.totalPages}
            onChange={(next) => change({ page: String(next - 1) }, true)}
          />
        </>
      )}
    </div>
  );
};