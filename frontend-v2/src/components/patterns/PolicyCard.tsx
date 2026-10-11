import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { cancellationPolicyLabels } from '@/lib/status';
import type { CancellationPolicy } from '@/types/api';

interface PolicyStage {
  policy: CancellationPolicy;
  full: string;
  partial: string;
  late: string;
}

/** The refund ladder exactly as the backend computes it (architecture 10.2.3). */
const STAGES: PolicyStage[] = [
  { policy: 'FLEXIBLE', full: '24 h before check-in: full refund', partial: '—', late: 'Within 24 h: no refund' },
  {
    policy: 'MODERATE',
    full: '120 h before check-in: full refund',
    partial: 'Within 120 h: 50% refund',
    late: 'Within 24 h: no refund',
  },
  {
    policy: 'STRICT',
    full: '—',
    partial: '168 h before check-in: 50% refund',
    late: 'Within 168 h: no refund',
  },
];

export const PolicyCard: React.FC<{ policy: CancellationPolicy; description: string }> = ({
  policy,
  description,
}) => {
  const active = cancellationPolicyLabels[policy];

  return (
    <section aria-label="Cancellation policy" className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start gap-2">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-ink">Cancellation: {active}</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-muted">{description}</p>
        </div>
      </div>

      <ol className="mt-6 grid gap-4 sm:grid-cols-3 pt-2">
        {STAGES.map((stage) => {
          const isActive = stage.policy === policy;
          return (
            <li
              key={stage.policy}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'relative rounded-2xl p-4 text-sm transition-all',
                isActive
                  ? 'bg-primary-soft/40 ring-2 ring-primary shadow-sm'
                  : 'bg-sand/60 ring-1 ring-line/70'
              )}
            >
              {isActive && (
                <span className="absolute -top-3 left-4 rounded-pill bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
                  Your policy
                </span>
              )}
              <p className={cn('font-semibold text-base', isActive ? 'text-primary font-bold' : 'text-text')}>
                {cancellationPolicyLabels[stage.policy]}
              </p>
              <div className="mt-2 space-y-1 text-xs text-muted">
                <p className="font-medium text-text">{stage.full}</p>
                <p>{stage.partial}</p>
                <p>{stage.late}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs text-muted">
        The service fee is only refundable when the whole booking is refunded. The exact amount is confirmed on
        your trip page before you cancel.
      </p>
      <p className="mt-1 text-xs">
        <Link className="text-primary underline underline-offset-4" to={ROUTES.CANCELLATION_POLICIES}>
          Read all three policies
        </Link>
      </p>
    </section>
  );
};