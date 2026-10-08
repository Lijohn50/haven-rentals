import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plane,
  Home as HomeIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useHostDashboard } from '@/features/host/api';
import { todayIn } from '@/lib/local-date';
import { cn } from '@/lib/cn';
import { NotificationBell, UserMenu } from './HeaderWidgets';

function SidebarLink({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={to === ROUTES.HOST_DASHBOARD || to === ROUTES.ADMIN_HOME}
      className={({ isActive }) =>
        cn(
          'flex min-h-[44px] items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-primary-soft font-medium text-primary-dark' : 'text-muted hover:bg-bg hover:text-ink'
        )
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] leading-none text-white">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

/** Host shell: left sidebar, top bar with notifications and a link back to travelling. */
export const HostShell: React.FC = () => {
  const { user, signOut, isHost, isAdmin } = useAuth();
  const today = todayIn();
  // `/api/v1/host/**` is `hasRole("HOST")` on the backend, so an admin-only account would
  // get a 403 for the sidebar badge. Staff use the Operations shell instead.
  const dashboard = useHostDashboard(today, today, isHost);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-surface no-print">
        <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 sm:px-6">
          <Link to={ROUTES.HOST_DASHBOARD} className="font-heading text-lg font-semibold text-primary-dark">
            {BRAND.name} <span className="text-sm font-normal text-muted">Hosting</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0 no-print">
          <nav aria-label="Host" className="flex flex-col gap-1">
            <SidebarLink to={ROUTES.HOST_DASHBOARD} icon={<LayoutDashboard className="h-4 w-4" />} label="Overview" />
            <SidebarLink to={ROUTES.HOST_LISTINGS} icon={<HomeIcon className="h-4 w-4" />} label="Listings" />
            <SidebarLink
              to={ROUTES.HOST_BOOKINGS}
              icon={<CalendarDays className="h-4 w-4" />}
              label="Bookings"
              badge={dashboard.data?.pendingRequests}
            />
            <SidebarLink to={ROUTES.HOST_PAYOUTS} icon={<CircleDollarSign className="h-4 w-4" />} label="Payouts" />
            <SidebarLink to={ROUTES.INBOX} icon={<Inbox className="h-4 w-4" />} label="Messages" />
            <SidebarLink to={ROUTES.HOST_REVIEWS} icon={<MessageSquare className="h-4 w-4" />} label="Reviews" />
          </nav>
          <div className="mt-6 border-t border-line pt-4">
            <Link to={ROUTES.HOME} className="flex min-h-[44px] items-center gap-2 rounded-control px-3 py-2 text-sm text-muted hover:bg-bg hover:text-ink">
              <Plane className="h-4 w-4" aria-hidden />
              Back to travelling
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex min-h-[44px] w-full items-center gap-2 rounded-control px-3 py-2 text-sm text-muted hover:bg-bg hover:text-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      {/* Aligned to the same content column as the header row above, otherwise this line hugs
          the viewport edge on wide screens. */}
      <p className="mx-auto w-full max-w-content px-4 pb-4 text-xs text-muted sm:px-6">
        Signed in as {user?.email}
      </p>
    </div>
  );
};

/** Staff shell: role-filtered sections, dense tables, global lookup placeholder. */
export const StaffShell: React.FC = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-surface no-print">
        <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 sm:px-6">
          <Link to={ROUTES.SUPPORT_HOME} className="font-heading text-lg font-semibold text-primary-dark">
            {BRAND.name} <span className="text-sm font-normal text-muted">Operations</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0 no-print">
          <nav aria-label="Operations" className="flex flex-col gap-1">
            <SidebarLink to={ROUTES.SUPPORT_DISPUTES} icon={<Inbox className="h-4 w-4" />} label="Dispute queue" />
            {isAdmin && (
              <>
                <SidebarLink to={ROUTES.ADMIN_HOME} icon={<BarChart3 className="h-4 w-4" />} label="Platform summary" />
                <SidebarLink to={ROUTES.ADMIN_LISTINGS} icon={<HomeIcon className="h-4 w-4" />} label="Moderation queue" />
                <SidebarLink to={ROUTES.ADMIN_USERS} icon={<HomeIcon className="h-4 w-4" />} label="Users" />
                <SidebarLink to={ROUTES.ADMIN_BOOKINGS} icon={<HomeIcon className="h-4 w-4" />} label="Booking lookup" />
                <SidebarLink to={ROUTES.ADMIN_REVIEWS} icon={<MessageSquare className="h-4 w-4" />} label="Review moderation" />
                <SidebarLink to={ROUTES.ADMIN_COMMISSION} icon={<CircleDollarSign className="h-4 w-4" />} label="Commission" />
                <SidebarLink to={ROUTES.ADMIN_AMENITIES} icon={<HomeIcon className="h-4 w-4" />} label="Amenities" />
                <SidebarLink to={ROUTES.ADMIN_AUDIT} icon={<BarChart3 className="h-4 w-4" />} label="Audit log" />
              </>
            )}
          </nav>
          <div className="mt-6 border-t border-line pt-4">
            <Link to={ROUTES.HOME} className="flex min-h-[44px] items-center gap-2 rounded-control px-3 py-2 text-sm text-muted hover:bg-bg hover:text-ink">
              <Plane className="h-4 w-4" aria-hidden />
              Back to the site
            </Link>
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};