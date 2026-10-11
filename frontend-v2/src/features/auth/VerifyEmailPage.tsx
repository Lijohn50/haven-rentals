import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { authApi, useResendVerification, useVerifyEmail } from '@/features/auth/api';
import { emailSchema } from '@/features/auth/schemas';
import { useDocumentTitle } from '@/hooks/useSeo';
import { ApiError } from '@/api/errors';
import {
  Button,
  Card,
  Field,
  Input,
  InlineAlert,
  Spinner,
  TraceId,
} from '@/components/ui';

type State = 'verifying' | 'success' | 'expired' | 'idle';

export const VerifyEmailPage: React.FC = () => {
  useDocumentTitle('Confirm your email');

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, refreshUser } = useAuth();
  const verify = useVerifyEmail();
  const resend = useResendVerification();

  const [state, setState] = useState<State>(() => {
    if (token) return 'verifying';
    if (user?.emailVerified) return 'success';
    return 'idle';
  });
  const [error, setError] = useState<unknown>(null);
  const [email, setEmail] = useState(user?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const started = useRef(false);
  const failureCode = error instanceof ApiError ? error.code : null;

  useEffect(() => {
    if (user?.emailVerified) {
      setState('success');
    }
  }, [user?.emailVerified]);

  // When a token is provided in the URL, verify it directly
  useEffect(() => {
    if (!token) {
      if (!user?.emailVerified) setState('idle');
      return;
    }
    // The token is single use: a second POST would burn it and show a false failure.
    if (started.current) return;
    started.current = true;
    setState('verifying');
    verify.mutate(token, {
      onSuccess: async () => {
        if (user) await refreshUser();
        setState('success');
      },
      onError: (cause) => {
        setError(cause);
        setState('expired');
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-detection polling: If this device is waiting on the "Check your email" screen (idle),
  // poll verification status so that if the user clicks the verification link on their phone
  // (or any other device), this screen automatically flips to "Your email is confirmed" without
  // requiring a manual page refresh.
  useEffect(() => {
    if (state !== 'idle') return;

    let active = true;
    const checkStatus = async () => {
      // 1. If signed in, refresh user profile directly
      if (user) {
        const me = await refreshUser();
        if (!active) return;
        if (me?.emailVerified) {
          setState('success');
          toast.success('Your email is confirmed! Welcome to Haven.');
          return;
        }
      }

      // 2. Also check public verification status endpoint by email
      const targetEmail = (user?.email || email).trim();
      if (targetEmail) {
        try {
          const res = await authApi.checkVerificationStatus(targetEmail);
          if (!active) return;
          if (res.verified) {
            if (user) await refreshUser();
            setState('success');
            toast.success('Your email is confirmed! Welcome to Haven.');
          }
        } catch {
          // ignore network hiccups during background polling
        }
      }
    };

    // Run immediate check and then every 2.5 seconds
    void checkStatus();
    const interval = setInterval(checkStatus, 2500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [state, user, email, refreshUser]);

  const sendResend = async () => {
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0].message);
      return;
    }
    setEmailError(null);
    try {
      await resend.mutateAsync(parsed.data);
    } catch {
      /* the endpoint answers the same way for unknown addresses, so nothing changes here */
    }
    setSent(true);
    toast.success('If that address needs confirming, a new email is on its way.');
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
        {state === 'verifying' && (
          <div className="flex flex-col items-start gap-3">
            <h1 className="text-xl font-semibold text-ink">Confirming your email</h1>
            <Spinner label="Checking your link…" />
          </div>
        )}

        {state === 'success' && (
          <div className="flex flex-col items-start gap-3">
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
            <h1 className="text-xl font-semibold text-ink">Your email is confirmed</h1>
            <p className="text-sm text-muted">
              Booking, messaging and listing a home are all unlocked now.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild>
                <Link to={user ? ROUTES.SEARCH : ROUTES.LOGIN}>
                  {user ? 'Start exploring' : 'Sign in'}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={ROUTES.HOME}>Back to the home page</Link>
              </Button>
            </div>
          </div>
        )}

        {state === 'expired' && (
          <div className="flex flex-col items-start gap-3">
            <h1 className="text-xl font-semibold text-ink">
              {failureCode === 'RATE_LIMITED' ? 'Too many requests' : 'This link has expired'}
            </h1>
            <p className="text-sm text-muted">
              {failureCode === 'RATE_LIMITED'
                ? 'Wait a minute and send yourself a fresh confirmation link below.'
                : 'Confirmation links can only be used once and they time out. Send yourself a fresh one below.'}
            </p>
            {error != null && <TraceId error={error} />}
          </div>
        )}

        {state === 'idle' && (
          <div className="flex flex-col items-start gap-3">
            <MailCheck className="h-9 w-9 text-primary" aria-hidden />
            <h1 className="text-xl font-semibold text-ink">Check your email</h1>
            <p className="text-sm text-muted">
              {user ? (
                <>
                  We sent a confirmation link to <span className="font-semibold text-text">{user.email}</span>.
                  Booking needs a confirmed address, so follow the link before you reserve a home.
                </>
              ) : (
                <>
                  Enter the address you registered with and we will send a new confirmation link.
                  Booking needs a confirmed address.
                </>
              )}
            </p>

            <div className="mt-1 flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary-soft/50 px-3.5 py-2.5 text-xs text-primary-dark">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
              </span>
              <span>
                <strong>Waiting for confirmation…</strong> You can click the link on your phone or any device, and this screen will update automatically.
              </span>
            </div>
          </div>
        )}

        {state !== 'success' && (
          <div className="mt-5 flex flex-col gap-3">
            {sent && (
              <InlineAlert tone="info">
                If that address needs confirming, a new email is on its way. The message is the same
                whether or not an account exists.
              </InlineAlert>
            )}

            <Field
              label="Email address"
              htmlFor="verify-email"
              error={emailError}
              hint="We send the same confirmation message for every address."
            >
              <Input
                id="verify-email"
                type="email"
                autoComplete="email"
                value={email}
                hasError={Boolean(emailError)}
                aria-invalid={Boolean(emailError)}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Button
              variant="secondary"
              block
              loading={resend.isPending}
              onClick={() => void sendResend()}
            >
              Send a new confirmation email
            </Button>

            <p className="text-sm text-muted">
              Already confirmed?{' '}
              <Link to={ROUTES.LOGIN} className="text-primary underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
