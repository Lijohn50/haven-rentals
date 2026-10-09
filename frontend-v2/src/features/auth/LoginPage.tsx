import React, { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';
import { safeNext } from '@/lib/idempotency';
import { mergeRefs } from '@/lib/refs';
import { useCountdown } from '@/hooks/useUtilities';
import { useDocumentTitle } from '@/hooks/useSeo';
import { ApiError } from '@/api/errors';
import { DemoCredentialsCard } from '@/features/auth/DemoCredentialsCard';
import {
  Button,
  Card,
  Field,
  InlineAlert,
  Input,
  PasswordInput,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';

/** One sentence for an unknown email, a wrong password and a locked account alike. */
const INVALID_CREDENTIALS = 'Invalid email or password';

export const LoginPage: React.FC = () => {
  useDocumentTitle('Sign in');

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRegister = form.register('email');
  const passwordRegister = form.register('password');

  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [failures, setFailures] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const countdown = useCountdown(cooldownUntil);
  const cooling = cooldownUntil !== null && !countdown.expired;

  const setFieldError = (name: string, text: string) =>
    form.setError(name as keyof LoginValues, { message: text });

  const onSubmit = async (values: LoginValues) => {
    setMessage(null);
    setTrace(null);

    try {
      await signIn({ email: values.email.trim(), password: values.password });
      navigate(safeNext(searchParams.get('next')), { replace: true });
    } catch (error) {
      const api = error instanceof ApiError ? error : null;

      if (api?.code === 'INVALID_CREDENTIALS') {
        setFailures((count) => count + 1);
        setMessage(INVALID_CREDENTIALS);
        passwordRef.current?.focus();
        return;
      }

      if (api?.code === 'ACCOUNT_SUSPENDED') {
        setFailures((count) => count + 1);
        setMessage('This account is suspended. Contact support to have it reviewed.');
        passwordRef.current?.focus();
        return;
      }

      if (api?.code === 'RATE_LIMITED') {
        setCooldownUntil(new Date(Date.now() + api.retryAfter * 1000).toISOString());
        setMessage('Too many attempts from this device. The button unlocks shortly.');
        return;
      }

      const unmatched = applyFieldErrors(error, setFieldError, ['email', 'password']);
      setMessage(unmatched[0] ?? (api?.detail ?? 'We could not sign you in. Try again.'));
      setTrace(error);

      const fields = api?.fieldErrors.map((fieldError) => fieldError.field) ?? [];
      if (fields.includes('email')) emailRef.current?.focus();
      else if (fields.includes('password')) passwordRef.current?.focus();
    }
  };

  const { errors, isSubmitting } = form.formState;

  const [busyDemo, setBusyDemo] = useState<string | null>(null);

  /** One-click demo sign-in: fills the form, then authenticates and lands on `next`. */
  const signInAsDemo = async (email: string, password: string) => {
    setBusyDemo(email);
    setMessage(null);
    setTrace(null);
    form.setValue('email', email);
    form.setValue('password', password);
    try {
      await signIn({ email, password });
      navigate(safeNext(searchParams.get('next')), { replace: true });
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      setFailures((count) => count + 1);
      setMessage(
        api?.detail ??
          'Could not sign in with the demo account. The backend may not be seeded (dev profile).'
      );
      setTrace(error);
    } finally {
      setBusyDemo(null);
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

      <Card className="mt-6 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Welcome back. Your trips and messages are waiting.
        </p>

        <form className="mt-5 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {message && (
            <InlineAlert tone="danger">
              {message}
              <TraceId error={trace} className="mt-1 block" />
            </InlineAlert>
          )}

          {failures >= 2 && (
            <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-text">
              {failures} failed attempts.{' '}
              <Link to={ROUTES.FORGOT_PASSWORD} className="font-semibold underline underline-offset-2">
                Forgot password?
              </Link>
            </p>
          )}

          <Field label="Email" htmlFor="login-email" error={errors.email?.message} required>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              {...emailRegister}
              ref={mergeRefs(emailRegister.ref, emailRef)}
              hasError={Boolean(errors.email)}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="login-password"
            error={errors.password?.message}
            required
            hint={
              <Link to={ROUTES.FORGOT_PASSWORD} className="text-primary underline underline-offset-2">
                Forgot password?
              </Link>
            }
          >
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              {...passwordRegister}
              ref={mergeRefs(passwordRegister.ref, passwordRef)}
              hasError={Boolean(errors.password)}
              aria-invalid={Boolean(errors.password)}
            />
          </Field>

          {cooling && (
            <p aria-live="polite" className="tabular text-sm text-warning-text">
              Too many attempts. Try again in {countdown.label}
            </p>
          )}

          <Button type="submit" size="lg" block loading={isSubmitting} disabled={cooling}>
            {cooling ? `Try again in ${countdown.label}` : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-sm text-muted">
          New to {BRAND.name}?{' '}
          <Link to={ROUTES.REGISTER} className="font-medium text-primary underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </Card>

      <DemoCredentialsCard onUse={signInAsDemo} busyEmail={busyDemo} />
    </div>
  );
};
