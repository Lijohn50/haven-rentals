import { z } from 'zod';
import type {
  BookingResponse,
  HostDashboardResponse,
  PaymentResponse,
  PriceBreakdownResponse,
  ProblemDetail,
  TokenResponse,
  UserResponse,
} from '@/types/api';

/**
 * Runtime guards for the five responses a wrong shape would corrupt money or access on
 * (architecture 4.3, check 3). Schemas are typed against the contract so the guarded value
 * stays assignable to its TypeScript type, with no casts at the call site. In development
 * and test a drift throws; in production it is logged and the value is passed through so one
 * renamed field never blanks a page.
 */
const userSchema: z.ZodType<UserResponse> = z.object({
  id: z.number(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  roles: z.array(z.enum(['GUEST', 'HOST', 'SUPPORT_AGENT', 'ADMIN'])),
  host: z.boolean(),
  emailVerified: z.boolean(),
  hostDisplayName: z.string().nullable(),
});

export const tokenResponseSchema: z.ZodType<TokenResponse> = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.string(),
  expiresIn: z.number(),
  user: userSchema,
});

export const priceBreakdownSchema: z.ZodType<PriceBreakdownResponse> = z.object({
  nightLines: z.array(
    z.object({
      date: z.string(),
      rate: z.number(),
      isWeekend: z.boolean(),
      isSeasonal: z.boolean(),
      seasonName: z.string().nullable(),
    })
  ).optional(),
  nightlySubtotal: z.number(),
  discountTotal: z.number(),
  discountPercent: z.number().optional(),
  cleaningFee: z.number(),
  serviceFee: z.number(),
  taxTotal: z.number(),
  totalAmount: z.number(),
  hostCommission: z.number().optional(),
  hostPayoutAmount: z.number().optional(),
  accommodationTotal: z.number().optional(),
}).passthrough();

export const quoteResponseSchema = z.object({
  listingId: z.number(),
  checkIn: z.string(),
  checkOut: z.string(),
  nights: z.number(),
  guests: z.number(),
  instantBook: z.boolean(),
  priceBreakdown: priceBreakdownSchema,
});

export const bookingResponseSchema: z.ZodType<BookingResponse> = z.object({
  reference: z.string(),
  id: z.number(),
  status: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  nights: z.number(),
  guests: z.number(),
  priceBreakdown: priceBreakdownSchema,
  allowedActions: z.array(z.string()),
  history: z
    .array(
      z.object({
        fromStatus: z.string().nullable(),
        toStatus: z.string(),
        actorType: z.string().nullable(),
        reason: z.string().nullable(),
        createdAt: z.string(),
      })
    )
    .default([]),
  }).passthrough() as unknown as z.ZodType<BookingResponse>;

export const paymentResponseSchema: z.ZodType<PaymentResponse> = z.object({
  id: z.number(),
  bookingId: z.number(),
  amount: z.number(),
  status: z.string(),
  failureCode: z.string().nullable(),
  refundedTotal: z.number(),
  refundableAmount: z.number(),
  refunds: z
    .array(
      z.object({
        id: z.number(),
        paymentId: z.number(),
        bookingId: z.number(),
        amount: z.number(),
        reason: z.string(),
        status: z.string(),
        createdAt: z.string(),
      })
    )
    .default([]),
}) as unknown as z.ZodType<PaymentResponse>;

export const hostDashboardSchema: z.ZodType<HostDashboardResponse> = z.object({
  from: z.string(),
  to: z.string(),
  earnings: z.object({
    paidTotal: z.number(),
    pendingTotal: z.number(),
    heldTotal: z.number(),
    thisMonthPaid: z.number(),
  }),
  overallOccupancyRate: z.number(),
  upcomingCheckIns: z.number(),
  pendingRequests: z.number(),
  oldestPendingRequestExpiry: z.string().nullable(),
  averageRating: z.number().nullable(),
  recentBookings: z.array(bookingResponseSchema),
  listings: z.array(
    z.object({
      listingId: z.number(),
      title: z.string(),
      coverPhotoUrl: z.string().nullable(),
      bookings: z.number(),
      bookedNights: z.number(),
      blockedNights: z.number(),
      occupancyRate: z.number(),
      revenue: z.number(),
      averageRating: z.number().nullable(),
    })
  ),
}) as unknown as z.ZodType<HostDashboardResponse>;

const isStrict = import.meta.env.DEV;

export function guarded<T>(name: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const message = `${name} failed its runtime contract check: ${result.error.message}`;
  if (isStrict) throw new Error(message);
  console.error(message, value);
  return value as T;
}

export function isProblemLike(value: unknown): value is ProblemDetail {
  return typeof value === 'object' && value !== null && 'code' in value && 'status' in value;
}
