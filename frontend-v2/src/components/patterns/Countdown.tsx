import React from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCountdown } from '@/hooks/useUtilities';

/** Hold and response deadlines. Turns amber when time is short (architecture 11.1.2). */
export const CountdownPill: React.FC<{
  target: string | null | undefined;
  prefix?: string;
  urgentMs?: number;
  className?: string;
}> = ({ target, prefix = 'Held for', urgentMs = 180_000, className }) => {
  const countdown = useCountdown(target, urgentMs);

  if (!target) return null;
  if (countdown.expired) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-sm text-danger-text', className)}>
        <Timer className="h-3.5 w-3.5" aria-hidden />
        {prefix === 'Held for' ? 'Hold expired' : 'Expired'}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm tabular',
        countdown.urgent ? 'bg-warning-soft text-warning-text' : 'bg-primary-soft text-primary-dark',
        className
      )}
    >
      <Timer className="h-3.5 w-3.5" aria-hidden />
      {prefix} <span className="font-semibold">{countdown.label}</span>
    </span>
  );
};

/** Long deadlines (host response, payouts) show days and hours instead of mm:ss. */
export function formatDeadline(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms)) return '—';
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min`;
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}