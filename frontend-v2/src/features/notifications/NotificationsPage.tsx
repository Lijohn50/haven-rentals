import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/api';
import {
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  Switch,
} from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useSeo';
import { cn } from '@/lib/cn';
import { formatAbsolute, formatRelative } from '@/lib/format';
import { notificationTarget } from '@/lib/notification-links';
import type { NotificationResponse } from '@/types/api';

const PAGE_SIZE = 10;

export const NotificationsPage: React.FC = () => {
  useDocumentTitle('Notifications');

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadOnly = searchParams.get('unreadOnly') === '1';
  const requested = Number(searchParams.get('page') ?? '1');
  const page = Number.isFinite(requested) && requested > 1 ? Math.floor(requested) : 1;

  const params = useMemo(
    // The URL keeps a 1-based page for humans; the API is 0-based like every other
    // PageResponse endpoint. Without the -1 the first render requested index 1 and
    // silently dropped the newest notification.
    () => ({ unreadOnly: unreadOnly || undefined, page: page - 1, size: PAGE_SIZE }),
    [unreadOnly, page]
  );

  const notifications = useNotifications(params);
  const data = notifications.data;
  const items = data?.content ?? [];
  const unreadOnPage = items.filter((item) => !item.readAt).length;

  const setUnreadOnly = (value: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('unreadOnly', '1');
    else next.delete('unreadOnly');
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const setPage = (value: number) => {
    const next = new URLSearchParams(searchParams);
    if (value > 1) next.set('page', String(value));
    else next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const open = (item: NotificationResponse) => {
    if (!item.readAt) markRead.mutate(item.id);
    navigate(notificationTarget(item.type, item.link));
  };

  const markEverything = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success('All notifications marked as read.'),
      onError: () => toast.error('We could not mark everything as read. Try again.'),
    });
  };

  return (
    <div className="mx-auto flex max-w-narrow flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Notifications' }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
        <Button
          variant="outline"
          size="sm"
          loading={markAllRead.isPending}
          disabled={unreadOnPage === 0}
          onClick={markEverything}
        >
          <CheckCheck className="h-4 w-4" aria-hidden />
          Mark all read
        </Button>
      </div>

      <div className="rounded-card border border-line bg-surface p-4">
        <Switch
          checked={unreadOnly}
          onCheckedChange={setUnreadOnly}
          label="Unread only"
          description="Only notifications you have not opened yet."
        />
      </div>

      {notifications.isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      )}

      {notifications.isError && (
        <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
      )}

      {data && items.length === 0 && (
        <EmptyState
          title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          description={
            unreadOnly
              ? 'You have opened everything. Turn the filter off to see older notifications.'
              : 'Booking, payout, listing and message updates land here.'
          }
        />
      )}

      {data && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const isUnread = !item.readAt;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-card border p-4 text-left transition-colors hover:bg-surface',
                    isUnread ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface'
                  )}
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{item.title}</span>
                    <time
                      className="tabular shrink-0 text-xs text-muted"
                      dateTime={item.createdAt}
                      title={formatAbsolute(item.createdAt)}
                    >
                      {formatRelative(item.createdAt)}
                    </time>
                  </span>
                  <span className="text-sm text-muted">{item.body}</span>
                  {isUnread && (
                    <span className="mt-1 inline-flex items-center gap-1.5" title="Unread">
                      <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data && (
          <Pagination
            page={data.page + 1}
            totalPages={data.totalPages}
            onChange={setPage}
          />
        )}
    </div>
  );
};
