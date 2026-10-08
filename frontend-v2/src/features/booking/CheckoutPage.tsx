import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { mergeRefs } from '@/lib/refs';
import { ROUTES } from '@/config/routes';
import { BRAND } from '@/config/brand';
import { useAuth } from '@/providers/AuthProvider';
import { useResendVerification } from '@/features/auth/api';
import { bookingsApi, priceChangePayload, useBookingMutations } from '@/features/booking/api';
import { useListing, useQuote } from '@/features/listings/api';
import { PriceBreakdown } from '@/components/patterns/PriceBreakdown';
import { PhotoThumb } from '@/components/patterns/PhotoGallery';
import { useCountdown } from '@/hooks/useUtilities';
import { useDocumentTitle } from '@/hooks/useSeo';
import { formatDate, formatDateRange } from '@/lib/local-date';
import { guestsLabel } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { localTimeToDisplay } from '@/lib/cancellation';
import { idempotencyKeyFor } from '@/lib/idempotency';
import { cancellationPolicyLabels } from '@/lib/status';
import {
  Banner,
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
  Textarea,
  TraceId,
  applyFieldErrors,
} from '@/components/ui';
import type { BookingResponse, CreateBookingRequest, PriceBreakdownResponse } from '@/types/api';

const checkoutSchema = z.object({
  message: z.string().trim().max(1000, 'Keep your message to 1000 characters'),
  agree: z
    .boolean()
    .refine((agreed) => agreed, 'Please accept the house rules and cancellation policy'),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;

function newAttemptKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const holdFailureMessage = (code: string | null, failure: unknown): string => {
  if (code === 'LISTING_NOT_BOOKABLE') return 'This home is no longer available for booking.';
  if (code === 'EMAIL_NOT_VERIFIED') return 'Confirm your email address before booking.';
  if (code === 'BOOKING_CONFLICT') return 'Those dates were just booked by someone else.';
  if (code === 'CONCURRENT_MODIFICATION')
    return 'Someone changed these dates a moment ago. Try again.';
  if (code === 'BUSINESS_RULE_VIOLATION')
    return failure instanceof ApiError ? failure.detail : 'A booking rule stopped this request.';
  return failure instanceof ApiError ? failure.detail : 'We could not hold these dates. Try again.';
};

export const CheckoutPage: React.FC = () => {
  useDocumentTitle('Review your trip');

  const { listingId: listingIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const resend = useResendVerification();

  const listingId = Number(listingIdParam);
  const checkIn = searchParams.get('checkIn') ?? '';
  const checkOut = searchParams.get('checkOut') ?? '';
  const guests = Math.max(1, Number(searchParams.get('guests') ?? '1') || 1);
  // "Start again" from the pay step needs a brand new hold, so it brings its own key.
  const forcedKey = searchParams.get('holdKey') ?? '';

  const validListing = Number.isFinite(listingId) && listingId > 0;
  const hasDates = checkIn !== '' && checkOut !== '';

  const listing = useListing(validListing ? listingId : null);
  const quote = useQuote(validListing ? listingId : null, { checkIn, checkOut, guests }, hasDates);
  const { createHold } = useBookingMutations(undefined, validListing ? listingId : undefined);

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { message: '', agree: false },
  });
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const messageRegister = form.register('message');
  const regenerated = useRef(false);

  const [failure, setFailure] = useState<unknown>(null);
  const [priceChange, setPriceChange] = useState<{ from: number; to: number } | null>(null);
  const [resumeHold, setResumeHold] = useState<BookingResponse | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const countdown = useCountdown(cooldownUntil);
  const cooling = cooldownUntil !== null && !countdown.expired;
  const message = form.watch('message') ?? '';
  const { errors } = form.formState;

  const failureCode = failure instanceof ApiError ? failure.code : null;
  const unverified = Boolean(user && !user.emailVerified);
  const listHref = `${ROUTES.LISTING(listingId)}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;

  const sendVerification = async () => {
    if (!user) return;
    try {
      await resend.mutateAsync(user.email);
      toast.success('Verification email sent. Check your inbox.');
    } catch {
      toast.error('Could not send the email. Try again in a minute.');
    }
  };

  const attempt = async (expectedTotal: number, messageText: string, forceNewKey = false) => {
    const body: CreateBookingRequest = {
      listingId,
      checkIn,
      checkOut,
      guests,
      expectedTotal,
      message: messageText === '' ? null : messageText,
    };

    let idempotencyKey: string;
    if (forceNewKey) idempotencyKey = newAttemptKey();
    else if (forcedKey !== '') idempotencyKey = forcedKey;
    else
      idempotencyKey = await idempotencyKeyFor('booking', {
        listingId,
        checkIn,
        checkOut,
        guests,
        expectedTotal,
        message: messageText,
      });

    setSubmitting(true);
    setFailure(null);
    setResumeHold(null);

    try {
      const booking = await createHold.mutateAsync({ body, idempotencyKey });
      navigate(ROUTES.TRIP_PAY(booking.reference));
    } catch (error) {
      const api = error instanceof ApiError ? error : null;

      switch (api?.code) {
        case 'PRICE_CHANGED': {
          const changed = priceChangePayload(error);
          setPriceChange({ from: expectedTotal, to: changed?.totalAmount ?? expectedTotal });
          void quote.refetch();
          break;
        }
        case 'BOOKING_CONFLICT': {
          const page = await bookingsApi.mine('PENDING_PAYMENT').catch(() => null);
          const own = page?.content.find(
            (candidate) =>
              candidate.listing.id === listingId &&
              candidate.checkIn === checkIn &&
              candidate.checkOut === checkOut
          );
          if (own) setResumeHold(own);
          else setFailure(error);
          break;
        }
        case 'LISTING_NOT_BOOKABLE':
        case 'EMAIL_NOT_VERIFIED':
        case 'BUSINESS_RULE_VIOLATION':
        case 'CONCURRENT_MODIFICATION':
          setFailure(error);
          break;
        case 'IDEMPOTENCY_KEY_REUSED': {
          // Should not happen: the key is derived from the payload. Regenerate once, then stop.
          if (regenerated.current) {
            setFailure(error);
            break;
          }
          regenerated.current = true;
          await attempt(expectedTotal, messageText, true);
          break;
        }
        case 'RATE_LIMITED':
          setCooldownUntil(new Date(Date.now() + api.retryAfter * 1000).toISOString());
          break;
        case 'VALIDATION_ERROR': {
          const unmatched = applyFieldErrors(
            error,
            (name, text) => form.setError(name as keyof CheckoutValues, { message: text }),
            ['message']
          );
          if (unmatched.length > 0) messageRef.current?.focus();
          else setFailure(error);
          break;
        }
        default:
          setFailure(error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const currentMessage = () => (form.getValues('message') ?? '').trim();

  const onSubmit = (values: CheckoutValues) => {
    if (!quote.data) return;
    void attempt(quote.data.priceBreakdown.totalAmount, (values.message ?? '').trim());
  };

  if (!validListing || !hasDates) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-12 sm:px-6">
        <EmptyState
          title="Pick your dates first"
          description="Checkout needs a check-in date, a check-out date and a guest count. Choose them on the listing page and come straight back."
          action={
            validListing ? (
              <Button asChild>
                <Link to={ROUTES.LISTING(listingId)}>Choose dates</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (listing.isLoading || quote.isLoading) {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row">
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="flex flex-col gap-3 lg:w-80">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (listing.isError) {
    return (
      <div className="mx-auto max-w-narrow px-4 py-12 sm:px-6">
        <ErrorState error={listing.error} onRetry={() => void listing.refetch()} />
      </div>
    );
  }

  if (quote.isError) {
    const conflict = quote.error instanceof ApiError && quote.error.code === 'BOOKING_CONFLICT';
    return (
      <div className="mx-auto flex max-w-narrow flex-col gap-4 px-4 py-12 sm:px-6">
        <ErrorState
          title={conflict ? 'Those dates are not available' : 'We could not price this stay'}
          error={quote.error}
          onRetry={() => void quote.refetch()}
        />
        <div>
          <Button asChild variant="outline">
            <Link to={listHref}>Back to the listing</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!listing.data || !quote.data) return null;

  const home = listing.data;
  const priced = quote.data;
  const policyLabel = cancellationPolicyLabels[home.cancellationPolicy] ?? home.cancellationPolicy;
  const rules = [...home.houseRules].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
<form
      className="mx-auto grid max-w-content gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      {/* Spans both columns: with the heading inside the left column, the left column started
          lower than the price column and "Continue to payment" floated above the trip card. */}
      <div className="lg:col-span-2">
        <Link
          to={listHref}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to {home.title}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Review your trip</h1>
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-primary-dark">1 Review</span>
          <span aria-hidden> · </span>
          <span>2 Pay</span>
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {unverified && (
          <Banner
            tone="warning"
            title="Confirm your email address to book"
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={resend.isPending}
                onClick={() => void sendVerification()}
              >
                Resend
              </Button>
            }
          >
            We need {user?.email} confirmed before a hold can be created.
          </Banner>
        )}

        <Card className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <PhotoThumb
              src={home.coverPhotoUrl}
              alt={home.title}
              className="aspect-[4/3] w-full shrink-0 sm:h-32 sm:w-48"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-ink">{home.title}</h2>
              <p className="text-sm text-muted">
                {home.city}, {home.country}
              </p>
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Check-in</dt>
                  <dd className="text-ink">{formatDate(checkIn)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Check-out</dt>
                  <dd className="text-ink">{formatDate(checkOut)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Guests</dt>
                  <dd className="text-ink">{guestsLabel(guests)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Times</dt>
                  <dd className="text-ink">
                    {localTimeToDisplay(home.checkInTime)} to {localTimeToDisplay(home.checkOutTime)}
                    <span className="block text-xs text-muted">local time in {home.city}</span>
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-ink">
                {formatDateRange(checkIn, checkOut)} · {priced.nights}{' '}
                {priced.nights === 1 ? 'night' : 'nights'}
              </p>
              <Button asChild variant="ghost" size="sm" className="-ml-3 mt-1">
                <Link to={listHref}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit dates and guests
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold text-ink">Your details</h2>
          <p className="mt-1 text-sm text-muted">
            Hosts never see your email address, only your name and phone once the booking is
            confirmed.
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Name</dt>
              <dd className="text-ink">
                {user?.firstName} {user?.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Phone</dt>
              <dd className="text-ink">{user?.phone ?? 'Not provided'}</dd>
            </div>
          </dl>
          <Button asChild variant="link" size="sm" className="-ml-3 mt-2">
            <Link to={ROUTES.ACCOUNT}>Edit in account</Link>
          </Button>
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold text-ink">
            Message to {home.hostDisplayName ?? 'the host'}
          </h2>
          <Field
            label="Message (optional)"
            htmlFor="checkout-message"
            error={errors.message?.message}
            hint={`${message.length}/1000 characters. Plain text only.`}
            className="mt-3"
          >
            <Textarea
              id="checkout-message"
              {...messageRegister}
              ref={mergeRefs(messageRegister.ref, messageRef)}
              maxLength={1000}
              hasError={Boolean(errors.message)}
              aria-invalid={Boolean(errors.message)}
            />
          </Field>
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold text-ink">House rules and cancellation policy</h2>
          <p className="mt-1 text-sm text-muted">
            Cancellation policy: <span className="font-medium text-ink">{policyLabel}</span>. The
            exact refund figures for your dates appear in the price panel.
          </p>

          {rules.length > 0 ? (
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
              {rules.map((rule) => (
                <li key={`${rule.sortOrder}-${rule.text}`}>{rule.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">This host has not published any house rules.</p>
          )}

          <div className="mt-4 border-t border-line pt-4">
            <Checkbox
              id="checkout-agree"
              label="I agree to the house rules and cancellation policy"
              aria-invalid={Boolean(errors.agree)}
              aria-describedby={errors.agree ? 'checkout-agree-error' : undefined}
              {...form.register('agree')}
            />
            {errors.agree && (
              <p id="checkout-agree-error" role="alert" className="mt-1.5 text-xs text-danger-text">
                {errors.agree.message}
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="lg:w-80 lg:shrink-0">
        <div className="flex flex-col gap-3 lg:sticky lg:top-24">
          {/* the quote's zod guard omits `seasonName`, so its breakdown is narrower than the contract */}
          <PriceBreakdown
            breakdown={priced.priceBreakdown as PriceBreakdownResponse}
            nights={priced.nights}
          />

          {failure != null && (
            <InlineAlert tone="danger">
              {holdFailureMessage(failureCode, failure)}
              <TraceId error={failure} className="mt-1 block" />
            </InlineAlert>
          )}

          {failureCode === 'LISTING_NOT_BOOKABLE' && (
            <Button asChild variant="outline" block>
              <Link to={ROUTES.SEARCH}>Find another home</Link>
            </Button>
          )}

          {failureCode === 'BOOKING_CONFLICT' && (
            <Button asChild variant="outline" block>
              <Link to={listHref}>Back to the listing</Link>
            </Button>
          )}

          {failureCode === 'BUSINESS_RULE_VIOLATION' && (
            <Button asChild variant="outline" block>
              <Link to={ROUTES.TRIPS}>Go to your trips</Link>
            </Button>
          )}

          {failureCode === 'EMAIL_NOT_VERIFIED' && (
            <Button
              type="button"
              variant="outline"
              block
              loading={resend.isPending}
              onClick={() => void sendVerification()}
            >
              Resend the confirmation email
            </Button>
          )}

          {failureCode === 'CONCURRENT_MODIFICATION' && (
            <Button
              type="button"
              variant="outline"
              block
              onClick={() => void attempt(priced.priceBreakdown.totalAmount, currentMessage())}
            >
              Busy, please try again
            </Button>
          )}

          {cooling && (
            <p aria-live="polite" className="tabular text-sm text-warning-text">
              Too many attempts. Try again in {countdown.label}
            </p>
          )}

          <Button type="submit" size="lg" block loading={submitting} disabled={cooling || unverified}>
            Continue to payment
          </Button>

          <p className="text-xs text-muted">
            Nothing is charged on this step. Your dates are held for {BRAND.paymentHoldMinutes}{' '}
            minutes once the hold exists, and the total is frozen with it.
          </p>
        </div>
      </div>

      <Dialog open={priceChange != null} onOpenChange={(open) => !open && setPriceChange(null)}>
        <DialogContent>
          <DialogTitle>The price changed</DialogTitle>
          <DialogDescription>
            {priceChange
              ? `The total moved from ${formatMoney(priceChange.from)} to ${formatMoney(
                  priceChange.to
                )} while you were reviewing.`
              : ''}
          </DialogDescription>
          {priceChange && (
            <div className="mt-4 flex flex-col gap-3">
              <InlineAlert tone="warning">
                Your dates are fine. Seasonal rates or the host's price moved, so the total is
                different now. Accepting takes the new price.
              </InlineAlert>
              <div className="flex justify-end gap-2">
                <Button asChild variant="ghost">
                  <Link to={listHref}>Back</Link>
                </Button>
                <Button type="button" onClick={() => void attempt(priceChange.to, currentMessage())}>
                  Accept new price
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resumeHold != null} onOpenChange={(open) => !open && setResumeHold(null)}>
        <DialogContent>
          <DialogTitle>You already have a hold for these dates</DialogTitle>
          <DialogDescription>
            Another tab or an earlier visit already held {formatDateRange(checkIn, checkOut)} on this
            home. Finish that hold instead of creating a second one.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setResumeHold(null)}>
              Stay here
            </Button>
            <Button asChild>
              <Link to={ROUTES.TRIP_PAY(resumeHold?.reference ?? '')}>Resume payment</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
};
