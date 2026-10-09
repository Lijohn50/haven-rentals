/**
 * The single table of backend URLs (architecture 4.3). Nothing else in the app may
 * contain a path string: components and hooks import functions from here.
 */
export const ep = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    verifyEmail: '/auth/verify-email',
    resendVerification: '/auth/resend-verification',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    changePassword: '/auth/change-password',
  },
  me: {
    get: '/users/me',
    update: '/users/me',
    remove: '/users/me',
    becomeHost: '/users/me/become-host',
  },
  hostProfile: (userId: number) => `/hosts/${userId}`,

  search: {
    list: '/search',
    citySuggestions: '/search/suggestions/cities',
  },

  amenities: '/amenities',

  listing: {
    get: (id: number) => `/listings/${id}`,
    calendar: (id: number) => `/listings/${id}/calendar`,
    quote: (id: number) => `/listings/${id}/quote`,
    reviews: (id: number) => `/listings/${id}/reviews`,
    reviewSummary: (id: number) => `/ai/listings/${id}/review-summary`,
  },

  media: (listingId: number, filename: string) => `/media/listings/${listingId}/${filename}`,

  bookings: {
    create: '/bookings',
    mine: '/bookings/mine',
    get: (id: number) => `/bookings/${id}`,
    byReference: (reference: string) => `/bookings/reference/${encodeURIComponent(reference)}`,
    pay: (id: number) => `/bookings/${id}/pay`,
    sslcommerzInitiate: (id: number) => `/bookings/${id}/sslcommerz/initiate`,
    cancellationPreview: (id: number) => `/bookings/${id}/cancellation-preview`,
    cancel: (id: number) => `/bookings/${id}/cancel`,
    payment: (id: number) => `/bookings/${id}/payment`,
    reviews: (id: number) => `/bookings/${id}/reviews`,
    disputes: (id: number) => `/bookings/${id}/disputes`,
  },

  reviews: {
    pending: '/reviews/pending',
    adminReview: (id: number) => `/admin/reviews/${id}`,
    adminReviews: '/admin/reviews',
  },

  disputes: {
    mine: '/disputes/mine',
  },

  conversations: {
    create: '/conversations',
    list: '/conversations',
    get: (id: number) => `/conversations/${id}`,
    messages: (id: number) => `/conversations/${id}/messages`,
    sendMessage: (id: number) => `/conversations/${id}/messages`,
    markRead: (id: number) => `/conversations/${id}/read`,
    unreadCount: '/conversations/unread-count',
  },

  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    markRead: (id: number) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
  },

  host: {
    dashboard: '/host/dashboard',
    dashboardListings: '/host/dashboard/listings',
    bookings: '/host/bookings',
    approve: (id: number) => `/host/bookings/${id}/approve`,
    decline: (id: number) => `/host/bookings/${id}/decline`,
    cancel: (id: number) => `/host/bookings/${id}/cancel`,
    payouts: '/host/payouts',
    payoutSummary: '/host/payouts/summary',
    reviews: '/host/reviews',
    reviewExchanges: '/host/reviews/exchange',

    listings: '/host/listings',
    createListing: '/host/listings',
    listing: (id: number) => `/host/listings/${id}`,
    updateListing: (id: number) => `/host/listings/${id}`,
    deleteListing: (id: number) => `/host/listings/${id}`,
    submit: (id: number) => `/host/listings/${id}/submit`,
    pause: (id: number) => `/host/listings/${id}/pause`,
    resume: (id: number) => `/host/listings/${id}/resume`,
    amenities: (id: number) => `/host/listings/${id}/amenities`,
    houseRules: (id: number) => `/host/listings/${id}/house-rules`,
    photos: (id: number) => `/host/listings/${id}/photos`,
  photoLink: (id: number) => `/host/listings/${id}/photos/link`,
    photoOrder: (id: number) => `/host/listings/${id}/photos/order`,
    photoCover: (id: number, photoId: number) => `/host/listings/${id}/photos/${photoId}/cover`,
    blocks: (id: number) => `/host/listings/${id}/blocks`,
    block: (id: number, blockId: number) => `/host/listings/${id}/blocks/${blockId}`,
    seasonalRates: (id: number) => `/host/listings/${id}/seasonal-rates`,
    seasonalRate: (id: number, rateId: number) => `/host/listings/${id}/seasonal-rates/${rateId}`,
  },

  support: {
    disputes: '/support/disputes',
    dispute: (id: number) => `/support/disputes/${id}`,
    assign: (id: number) => `/support/disputes/${id}/assign`,
    resolve: (id: number) => `/support/disputes/${id}/resolve`,
    reject: (id: number) => `/support/disputes/${id}/reject`,
  },

  admin: {
    summary: '/admin/summary',
    pendingListings: '/admin/listings/pending',
    listing: (id: number) => `/admin/listings/${id}`,
    approveListing: (id: number) => `/admin/listings/${id}/approve`,
    rejectListing: (id: number) => `/admin/listings/${id}/reject`,
    suspendListing: (id: number) => `/admin/listings/${id}/suspend`,
    reinstateListing: (id: number) => `/admin/listings/${id}/reinstate`,
    users: '/admin/users',
    user: (id: number) => `/admin/users/${id}`,
    suspendUser: (id: number) => `/admin/users/${id}/suspend`,
    unsuspendUser: (id: number) => `/admin/users/${id}/unsuspend`,
    userRoles: (id: number) => `/admin/users/${id}/roles`,
    booking: (id: number) => `/admin/bookings/${id}`,
    bookingByReference: (reference: string) =>
      `/admin/bookings/reference/${encodeURIComponent(reference)}`,
    audit: '/admin/audit',
    commissionSettings: '/admin/commission-settings',
    amenities: '/admin/amenities',
    amenity: (id: number) => `/admin/amenities/${id}`,
    review: (id: number) => `/admin/reviews/${id}`,
  },

  ai: {
    listingDescription: '/ai/listing-description',
    reviewSummary: (id: number) => `/ai/listings/${id}/review-summary`,
    tripPlan: '/ai/trip-plan',
  },

  dashboard: {
    trips: '/dashboard/trips',
  },
} as const;