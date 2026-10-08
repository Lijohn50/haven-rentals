/** The only place `import.meta.env` is read. Every value has a working default. */
export const ENV = {
  /** base URL for every REST call; proxied to the backend in dev */
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  /** absolute backend origin, used to build absolute media URLs when needed */
  API_ORIGIN: import.meta.env.VITE_API_ORIGIN || '',
  SITE_URL: import.meta.env.VITE_SITE_URL || 'http://localhost:3000',
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Haven',
  /** provider = card form (default). fake = scripted test-token picker. */
  PAYMENT_MODE: import.meta.env.VITE_PAYMENT_MODE || 'provider',
  /** Stripe publishable key (pk_...). Empty = local card simulation. */
  STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  MAP_TILE_URL:
    import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  MAP_ATTRIBUTION: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; OpenStreetMap contributors',
  SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL || 'support@haven.test',
} as const;

/** The fake token picker must never ship to production (architecture 15.4). */
export const IS_PRODUCTION_BUILD = import.meta.env.PROD;
export const IS_FAKE_PAYMENTS = ENV.PAYMENT_MODE !== 'provider';