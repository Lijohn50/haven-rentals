import React from 'react';
import { bookingStatusEntry } from '@/lib/status';
import { formatDateTimeLocal } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { BookingHistoryResponse, BookingStatus } from '@/types/api';

const ACTOR_LABELS: Record<string, string> = {
  GUEST: 'Guest',
  HOST: 'Host',
  SYSTEM: 'System',
  ADMIN: 'Administrator',
  SUPPORT_AGENT: 'Support',
};

function statusLabel(status: string): string {
  return bookingStatusEntry(status as BookingStatus, 'guest').label;
}

/** Oldest first, so the story of the booking reads top to bottom. */
export const BookingTimeline: React.FC<{ history: BookingHistoryResponse[] }> = ({ history }) => {
  if (history.length === 0) return null;

  const entries = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => (
        <li key={`${entry.toStatus}-${entry.createdAt}-${index}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                index === entries.length - 1 ? 'bg-primary' : 'bg-line'
              )}
              aria-hidden
            />
            {index < entries.length - 1 && <span className="w-px flex-1 bg-line" aria-hidden />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium text-ink">
              {entry.fromStatus ? `${statusLabel(entry.fromStatus)} → ` : ''}
              {statusLabel(entry.toStatus)}
            </p>
            <p className="text-xs text-muted">
              {entry.actorType ? `${ACTOR_LABELS[entry.actorType] ?? entry.actorType} · ` : ''}
              {formatDateTimeLocal(entry.createdAt)}
            </p>
            {entry.reason && <p className="mt-1 text-xs text-muted">{entry.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};
