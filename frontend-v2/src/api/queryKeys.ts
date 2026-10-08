/**
 * Query keys. Every key starts with the backend module so invalidation stays predictable
 * (architecture 14.6). Stale times mirror the server-side cache windows.
 */
export const queryKeys = {
  me: ['me'] as const,
  amenities: ['amenities'] as const,

  search: (params: unknown) => ['search', params] as const,
  citySuggestions: (prefix: string) => ['citySuggestions', prefix] as const,

  listing: (id: number) => ['listing', id] as const,
  hostListing: (id: number) => ['hostListing', id] as const,
  hostListings: (status?: string) => ['hostListings', status ?? 'ALL'] as const,
  listingReviews: (id: number, sort: string, page: number) =>
    ['listingReviews', id, sort, page] as const,
  reviewSummary: (id: number) => ['reviewSummary', id] as const,
  hostProfile: (id: number) => ['hostProfile', id] as const,

  calendar: (id: number, from: string, to: string) => ['calendar', id, from, to] as const,
  quote: (id: number, checkIn: string, checkOut: string, guests: number) =>
    ['quote', id, checkIn, checkOut, guests] as const,

  trips: ['trips'] as const,
  myBookings: (status?: string) => ['myBookings', status ?? 'ALL'] as const,
  booking: (id: number) => ['booking', id] as const,
  bookingByRef: (reference: string) => ['bookingByRef', reference] as const,
  bookingReviews: (id: number) => ['bookingReviews', id] as const,
  payment: (id: number) => ['payment', id] as const,
  pendingReviews: ['pendingReviews'] as const,
  myDisputes: (page: number) => ['myDisputes', page] as const,

  conversations: ['conversations'] as const,
  conversation: (id: number) => ['conversation', id] as const,
  messages: (id: number) => ['messages', id] as const,
  unreadMessages: ['unreadMessages'] as const,

  notifications: (params: unknown) => ['notifications', params] as const,
  unreadNotifications: ['unreadNotifications'] as const,

  hostDashboard: (from: string, to: string) => ['hostDashboard', from, to] as const,
  hostListingMetrics: (from: string, to: string) => ['hostListingMetrics', from, to] as const,
  hostBookings: (params: unknown) => ['hostBookings', params] as const,
  hostPayouts: (params: unknown) => ['hostPayouts', params] as const,
  payoutSummary: ['payoutSummary'] as const,
  blocks: (listingId: number) => ['blocks', listingId] as const,
  seasonalRates: (listingId: number) => ['seasonalRates', listingId] as const,

  supportDisputes: (params: unknown) => ['supportDisputes', params] as const,
  supportDispute: (id: number) => ['supportDispute', id] as const,

  adminSummary: (from: string, to: string) => ['adminSummary', from, to] as const,
  adminPendingListings: (page: number) => ['adminPendingListings', page] as const,
  adminListing: (id: number) => ['adminListing', id] as const,
  adminUsers: (params: unknown) => ['adminUsers', params] as const,
  adminUser: (id: number) => ['adminUser', id] as const,
  adminBooking: (id: number) => ['adminBooking', id] as const,
  adminBookingByRef: (reference: string) => ['adminBookingByRef', reference] as const,
  hostReviews: (params: { sort: string; page: number }) =>
    ['hostReviews', params.sort, params.page] as const,
  hostReviewExchanges: ['hostReviewExchanges'] as const,
  adminReviews: (params: { status: string; query: string; page: number }) =>
    ['adminReviews', params.status, params.query, params.page] as const,
  auditLog: (params: unknown) => ['auditLog', params] as const,
  commission: (page: number) => ['commission', page] as const,

  tripPlan: (city: string, days: number) => ['tripPlan', city, days] as const,
} as const;