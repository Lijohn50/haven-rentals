import { ENV } from './env';

/** Copy constants that must stay consistent across screens (all original wording). */
export const BRAND = {
  name: ENV.APP_NAME,
  tagline: 'Find a whole home for your next trip.',
  subcopy: 'Private homes, clear prices, secure payment.',
  hostBand: 'Turn your property into income',
  supportEmail: ENV.SUPPORT_EMAIL,
  /** Mirrors the backend configuration in application.yml. */
  paymentHoldMinutes: 15,
  hostResponseHours: 24,
  reviewWindowDays: 14,
  disputeWindowDays: 14,
  payoutDelayHours: 24,
  commissionPercent: 3,
  maxGuests: 50,
  maxNights: 365,
  maxPhotosPerListing: 20,
  minPhotosToSubmit: 3,
  maxPhotoBytes: 5 * 1024 * 1024,
  photoMinSide: 400,
  photoMaxSide: 8000,
} as const;