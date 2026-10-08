import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { mergeRefs } from '@/lib/refs';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useBecomeHost, useResendVerification } from '@/features/auth/api';
import { useDocumentTitle } from '@/hooks/useSeo';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  InlineAlert,
  Input,
  Textarea,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters')
    .max(80, 'Use at most 80 characters'),
  bio: z.string().trim().max(1000, 'Keep your introduction to 1000 characters').optional(),
  acceptTerms: z.boolean().refine((accepted) => accepted, 'Please accept the hosting terms'),
});
type Values = z.infer<typeof schema>;

const CHECKLIST = [
  { title: 'Create your first listing', detail: 'Add the address, the rooms and your nightly price.' },
  { title: 'Add photos', detail: `At least ${BRAND.minPhotosToSubmit} photos, ${BRAND.photoMinSide}px on the short side.` },
  { title: 'Submit for review', detail: 'We check every home before it appears in search.' },
];

export const BecomeHostPage: React.FC = () => {
  useDocumentTitle('Become a host');

  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const becomeHost = useBecomeHost();
  const resend = useResendVerification();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', bio: '', acceptTerms: false },
  });
  const displayNameRef = useRef<HTMLInputElement>(null);
  const displayNameRegister = form.register('displayName');
  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const { errors, isSubmitting } = form.formState;
  const bio = form.watch('bio') ?? '';
  const unverified = Boolean(user && !user.emailVerified);

  const onSubmit = async (values: Values) => {
    setMessage(null);
    setTrace(null);
    try {
      await becomeHost.mutateAsync({
        displayName: values.displayName.trim(),
        bio: values.bio && values.bio.trim() !== '' ? values.bio.trim() : undefined,
        acceptTerms: true,
      });
      // Roles change server-side, so refresh the stored user instead of asking for a re-login.
      await refreshUser();
      setDone(true);
      toast.success('You are a host now');
    } catch (error) {
      const api = error instanceof ApiError ? error : null;

      if (api?.code === 'DUPLICATE_RESOURCE') {
        navigate(ROUTES.HOST_DASHBOARD, { replace: true });
        return;
      }

      if (api?.code === 'EMAIL_NOT_VERIFIED') {
        setMessage('Confirm your email address before you become a host.');
        setTrace(error);
        return;
      }

      const unmatched = applyFieldErrors(
        error,
        (name, text) => form.setError(name as keyof Values, { message: text }),
        ['displayName', 'bio', 'acceptTerms']
      );
      setMessage(unmatched[0] ?? (api?.detail ?? 'We could not complete your application.'));
      setTrace(error);
      displayNameRef.current?.focus();
    }
  };

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Account', to: ROUTES.ACCOUNT }, { label: 'Become a host' }]} />

      {done ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Welcome aboard, {user?.firstName}</h1>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Your hosting profile is live. Three steps and your first home is on the market.
            </p>
          </div>

          <ol className="flex flex-col gap-3">
            {CHECKLIST.map((item, index) => (
              <li key={item.title}>
                <Card className="flex items-start gap-3 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="text-sm text-muted">{item.detail}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={ROUTES.HOST_LISTING_NEW}>Create your first listing</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={ROUTES.HOST_DASHBOARD}>Go to the host dashboard</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-ink">List your property</h1>
            <p className="mt-1 max-w-prose text-sm text-muted">
              {BRAND.hostBand}. You keep {100 - BRAND.commissionPercent}% of every booking, and you
              decide who stays and who does not.
            </p>
          </div>

          {unverified && (
            <Banner
              tone="warning"
              title="Confirm your email address first"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  loading={resend.isPending}
                  onClick={async () => {
                    try {
                      await resend.mutateAsync(user!.email);
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
              Hosting needs a confirmed address at {user?.email}.
            </Banner>
          )}

          <Card className="p-6">
            <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              {message && (
                <InlineAlert tone="danger">
                  {message}
                  <TraceId error={trace} className="mt-1 block" />
                </InlineAlert>
              )}

              <Field
                label="Display name"
                htmlFor="host-display-name"
                error={errors.displayName?.message}
                required
                hint="Guests see this name, not your own. 2 to 80 characters."
              >
                <Input
                  id="host-display-name"
                  {...displayNameRegister}
                  ref={mergeRefs(displayNameRegister.ref, displayNameRef)}
                  hasError={Boolean(errors.displayName)}
                  aria-invalid={Boolean(errors.displayName)}
                />
              </Field>

              <Field
                label="About you (optional)"
                htmlFor="host-bio"
                error={errors.bio?.message}
                hint={`${bio.length}/1000 characters. A photo and a sentence or two work best.`}
              >
                <Textarea
                  id="host-bio"
                  maxLength={1000}
                  hasError={Boolean(errors.bio)}
                  aria-invalid={Boolean(errors.bio)}
                  {...form.register('bio')}
                />
              </Field>

              <div>
                <Checkbox
                  id="host-accept-terms"
                  label={
                    <>
                      I accept the hosting{' '}
                      <Link to={ROUTES.TERMS} className="text-primary underline underline-offset-2">
                        terms of service
                      </Link>{' '}
                      and will follow the house rules I publish.
                    </>
                  }
                  aria-invalid={Boolean(errors.acceptTerms)}
                  aria-describedby={errors.acceptTerms ? 'host-accept-terms-error' : undefined}
                  {...form.register('acceptTerms')}
                />
                {errors.acceptTerms && (
                  <p id="host-accept-terms-error" role="alert" className="mt-1.5 text-xs text-danger-text">
                    {errors.acceptTerms.message}
                  </p>
                )}
              </div>

              <div>
                <Button
                  type="submit"
                  size="lg"
                  loading={isSubmitting || becomeHost.isPending}
                  disabled={unverified}
                >
                  Become a host
                </Button>
                {unverified && (
                  <p className="mt-2 text-xs text-muted">
                    The button unlocks once your email address is confirmed.
                  </p>
                )}
              </div>
            </form>
          </Card>
        </>
      )}
    </div>
  );
};
