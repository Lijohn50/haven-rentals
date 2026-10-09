import React, { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useResetPassword } from '@/features/auth/api';
import { byteLength, passwordSchema } from '@/features/auth/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { ApiError } from '@/api/errors';
import { mergeRefs } from '@/lib/refs';
import {
  Button,
  Card,
  Field,
  InlineAlert,
  PasswordInput,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import { cn } from '@/lib/cn';

const schema = z.object({
  newPassword: passwordSchema,
  confirmPassword: z.string(),
});
type Values = z.infer<typeof schema>;

export const ResetPasswordPage: React.FC = () => {
  useDocumentTitle('Choose a new password');

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const reset = useResetPassword();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const passwordRegister = form.register('newPassword');
  const confirmRegister = form.register('confirmPassword');
  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [expired, setExpired] = useState(false);

  const newPassword = form.watch('newPassword') ?? '';
  const checks = [
    { label: 'At least 8 characters', ok: byteLength(newPassword) >= 8 },
    {
      label: 'A letter and a digit',
      ok: /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword),
    },
    { label: 'No spaces at the ends', ok: newPassword !== '' && newPassword === newPassword.trim() },
  ];
  const { errors, isSubmitting } = form.formState;

  const onSubmit = async (values: Values) => {
    if (values.confirmPassword !== values.newPassword) {
      form.setError('confirmPassword', { message: 'Both passwords must match' });
      confirmRef.current?.focus();
      return;
    }
    setMessage(null);
    setTrace(null);

    try {
      await reset.mutateAsync({ token, newPassword: values.newPassword });
      toast.success('Password changed. Please sign in again with your new password.');
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      const api = error instanceof ApiError ? error : null;

      if (api?.code === 'INVALID_OR_EXPIRED_TOKEN') {
        setExpired(true);
        return;
      }

      const unmatched = applyFieldErrors(
        error,
        (name, messageText) => form.setError(name as keyof Values, { message: messageText }),
        ['newPassword', 'confirmPassword']
      );
      setMessage(
        unmatched[0] ?? (api?.detail ?? 'We could not change your password. Try again.')
      );
      setTrace(error);
      passwordRef.current?.focus();
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
        {expired || token === '' ? (
          <div className="flex flex-col items-start gap-3">
            <h1 className="text-xl font-semibold text-ink">This link is invalid or has expired</h1>
            <p className="text-sm text-muted">
              Reset links can only be used once and they time out. Request a fresh one and we will
              email it to you.
            </p>
            <Button asChild className="mt-1">
              <Link to={ROUTES.FORGOT_PASSWORD}>Request a new link</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-ink">Choose a new password</h1>
            <p className="mt-1 text-sm text-muted">
              Setting a new password signs you out everywhere, including this browser.
            </p>

            <form className="mt-5 flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              {message && (
                <InlineAlert tone="danger">
                  {message}
                  <TraceId error={trace} className="mt-1 block" />
                </InlineAlert>
              )}

              <Field
                label="New password"
                htmlFor="reset-password"
                error={errors.newPassword?.message}
                required
              >
                <PasswordInput
                  id="reset-password"
                  autoComplete="new-password"
                  {...passwordRegister}
                  ref={mergeRefs(passwordRegister.ref, passwordRef)}
                  hasError={Boolean(errors.newPassword)}
                  aria-invalid={Boolean(errors.newPassword)}
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
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        check.ok ? 'bg-success' : 'bg-line'
                      )}
                      aria-hidden
                    />
                    {check.label}
                  </li>
                ))}
              </ul>

              <Field
                label="Confirm new password"
                htmlFor="reset-confirm"
                error={errors.confirmPassword?.message}
                required
              >
                <PasswordInput
                  id="reset-confirm"
                  autoComplete="new-password"
                  {...confirmRegister}
                  ref={mergeRefs(confirmRegister.ref, confirmRef)}
                  hasError={Boolean(errors.confirmPassword)}
                  aria-invalid={Boolean(errors.confirmPassword)}
                />
              </Field>

              <Button
                type="submit"
                size="lg"
                block
                loading={isSubmitting || reset.isPending}
                disabled={token === ''}
              >
                Change password
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
};
