import React from 'react';
import { AlertCircle, CreditCard, FlaskConical, Lock } from 'lucide-react';
import { ENV } from '@/config/env';
import { Banner, Field, Input, RadioGroup, type RadioOption } from '@/components/ui';

const TEST_TOKENS: RadioOption[] = [
  { value: 'tok_success', label: 'Succeeds', description: 'The payment goes through immediately.' },
  { value: 'tok_decline', label: 'Card declined', description: '402 with CARD_DECLINED.' },
  {
    value: 'tok_insufficient',
    label: 'Insufficient funds',
    description: '402 with INSUFFICIENT_FUNDS.',
  },
  {
    value: 'tok_timeout',
    label: 'Gateway timeout (2 s)',
    description: 'The fake gateway waits two seconds, then answers 402 GATEWAY_TIMEOUT.',
  },
  { value: 'tok_flaky', label: 'Fails first', description: 'Declines once, then succeeds.' },
];

export interface PaymentMethodFieldProps {
  onTokenChange: (token: string) => void;
}

/**
 * Development and demo only: the fake gateway turns one of these opaque tokens into a
 * scripted outcome. No card data ever reaches the browser or the API.
 */
export const FakePaymentField: React.FC<PaymentMethodFieldProps> = ({ onTokenChange }) => {
  const [token, setToken] = React.useState('tok_success');

  React.useEffect(() => {
    onTokenChange(token);
  }, [onTokenChange, token]);

  return (
    <div className="flex flex-col gap-3">
      <Banner tone="warning" className="items-center" title="Test mode">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          No real card is charged. Pick the outcome the fake gateway should return.
        </span>
      </Banner>

      <RadioGroup
        name="payment-token"
        value={token}
        onChange={(value) => setToken(value)}
        options={TEST_TOKENS}
      />
    </div>
  );
};

type CardBrand = {
  id: string;
  label: string;
  pattern: RegExp;
  lengths: number[];
  cvcLength: number;
  groups: number[];
};

const CARD_BRANDS: CardBrand[] = [
  {
    id: 'amex',
    label: 'American Express',
    pattern: /^3[47]/,
    lengths: [15],
    cvcLength: 4,
    groups: [4, 6, 5],
  },
  {
    id: 'discover',
    label: 'Discover',
    pattern: /^6/,
    lengths: [16],
    cvcLength: 3,
    groups: [4, 4, 4, 4],
  },
  {
    id: 'mastercard',
    label: 'Mastercard',
    pattern: /^(5[1-5]|2[2-7])/,
    lengths: [16],
    cvcLength: 3,
    groups: [4, 4, 4, 4],
  },
  {
    id: 'visa',
    label: 'Visa',
    pattern: /^4/,
    lengths: [16],
    cvcLength: 3,
    groups: [4, 4, 4, 4],
  },
];

const GENERIC_BRAND: CardBrand = {
  id: 'card',
  label: 'Card',
  pattern: /^/,
  lengths: [13, 19],
  cvcLength: 3,
  groups: [4, 4, 4, 4, 4],
};

function detectBrand(digits: string): CardBrand {
  return CARD_BRANDS.find((brand) => brand.pattern.test(digits)) ?? GENERIC_BRAND;
}

function formatCardNumber(digits: string, brand: CardBrand): string {
  const parts: string[] = [];
  let rest = digits;
  for (const size of brand.groups) {
    if (rest.length === 0) break;
    parts.push(rest.slice(0, size));
    rest = rest.slice(size);
  }
  if (rest.length > 0) parts.push(rest);
  return parts.join(' ');
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function expiryError(value: string): string | null {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
  if (!match) return 'Use MM/YY';
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  // Day 0 of the next month is the last moment the card is still usable.
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  return endOfMonth.getTime() < Date.now() ? 'This card has expired' : null;
}

/**
 * Development simulation with Stripe test-card semantics, so the full pay flow
 * can be exercised without provider credentials.
 */
function simulatedToken(digits: string): string {
  if (digits === '4000000000000002') return 'tok_decline';
  if (digits === '4000000000009995') return 'tok_insufficient';
  return 'tok_success';
}

interface StripeTokenResponse {
  token?: { id: string };
  error?: { message: string };
}

type StripeJs = (key: string) => {
  createToken(card: Record<string, unknown>): Promise<StripeTokenResponse>;
};

function loadStripeJs(): Promise<StripeJs | null> {
  return new Promise((resolve) => {
    const win = window as typeof window & { Stripe?: StripeJs };
    if (win.Stripe) {
      resolve(win.Stripe);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve(win.Stripe ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Provider mode (decision C9): a real card form. When a Stripe publishable key
 * is configured, the card is tokenised by Stripe.js straight from the browser,
 * so only an opaque token is ever sent to the API. Without a key (local dev)
 * the card is validated locally and mapped to a simulated token instead. If the
 * card service is unreachable or the key is unusable, the form degrades to that
 * same simulated flow — and says so on screen — so a booking can still complete.
 */
export const CardPaymentField: React.FC<PaymentMethodFieldProps> = ({ onTokenChange }) => {
  const [number, setNumber] = React.useState('');
  const [expiry, setExpiry] = React.useState('');
  const [cvc, setCvc] = React.useState('');
  const [name, setName] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [tokenizing, setTokenizing] = React.useState(false);
  const [providerError, setProviderError] = React.useState<string | null>(null);
  const [providerDown, setProviderDown] = React.useState(false);

  const digits = number.replace(/\D/g, '');
  const brand = detectBrand(digits);
  const maxDigits = Math.max(...brand.lengths);

  const numberError =
    digits.length === 0
      ? 'Card number is required'
      : digits.length < Math.min(...brand.lengths) || digits.length > maxDigits
        ? `Enter a valid ${brand.label.toLowerCase()} number`
        : !luhnValid(digits)
          ? 'This card number is not valid'
          : null;

  const expiryErr = expiry === '' ? 'Expiry is required' : expiryError(expiry);
  const cvcError =
    cvc.length === 0
      ? 'Security code is required'
      : cvc.length !== brand.cvcLength
        ? `Enter the ${brand.cvcLength}-digit code`
        : null;
  const nameError = name.trim() === '' ? 'Name on card is required' : null;

  const valid =
    numberError === null && expiryErr === null && cvcError === null && nameError === null;

  React.useEffect(() => {
    if (!valid) {
      onTokenChange('');
      setTokenizing(false);
      return;
    }

    // No provider credentials: hand the fake gateway a simulated token so the
    // rest of the flow behaves exactly like production.
    if (!ENV.STRIPE_PUBLISHABLE_KEY) {
      onTokenChange(simulatedToken(digits));
      return;
    }

    // The card service was already unreachable: keep using the simulated flow
    // instead of re-attempting (and re-failing) on every keystroke.
    if (providerDown) {
      onTokenChange(simulatedToken(digits));
      return;
    }

    let cancelled = false;
    setTokenizing(true);
    setProviderError(null);
    void loadStripeJs()
      .then((stripe) => {
        if (cancelled || !stripe) return null;
        return stripe(ENV.STRIPE_PUBLISHABLE_KEY).createToken({
          number: digits,
          exp_month: Number(expiry.slice(0, 2)),
          exp_year: 2000 + Number(expiry.slice(3, 5)),
          cvc,
          name: name.trim(),
        });
      })
      .then((result) => {
        if (cancelled) return;
        setTokenizing(false);
        if (result && result.token?.id) {
          onTokenChange(result.token.id);
          return;
        }
        if (result?.error?.message) {
          // The provider answered with a card error: surface it as-is instead
          // of silently simulating the payment.
          setProviderError(result.error.message);
          onTokenChange('');
          return;
        }
        // The script never loaded or the call threw: the card service cannot
        // be used, so degrade to the simulated flow and say so.
        setProviderDown(true);
        onTokenChange(simulatedToken(digits));
      })
      .catch(() => {
        if (cancelled) return;
        setTokenizing(false);
        setProviderDown(true);
        onTokenChange(simulatedToken(digits));
      });
    return () => {
      cancelled = true;
    };
  }, [valid, digits, expiry, cvc, name, onTokenChange, providerDown]);

  const touchAll = () => setTouched(true);

  return (
    <div className="flex flex-col gap-4">
      {providerDown ? (
        <Banner tone="warning" className="items-center" title="Test mode">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            Card service unreachable — no real card is charged.
          </span>
        </Banner>
      ) : ENV.STRIPE_PUBLISHABLE_KEY ? (
        <Banner tone="info" className="items-center" title="Card payment">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Card details are tokenised by Stripe and never touch our servers.
          </span>
        </Banner>
      ) : (
        <Banner tone="warning" className="items-center" title="Test mode">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            No real card is charged. Use one of the test cards below.
          </span>
        </Banner>
      )}

      <Field label="Card number" htmlFor="card-number" required error={touched ? numberError : null}>
        <div className="relative">
          <Input
            id="card-number"
            className="pr-24"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 5678 9012 3456"
            value={number}
            hasError={touched && numberError !== null}
            aria-invalid={touched && numberError !== null}
            maxLength={formatCardNumber('9'.repeat(maxDigits), brand).length}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, '');
              const nextBrand = detectBrand(next);
              setNumber(
                formatCardNumber(next.slice(0, Math.max(...nextBrand.lengths)), nextBrand),
              );
            }}
            onBlur={touchAll}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">
            <CreditCard className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {brand.label}
          </span>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry" htmlFor="card-expiry" required error={touched ? expiryErr : null}>
          <Input
            id="card-expiry"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={expiry}
            hasError={touched && expiryErr !== null}
            aria-invalid={touched && expiryErr !== null}
            maxLength={5}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, '').slice(0, 4);
              setExpiry(next.length > 2 ? `${next.slice(0, 2)}/${next.slice(2)}` : next);
            }}
            onBlur={touchAll}
          />
        </Field>
        <Field
          label="Security code"
          htmlFor="card-cvc"
          required
          error={touched ? cvcError : null}
          hint={
            brand.id === 'amex'
              ? 'The 4-digit code on the front'
              : 'The 3-digit code on the back'
          }
        >
          <Input
            id="card-cvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder={brand.id === 'amex' ? '1234' : '123'}
            value={cvc}
            hasError={touched && cvcError !== null}
            aria-invalid={touched && cvcError !== null}
            maxLength={brand.cvcLength}
            onChange={(event) =>
              setCvc(event.target.value.replace(/\D/g, '').slice(0, brand.cvcLength))
            }
            onBlur={touchAll}
          />
        </Field>
      </div>

      <Field label="Name on card" htmlFor="card-name" required error={touched ? nameError : null}>
        <Input
          id="card-name"
          autoComplete="cc-name"
          placeholder="Full name as printed on the card"
          value={name}
          hasError={touched && nameError !== null}
          aria-invalid={touched && nameError !== null}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          onBlur={touchAll}
        />
      </Field>

      {providerError && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger-text">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>{providerError}</span>
        </p>
      )}

      {tokenizing && <p className="text-xs text-muted">Tokenising card…</p>}

      {(!ENV.STRIPE_PUBLISHABLE_KEY || providerDown) && (
        <p className="text-xs text-muted">
          Test cards:{' '}
          <span className="tabular">4242 4242 4242 4242</span> succeeds,{' '}
          <span className="tabular">4000 0000 0000 0002</span> is declined and{' '}
          <span className="tabular">4000 0000 0000 9995</span> reports insufficient funds.
          Any other valid number succeeds.
        </p>
      )}
    </div>
  );
};
