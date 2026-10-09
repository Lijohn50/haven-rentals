import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { tokens } from '@/api/tokens';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useChangePassword, useDeleteAccount } from '@/features/auth/api';
import { passwordSchema } from '@/features/auth/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { ApiError } from '@/api/errors';
import { mergeRefs } from '@/lib/refs';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  InlineAlert,
  PasswordInput,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: 'Choose a password you have not used here',
    path: ['newPassword'],
  });
type ChangeValues = z.infer<typeof changeSchema>;

export const SecurityPage: React.FC = () => {
  useDocumentTitle('Security');

  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();

  const form = useForm<ChangeValues>({
    resolver: zodResolver(changeSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const currentRef = useRef<HTMLInputElement>(null);
  const currentRegister = form.register('currentPassword');
  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { errors, isSubmitting } = form.formState;

  const onChangePassword = async (values: ChangeValues) => {
    setMessage(null);
    setTrace(null);
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      // Every session is revoked server-side, so the local one goes too.
      tokens.clear();
      toast.success('Password changed. Please sign in again.');
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, text) => form.setError(name as keyof ChangeValues, { message: text }),
        ['currentPassword', 'newPassword']
      );
      setMessage(
        unmatched[0] ??
          (error instanceof ApiError ? error.detail : 'We could not change your password.')
      );
      setTrace(error);
      currentRef.current?.focus();
    }
  };

  const onDelete = async () => {
    if (deletePassword === '') {
      setDeleteError('Enter your password to confirm');
      return;
    }
    setDeleteError(null);
    try {
      await deleteAccount.mutateAsync({ password: deletePassword });
      setDeleteOpen(false);
      await signOut();
      toast.success('Your account has been deleted.');
      navigate(ROUTES.HOME, { replace: true });
    } catch (error) {
      setDeleteError(
        error instanceof ApiError
          ? error.detail
          : 'We could not delete your account. Try again in a minute.'
      );
    }
  };

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Account', to: ROUTES.ACCOUNT }, { label: 'Security' }]} />
      <h1 className="text-2xl font-semibold text-ink">Security</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Change password</h2>
        <p className="mt-1 text-sm text-muted">
          Changing your password signs you out on every device, including this one.
        </p>

        <form
          className="mt-4 flex max-w-md flex-col gap-4"
          onSubmit={form.handleSubmit(onChangePassword)}
          noValidate
        >
          {message && (
            <InlineAlert tone="danger">
              {message}
              <TraceId error={trace} className="mt-1 block" />
            </InlineAlert>
          )}

          <Field
            label="Current password"
            htmlFor="current-password"
            error={errors.currentPassword?.message}
            required
          >
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              {...currentRegister}
              ref={mergeRefs(currentRegister.ref, currentRef)}
              hasError={Boolean(errors.currentPassword)}
              aria-invalid={Boolean(errors.currentPassword)}
            />
          </Field>

          <Field label="New password" htmlFor="new-password" error={errors.newPassword?.message} required>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              hasError={Boolean(errors.newPassword)}
              aria-invalid={Boolean(errors.newPassword)}
              {...form.register('newPassword')}
            />
          </Field>

          <div>
            <Button type="submit" loading={isSubmitting || changePassword.isPending}>
              Change password
            </Button>
          </div>
        </form>
      </Card>

      <Card className="border-danger/40 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-danger-text">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          Delete account
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Deleting removes your profile and stops every booking, message and payout immediately. It
          cannot be undone.
        </p>
        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => {
            setDeletePassword('');
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        >
          Delete my account
        </Button>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This is permanent. Active bookings, unpaid payouts and open disputes block it until
              they are settled.
            </DialogDescription>

            <div className="mt-4 flex flex-col gap-3">
              <Field
                label="Confirm with your password"
                htmlFor="delete-password"
                error={deleteError}
                required
                hint={`Signed in as ${user?.email ?? ''}`}
              >
                <PasswordInput
                  id="delete-password"
                  autoComplete="current-password"
                  value={deletePassword}
                  hasError={Boolean(deleteError)}
                  aria-invalid={Boolean(deleteError)}
                  onChange={(event) => setDeletePassword(event.target.value)}
                />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleteAccount.isPending}>
                Keep my account
              </Button>
              <Button
                variant="destructive"
                loading={deleteAccount.isPending}
                onClick={() => void onDelete()}
              >
                Delete permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
};
