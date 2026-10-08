import type { NotificationType } from '@/types/api';
import { ROUTES } from '@/config/routes';

/**
 * A notification `link` is a frontend route produced by the backend. It is honoured only
 * when it is a relative single-slash path; otherwise, or when it matches no known area, the
 * item opens the notifications page instead (architecture 11.6, open-redirect rule 15.4).
 */
const KNOWN_PREFIXES = [
  '/trips',
  '/host',
  '/support',
  '/admin',
  '/inbox',
  '/listings',
  '/reviews',
  '/account',
  '/notifications',
  '/become-host',
];

export function notificationTarget(type: NotificationType, link: string | null): string {
  if (link && link.startsWith('/') && !link.startsWith('//') && KNOWN_PREFIXES.some((p) => link === p || link.startsWith(`${p}/`))) {
    return link;
  }
  switch (type) {
    case 'NEW_MESSAGE':
      return ROUTES.INBOX;
    case 'PAYOUT_PAID':
      return ROUTES.HOST_PAYOUTS;
    case 'BOOKING_REQUESTED':
      return ROUTES.HOST_BOOKINGS;
    case 'LISTING_APPROVED':
    case 'LISTING_REJECTED':
    case 'LISTING_SUSPENDED':
      return ROUTES.HOST_LISTINGS;
    case 'DISPUTE_OPENED':
    case 'DISPUTE_RESOLVED':
      return ROUTES.ACCOUNT_DISPUTES;
    case 'REVIEW_REMINDER':
    case 'REVIEW_PUBLISHED':
      return ROUTES.REVIEWS;
    default:
      return ROUTES.NOTIFICATIONS;
  }
}