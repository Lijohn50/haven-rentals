import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useResendVerification } from '@/features/auth/api';
import { passwordChecks, registerSchema, type RegisterValues } from '@/features/auth/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { ApiError } from '@/api/errors';
import { mergeRefs } from '@/lib/refs';
import {
  Button,
  Card,
  Field,
  InlineAlert,
  Input,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import { cn } from '@/lib/cn';

export const RegisterPage: React.FC = () => {
  useDocumentTitle('Create your account');

  const navigate = useNavigate();
  const { registerAndSignIn } = useAuth();
  const resend = useResendVerification();
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '', phone: '' },
  });
  const emailRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const emailRegister = form.register('email');
  const passwordRegister = form.register('password');

  const password = form.watch('password');
  const email = form.watch('email');
  const checks = passwordChecks(password ?? '', email ?? '');
  const { errors, isSubmitting } = form.formState;

  const setFieldError = (name: string, text: string) =>
    form.setError(name as keyof RegisterValues, { message: text });

  const onSubmit = async (values: RegisterValues) => {
    setMessage(null);
    setTrace(null);

    try {
      await registerAndSignIn({
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone && values.phone.trim() !== '' ? values.phone.trim() : null,
      });
      setCreatedEmail(values.email.trim());
      toast.success('Account created. Check your email to confirm your address.');
      // `/register` is behind RequireGuest, which redirects the moment we are signed in,
      // so the "check your email" panel lives on the verification screen.
      navigate(ROUTES.VERIFY_EMAIL, { replace: true });
    } catch (error) {
      const api = error instanceof ApiError ? error : null;

      if (api?.code === 'EMAIL_ALREADY_REGISTERED') {
        setFieldError('email', 'An account already uses this email address');
        emailRef.current?.focus();
        return;
      }

      const unmatched = applyFieldErrors(error, setFieldError, [
        'email',
        'password',
        'firstName',
        'lastName',
        'phone',
      ]);
      setMessage(unmatched[0] ?? (api?.detail ?? 'We could not create your account. Try again.'));
      setTrace(error);

      const fields = api?.fieldErrors.map((fieldError) => fieldError.field) ?? [];
      if (fields.includes('email')) emailRef.current?.focus();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-content flex-col items-center px-4 py-14 sm:px-6">
      <Link to={ROUTES.HOME} className="flex items-center gap-2 font-heading text-xl font-semibold text-primary-dark">
        <span className="grid h-8 w-8 place-items-center rounded-control bg-primary text-white" aria-hidden>
          H
        </span>
        {BRAND.name}
      </Link>

      <Card className="mt-6 w-full max-w-lg p-6">
        <h1 className="text-xl font-semibold text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          {BRAND.subcopy} Booking takes a minute once your email is confirmed.
        </p>

        {createdEmail && (
          <div className="mt-4 rounded-control bg-primary-soft px-4 py-3 text-sm text-primary-dark">
            <p className="font-medium">Check your email</p>
            <p className="mt-1">
              We sent a confirmation link to {createdEmail}. Booking, messaging and listing a home
              all stay locked until the address is confirmed.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              loading={resend.isPending}
              onClick={async () => {
                try {
                  await resend.mutateAsync(createdEmail);
                  toast.success('Verification email sent. Check your inbox.');
                } catch {
                  toast.error('Could not send the email. Try again in a minute.');
                }
              }}
            >
              Resend the email
            </Button>
          </div>
        )}

        <form className="mt-5 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {message && (
            <InlineAlert tone="danger">
              {message}
              <TraceId error={trace} className="mt-1 block" />
            </InlineAlert>
          )}

          <Field label="Email" htmlFor="register-email" error={errors.email?.message} required>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              {...emailRegister}
              ref={mergeRefs(emailRegister.ref, emailRef)}
              hasError={Boolean(errors.email)}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>
          <p className="-mt-2 text-xs text-muted">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className="text-primary underline underline-offset-2">
              Sign in instead
            </Link>
          </p>

          <Field
            label="Password"
            htmlFor="register-password"
            error={errors.password?.message}
            required
          >
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              hasError={Boolean(errors.password)}
              aria-invalid={Boolean(errors.password)}
              {...form.register('password')}
            />
          </Field>

          <ul className="flex flex-col gap-1" aria-live="polite">
            {checks.map((check) => (
              <li
                key={check.label}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  check.ok ? 'text-success-text' : 'text-muted'
                )}
              >
                {check.ok ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <X className="h-3.5 w-3.5" aria-hidden />
                )}
                {check.label}
              </li>
            ))}
          </ul>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="register-first-name" error={errors.firstName?.message} required>
              <Input
                id="register-first-name"
                autoComplete="given-name"
                hasError={Boolean(errors.firstName)}
                aria-invalid={Boolean(errors.firstName)}
                {...form.register('firstName')}
              />
            </Field>
            <Field label="Last name" htmlFor="register-last-name" error={errors.lastName?.message} required>
              <Input
                id="register-last-name"
                autoComplete="family-name"
                hasError={Boolean(errors.lastName)}
                aria-invalid={Boolean(errors.lastName)}
                {...form.register('lastName')}
              />
            </Field>
          </div>

          <Field
            label="Phone (optional)"
            htmlFor="register-phone"
            error={errors.phone?.message}
            hint="International format, for example +14155550123. Hosts see it only once a booking is confirmed."
          >
            <Input
              id="register-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              hasError={Boolean(errors.phone)}
              aria-invalid={Boolean(errors.phone)}
              {...form.register('phone')}
            />
          </Field>

          <Button type="submit" size="lg" block loading={isSubmitting}>
            Create account
          </Button>
        </form>

        <p className="mt-5 text-xs text-muted">
          By creating an account you accept the{' '}
          <Link to={ROUTES.TERMS} className="text-primary underline underline-offset-2">
            terms of service
          </Link>{' '}
          and the{' '}
          <Link to={ROUTES.PRIVACY} className="text-primary underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
      </Card>
    </div>
  );
};
