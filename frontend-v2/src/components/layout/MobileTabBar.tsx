import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Compass, HelpCircle, Home, Inbox, Search, Shield, User } from 'lucide-react';
import { ROUTES, primaryNav, type NavEntry } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useUnreadMessages } from '@/features/messaging/api';
import { cn } from '@/lib/cn';

/** Keyed by route so the tab labels come from the same role rules as the header. */
const TAB_ICONS: Record<string, React.ReactNode> = {
  [ROUTES.SEARCH]: <Search className="h-5 w-5" aria-hidden />,
  [ROUTES.HOW_IT_WORKS]: <Compass className="h-5 w-5" aria-hidden />,
  [ROUTES.HELP]: <HelpCircle className="h-5 w-5" aria-hidden />,
  [ROUTES.TRIPS]: <Compass className="h-5 w-5" aria-hidden />,
  [ROUTES.INBOX]: <Inbox className="h-5 w-5" aria-hidden />,
  [ROUTES.HOST_DASHBOARD]: <Home className="h-5 w-5" aria-hidden />,
  [ROUTES.SUPPORT_DISPUTES]: <Shield className="h-5 w-5" aria-hidden />,
  [ROUTES.ADMIN_HOME]: <BarChart3 className="h-5 w-5" aria-hidden />,
  [ROUTES.ACCOUNT]: <User className="h-5 w-5" aria-hidden />,
};

/**
 * Bottom navigation for small screens. It is the only nav a phone-sized visitor gets, so it
 * used to render for signed-in users only, which left signed-out visitors with nothing but the
 * logo. Both roles now get a tab set, filtered from the shared role rules in `primaryNav`.
 */
export const MobileTabBar: React.FC = () => {
  const { isAuthenticated, isHost, isStaff, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const unread = useUnreadMessages(isAuthenticated);

  const nav = primaryNav({ isAuthenticated, isHost, isStaff, isAdmin });
  const pick = (to: string): NavEntry | null => nav.find((entry) => entry.to === to) ?? null;

  // The listing detail page pins its own "Check availability" bar to the same edge. Two
  // `fixed bottom-0` bars would overlap, and stacking them would eat most of a small
  // screen, so the booking action takes over from the tab bar there.
  const isListingDetail = pathname.startsWith('/listings/');
  if (isListingDetail) return null;

  // Staff reach their tools from the tab bar, so property search and trips are dropped for
  // them: five tabs is the most that fits without cramping the labels.
  const tabs: NavEntry[] = isAuthenticated
    ? [
        !isStaff ? pick(ROUTES.SEARCH) : null,
        !isStaff ? pick(ROUTES.TRIPS) : null,
        { to: ROUTES.INBOX, label: 'Inbox' },
        pick(ROUTES.HOST_DASHBOARD),
        pick(ROUTES.SUPPORT_DISPUTES),
        pick(ROUTES.ADMIN_HOME),
        { to: ROUTES.ACCOUNT, label: 'Account' },
      ].filter((entry): entry is NavEntry => entry !== null)
    : nav;

  const item = (entry: NavEntry, badge?: number) => (
    <NavLink
      to={entry.to}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px]',
          isActive ? 'text-primary' : 'text-muted'
        )
      }
    >
      {TAB_ICONS[entry.to]}
      <span className="max-w-full truncate">{entry.label}</span>
      {badge ? (
        <span className="absolute right-[22%] top-1 h-4 min-w-4 rounded-full bg-accent px-1 text-[10px] leading-4 text-white">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface sm:hidden no-print"
    >
      {tabs.map((entry) => item(entry, entry.to === ROUTES.INBOX ? unread.data?.total : undefined))}
    </nav>
  );
};

export const Breadcrumbs: React.FC<{ items: { label: string; to?: string }[] }> = ({ items }) => (
  <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
    <ol className="flex flex-wrap items-center gap-1">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden>/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-primary">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
);