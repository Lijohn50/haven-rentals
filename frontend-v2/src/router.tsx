import React from 'react';
import { createBrowserRouter, Navigate, useRouteError } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ROUTES } from '@/config/routes';
import { PublicLayout, HostShell, StaffShell, RequireAuth, RequireGuest } from '@/components/layout';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Button, EmptyState } from '@/components/ui';

import { LandingPage } from '@/features/landing/LandingPage';
import { SearchPage } from '@/features/search/SearchPage';
import { ListingPage } from '@/features/listings/ListingPage';
import { HostProfilePage } from '@/features/listings/HostProfilePage';
import {
  CancellationPoliciesPage,
  HelpPage,
  HowItWorksPage,
  PrivacyPage,
  TermsPage,
} from '@/features/static/StaticPages';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { AccountPage } from '@/features/account/AccountPage';
import { SecurityPage } from '@/features/account/SecurityPage';
import { MyDisputesPage } from '@/features/account/MyDisputesPage';
import { BecomeHostPage } from '@/features/account/BecomeHostPage';
import { CheckoutPage } from '@/features/booking/CheckoutPage';
import { PayPage } from '@/features/booking/PayPage';
import { TripsPage } from '@/features/trips/TripsPage';
import { TripDetailPage } from '@/features/trips/TripDetailPage';
import { ReviewFormPage } from '@/features/trips/ReviewFormPage';
import { DisputeFormPage } from '@/features/trips/DisputeFormPage';
import { ReviewsPage } from '@/features/reviews/ReviewsPage';
import { InboxPage } from '@/features/messaging/InboxPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { HostDashboardPage } from '@/features/host/HostDashboardPage';
import { HostListingsPage } from '@/features/host/HostListingsPage';
import { HostListingPage } from '@/features/host/HostListingPage';
import { ListingWizardPage } from '@/features/host/ListingWizardPage';
import { HostBookingsPage } from '@/features/host/HostBookingsPage';
import { HostBookingDetailPage } from '@/features/host/HostBookingDetailPage';
import { HostPayoutsPage } from '@/features/host/HostPayoutsPage';
import { HostReviewsPage } from '@/features/host/HostReviewsPage';
import { SupportDisputesPage } from '@/features/support/SupportDisputesPage';
import { SupportDisputeDetailPage } from '@/features/support/SupportDisputeDetailPage';
import { AdminSummaryPage } from '@/features/admin/AdminSummaryPage';
import { AdminListingsPage } from '@/features/admin/AdminListingsPage';
import { AdminListingPage } from '@/features/admin/AdminListingPage';
import { AdminUsersPage } from '@/features/admin/AdminUsersPage';
import { AdminUserPage } from '@/features/admin/AdminUserPage';
import { AdminBookingsPage } from '@/features/admin/AdminBookingsPage';
import { AdminCommissionPage } from '@/features/admin/AdminCommissionPage';
import { AdminAmenitiesPage } from '@/features/admin/AdminAmenitiesPage';
import { AdminAuditPage } from '@/features/admin/AdminAuditPage';
import { AdminReviewsPage } from '@/features/admin/AdminReviewsPage';

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

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteCrash />,
    children: [
      { path: ROUTES.HOME, element: <LandingPage /> },
      { path: ROUTES.SEARCH, element: <SearchPage /> },
      { path: ROUTES.LISTING(':id'), element: <ListingPage /> },
      { path: ROUTES.HOST_PROFILE(':id'), element: <HostProfilePage /> },
      { path: ROUTES.HOW_IT_WORKS, element: <HowItWorksPage /> },
      { path: ROUTES.CANCELLATION_POLICIES, element: <CancellationPoliciesPage /> },
      { path: ROUTES.HELP, element: <HelpPage /> },
      { path: ROUTES.TERMS, element: <TermsPage /> },
      { path: ROUTES.PRIVACY, element: <PrivacyPage /> },
      { path: ROUTES.FORBIDDEN, element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },

      // signed-in guest area
      {
        element: <RequireAuth />,
        children: [
          { path: ROUTES.CHECKOUT(':listingId'), element: <CheckoutPage /> },
          { path: ROUTES.TRIPS, element: <TripsPage /> },
          { path: `${ROUTES.TRIPS}/:reference/pay`, element: <PayPage /> },
          { path: `${ROUTES.TRIPS}/:reference/review`, element: <ReviewFormPage /> },
          { path: `${ROUTES.TRIPS}/:reference/dispute`, element: <DisputeFormPage /> },
          { path: ROUTES.TRIP(':reference'), element: <TripDetailPage /> },
          { path: ROUTES.REVIEWS, element: <ReviewsPage /> },
          { path: ROUTES.INBOX, element: <InboxPage /> },
          { path: ROUTES.CONVERSATION(':id'), element: <InboxPage /> },
          { path: ROUTES.NOTIFICATIONS, element: <NotificationsPage /> },
          { path: ROUTES.ACCOUNT, element: <AccountPage /> },
          { path: ROUTES.ACCOUNT_SECURITY, element: <SecurityPage /> },
          { path: ROUTES.ACCOUNT_DISPUTES, element: <MyDisputesPage /> },
          { path: ROUTES.BECOME_HOST, element: <BecomeHostPage /> },
        ],
      },

      // signed-out only
      {
        element: <RequireGuest />,
        children: [
          { path: ROUTES.LOGIN, element: <LoginPage /> },
          { path: ROUTES.REGISTER, element: <RegisterPage /> },
        ],
      },
      { path: ROUTES.VERIFY_EMAIL, element: <VerifyEmailPage /> },
      { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
      { path: ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth roles={['HOST']} />,
    children: [
      {
        element: <HostShell />,
        children: [
          { path: ROUTES.HOST_DASHBOARD, element: <HostDashboardPage /> },
          { path: ROUTES.HOST_LISTINGS, element: <HostListingsPage /> },
          { path: ROUTES.HOST_LISTING_NEW, element: <ListingWizardPage /> },
          { path: ROUTES.HOST_LISTING(':id'), element: <HostListingPage /> },
          { path: ROUTES.HOST_BOOKINGS, element: <HostBookingsPage /> },
          { path: ROUTES.HOST_BOOKING(':id'), element: <HostBookingDetailPage /> },
          { path: ROUTES.HOST_PAYOUTS, element: <HostPayoutsPage /> },
          { path: ROUTES.HOST_REVIEWS, element: <HostReviewsPage /> },
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
          { path: ROUTES.SUPPORT_DISPUTES, element: <SupportDisputesPage /> },
          { path: ROUTES.SUPPORT_DISPUTE(':id'), element: <SupportDisputeDetailPage /> },
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
          { path: ROUTES.ADMIN_HOME, element: <AdminSummaryPage /> },
          { path: ROUTES.ADMIN_LISTINGS, element: <AdminListingsPage /> },
          { path: ROUTES.ADMIN_LISTING(':id'), element: <AdminListingPage /> },
          { path: ROUTES.ADMIN_USERS, element: <AdminUsersPage /> },
          { path: ROUTES.ADMIN_USER(':id'), element: <AdminUserPage /> },
          { path: ROUTES.ADMIN_BOOKINGS, element: <AdminBookingsPage /> },
          { path: ROUTES.ADMIN_REVIEWS, element: <AdminReviewsPage /> },
          { path: ROUTES.ADMIN_COMMISSION, element: <AdminCommissionPage /> },
          { path: ROUTES.ADMIN_AMENITIES, element: <AdminAmenitiesPage /> },
          { path: ROUTES.ADMIN_AUDIT, element: <AdminAuditPage /> },
        ],
      },
    ],
  },
]);

export { NotFoundPage, ForbiddenPage, ErrorBoundary, Toaster };