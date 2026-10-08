import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useAdminMutations, useAdminUser, useAdminUsers } from '@/features/host/api';
import { adminReasonSchema } from '@/features/host/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { useAuth } from '@/providers/AuthProvider';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Skeleton,
  StatusBadge,
  Textarea,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import { formatInstant } from '@/lib/format';
import type { Role } from '@/types/api';

type ReasonValues = { reason: string };

const GRANTABLE: Role[] = ['SUPPORT_AGENT', 'ADMIN'];

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

/** Mirrors AdminUserService.suspendUser: sessions, listings, requests, holds, bookings. */
const SUSPENSION_CONSEQUENCES = [
  'Their sessions end immediately and they are signed out everywhere.',
  'Every live and paused listing they host becomes suspended.',
  'Pending host requests are declined automatically and the guest is refunded in full.',
  'Bookings they hold as a guest expire and the dates are released.',
  'Confirmed bookings are left alone, and support is alerted to follow up.',
];

/** Mirrors AdminUserService.deleteUser: soft delete plus the shared shutdown cascade. */
const DELETION_CONSEQUENCES = [
  'Every session ends immediately and the account can never sign in again.',
  'Name, email and phone are overwritten; the record is kept for booking history.',
  'Live and paused listings they host become suspended.',
  'Pending host requests are declined and refunded; their own holds expire.',
];

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-3 py-1.5 text-sm">
    <dt className="text-muted">{label}</dt>
    <dd className="text-right font-medium text-ink">{children}</dd>
  </div>
);

export const AdminUserPage: React.FC = () => {
  const { id } = useParams();
  const userId = Number(id);
  const validId = Number.isFinite(userId) ? userId : null;

  const { user: signedIn } = useAuth();
  const query = useAdminUser(validId);
  const admin = useAdminMutations();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [unsuspendOpen, setUnsuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Role[]>([]);
  const [saveError, setSaveError] = useState<unknown>(null);

  const suspendForm = useForm<ReasonValues>({
    resolver: zodResolver(adminReasonSchema),
    defaultValues: { reason: '' },
  });
  const deleteForm = useForm<ReasonValues>({
    resolver: zodResolver(adminReasonSchema),
    defaultValues: { reason: '' },
  });
  const reasonValue = suspendForm.watch('reason') ?? '';
  const deleteReasonValue = deleteForm.watch('reason') ?? '';

  const target = query.data ?? null;
  const isSelf = Boolean(target && signedIn && target.id === signedIn.id);
  const isTargetAdmin = Boolean(target?.roles.includes('ADMIN'));
  const suspended = target?.status === 'SUSPENDED';

  // The API refuses to demote the last administrator; the count here is a safe over-approximation.
  const adminCount = useAdminUsers({ role: 'ADMIN', page: 0 });
  const lastAdmin = Boolean(
    isTargetAdmin && adminCount.data !== undefined && adminCount.data.totalElements <= 1
  );

  useEffect(() => {
    if (!target) return;
    setSelected(GRANTABLE.filter((role) => target.roles.includes(role)));
  }, [target]);

  useEffect(() => {
    setActionError(null);
  }, [suspendOpen, unsuspendOpen, deleteOpen]);

  const describeError = (error: unknown): string =>
    error instanceof ApiError ? error.detail : 'That action could not be completed. Try again.';

  const closeDialog = () => {
    setSuspendOpen(false);
    setUnsuspendOpen(false);
    setDeleteOpen(false);
    setActionError(null);
    suspendForm.reset();
    deleteForm.reset();
  };

  const onDelete = async (values: ReasonValues) => {
    if (!validId) return;
    setActionError(null);
    try {
      await admin.deleteUser.mutateAsync({ id: validId, reason: values.reason.trim() });
      closeDialog();
      toast.success('Account removed.');
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => deleteForm.setError(name as keyof ReasonValues, { message }),
        ['reason']
      );
      setActionError(error);
      if (unmatched.length > 0) toast.error(unmatched[0]);
    }
  };

  const onSuspend = async (values: ReasonValues) => {
    if (!validId) return;
    setActionError(null);
    try {
      await admin.suspendUser.mutateAsync({ id: validId, reason: values.reason.trim() });
      closeDialog();
      toast.success('Account suspended.');
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, message) => suspendForm.setError(name as keyof ReasonValues, { message }),
        ['reason']
      );
      setActionError(error);
      if (unmatched.length > 0) toast.error(unmatched[0]);
    }
  };

  const onUnsuspend = async () => {
    if (!validId) return;
    setActionError(null);
    try {
      await admin.unsuspendUser.mutateAsync(validId);
      closeDialog();
      toast.success('Account reactivated.');
    } catch (error) {
      setActionError(error);
      toast.error(describeError(error));
    }
  };

  const onSaveRoles = async () => {
    if (!validId) return;
    setSaveError(null);
    try {
      // Only the grantable roles travel: GUEST is kept and HOST cannot be granted here.
      await admin.setRoles.mutateAsync({ id: validId, roles: selected });
      toast.success('Roles updated.');
    } catch (error) {
      setSaveError(error);
      toast.error(describeError(error));
    }
  };

  const roleDirty =
    target !== null &&
    JSON.stringify([...selected].sort()) !==
      JSON.stringify(GRANTABLE.filter((role) => target.roles.includes(role)).sort());

  useDocumentTitle(target ? `${target.firstName} ${target.lastName}` : 'User');

  if (!validId) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 sm:px-6">
        <EmptyState title="That user link is not valid" description="Users are opened by numeric id." />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (query.isError || !target) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 sm:px-6">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const canSuspend = !isSelf && !isTargetAdmin && !suspended;
  const removed = target?.status === 'DELETED';
  const canDelete = !isSelf && !isTargetAdmin && !removed;
  const rolesLocked = isSelf;
  const adminLocked = isSelf || lastAdmin;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', to: ROUTES.ADMIN_HOME },
          { label: 'Users', to: ROUTES.ADMIN_USERS },
          { label: `#${target.id}` },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-ink">
            {target.firstName} {target.lastName}
            <StatusBadge status={target.status} kind="user" />
          </h1>
          <p className="mt-1 text-sm text-muted">
            User <span className="tabular">#{target.id}</span> · {target.email}
            {target.emailVerified ? '' : ' · email not verified'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {suspended ? (
            <Button variant="primary" onClick={() => setUnsuspendOpen(true)}>
              Unsuspend
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={!canSuspend}
              onClick={() => {
                suspendForm.reset();
                setActionError(null);
                setSuspendOpen(true);
              }}
            >
              Suspend account
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!canDelete}
            onClick={() => {
              deleteForm.reset();
              setActionError(null);
              setDeleteOpen(true);
            }}
          >
            Remove account
          </Button>
        </div>
      </div>

      {removed && (
        <InlineAlert tone="info">
          This account has been removed. It can no longer sign in, and the personal details were
          replaced. The record itself is kept so booking history and audit logs stay intact.
        </InlineAlert>
      )}

      {!canSuspend && !suspended && !removed && (
        <InlineAlert tone="info">
          {isSelf
            ? 'You are signed in as this account, so you cannot suspend yourself.'
            : 'Administrators cannot be suspended. Ask another administrator to demote this account first.'}
        </InlineAlert>
      )}

      {!canDelete && !removed && (
        <InlineAlert tone="info">
          {isSelf
            ? 'You are signed in as this account, so you cannot remove yourself.'
            : 'Administrators cannot be removed. Ask another administrator to demote this account first.'}
        </InlineAlert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Profile</h2>
          <dl className="divide-y divide-line">
            <DetailRow label="Name">
              {target.firstName} {target.lastName}
            </DetailRow>
            <DetailRow label="Email">{target.email}</DetailRow>
            <DetailRow label="Phone">{target.phone ?? '—'}</DetailRow>
            <DetailRow label="Email verified">{target.emailVerified ? 'Yes' : 'No'}</DetailRow>
            <DetailRow label="Host cancellations">
              <span className="tabular">{target.hostCancellationCount}</span>
            </DetailRow>
            <DetailRow label="Session version">
              <span className="tabular">{target.tokenVersion}</span>
            </DetailRow>
            <DetailRow label="Joined">{formatInstant(target.createdAt)}</DetailRow>
            <DetailRow label="Last change">{formatInstant(target.updatedAt)}</DetailRow>
          </dl>
        </Card>

        <Card as="section" className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Access</h2>
          <p className="mb-3 flex flex-wrap gap-1">
            {(['GUEST', 'HOST', 'SUPPORT_AGENT', 'ADMIN'] as Role[])
              .filter((role) => target.roles.includes(role))
              .map((role) => (
                <Badge key={role} className={ROLE_CHIP[role]}>
                  {ROLE_LABELS[role]}
                </Badge>
              ))}
          </p>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-ink">Staff roles</legend>

            <Checkbox
              label="Guest"
              checked
              disabled
              onChange={() => undefined}
            />
            <Checkbox
              label={
                <span>
                  Host
                  <span className="block text-xs text-muted">Granted only through host onboarding</span>
                </span>
              }
              checked={target.roles.includes('HOST')}
              disabled
              onChange={() => undefined}
            />

            {GRANTABLE.map((role) => (
              <Checkbox
                key={role}
                label={ROLE_LABELS[role]}
                checked={selected.includes(role)}
                disabled={role === 'ADMIN' ? adminLocked : rolesLocked}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, role]
                      : current.filter((item) => item !== role)
                  )
                }
              />
            ))}

            {adminLocked && (
              <p className="text-xs text-warning-text">
                {isSelf
                  ? 'You cannot change the roles on your own account.'
                  : 'This is the only administrator, so the admin role cannot be removed.'}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={rolesLocked || !roleDirty}
                loading={admin.setRoles.isPending}
                onClick={() => void onSaveRoles()}
              >
                Save roles
              </Button>
              {adminCount.isError && (
                <p className="text-xs text-muted">
                  The administrator count could not be loaded, so the last-admin guard is inactive.
                </p>
              )}
            </div>

            {saveError != null && (
              <InlineAlert tone="danger">
                {describeError(saveError)}
                <TraceId error={saveError} className="mt-1 block" />
              </InlineAlert>
            )}
          </fieldset>
        </Card>
      </div>

      {suspended && (
        <Card as="section" className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Suspension
          </h2>
          {/* The reason is kept only in the audit log; the user DTO does not carry it. */}
          <DetailRow label="Reason">
            <span className="text-muted">Not returned by the API</span>
          </DetailRow>
          <p className="mt-2 text-xs text-muted">
            The recorded reason is in the{' '}
            <Link
              to={`${ROUTES.ADMIN_AUDIT}?entityType=User&action=USER_SUSPENDED`}
              className="text-primary underline underline-offset-2"
            >
              audit log
            </Link>
            .
          </p>
        </Card>
      )}

      <Dialog open={suspendOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogTitle>Suspend {target.firstName}?</DialogTitle>
          <DialogDescription>
            Suspending takes effect immediately and cannot be undone from this page.
          </DialogDescription>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={suspendForm.handleSubmit(onSuspend)}
            noValidate
          >
            <ul className="flex flex-col gap-1.5 rounded-control bg-bg px-4 py-3 text-sm text-muted">
              {SUSPENSION_CONSEQUENCES.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden>·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <Field
              label="Reason for the suspension"
              htmlFor="suspend-reason"
              required
              hint={`${reasonValue.length}/500 characters. It is recorded in the audit log.`}
              error={suspendForm.formState.errors.reason?.message}
            >
              <Textarea
                id="suspend-reason"
                maxLength={500}
                hasError={Boolean(suspendForm.formState.errors.reason)}
                aria-invalid={Boolean(suspendForm.formState.errors.reason)}
                {...suspendForm.register('reason')}
              />
            </Field>

            {actionError != null && (
              <InlineAlert tone="danger">
                {describeError(actionError)}
                <TraceId error={actionError} className="mt-1 block" />
              </InlineAlert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" loading={suspendForm.formState.isSubmitting}>
                Suspend account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogTitle>Remove {target.firstName} {target.lastName}?</DialogTitle>
          <DialogDescription>
            This signs the account out everywhere and stops it signing in again. It cannot be
            undone from this page.
          </DialogDescription>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={deleteForm.handleSubmit(onDelete)}
            noValidate
          >
            <ul className="flex flex-col gap-1.5 rounded-control bg-bg px-4 py-3 text-sm text-muted">
              {DELETION_CONSEQUENCES.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden>·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <Field
              label="Reason for the removal"
              htmlFor="delete-reason"
              required
              hint={`${deleteReasonValue.length}/500 characters. It is recorded in the audit log.`}
              error={deleteForm.formState.errors.reason?.message}
            >
              <Textarea
                id="delete-reason"
                maxLength={500}
                hasError={Boolean(deleteForm.formState.errors.reason)}
                aria-invalid={Boolean(deleteForm.formState.errors.reason)}
                {...deleteForm.register('reason')}
              />
            </Field>

            {actionError != null && (
              <InlineAlert tone="danger">
                {describeError(actionError)}
                <TraceId error={actionError} className="mt-1 block" />
              </InlineAlert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" loading={deleteForm.formState.isSubmitting}>
                Remove account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={unsuspendOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogTitle>Unsuspend {target.firstName}?</DialogTitle>
          <DialogDescription>
            The account becomes active again and can sign in immediately.
          </DialogDescription>

          <InlineAlert tone="warning" className="mt-4">
            Listings are not restored automatically. Every listing that was suspended with this
            account stays suspended until an administrator reinstates it one by one.
          </InlineAlert>

{saveError != null && (
              <InlineAlert tone="danger">
                {describeError(saveError)}
                <TraceId error={saveError} className="mt-1 block" />
              </InlineAlert>
            )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={admin.unsuspendUser.isPending}
              onClick={() => void onUnsuspend()}
            >
              Unsuspend
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};