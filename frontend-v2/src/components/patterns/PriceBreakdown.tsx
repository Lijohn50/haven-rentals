import React, { useState } from 'react';
import { ChevronDown, Tag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/local-date';
import type { PriceBreakdownResponse } from '@/types/api';

export interface PriceBreakdownProps {
  breakdown: PriceBreakdownResponse;
  nights: number;
  /**
   * Guest views show what the guest paid, host views add the commission and
   * payout lines (architecture 2.3 UI rule). Admin views show every line
   * because staff reconcile both sides.
   */
  viewer?: 'guest' | 'host' | 'admin';
  showNightLines?: boolean;
  className?: string;
}

/**
 * Every total the guest ever sees comes from the server snapshot. Nothing here is computed
 * in the browser (architecture 19).
 */
export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  breakdown,
  nights,
  viewer = 'guest',
  showNightLines = false,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasDiscount = Number(breakdown.discountTotal) > 0;

  const row = (label: React.ReactNode, value: React.ReactNode, options?: { muted?: boolean; strong?: boolean; success?: boolean }) => (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 py-1.5 text-sm',
        options?.strong
          ? 'font-heading text-base sm:text-lg font-bold text-text'
          : options?.success
            ? 'font-medium text-success'
            : options?.muted
              ? 'text-muted'
              : 'text-text'
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="tabular shrink-0 text-right font-medium">{value}</span>
    </div>
  );

  return (
    <div className={cn('rounded-2xl bg-surface p-4 sm:p-5 ring-1 ring-line/70 shadow-sm', className)}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-sand px-3.5 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-sand/80"
      >
        <span className="truncate">
          {formatMoney(breakdown.totalAmount)} total · {nights} {nights === 1 ? 'night' : 'nights'}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {expanded && breakdown.nightLines && breakdown.nightLines.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-l-2 border-line/80 pl-3">
          {breakdown.nightLines.map((line) => (
            <li key={line.date} className="flex items-baseline justify-between gap-3 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                {formatDate(line.date)}
                {line.isSeasonal && line.seasonName && (
                  <span className="rounded-pill bg-sand px-1.5 py-0.5 text-[10px] text-text">
                    {line.seasonName}
                  </span>
                )}
                {line.isWeekend && (
                  <span className="rounded-pill bg-highlight px-1.5 py-0.5 text-[10px] font-semibold text-accent-dark">
                    weekend
                  </span>
                )}
              </span>
              <span className="tabular font-medium text-text">{formatMoney(line.rate)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 divide-y divide-line/60 border-t border-line/70 pt-2">
        {row(
          `${nights} ${nights === 1 ? 'night' : 'nights'}`,
          formatMoney(breakdown.nightlySubtotal),
          { muted: true }
        )}
        {hasDiscount && (
          <>
            {row(
              <span className="inline-flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-success" />
                Length-of-stay discount{breakdown.discountPercent ? ` (${breakdown.discountPercent}%)` : ''}
              </span>,
              `−${formatMoney(breakdown.discountTotal)}`,
              { success: true }
            )}
            {row('Accommodation total', formatMoney(breakdown.accommodationTotal))}
          </>
        )}
        {row('Cleaning fee', formatMoney(breakdown.cleaningFee))}
        {viewer === 'guest' && row('Service fee', formatMoney(breakdown.serviceFee))}
        {viewer === 'host' && row('Guest service fee', formatMoney(breakdown.serviceFee))}
        {viewer === 'admin' && row('Service fee', formatMoney(breakdown.serviceFee))}
        {row('Taxes', formatMoney(breakdown.taxTotal))}
        {viewer !== 'guest' && row('Platform commission', formatMoney(breakdown.hostCommission))}
        <div className="mt-2 border-t-2 border-dashed border-line pt-2">
          {row('Total', formatMoney(breakdown.totalAmount), { strong: true })}
        </div>
        {viewer === 'host' && (
          <div className="mt-1 border-t border-line pt-1.5">
            {row('Your payout', formatMoney(breakdown.hostPayoutAmount), { strong: true })}
          </div>
        )}
        {viewer === 'admin' && (
          <div className="mt-1 border-t border-line pt-1.5">
            {row('Host payout', formatMoney(breakdown.hostPayoutAmount), { strong: true })}
          </div>
        )}
      </div>
    </div>
  );
};