import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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

  const row = (label: React.ReactNode, value: React.ReactNode, options?: { muted?: boolean; strong?: boolean }) => (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-1.5 text-sm',
        options?.strong ? 'font-semibold text-ink' : options?.muted ? 'text-muted' : 'text-ink'
      )}
    >
      <span>{label}</span>
      <span className="tabular shrink-0">{value}</span>
    </div>
  );

  return (
    <div className={cn('rounded-card border border-line bg-surface p-4', className)}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-sm font-medium text-ink"
      >
        <span>
          {formatMoney(breakdown.totalAmount)} total · {nights} {nights === 1 ? 'night' : 'nights'}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {expanded && breakdown.nightLines && breakdown.nightLines.length > 0 && (
        <ul className="mt-2 border-l-2 border-line pl-3">
          {breakdown.nightLines.map((line) => (
            <li key={line.date} className="flex items-baseline justify-between gap-3 py-0.5 text-xs text-muted">
              <span>
                {formatDate(line.date)}
                {line.isSeasonal && line.seasonName ? ` · ${line.seasonName}` : ''}
                {line.isWeekend ? ' · weekend' : ''}
              </span>
              <span className="tabular">{formatMoney(line.rate)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 divide-y divide-line border-t border-line pt-2">
        {row(
          `${nights} ${nights === 1 ? 'night' : 'nights'}`,
          formatMoney(breakdown.nightlySubtotal),
          { muted: true }
        )}
        {hasDiscount && (
          <>
            {row(
              `Length-of-stay discount${breakdown.discountPercent ? ` (${breakdown.discountPercent}%)` : ''}`,
              `−${formatMoney(breakdown.discountTotal)}`,
              { muted: true }
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
        {row('Total', formatMoney(breakdown.totalAmount), { strong: true })}
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