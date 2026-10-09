import { z } from 'zod';
import { isValidMoneyInput } from '@/lib/money';
import { todayIn } from '@/lib/local-date';
import type { CancellationPolicy, ListingRequest, PropertyType } from '@/types/api';

const money = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => isValidMoneyInput(value), `${label} needs at most 2 decimals`)
    .refine((value) => Number(value) >= min, `${label} must be at least ${min}`)
    .refine((value) => Number(value) <= max, `${label} must be at most ${max}`);

const percent = (max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => isValidMoneyInput(value), `${label} needs at most 2 decimals`)
    .refine((value) => Number(value) >= 0, `${label} cannot be negative`)
    .refine((value) => Number(value) <= max, `${label} must be at most ${max}`);

const noHtml = (value: string) => !/<[^>]*>/.test(value);

export const propertyTypeSchema = z.enum([
  'APARTMENT',
  'HOUSE',
  'VILLA',
  'CABIN',
  'CONDO',
  'STUDIO',
  'OTHER',
]);

export const basicsSchema = z.object({
  propertyType: propertyTypeSchema,
  title: z
    .string()
    .trim()
    .min(10, 'Use at least 10 characters')
    .max(120, 'Use at most 120 characters')
    .refine(noHtml, 'Remove any HTML'),
  description: z
    .string()
    .trim()
    .min(50, 'Use at least 50 characters')
    .max(5000, 'Use at most 5000 characters')
    .refine(noHtml, 'Remove any HTML'),
});

export const locationSchema = z.object({
  addressLine: z.string().trim().min(5, 'Use at least 5 characters').max(200),
  city: z.string().trim().min(1, 'Required').max(100),
  stateRegion: z.string().trim().max(100).optional(),
  country: z
    .string()
    .trim()
    .length(2, 'Use the ISO-3166 alpha-2 code, e.g. FR')
    .regex(/^[A-Za-z]{2}$/, 'Use the ISO-3166 alpha-2 code, e.g. FR')
    .transform((value) => value.toUpperCase()),
  postalCode: z.string().trim().max(20).optional(),
  latitude: z
    .string()
    .trim()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), 'Enter a latitude')
    .refine((value) => Math.abs(Number(value)) <= 90, 'Latitude must be between -90 and 90')
    .refine((value) => /^-?\d{1,2}(\.\d{1,6})?$/.test(value), 'Use at most 6 decimals'),
  longitude: z
    .string()
    .trim()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), 'Enter a longitude')
    .refine((value) => Math.abs(Number(value)) <= 180, 'Longitude must be between -180 and 180')
    .refine((value) => /^-?\d{1,3}(\.\d{1,6})?$/.test(value), 'Use at most 6 decimals'),
  timezone: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Use a valid IANA timezone, e.g. Europe/Paris'),
});

export const spaceSchema = z.object({
  maxGuests: z.coerce.number().int().min(1, 'At least 1').max(50, 'At most 50'),
  bedrooms: z.coerce.number().int().min(0).max(50),
  beds: z.coerce.number().int().min(1, 'At least 1').max(100),
  bathrooms: z.coerce.number().min(0).max(50).refine((value) => Number.isInteger(value * 2), 'Use 0.5 steps'),
});

export const pricingSchema = z
  .object({
    baseNightlyPrice: money(50, 1000000, 'Nightly price'),
    weekendMultiplier: money(1, 3, 'Weekend multiplier'),
    cleaningFee: money(0, 50000, 'Cleaning fee'),
    weeklyDiscountPercent: percent(90, 'Weekly discount'),
    monthlyDiscountPercent: percent(90, 'Monthly discount'),
  })
  // Both discount fields live here, so this comparison has to live here too. It used to
  // sit on bookingRulesSchema, whose shape has neither field, so the rule never ran.
  .superRefine((values, ctx) => {
    if (
      Number(values.monthlyDiscountPercent) > 0 &&
      Number(values.monthlyDiscountPercent) < Number(values.weeklyDiscountPercent)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['monthlyDiscountPercent'],
        message: 'Monthly discount must be at least the weekly discount',
      });
    }
  });

export const bookingRulesSchema = z
  .object({
    minNights: z.coerce.number().int().min(1, 'At least 1 night'),
    maxNights: z.coerce.number().int().min(1).max(365, 'At most 365 nights'),
    advanceNoticeDays: z.coerce.number().int().min(0).max(60, 'At most 60 days'),
    bookingWindowDays: z.coerce.number().int().min(30, 'At least 30 days').max(730, 'At most 730 days'),
    checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm'),
    checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm'),
    cancellationPolicy: z.enum(['FLEXIBLE', 'MODERATE', 'STRICT']),
    instantBook: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.maxNights < values.minNights) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxNights'],
        message: 'Maximum stay must be at least the minimum stay',
      });
    }
  });

export const seasonalRateSchema = z
  .object({
    name: z.string().trim().min(2, 'Use at least 2 characters').max(60),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick an end date'),
    nightlyPrice: money(1, 100000, 'Nightly price'),
  })
  .superRefine((values, ctx) => {
    if (values.endDate < values.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End must be on or after start' });
    }
    if (values.endDate < todayIn()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date cannot be in the past' });
    }
    const days =
      (new Date(`${values.endDate}T00:00:00Z`).getTime() - new Date(`${values.startDate}T00:00:00Z`).getTime()) /
      86_400_000 +
      1;
    if (days > 366) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'A season cannot exceed 366 days' });
    }
  });

export const blockSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick an end date'),
    reason: z.string().trim().max(200, 'Use at most 200 characters').optional(),
  })
  .superRefine((values, ctx) => {
    if (values.startDate < todayIn()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'Start date cannot be in the past' });
    }
    const days =
      (new Date(`${values.endDate}T00:00:00Z`).getTime() - new Date(`${values.startDate}T00:00:00Z`).getTime()) /
      86_400_000;
    if (days > 730) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'A block cannot exceed 730 days' });
    }
  });

export const houseRuleTextSchema = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(200, 'Use at most 200 characters')
  .refine(noHtml, 'Remove any HTML');

/**
 * One editable house rule. The editor works on `{ text, sortOrder }` records, so the
 * array item needs the object wrapper around {@link houseRuleTextSchema} rather than the
 * bare string.
 */
export const houseRuleSchema = z.object({
  text: houseRuleTextSchema,
  sortOrder: z.number().int().min(0),
});

export const declineReasonSchema = z.object({
  reason: z.string().trim().min(5, 'Use at least 5 characters').max(500, 'Use at most 500 characters'),
});

export const hostCancelReasonSchema = z.object({
  reason: z.string().trim().min(10, 'Use at least 10 characters').max(500, 'Use at most 500 characters'),
});

/** `ReasonRequest` on the backend is @Size(min = 10, max = 500). */
export const adminReasonSchema = z.object({
  reason: z.string().trim().min(10, 'Use at least 10 characters').max(500, 'Use at most 500 characters'),
});

export const reviewRemovalReasonSchema = z.object({
  reason: z.string().trim().min(10, 'Use at least 10 characters').max(500, 'Use at most 500 characters'),
});

/** Builds the PUT body the backend expects, with every optional field explicitly present. */
export function toListingRequest(input: {
  basics: z.infer<typeof basicsSchema>;
  location: z.infer<typeof locationSchema>;
  space: z.infer<typeof spaceSchema>;
  pricing: z.infer<typeof pricingSchema>;
  rules: z.infer<typeof bookingRulesSchema>;
}): ListingRequest {
  const { basics, location, space, pricing, rules } = input;
  return {
    title: basics.title,
    description: basics.description,
    propertyType: basics.propertyType as PropertyType,
    addressLine: location.addressLine,
    city: location.city,
    stateRegion: location.stateRegion ?? null,
    country: location.country,
    postalCode: location.postalCode ?? null,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    timezone: location.timezone,
    maxGuests: space.maxGuests,
    bedrooms: space.bedrooms,
    beds: space.beds,
    bathrooms: space.bathrooms,
    baseNightlyPrice: Number(pricing.baseNightlyPrice),
    weekendMultiplier: Number(pricing.weekendMultiplier),
    cleaningFee: Number(pricing.cleaningFee),
    weeklyDiscountPercent: Number(pricing.weeklyDiscountPercent),
    monthlyDiscountPercent: Number(pricing.monthlyDiscountPercent),
    minNights: rules.minNights,
    maxNights: rules.maxNights,
    advanceNoticeDays: rules.advanceNoticeDays,
    bookingWindowDays: rules.bookingWindowDays,
    checkInTime: rules.checkInTime,
    checkOutTime: rules.checkOutTime,
    cancellationPolicy: rules.cancellationPolicy as CancellationPolicy,
    instantBook: rules.instantBook,
  };
}
