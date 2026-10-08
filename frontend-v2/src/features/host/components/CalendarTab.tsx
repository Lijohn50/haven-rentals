import React, { useMemo, useState } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, format } from 'date-fns';
import { useCalendar, useBlocks, useListingMutations } from '@/features/listings/api';
import { blockSchema } from '@/features/host/schemas';
import { Button, Card, ErrorState, Field, InlineAlert, Input, Skeleton } from '@/components/ui';
import { ApiError } from '@/api/errors';
import { toast } from 'sonner';
import { todayIn, addDays, formatDate, rangeDays } from '@/lib/local-date';
import { cn } from '@/lib/cn';
import { z } from 'zod';
import type { ListingResponse } from '@/types/api';

export const CalendarTab: React.FC<{ listing: ListingResponse }> = ({ listing }) => {
  const mutations = useListingMutations(listing.id);
  const blocksQuery = useBlocks(listing.id);
  const today = todayIn(listing.timezone);
  const [from, setFrom] = useState(today);
  const to = React.useMemo(() => addDays(from, 60), [from]);
  const calendar = useCalendar(listing.id, from, to, true);

  const [selection, setSelection] = useState<{ start: string; end: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);

  const days = useMemo(() => {
    if (!calendar.data) return [];
    const map = new Map(calendar.data.days.map((d) => [d.date, d]));
    return rangeDays(from, to).map((date) => {
      const info = map.get(date);
      return { date, ...info };
    });
  }, [calendar.data, from, to]);

  const monthStart = startOfMonth(new Date(from + 'T00:00:00Z'));
  const monthEnd = endOfMonth(monthStart);
  const visibleDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const toggleDay = (date: string) => {
    if (!selection) { setSelection({ start: date, end: date }); return; }
    if (date < selection.start) { setSelection({ start: date, end: selection.start }); return; }
    if (date > selection.end) { setSelection({ start: selection.start, end: date }); return; }
    setSelection(null);
  };

  const submitBlock = async () => {
    if (!selection) return;
    setBlockError(null);
    const endExclusive = addDays(selection.end, 1);
    const parsed = blockSchema.safeParse({ startDate: selection.start, endDate: endExclusive, reason: blockReason || undefined });
    if (!parsed.success) { setBlockError(parsed.error.errors[0]?.message ?? 'Invalid block'); return; }
    try {
      await mutations.createBlock.mutateAsync({ id: listing.id, payload: parsed.data });
      toast.success('Block created');
      setSelection(null);
      setBlockReason('');
      void blocksQuery.refetch();
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      if (api?.code === 'BOOKING_CONFLICT') setBlockError('That range overlaps a reservation');
      else if (api?.code === 'DUPLICATE_RESOURCE') setBlockError('That range overlaps another block');
      else setBlockError(api?.detail ?? 'Could not create block');
    }
  };

  const removeBlock = async (blockId: number) => {
    if (!window.confirm('Remove this block?')) return;
    try {
      await mutations.deleteBlock.mutateAsync({ id: listing.id, blockId });
      toast.success('Block removed');
      void blocksQuery.refetch();
    } catch { toast.error('Could not remove block'); }
  };

  const reasonLabel: Record<string, string> = { BOOKED: 'Booked', BLOCKED: 'Blocked', PAST: 'Past', OUTSIDE_WINDOW: 'Outside window' };

  if (calendar.isLoading) return <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>;
  if (calendar.error) return <Card className="p-6"><ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} /></Card>;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Calendar</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFrom(addDays(from, -30))}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setFrom(today)}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => setFrom(addDays(from, 30))}>Next</Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-px bg-line">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="bg-bg p-2 text-center text-xs font-medium text-muted">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-line">
              {visibleDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const info = days.find((d) => isSameDay(d.date, dateStr));
                const isToday = dateStr === today;
                const isPast = dateStr < today;
                const isBlocked = info && !info.available;
                const isInMonth = format(day, 'M') === format(monthStart, 'M');
                const cellClass = cn(
                  'bg-bg p-2 text-center text-sm min-h-[56px]',
                  isInMonth ? 'text-ink' : 'text-muted',
                  isToday && 'font-semibold underline'
                );
                const dayClass = cn(
                  'mx-auto flex h-7 w-7 items-center justify-center rounded-full',
                  isBlocked && (info.reason === 'BOOKED' ? 'bg-accent/10 text-accent' : 'bg-neutral-soft text-muted'),
                  !isBlocked && !isPast && 'hover:bg-primary-soft/40'
                );
                return (
                  <div key={dateStr} className={cellClass} onClick={() => !isPast && toggleDay(dateStr)}>
                    <span className={dayClass}>{format(day, 'd')}</span>
                    {isBlocked && <p className="mt-1 truncate text-[10px] text-muted">{reasonLabel[info.reason ?? ''] ?? ''}</p>}
                    {selection && dateStr >= selection.start && dateStr <= selection.end && !isPast && (
                      <div className="mx-auto mt-0.5 h-1 w-5 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selection && (
          <div className="mt-4 rounded-card border border-line bg-surface p-4">
            <p className="text-sm font-medium text-ink">
              Block {formatDate(selection.start)} – {formatDate(selection.end)}
            </p>
            <Field label="Reason (optional)" htmlFor="block-reason" className="mt-2">
              <Input id="block-reason" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Maintenance, personal use…" />
            </Field>
            {blockError && <InlineAlert tone="danger" className="mt-2">{blockError}</InlineAlert>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelection(null)}>Cancel</Button>
              <Button size="sm" onClick={submitBlock} loading={mutations.createBlock.isPending}>Create block</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Blocks</h2>
        {blocksQuery.isLoading ? (
          <Skeleton className="mt-4 h-16 w-full" />
        ) : blocksQuery.error ? (
          <ErrorState error={blocksQuery.error} onRetry={() => void blocksQuery.refetch()} className="mt-4" />
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {(blocksQuery.data ?? []).map((block) => (
              <div key={block.id} className="flex items-center justify-between rounded-control border border-line p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{formatDate(block.startDate)} – {formatDate(addDays(block.endDate, -1))}</p>
                  {block.reason && <p className="text-xs text-muted">{block.reason}</p>}
                </div>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => removeBlock(block.id)}>Remove</Button>
              </div>
            ))}
            {(blocksQuery.data ?? []).length === 0 && <p className="text-sm text-muted">No blocks.</p>}
          </div>
        )}
      </Card>
    </div>
  );
};
