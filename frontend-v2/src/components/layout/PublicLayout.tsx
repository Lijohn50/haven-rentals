import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Home, Inbox, TriangleAlert, User } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { ROUTES, primaryNav } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useUnreadMessages } from '@/features/messaging/api';
import { useResendVerification } from '@/features/auth/api';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { Banner, Button } from '@/components/ui';
import { NotificationBell, UserMenu } from './HeaderWidgets';
import { MobileTabBar } from './MobileTabBar';

/**
 * Sits between the header and the page, not inside the header. Inside a `sticky` bar the
 * banner made the bar twice as tall and shoved the page content down whenever it appeared.
 */
const VerifyEmailBanner: React.FC = () => {
  const { user } = useAuth();
  const resend = useResendVerification();
  if (!user || user.emailVerified) return null;

  return (
    <div className="mx-auto w-full max-w-content px-4 pt-4 sm:px-6">
      <Banner
        tone="warning"
        title="Confirm your email address"
        action={
          <Button
            size="sm"
            variant="outline"
            loading={resend.isPending}
            onClick={async () => {
              try {
                await resend.mutateAsync(user.email);
                toast.success('Verification email sent. Check your inbox.');
              } catch {
                toast.error('Could not send the email. Try again in a minute.');
              }
            }}
          >
            Resend email
          </Button>
        }
      >
        Booking, messaging and listing submission stay locked until {user.email} is confirmed.
      </Banner>
    </div>
  );
};

/**
 * One height for every control in the bar. The previous mix of 32px avatar, 36px text links
 * and 44px icon buttons on a 64px bar is what read as misalignment.
 */
const CONTROL = 'inline-flex h-10 items-center rounded-control text-sm font-medium transition-colors';
const CONTROL_GAP = 'gap-2 px-3';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    CONTROL,
    CONTROL_GAP,
    'shrink-0',
    isActive ? 'bg-primary-soft text-primary-dark' : 'text-ink hover:bg-bg'
  );

export const SiteHeader: React.FC = () => {
  const { isAuthenticated, isHost, isStaff, isAdmin } = useAuth();
  const unreadMessages = useUnreadMessages(isAuthenticated);
  const entries = primaryNav({ isAuthenticated, isHost, isStaff, isAdmin });

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur no-print">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-control focus:bg-primary focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-content items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link
          to={ROUTES.HOME}
          className="flex shrink-0 items-center gap-2 font-heading text-lg font-semibold text-primary-dark"
        >
          <span className="grid h-8 w-8 place-items-center rounded-control bg-primary text-white" aria-hidden>
            {BRAND.name.charAt(0)}
          </span>
          {BRAND.name}
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 items-center gap-1 md:flex">
          {entries.map((entry) => (
            <NavLink key={entry.to} to={entry.to} className={navLinkClass}>
              {entry.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {isAuthenticated && (
            <NavLink to={ROUTES.INBOX} className={navLinkClass}>
              <span className="relative">
                <Inbox className="h-5 w-5" aria-hidden />
                {Boolean(unreadMessages.data?.total) && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" aria-hidden />
                )}
              </span>
              <span className="hidden sm:inline">Inbox</span>
              <span className="sr-only sm:hidden">Inbox</span>
            </NavLink>
          )}
          {isAuthenticated && <NotificationBell />}
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export const SiteFooter: React.FC = () => (
  // The mobile tab bar is fixed to the bottom edge and the footer is the last block in
  // the document flow, so the footer needs its own bottom padding or the copyright line
  // sits underneath the bar.
  <footer className="mt-16 border-t border-line bg-surface pb-16 no-print sm:pb-0">
    <div className="mx-auto grid max-w-content gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
      <div>
        <p className="font-heading text-lg font-semibold text-primary-dark">{BRAND.name}</p>
        <p className="mt-1 text-sm text-muted">{BRAND.tagline}</p>
      </div>
      <nav aria-label="Explore">
        <h2 className="text-sm font-semibold text-ink">Explore</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>
            <Link className="hover:text-primary" to={ROUTES.SEARCH}>
              Search homes
            </Link>
          </li>
          <li>
            <Link className="hover:text-primary" to={ROUTES.HOW_IT_WORKS}>
              How it works
            </Link>
          </li>
        </ul>
      </nav>
      <nav aria-label="Hosting">
        <h2 className="text-sm font-semibold text-ink">Hosting</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>
            <Link className="hover:text-primary" to={ROUTES.BECOME_HOST}>
              List your property
            </Link>
          </li>
          <li>
            <Link className="hover:text-primary" to={ROUTES.HOST_DASHBOARD}>
              Host dashboard
            </Link>
          </li>
        </ul>
      </nav>
      <nav aria-label="Support">
        <h2 className="text-sm font-semibold text-ink">Support</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>
            <Link className="hover:text-primary" to={ROUTES.HELP}>
              Help
            </Link>
          </li>
          <li>
            <Link className="hover:text-primary" to={ROUTES.CANCELLATION_POLICIES}>
              Cancellation policies
            </Link>
          </li>
          <li>
            <Link className="hover:text-primary" to={ROUTES.TERMS}>
              Terms
            </Link>
          </li>
          <li>
            <Link className="hover:text-primary" to={ROUTES.PRIVACY}>
              Privacy
            </Link>
          </li>
        </ul>
      </nav>
    </div>
    <div className="border-t border-line px-4 py-4 text-center text-xs text-muted">
      © {new Date().getFullYear()} {BRAND.name}. Demo build connected to the rentals REST API.
    </div>
  </footer>
);

export const PublicLayout: React.FC = () => (
  <div className="flex min-h-screen flex-col">
    <SiteHeader />
    <VerifyEmailBanner />
    <main id="main" className="flex-1 pb-16 sm:pb-0">
      <Outlet />
    </main>
    <SiteFooter />
    <MobileTabBar />
  </div>
);

export const RouteFallback: React.FC = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-muted">
    <TriangleAlert className="h-5 w-5" aria-hidden />
  </div>
);

export const HomeLink: React.FC = () => (
  <Link to={ROUTES.HOME} className="inline-flex items-center gap-1.5 text-sm text-primary">
    <Home className="h-4 w-4" aria-hidden />
    Back to travelling
  </Link>
);

export const AccountLink: React.FC = () => (
  <Link to={ROUTES.ACCOUNT} className="inline-flex items-center gap-1.5 text-sm text-primary">
    <User className="h-4 w-4" aria-hidden />
    Account
  </Link>
);