import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications, useMarkNotificationRead, useUnreadNotifications } from '@/features/notifications/api';
import { formatRelative } from '@/lib/format';
import { notificationTarget } from '@/lib/notification-links';
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
} from '@/components/ui';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const unread = useUnreadNotifications(true);
  const latest = useNotifications({ size: 5 });
  const markRead = useMarkNotificationRead();

  const open = (id: number, type: Parameters<typeof notificationTarget>[0], link: string | null) => {
    void markRead.mutateAsync(id).catch(() => undefined);
    navigate(notificationTarget(type, link));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {Boolean(unread.data?.total) && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" aria-label={`${unread.data?.total} unread`} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(20rem,calc(100vw-1.5rem))]">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {latest.isLoading && <p className="px-3 py-2 text-sm text-muted">Loading…</p>}
        {latest.data && latest.data.content.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted">Nothing new.</p>
        )}
        {latest.data?.content.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onSelect={() => open(item.id, item.type, item.link)}
            className="flex-col items-start gap-0.5"
          >
            <span className="flex w-full items-start gap-2">
              {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                <span className="block truncate text-xs text-muted">{item.body}</span>
                <span className="block text-[11px] text-muted">{formatRelative(item.createdAt)}</span>
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(ROUTES.NOTIFICATIONS)} className="justify-center">
          See all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user, status, isHost, isStaff, isAdmin, signOut } = useAuth();

  // Session is still being restored (refresh + /me round trips after a
  // reload); neither the signed-in nor the signed-out state is known yet.
  if (status === 'loading') {
    return (
      <div
        className="h-10 w-10 animate-pulse rounded-full bg-neutral-soft"
        aria-label="Loading session"
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-10" onClick={() => navigate(ROUTES.LOGIN)}>
          Sign in
        </Button>
        <Button size="sm" className="h-10" onClick={() => navigate(ROUTES.REGISTER)}>
          Register
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Fixed hit area so the avatar lines up with the 40px controls beside it. */}
        <button
          className="grid h-10 w-10 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Account menu"
        >
          <Avatar name={user.firstName} size="md" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate(ROUTES.ACCOUNT)}>
          <User className="h-4 w-4" aria-hidden />
          Account
        </DropdownMenuItem>
        {isHost && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(ROUTES.HOST_DASHBOARD)}>Host dashboard</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(ROUTES.HOST_LISTINGS)}>My listings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(ROUTES.HOST_BOOKINGS)}>Bookings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(ROUTES.HOST_PAYOUTS)}>Payouts</DropdownMenuItem>
          </>
        )}
        {!isHost && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(ROUTES.BECOME_HOST)}>List your property</DropdownMenuItem>
          </>
        )}
        {isStaff && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(ROUTES.SUPPORT_DISPUTES)}>
              <Shield className="h-4 w-4" aria-hidden />
              Dispute queue
            </DropdownMenuItem>
          </>
        )}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(ROUTES.ADMIN_HOME)}>Admin panel</DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            toast.success('Signed out');
            navigate(ROUTES.HOME);
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const RoleHint: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link to={to} className="text-primary underline underline-offset-4">
    {children}
  </Link>
);

export const EmptyNotifications: React.FC = () => (
  <EmptyState title="No notifications" description="Booking updates and payouts will show up here." />
);