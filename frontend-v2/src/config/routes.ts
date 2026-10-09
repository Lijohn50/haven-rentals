/** Every route in the app. URL builders keep path strings out of components. */
export const ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  LISTING: (id: number | string) => `/listings/${id}`,
  HOST_PROFILE: (id: number | string) => `/hosts/${id}`,
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  HELP: '/help',
  HOW_IT_WORKS: '/how-it-works',
  CANCELLATION_POLICIES: '/cancellation-policies',
  TERMS: '/terms',
  PRIVACY: '/privacy',

  CHECKOUT: (listingId: number | string) => `/checkout/${listingId}`,

  TRIPS: '/trips',
  TRIP: (reference: string) => `/trips/${reference}`,
  TRIP_PAY: (reference: string) => `/trips/${reference}/pay`,
  TRIP_REVIEW: (reference: string) => `/trips/${reference}/review`,
  TRIP_DISPUTE: (reference: string) => `/trips/${reference}/dispute`,
  REVIEWS: '/reviews',

  INBOX: '/inbox',
  CONVERSATION: (id: number | string) => `/inbox/${id}`,
  NOTIFICATIONS: '/notifications',

  ACCOUNT: '/account',
  ACCOUNT_SECURITY: '/account/security',
  ACCOUNT_DISPUTES: '/account/disputes',
  BECOME_HOST: '/become-host',

  HOST_DASHBOARD: '/host',
  HOST_LISTINGS: '/host/listings',
  HOST_LISTING_NEW: '/host/listings/new',
  HOST_LISTING: (id: number | string) => `/host/listings/${id}`,
  HOST_BOOKINGS: '/host/bookings',
  HOST_BOOKING: (id: number | string) => `/host/bookings/${id}`,
  HOST_PAYOUTS: '/host/payouts',
  HOST_REVIEWS: '/host/reviews',

  SUPPORT_HOME: '/support',
  SUPPORT_DISPUTES: '/support/disputes',
  SUPPORT_DISPUTE: (id: number | string) => `/support/disputes/${id}`,

  ADMIN_HOME: '/admin',
  ADMIN_LISTINGS: '/admin/listings',
  ADMIN_LISTING: (id: number | string) => `/admin/listings/${id}`,
  ADMIN_USERS: '/admin/users',
  ADMIN_USER: (id: number | string) => `/admin/users/${id}`,
  ADMIN_BOOKINGS: '/admin/bookings',
  ADMIN_REVIEWS: '/admin/reviews',
  ADMIN_COMMISSION: '/admin/commission',
  ADMIN_AMENITIES: '/admin/amenities',
  ADMIN_AUDIT: '/admin/audit',

  FORBIDDEN: '/forbidden',
} as const;

export interface NavEntry {
  /** A path registered in `router.tsx`. A nav entry pointing anywhere else is a dead link. */
  to: string;
  label: string;
}

export interface NavFlags {
  isAuthenticated: boolean;
  isHost: boolean;
  isStaff: boolean;
  isAdmin: boolean;
}

/**
 * The primary navigation answers "where can this account go", so it is derived from the role
 * rather than being one fixed list. Order is priority: the role entry a person needs to do
 * their job comes before the generic Help link.
 *
 * Every `to` here must exist in the router. `/host/messages` was removed for exactly that
 * reason: nothing renders it, so it only ever produced a 404.
 */
export function primaryNav({ isAuthenticated, isHost, isStaff, isAdmin }: NavFlags): NavEntry[] {
  const entries: NavEntry[] = [{ to: ROUTES.SEARCH, label: 'Search' }];

  if (!isAuthenticated) {
    return [
      ...entries,
      { to: ROUTES.HOW_IT_WORKS, label: 'How it works' },
      { to: ROUTES.HELP, label: 'Help' },
    ];
  }

  // Staff live in the tools, not in a traveller's trip list.
  if (!isStaff) entries.push({ to: ROUTES.TRIPS, label: 'Trips' });

  if (isHost) {
    entries.push({ to: ROUTES.HOST_DASHBOARD, label: 'Hosting' });
  } else if (!isStaff) {
    entries.push({ to: ROUTES.BECOME_HOST, label: 'List your place' });
  }

  // One portal entry per role, named after the role. Admins are staff too, so
  // they would otherwise get both "Operations" and "Admin" pointing into the
  // same staff shell; the dispute queue stays in that shell's sidebar.
  if (isStaff && !isAdmin) entries.push({ to: ROUTES.SUPPORT_DISPUTES, label: 'Operations' });
  if (isAdmin) entries.push({ to: ROUTES.ADMIN_HOME, label: 'Admin' });

  entries.push({ to: ROUTES.HELP, label: 'Help' });
  return entries;
}

/** Internal routes that must never be indexed (architecture 15.3). */
const PRIVATE_PREFIXES = [
  '/trips',
  '/checkout',
  '/inbox',
  '/notifications',
  '/account',
  '/reviews',
  '/become-host',
  '/host',
  '/support',
  '/admin',
];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}