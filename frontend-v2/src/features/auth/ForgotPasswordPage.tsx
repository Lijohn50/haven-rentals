import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useForgotPassword } from '@/features/auth/api';
import { emailSchema } from '@/features/auth/schemas';
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

const schema = z.object({ email: emailSchema });
type Values = z.infer<typeof schema>;

export const ForgotPasswordPage: React.FC = () => {
  useDocumentTitle('Reset your password');

  const forgot = useForgotPassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });
  const emailRef = useRef<HTMLInputElement>(null);
  const emailRegister = form.register('email');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const { errors, isSubmitting } = form.formState;

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      await forgot.mutateAsync(values.email.trim());
      setSent(true);
    } catch (err) {
      const unmatched = applyFieldErrors(
        err,
        (name, message) => form.setError(name as keyof Values, { message }),
        ['email']
      );
      if (unmatched.length === 0) setError(err);
      else setSent(true);
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
        {sent ? (
          <div className="flex flex-col items-start gap-3">
            <MailCheck className="h-9 w-9 text-primary" aria-hidden />
            <h1 className="text-xl font-semibold text-ink">Check your inbox</h1>
            <p className="text-sm text-muted">
              If an account exists for that address, a reset link is on its way. The link expires
              after a short while, and it can only be used once.
            </p>
            <p className="text-sm text-muted">
              Nothing arrived? Check the spam folder, then try again with the same address.
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link to={ROUTES.LOGIN}>Back to sign in</Link>
              </Button>
              <Button variant="ghost" onClick={() => setSent(false)}>
                Use a different address
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-ink">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted">
              Enter the email you registered with and we will send you a link to choose a new one.
            </p>

            <form className="mt-5 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              {error != null && (
                <InlineAlert tone="danger">
                  {error instanceof ApiError ? error.detail : 'We could not send that email. Try again.'}
                  <TraceId error={error} className="mt-1 block" />
                </InlineAlert>
              )}

              <Field label="Email" htmlFor="forgot-email" error={errors.email?.message} required>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  {...emailRegister}
                  ref={mergeRefs(emailRegister.ref, emailRef)}
                  hasError={Boolean(errors.email)}
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>

              <Button type="submit" size="lg" block loading={isSubmitting || forgot.isPending}>
                Send the reset link
              </Button>
            </form>

            <p className="mt-5 text-sm text-muted">
              Remembered it?{' '}
              <Link to={ROUTES.LOGIN} className="text-primary underline underline-offset-2">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
};
