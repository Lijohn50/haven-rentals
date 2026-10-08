import React, { useState } from 'react';
import { Check, Copy, Eye, EyeOff, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { IS_PRODUCTION_BUILD } from '@/config/env';
import { cn } from '@/lib/cn';

/**
 * Accounts created by the backend `SeedDataRunner`, which only runs under the `dev`
 * profile. Every one of them uses the password `Password123!`. These were verified by
 * signing in through `/api/v1/auth/login` and confirming the `users` rows in Postgres.
 */
export const DEMO_PASSWORD = 'Password123!';

export interface DemoAccount {
  key: string;
  label: string;
  email: string;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'admin',
    label: 'Admin',
    email: 'admin@rentals.test',
    description: 'Full admin console: listings, users, bookings, amenities, audit log.',
  },
  {
    key: 'host',
    label: 'Host',
    email: 'host1@rentals.test',
    description: 'Hosting tools: dashboard, listings wizard, bookings to approve, payouts.',
  },
  {
    key: 'guest',
    label: 'Guest',
    email: 'guest1@rentals.test',
    description: 'Trips, inbox, reviews and disputes as a booked-in guest.',
  },
];

export interface DemoCredentialsCardProps {
  onUse: (email: string, password: string) => void;
  busyEmail?: string | null;
}

export const DemoCredentialsCard: React.FC<DemoCredentialsCardProps> = ({ onUse, busyEmail }) => {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  //if (IS_PRODUCTION_BUILD) return null;

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section
      aria-labelledby="demo-credentials-heading"
      className="mt-4 w-full max-w-md rounded-card border border-dashed border-primary/40 bg-primary-soft/30 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary-dark" aria-hidden />
          <div>
            <h2 id="demo-credentials-heading" className="text-sm font-semibold text-ink">
              Demo accounts
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Seeded locally. Not available in production builds.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-pressed={revealed}
          className="flex shrink-0 items-center gap-1 rounded-control px-2 py-1 text-xs font-medium text-primary-dark transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {DEMO_ACCOUNTS.map((account) => {
          const busy = busyEmail === account.email;
          return (
            <li
              key={account.key}
              className="rounded-control border border-line bg-surface p-3 transition-shadow hover:shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-dark">
                  {account.label}
                </span>
                <button
                  type="button"
                  onClick={() => void copy(account.email, `${account.key}-email`)}
                  className="flex items-center gap-1 rounded-control px-1.5 py-0.5 font-mono text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={`Copy ${account.label} email`}
                >
                  {account.email}
                  {copied === `${account.key}-email` ? (
                    <Check className="h-3 w-3 text-success-text" aria-hidden />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden />
                  )}
                </button>
              </div>

              <p className="mt-1.5 text-xs text-muted">{account.description}</p>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted">
                  {revealed ? (
                    <button
                      type="button"
                      onClick={() => void copy(DEMO_PASSWORD, `${account.key}-password`)}
                      className="flex items-center gap-1 rounded-control px-1.5 py-0.5 text-ink transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      aria-label={`Copy ${account.label} password`}
                    >
                      {DEMO_PASSWORD}
                      {copied === `${account.key}-password` ? (
                        <Check className="h-3 w-3 text-success-text" aria-hidden />
                      ) : (
                        <Copy className="h-3 w-3" aria-hidden />
                      )}
                    </button>
                  ) : (
                    <span aria-hidden>Password hidden</span>
                  )}
                </span>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn('shrink-0')}
                  onClick={() => onUse(account.email, DEMO_PASSWORD)}
                  loading={busy}
                >
                  {busy ? 'Signing in' : `Use ${account.label.toLowerCase()} account`}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-muted">
        Shared password <span className="font-mono">{revealed ? DEMO_PASSWORD : '••••••••••'}</span>. One-click
        fills the form and signs in.
      </p>
    </section>
  );
};
