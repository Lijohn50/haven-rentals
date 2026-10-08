import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate, useRouteError } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ROUTES } from '@/config/routes';
import { PublicLayout, HostShell, StaffShell, RequireAuth, RequireGuest } from '@/components/layout';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Button, EmptyState, Spinner } from '@/components/ui';

// Route-level code splitting: every page loads on navigation instead of
// shipping all ~35 routes in the entry chunk.
const LandingPage = lazy(() => import('@/features/landing/LandingPage').then(m => ({ default: m.LandingPage })));
const SearchPage = lazy(() => import('@/features/search/SearchPage').then(m => ({ default: m.SearchPage })));
const ListingPage = lazy(() => import('@/features/listings/ListingPage').then(m => ({ default: m.ListingPage })));
const HostProfilePage = lazy(() => import('@/features/listings/HostProfilePage').then(m => ({ default: m.HostProfilePage })));
const CancellationPoliciesPage = lazy(() => import('@/features/static/StaticPages').then(m => ({ default: m.CancellationPoliciesPage })));
const HelpPage = lazy(() => import('@/features/static/StaticPages').then(m => ({ default: m.HelpPage })));
const HowItWorksPage = lazy(() => import('@/features/static/StaticPages').then(m => ({ default: m.HowItWorksPage })));
const PrivacyPage = lazy(() => import('@/features/static/StaticPages').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('@/features/static/StaticPages').then(m => ({ default: m.TermsPage })));
const LoginPage = lazy(() => import('@/features/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const AccountPage = lazy(() => import('@/features/account/AccountPage').then(m => ({ default: m.AccountPage })));
const SecurityPage = lazy(() => import('@/features/account/SecurityPage').then(m => ({ default: m.SecurityPage })));
const MyDisputesPage = lazy(() => import('@/features/account/MyDisputesPage').then(m => ({ default: m.MyDisputesPage })));
const BecomeHostPage = lazy(() => import('@/features/account/BecomeHostPage').then(m => ({ default: m.BecomeHostPage })));
const CheckoutPage = lazy(() => import('@/features/booking/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const PayPage = lazy(() => import('@/features/booking/PayPage').then(m => ({ default: m.PayPage })));
const TripsPage = lazy(() => import('@/features/trips/TripsPage').then(m => ({ default: m.TripsPage })));
const TripDetailPage = lazy(() => import('@/features/trips/TripDetailPage').then(m => ({ default: m.TripDetailPage })));
const ReviewFormPage = lazy(() => import('@/features/trips/ReviewFormPage').then(m => ({ default: m.ReviewFormPage })));
const DisputeFormPage = lazy(() => import('@/features/trips/DisputeFormPage').then(m => ({ default: m.DisputeFormPage })));
const ReviewsPage = lazy(() => import('@/features/reviews/ReviewsPage').then(m => ({ default: m.ReviewsPage })));
const InboxPage = lazy(() => import('@/features/messaging/InboxPage').then(m => ({ default: m.InboxPage })));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const HostDashboardPage = lazy(() => import('@/features/host/HostDashboardPage').then(m => ({ default: m.HostDashboardPage })));
const HostListingsPage = lazy(() => import('@/features/host/HostListingsPage').then(m => ({ default: m.HostListingsPage })));
const HostListingPage = lazy(() => import('@/features/host/HostListingPage').then(m => ({ default: m.HostListingPage })));
const ListingWizardPage = lazy(() => import('@/features/host/ListingWizardPage').then(m => ({ default: m.ListingWizardPage })));
const HostBookingsPage = lazy(() => import('@/features/host/HostBookingsPage').then(m => ({ default: m.HostBookingsPage })));
const HostBookingDetailPage = lazy(() => import('@/features/host/HostBookingDetailPage').then(m => ({ default: m.HostBookingDetailPage })));
const HostPayoutsPage = lazy(() => import('@/features/host/HostPayoutsPage').then(m => ({ default: m.HostPayoutsPage })));
const HostReviewsPage = lazy(() => import('@/features/host/HostReviewsPage').then(m => ({ default: m.HostReviewsPage })));
const SupportDisputesPage = lazy(() => import('@/features/support/SupportDisputesPage').then(m => ({ default: m.SupportDisputesPage })));
const SupportDisputeDetailPage = lazy(() => import('@/features/support/SupportDisputeDetailPage').then(m => ({ default: m.SupportDisputeDetailPage })));
const AdminSummaryPage = lazy(() => import('@/features/admin/AdminSummaryPage').then(m => ({ default: m.AdminSummaryPage })));
const AdminListingsPage = lazy(() => import('@/features/admin/AdminListingsPage').then(m => ({ default: m.AdminListingsPage })));
const AdminListingPage = lazy(() => import('@/features/admin/AdminListingPage').then(m => ({ default: m.AdminListingPage })));
const AdminUsersPage = lazy(() => import('@/features/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminUserPage = lazy(() => import('@/features/admin/AdminUserPage').then(m => ({ default: m.AdminUserPage })));
const AdminBookingsPage = lazy(() => import('@/features/admin/AdminBookingsPage').then(m => ({ default: m.AdminBookingsPage })));
const AdminCommissionPage = lazy(() => import('@/features/admin/AdminCommissionPage').then(m => ({ default: m.AdminCommissionPage })));
const AdminAmenitiesPage = lazy(() => import('@/features/admin/AdminAmenitiesPage').then(m => ({ default: m.AdminAmenitiesPage })));
const AdminAuditPage = lazy(() => import('@/features/admin/AdminAuditPage').then(m => ({ default: m.AdminAuditPage })));
const AdminReviewsPage = lazy(() => import('@/features/admin/AdminReviewsPage').then(m => ({ default: m.AdminReviewsPage })));

const NotFoundPage: React.FC = () => (
  <div className="mx-auto max-w-narrow px-4 py-20">
    <EmptyState
      title="We could not find that page"
      description="The link may be broken, or the item may have been removed."
      action={
        <Button asChild variant="primary">
          <a href={ROUTES.HOME}>Back to the home page</a>
        </Button>
      }
    />
  </div>
);

const ForbiddenPage: React.FC = () => (
  <div className="mx-auto max-w-narrow px-4 py-20">
    <EmptyState
      title="You don't have access to this area"
      description="Your account does not include this permission. If you think that is wrong, ask an administrator."
      action={
        <Button asChild variant="primary">
          <a href={ROUTES.HOME}>Back to the home page</a>
        </Button>
      }
    />
  </div>
);

function RouteCrash() {
  const error = useRouteError() as { message?: string } | undefined;
  return (
    <div className="mx-auto max-w-narrow px-4 py-20">
      <EmptyState
        title="Something went wrong"
        description={error?.message ?? 'An unexpected error occurred while loading this page.'}
        action={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    </div>
  );
}

const PageFallback: React.FC = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Spinner label="Loading…" />
  </div>
);

/** Wraps a lazily loaded route so its chunk fetch shows a fallback. */
const page = (Component: React.LazyExoticComponent<React.ComponentType>): React.ReactNode => (
  <Suspense fallback={<PageFallback />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteCrash />,
    children: [
      { path: ROUTES.HOME, element: page(LandingPage) },
      { path: ROUTES.SEARCH, element: page(SearchPage) },
      { path: ROUTES.LISTING(':id'), element: page(ListingPage) },
      { path: ROUTES.HOST_PROFILE(':id'), element: page(HostProfilePage) },
      { path: ROUTES.HOW_IT_WORKS, element: page(HowItWorksPage) },
      { path: ROUTES.CANCELLATION_POLICIES, element: page(CancellationPoliciesPage) },
      { path: ROUTES.HELP, element: page(HelpPage) },
      { path: ROUTES.TERMS, element: page(TermsPage) },
      { path: ROUTES.PRIVACY, element: page(PrivacyPage) },
      { path: ROUTES.FORBIDDEN, element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },

      // signed-in guest area
      {
        element: <RequireAuth />,
        children: [
          { path: ROUTES.CHECKOUT(':listingId'), element: page(CheckoutPage) },
          { path: ROUTES.TRIPS, element: page(TripsPage) },
          { path: `${ROUTES.TRIPS}/:reference/pay`, element: page(PayPage) },
          { path: `${ROUTES.TRIPS}/:reference/review`, element: page(ReviewFormPage) },
          { path: `${ROUTES.TRIPS}/:reference/dispute`, element: page(DisputeFormPage) },
          { path: ROUTES.TRIP(':reference'), element: page(TripDetailPage) },
          { path: ROUTES.REVIEWS, element: page(ReviewsPage) },
          { path: ROUTES.INBOX, element: page(InboxPage) },
          { path: ROUTES.CONVERSATION(':id'), element: page(InboxPage) },
          { path: ROUTES.NOTIFICATIONS, element: page(NotificationsPage) },
          { path: ROUTES.ACCOUNT, element: page(AccountPage) },
          { path: ROUTES.ACCOUNT_SECURITY, element: page(SecurityPage) },
          { path: ROUTES.ACCOUNT_DISPUTES, element: page(MyDisputesPage) },
          { path: ROUTES.BECOME_HOST, element: page(BecomeHostPage) },
        ],
      },

      // signed-out only
      {
        element: <RequireGuest />,
        children: [
          { path: ROUTES.LOGIN, element: page(LoginPage) },
          { path: ROUTES.REGISTER, element: page(RegisterPage) },
        ],
      },
      { path: ROUTES.VERIFY_EMAIL, element: page(VerifyEmailPage) },
      { path: ROUTES.FORGOT_PASSWORD, element: page(ForgotPasswordPage) },
      { path: ROUTES.RESET_PASSWORD, element: page(ResetPasswordPage) },
    ],
  },
  {
    element: <RequireAuth roles={['HOST']} />,
    children: [
      {
        element: <HostShell />,
        children: [
          { path: ROUTES.HOST_DASHBOARD, element: page(HostDashboardPage) },
          { path: ROUTES.HOST_LISTINGS, element: page(HostListingsPage) },
          { path: ROUTES.HOST_LISTING_NEW, element: page(ListingWizardPage) },
          { path: ROUTES.HOST_LISTING(':id'), element: page(HostListingPage) },
          { path: ROUTES.HOST_BOOKINGS, element: page(HostBookingsPage) },
          { path: ROUTES.HOST_BOOKING(':id'), element: page(HostBookingDetailPage) },
          { path: ROUTES.HOST_PAYOUTS, element: page(HostPayoutsPage) },
          { path: ROUTES.HOST_REVIEWS, element: page(HostReviewsPage) },
        ],
      },
    ],
  },
  {
    element: <RequireAuth roles={['SUPPORT_AGENT', 'ADMIN']} />,
    children: [
      {
        element: <StaffShell />,
        children: [
          { path: ROUTES.SUPPORT_HOME, element: <Navigate to={ROUTES.SUPPORT_DISPUTES} replace /> },
          { path: ROUTES.SUPPORT_DISPUTES, element: page(SupportDisputesPage) },
          { path: ROUTES.SUPPORT_DISPUTE(':id'), element: page(SupportDisputeDetailPage) },
        ],
      },
    ],
  },
  {
    element: <RequireAuth roles={['ADMIN']} />,
    children: [
      {
        element: <StaffShell />,
        children: [
          { path: ROUTES.ADMIN_HOME, element: page(AdminSummaryPage) },
          { path: ROUTES.ADMIN_LISTINGS, element: page(AdminListingsPage) },
          { path: ROUTES.ADMIN_LISTING(':id'), element: page(AdminListingPage) },
          { path: ROUTES.ADMIN_USERS, element: page(AdminUsersPage) },
          { path: ROUTES.ADMIN_USER(':id'), element: page(AdminUserPage) },
          { path: ROUTES.ADMIN_BOOKINGS, element: page(AdminBookingsPage) },
          { path: ROUTES.ADMIN_REVIEWS, element: page(AdminReviewsPage) },
          { path: ROUTES.ADMIN_COMMISSION, element: page(AdminCommissionPage) },
          { path: ROUTES.ADMIN_AMENITIES, element: page(AdminAmenitiesPage) },
          { path: ROUTES.ADMIN_AUDIT, element: page(AdminAuditPage) },
        ],
      },
    ],
  },
]);

export { NotFoundPage, ForbiddenPage, ErrorBoundary, Toaster };
