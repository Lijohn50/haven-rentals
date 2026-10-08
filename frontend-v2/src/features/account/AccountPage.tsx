import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useResendVerification, useUpdateProfile } from '@/features/auth/api';
import { nameSchema, phoneSchema } from '@/features/auth/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { ApiError } from '@/api/errors';
import { mergeRefs } from '@/lib/refs';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  InlineAlert,
  Input,
  Skeleton,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import type { UpdateProfileRequest } from '@/types/api';

const schema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema.optional().or(z.literal('')),
});
type Values = z.infer<typeof schema>;

export const AccountPage: React.FC = () => {
  useDocumentTitle('Account');

  const { user, refreshUser } = useAuth();
  const update = useUpdateProfile();
  const resend = useResendVerification();
  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '' },
  });
  const firstNameRegister = form.register('firstName');

  useEffect(() => {
    if (!user) return;
    form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.firstName, user?.lastName, user?.phone]);

  const { errors, isSubmitting } = form.formState;

  const onSubmit = async (values: Values) => {
    if (!user) return;
    setMessage(null);
    setTrace(null);
    setSaved(false);

    // The PATCH carries only what actually changed.
    const payload: UpdateProfileRequest = {};
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    const phone = (values.phone ?? '').trim();
    if (firstName !== user.firstName) payload.firstName = firstName;
    if (lastName !== user.lastName) payload.lastName = lastName;
    if (phone !== (user.phone ?? '')) payload.phone = phone;

    if (Object.keys(payload).length === 0) {
      setMessage('Nothing has changed yet.');
      return;
    }

    try {
      await update.mutateAsync(payload);
      await refreshUser();
      form.reset({ firstName, lastName, phone });
      setSaved(true);
      toast.success('Profile updated');
    } catch (error) {
      const unmatched = applyFieldErrors(
        error,
        (name, text) => form.setError(name as keyof Values, { message: text }),
        ['firstName', 'lastName', 'phone']
      );
      setMessage(
        unmatched[0] ?? (error instanceof ApiError ? error.detail : 'We could not save your profile.')
      );
      setTrace(error);
      firstNameRef.current?.focus();
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Account' }]} />
      <h1 className="text-2xl font-semibold text-ink">Your account</h1>

      {!user.emailVerified && (
        <Banner
          tone="warning"
          title="Confirm your email address"
          action={
            <Button
              size="sm"
              variant="outline"
              loading={resend.isPending}
              onClick={async () => {
                try {
                  await resend.mutateAsync(user.email);
                  toast.success('Verification email sent. Check your inbox.');
                } catch {
                  toast.error('Could not send the email. Try again in a minute.');
                }
              }}
            >
              Resend
            </Button>
          }
        >
          Booking, messaging and submitting a listing stay locked until {user.email} is confirmed.
        </Banner>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Profile</h2>

        <form className="mt-4 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {message && (
            <InlineAlert tone={saved ? 'success' : 'danger'}>
              {message}
              <TraceId error={trace} className="mt-1 block" />
            </InlineAlert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="account-first-name" error={errors.firstName?.message} required>
              <Input
                id="account-first-name"
                autoComplete="given-name"
                {...firstNameRegister}
                ref={mergeRefs(firstNameRegister.ref, firstNameRef)}
                hasError={Boolean(errors.firstName)}
                aria-invalid={Boolean(errors.firstName)}
              />
            </Field>
            <Field label="Last name" htmlFor="account-last-name" error={errors.lastName?.message} required>
              <Input
                id="account-last-name"
                autoComplete="family-name"
                hasError={Boolean(errors.lastName)}
                aria-invalid={Boolean(errors.lastName)}
                {...form.register('lastName')}
              />
            </Field>
          </div>

          <Field
            label="Phone"
            htmlFor="account-phone"
            error={errors.phone?.message}
            hint="International format, for example +14155550123."
          >
            <Input
              id="account-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              hasError={Boolean(errors.phone)}
              aria-invalid={Boolean(errors.phone)}
              {...form.register('phone')}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting || update.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Email address</h2>
        <p className="mt-1 text-sm text-muted">
          Your address identifies your account and hosts never see it. It cannot be changed here.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="min-w-0 break-all text-sm text-ink">{user.email}</span>
          {user.emailVerified ? (
            <Badge tone="success">Confirmed</Badge>
          ) : (
            <Badge tone="warning">Not confirmed</Badge>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Account settings</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          <li>
            <Link to={ROUTES.ACCOUNT_SECURITY} className="text-primary underline underline-offset-4">
              Password and account deletion
            </Link>
          </li>
          <li>
            <Link to={ROUTES.ACCOUNT_DISPUTES} className="text-primary underline underline-offset-4">
              My disputes
            </Link>
          </li>
          <li>
            <Link to={user.host ? ROUTES.HOST_DASHBOARD : ROUTES.BECOME_HOST} className="text-primary underline underline-offset-4">
              {user.host ? 'Host dashboard' : 'List your property'}
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
};
