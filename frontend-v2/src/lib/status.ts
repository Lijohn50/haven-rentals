import type {
  BookingStatus,
  CancellationPolicy,
  DisputeCategory,
  ListingStatus,
  PaymentStatus,
  PayoutStatus,
  PropertyType,
  RefundStatus,
  ResolutionType,
  ReviewStatus,
  UserStatus,
} from '@/types/api';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusEntry {
  label: string;
  tone: Tone;
  hint?: string;
}

const unknownEntry = (value: string): StatusEntry => ({
  label: value.replaceAll('_', ' ').toLowerCase(),
  tone: 'neutral',
});

/** Viewer-aware copy: the same status reads differently to a guest and to a host. */
export const bookingStatus: Record<BookingStatus, StatusEntry> = {
  PENDING_PAYMENT: { label: 'Awaiting payment', tone: 'warning', hint: 'These dates are held until you pay.' },
  PENDING_APPROVAL: { label: 'Waiting for host', tone: 'warning', hint: 'The host has 24 hours to respond.' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  PAYMENT_FAILED: { label: 'Payment failed', tone: 'danger' },
  CANCELLED_BY_GUEST: { label: 'Cancelled by guest', tone: 'danger' },
  CANCELLED_BY_HOST: { label: 'Cancelled by host', tone: 'danger' },
};

export const bookingStatusForHost: Partial<Record<BookingStatus, StatusEntry>> = {
  PENDING_APPROVAL: { label: 'Needs your response', tone: 'warning', hint: 'Approve or decline within 24 hours.' },
  CANCELLED_BY_HOST: { label: 'Cancelled by you', tone: 'danger' },
  CANCELLED_BY_GUEST: { label: 'Cancelled by guest', tone: 'danger' },
};

export function bookingStatusEntry(status: BookingStatus, viewer: 'guest' | 'host'): StatusEntry {
  if (viewer === 'host') return bookingStatusForHost[status] ?? bookingStatus[status];
  return bookingStatus[status];
}

export const listingStatus: Record<ListingStatus, StatusEntry> = {
  DRAFT: { label: 'Draft', tone: 'neutral', hint: 'Only you can see this listing.' },
  PENDING_REVIEW: { label: 'Under review', tone: 'warning', hint: 'Editing is locked while we review it.' },
  ACTIVE: { label: 'Live', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'neutral', hint: 'Hidden from search; existing bookings stand.' },
  SUSPENDED: { label: 'Suspended', tone: 'danger', hint: 'Suspended by an administrator.' },
  REJECTED: { label: 'Rejected', tone: 'danger', hint: 'See the reason and edit to resubmit.' },
  DELETED: { label: 'Deleted', tone: 'neutral' },
};

export const paymentStatus: Record<PaymentStatus, StatusEntry> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  SUCCEEDED: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  PARTIALLY_REFUNDED: { label: 'Partly refunded', tone: 'info' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
};

export const refundStatus: Record<RefundStatus, StatusEntry> = {
  PENDING: { label: 'Refund pending', tone: 'warning' },
  SUCCEEDED: { label: 'Refunded', tone: 'success' },
  FAILED: { label: 'Refund failed', tone: 'danger', hint: "We're retrying this refund automatically." },
};

export const payoutStatus: Record<PayoutStatus, StatusEntry> = {
  PAID: { label: 'Paid', tone: 'success' },
  SCHEDULED: { label: 'Scheduled', tone: 'info', hint: 'Payouts are released 24 hours after check-in.' },
  HELD: { label: 'Held', tone: 'warning', hint: 'Held while a dispute is open.' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const disputeStatus: Record<string, StatusEntry> = {
  OPEN: { label: 'Open', tone: 'warning' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
};

export const reviewStatus: Record<ReviewStatus, StatusEntry> = {
  PUBLISHED: { label: 'Published', tone: 'success' },
  HIDDEN: { label: 'Hidden', tone: 'neutral', hint: 'Revealed when both reviews are in.' },
  REMOVED: { label: 'Removed', tone: 'danger' },
};

export const userStatus: Record<UserStatus, StatusEntry> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  DELETED: { label: 'Deleted', tone: 'neutral' },
};

export const propertyTypeLabels: Record<PropertyType, string> = {
  APARTMENT: 'Apartment',
  HOUSE: 'House',
  VILLA: 'Villa',
  CABIN: 'Cabin',
  CONDO: 'Condo',
  STUDIO: 'Studio',
  OTHER: 'Other',
};

export const cancellationPolicyLabels: Record<CancellationPolicy, string> = {
  FLEXIBLE: 'Flexible',
  MODERATE: 'Moderate',
  STRICT: 'Strict',
};

export const disputeCategoryLabels: Record<DisputeCategory, string> = {
  PROPERTY_NOT_AS_DESCRIBED: 'Property not as described',
  CLEANLINESS: 'Cleanliness',
  HOST_NO_SHOW: 'Host did not show up',
  GUEST_DAMAGE: 'Damage to the property',
  SAFETY: 'Safety or security concern',
  BILLING: 'Billing or payout problem',
  OTHER: 'Something else',
};

export const resolutionTypeLabels: Record<ResolutionType, string> = {
  FULL_REFUND: 'Full refund',
  PARTIAL_REFUND: 'Partial refund',
  NO_REFUND: 'No refund',
};

export const calendarReasonLabels: Record<string, string> = {
  BOOKED: 'Already booked',
  BLOCKED: 'Blocked by the host',
  PAST: 'In the past',
  OUTSIDE_WINDOW: 'Outside the booking window',
};

export function statusEntry(
  map: Record<string, StatusEntry>,
  value: string | null | undefined
): StatusEntry {
  if (!value) return { label: '—', tone: 'neutral' };
  return map[value] ?? unknownEntry(value);
}