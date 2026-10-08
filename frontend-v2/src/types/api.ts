/**
 * The API contract, transcribed from the running backend (Spring Boot, `com.example.rentals`).
 *
 * Ground rules (frontend architecture document, Section 2.2):
 *  - calendar dates are `yyyy-MM-dd` strings, timestamps are ISO-8601 UTC strings
 *  - money is always a JSON number in USD and is NEVER recomputed in the browser
 *  - enums arrive as their Java constant names (`"PENDING_PAYMENT"`), never ordinals
 *  - `null` is emitted for absent fields, so optional fields are `T | null` (never `undefined`)
 */

export type Role = 'GUEST' | 'HOST' | 'SUPPORT_AGENT' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type PropertyType =
  | 'APARTMENT'
  | 'HOUSE'
  | 'VILLA'
  | 'CABIN'
  | 'CONDO'
  | 'STUDIO'
  | 'OTHER';
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'PAUSED'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'DELETED';
export type CancellationPolicy = 'FLEXIBLE' | 'MODERATE' | 'STRICT';
export type SearchSort = 'RATING_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'NEWEST';
export type ReviewSort = 'NEWEST' | 'HIGHEST' | 'LOWEST';
export type ReviewStatus = 'HIDDEN' | 'PUBLISHED' | 'REMOVED';
export type ReviewDirection = 'GUEST_TO_HOST' | 'HOST_TO_GUEST';
export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED_BY_GUEST'
  | 'CANCELLED_BY_HOST';
export type BookingAction =
  | 'PAY'
  | 'CANCEL'
  | 'APPROVE'
  | 'DECLINE'
  | 'REVIEW'
  | 'MESSAGE'
  | 'OPEN_DISPUTE';
export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';
export type PayoutStatus = 'SCHEDULED' | 'HELD' | 'PAID' | 'CANCELLED';
export type RefundStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type RefundReason =
  | 'GUEST_CANCELLATION'
  | 'HOST_CANCELLATION'
  | 'HOST_DECLINED'
  | 'REQUEST_EXPIRED'
  | 'DISPUTE_RESOLUTION'
  | 'LATE_PAYMENT';
export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
export type DisputeCategory =
  | 'PROPERTY_NOT_AS_DESCRIBED'
  | 'CLEANLINESS'
  | 'HOST_NO_SHOW'
  | 'GUEST_DAMAGE'
  | 'SAFETY'
  | 'BILLING'
  | 'OTHER';
export type ResolutionType = 'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_REFUND';
export type NotificationType =
  | 'BOOKING_REQUESTED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_DECLINED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_EXPIRED'
  | 'BOOKING_COMPLETED'
  | 'PAYOUT_PAID'
  | 'REFUND_ISSUED'
  | 'REVIEW_REMINDER'
  | 'REVIEW_PUBLISHED'
  | 'LISTING_APPROVED'
  | 'LISTING_REJECTED'
  | 'LISTING_SUSPENDED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
  | 'NEW_MESSAGE'
  | 'CHECK_IN_REMINDER';
export type CalendarUnavailableReason = 'BOOKED' | 'BLOCKED' | 'PAST' | 'OUTSIDE_WINDOW';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ProblemDetail {
  status: number;
  title?: string;
  detail?: string;
  code?: string;
  traceId?: string;
  timestamp?: string;
  path?: string;
  fieldErrors?: FieldError[];
  [extra: string]: unknown;
}

export interface FieldError {
  field: string;
  message: string;
}

/* ------------------------------------------------------------------ auth */

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  /** seconds */
  expiresIn: number;
  user: UserResponse;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface EmailRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/* ------------------------------------------------------------------ user */

export interface UserResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  roles: Role[];
  host: boolean;
  emailVerified: boolean;
  hostDisplayName: string | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface DeleteAccountRequest {
  password: string;
}

export interface BecomeHostRequest {
  displayName: string;
  bio?: string;
  acceptTerms?: boolean;
}

export interface PublicHostResponse {
  userId: number;
  displayName: string | null;
  bio: string | null;
  memberSince: string;
  activeListings: number;
  averageRating: number | null;
  reviewCount: number;
}

/* --------------------------------------------------------------- listing */

export interface AmenityResponse {
  id: number;
  name: string;
  category: string;
  icon: string | null;
}

export interface PhotoResponse {
  id: number;
  url: string;
  width: number;
  height: number;
  sortOrder: number;
  isCover: boolean;
}

/** Body for attaching a photo that is already hosted externally, e.g. on Cloudinary. */
export interface PhotoLinkRequest {
  url: string;
  width?: number;
  height?: number;
  isCover?: boolean;
}

export interface HouseRuleItem {
  text: string;
  sortOrder: number;
}

export interface HouseRulesRequest {
  rules: HouseRuleItem[];
}

export interface UpdateAmenitiesRequest {
  amenityIds: number[];
}

export interface PhotoOrderRequest {
  photoIds: number[];
}

export interface ListingRequest {
  title: string;
  description: string;
  propertyType: PropertyType;
  addressLine: string;
  city: string;
  stateRegion?: string | null;
  country: string;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  baseNightlyPrice: number;
  weekendMultiplier?: number | null;
  cleaningFee?: number | null;
  weeklyDiscountPercent?: number | null;
  monthlyDiscountPercent?: number | null;
  minNights?: number | null;
  maxNights?: number | null;
  advanceNoticeDays?: number | null;
  bookingWindowDays?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  cancellationPolicy: CancellationPolicy;
  instantBook: boolean;
}

export interface ListingResponse {
  id: number;
  hostId: number | null;
  hostDisplayName: string | null;
  title: string;
  description: string;
  propertyType: PropertyType;
  status: ListingStatus;
  rejectionReason: string | null;
  addressLine: string;
  city: string;
  stateRegion: string | null;
  country: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  baseNightlyPrice: number;
  weekendMultiplier: number | null;
  cleaningFee: number | null;
  weeklyDiscountPercent: number | null;
  monthlyDiscountPercent: number | null;
  minNights: number;
  maxNights: number;
  advanceNoticeDays: number;
  bookingWindowDays: number;
  /** LocalTime, serialised as `HH:mm:ss` */
  checkInTime: string | null;
  checkOutTime: string | null;
  cancellationPolicy: CancellationPolicy;
  instantBook: boolean;
  averageRating: number | null;
  reviewCount: number;
  coverPhotoUrl: string | null;
  photos: PhotoResponse[];
  amenities: AmenityResponse[];
  houseRules: HouseRuleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ListingSummaryResponse {
  id: number;
  title: string;
  city: string;
  country: string;
  propertyType: PropertyType;
  status: ListingStatus;
  baseNightlyPrice: number;
  averageRating: number | null;
  reviewCount: number;
  coverPhotoUrl: string | null;
  createdAt: string;
}

/* ---------------------------------------------------------------- search */

export interface SearchResultResponse {
  id: number;
  title: string;
  city: string;
  country: string;
  propertyType: PropertyType;
  coverPhotoUrl: string | null;
  maxGuests: number;
  bedrooms: number;
  baseNightlyPrice: number;
  averageRating: number | null;
  reviewCount: number;
  instantBook: boolean;
  /** up to four amenity names (not ids) */
  amenitiesPreview: string[];
  totalPrice: number | null;
  nights: number | null;
}

export interface CitySuggestionResponse {
  city: string;
  country: string;
  listingCount: number;
}

export interface SearchParams {
  city?: string;
  country?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  amenityIds?: number[];
  propertyType?: PropertyType;
  minBedrooms?: number;
  minRating?: number;
  instantBook?: boolean;
  sort?: SearchSort;
  page?: number;
  size?: number;
}

/* ---------------------------------------------------------- availability */

export interface CalendarDayResponse {
  date: string;
  available: boolean;
  reason: CalendarUnavailableReason | null;
  nightlyPrice: number | null;
}

export interface CalendarResponse {
  listingId: number;
  from: string;
  to: string;
  days: CalendarDayResponse[];
}

export interface BlockRequest {
  startDate: string;
  /** exclusive, per the backend contract */
  endDate: string;
  reason?: string | null;
}

export interface BlockResponse {
  id: number;
  listingId: number;
  startDate: string;
  endDate: string;
  reason: string | null;
}

/* --------------------------------------------------------------- pricing */

export interface NightLineResponse {
  date: string;
  rate: number;
  isWeekend: boolean;
  isSeasonal: boolean;
  seasonName: string | null;
}

export interface PriceBreakdownResponse {
  nightLines?: NightLineResponse[];
  nightlySubtotal: number;
  discountTotal: number;
  discountPercent?: number;
  cleaningFee: number;
  serviceFee: number;
  taxTotal: number;
  totalAmount: number;
  /** host-only: never rendered in guest views */
  hostCommission?: number;
  /** host-only: never rendered in guest views */
  hostPayoutAmount?: number;
  accommodationTotal?: number;
}

export interface QuoteResponse {
  listingId: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  instantBook: boolean;
  priceBreakdown: PriceBreakdownResponse;
}

export interface SeasonalRateRequest {
  name: string;
  /** inclusive first night */
  startDate: string;
  /** inclusive last night */
  endDate: string;
  nightlyPrice: number;
}

export interface SeasonalRateResponse {
  id: number;
  listingId: number;
  name: string;
  startDate: string;
  endDate: string;
  nightlyPrice: number;
}

export interface CommissionSettingRequest {
  guestServiceFeePercent: number;
  hostCommissionPercent: number;
  taxPercent: number;
  effectiveFrom: string;
}

export interface CommissionSettingResponse {
  id: number;
  guestServiceFeePercent: number;
  hostCommissionPercent: number;
  taxPercent: number;
  effectiveFrom: string;
  createdBy: number | null;
  createdAt: string;
}

/* --------------------------------------------------------------- booking */

export interface CreateBookingRequest {
  listingId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  expectedTotal: number;
  message?: string | null;
}

export interface PayBookingRequest {
  paymentToken: string;
}

export interface CancelRequest {
  reason?: string | null;
}

export interface DeclineRequest {
  reason: string;
}

export interface BookingListingSummary {
  id: number;
  title: string;
  city: string;
  country: string;
  coverPhotoUrl: string | null;
}

export interface BookingGuestSummary {
  id: number;
  firstName: string;
  /** null for the host before CONFIRMED */
  lastName: string | null;
  /** null for the host before CONFIRMED */
  phone: string | null;
}

export interface BookingHostSummary {
  id: number;
  displayName: string;
}

export interface BookingHistoryResponse {
  fromStatus: string | null;
  toStatus: string;
  actorType: string | null;
  reason: string | null;
  createdAt: string;
}

export interface BookingResponse {
  reference: string;
  id: number;
  status: BookingStatus;
  listing: BookingListingSummary;
  guest: BookingGuestSummary;
  host: BookingHostSummary;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  /** serialised PriceBreakdownResponse snapshot taken when the hold was created */
  priceBreakdown: PriceBreakdownResponse;
  refundAmount: number | null;
  cancellationPolicy: CancellationPolicy;
  cancellationPolicyDescription: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  expiresAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  hostPayoutAmount: number | null;
  instantBook: boolean;
  allowedActions: BookingAction[];
  history: BookingHistoryResponse[];
}

export interface CancellationPreviewResponse {
  refundAmount: number;
  nonRefundableAmount: number;
  policyName: string;
  explanation: string;
}

/* --------------------------------------------------------------- payment */

export interface RefundResponse {
  id: number;
  paymentId: number;
  bookingId: number;
  amount: number;
  reason: RefundReason;
  status: RefundStatus;
  createdAt: string;
}

export interface PaymentResponse {
  id: number;
  bookingId: number;
  amount: number;
  status: PaymentStatus;
  failureCode: string | null;
  refundedTotal: number;
  refundableAmount: number;
  refunds: RefundResponse[];
}

export interface PayoutResponse {
  id: number;
  hostId: number;
  bookingId: number;
  amount: number;
  status: PayoutStatus;
  scheduledFor: string | null;
  paidAt: string | null;
}

export interface PayoutSummaryResponse {
  pendingAmount: number;
  paidAmount: number;
  heldAmount: number;
  scheduledCount: number;
}

/* ---------------------------------------------------------------- review */

export interface CreateReviewRequest {
  overallRating: number;
  cleanlinessRating?: number;
  communicationRating?: number;
  accuracyRating?: number;
  comment?: string;
}

export interface ReviewResponse {
  id: number;
  bookingId: number;
  listingId: number;
  listingTitle: string;
  reviewerId: number;
  reviewerName: string;
  direction: ReviewDirection;
  overallRating: number;
  cleanlinessRating: number | null;
  communicationRating: number | null;
  accuracyRating: number | null;
  comment: string | null;
  status: ReviewStatus;
  publishedAt: string | null;
}

export interface PendingReviewResponse {
  bookingId: number;
  reference: string;
  listingId: number;
  listingTitle: string;
  coverPhotoUrl: string | null;
  checkOut: string;
  deadline: string;
}

/** A completed stay whose review exchange is still open, from the host's side. */
export interface ReviewExchangeResponse {
  bookingId: number;
  reference: string;
  listingId: number;
  listingTitle: string;
  coverPhotoUrl: string | null;
  checkOut: string;
  deadline: string;
  guestReviewed: boolean;
  hostReviewed: boolean;
}

/** Every field a moderator sees in the review queue. */
export interface AdminReviewResponse {
  id: number;
  bookingId: number;
  listingId: number;
  listingTitle: string;
  reviewerId: number;
  reviewerName: string;
  revieweeId: number;
  revieweeName: string;
  direction: ReviewDirection;
  overallRating: number;
  cleanlinessRating: number | null;
  communicationRating: number | null;
  accuracyRating: number | null;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
  publishDeadline: string;
  publishedAt: string | null;
}

/* ------------------------------------------------------------- messaging */

export interface StartConversationRequest {
  listingId: number;
  message: string;
}

export interface SendMessageRequest {
  body: string;
}

export interface ConversationResponse {
  id: number;
  listingId: number;
  listingTitle: string;
  counterpartId: number;
  counterpartDisplayName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface MessageResponse {
  /** Mongo ObjectId hex */
  id: string;
  conversationId: number;
  senderId: number;
  body: string;
  sentAt: string;
  readAt: string | null;
}

export interface MessagePageResponse {
  /** newest first */
  content: MessageResponse[];
  hasMore: boolean;
  nextCursor: string | null;
}

/* --------------------------------------------------------- notifications */

export interface NotificationResponse {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  /** frontend route */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/* --------------------------------------------------------------- dispute */

export interface CreateDisputeRequest {
  category: DisputeCategory;
  description: string;
}

export interface DisputeResponse {
  id: number;
  bookingId: number;
  bookingReference: string;
  raisedById: number;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  assignedAgentId: number | null;
  resolutionType: ResolutionType | null;
  refundAmount: number | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ResolveDisputeRequest {
  resolutionType: ResolutionType;
  refundAmount?: number | null;
  note: string;
}

export interface RejectDisputeRequest {
  note: string;
}

export interface SupportDisputeDetailResponse {
  dispute: DisputeResponse;
  booking: BookingResponse;
  payment: PaymentResponse | null;
  statusHistory: BookingHistoryResponse[];
  messages: MessageResponse[];
}

/* ------------------------------------------------------------- dashboard */

export interface EarningsResponse {
  paidTotal: number;
  pendingTotal: number;
  heldTotal: number;
  thisMonthPaid: number;
}

export interface ListingMetricsResponse {
  listingId: number;
  title: string;
  coverPhotoUrl: string | null;
  bookings: number;
  bookedNights: number;
  blockedNights: number;
  occupancyRate: number;
  revenue: number;
  averageRating: number | null;
}

export interface HostDashboardResponse {
  from: string;
  to: string;
  earnings: EarningsResponse;
  overallOccupancyRate: number;
  upcomingCheckIns: number;
  pendingRequests: number;
  oldestPendingRequestExpiry: string | null;
  recentBookings: BookingResponse[];
  averageRating: number | null;
  listings: ListingMetricsResponse[];
}

export interface MyTripsResponse {
  upcoming: BookingResponse[];
  past: BookingResponse[];
  cancelled: BookingResponse[];
}

/* ----------------------------------------------------------------- admin */

export interface AdminUserResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  roles: Role[];
  emailVerified: boolean;
  tokenVersion: number;
  hostCancellationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CityStats {
  city: string;
  bookingsCount: number;
  totalGmv: number;
}

export interface AdminSummaryResponse {
  grossMerchandiseValue: number;
  platformRevenue: number;
  bookingsByStatus: Record<string, number>;
  newUsers: number;
  newListings: number;
  topCities: CityStats[];
  averageHostResponseHours: number | null;
  disputesByStatus: Record<string, number>;
}

export interface AuditLogResponse {
  id: number;
  actorId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface RolesRequest {
  roles: Role[];
}

export interface ReasonRequest {
  reason: string;
}

export interface AmenityRequest {
  name: string;
  category: string;
  icon: string;
  active?: boolean;
}

/* -------------------------------------------------------------------- ai */

export interface ListingDescriptionRequest {
  propertyType: PropertyType;
  city: string;
  bullets: string[];
}

export interface TripPlanRequest {
  city: string;
  days: number;
  interests?: string[];
}

export interface AiTextResponse {
  text: string;
}

export interface ReviewSummaryResponse {
  listingId: number;
  reviewCount: number;
  summary: string;
  generatedAt: string;
}

/* --------------------------------------------------------------- helpers */

export interface UnreadCountResponse {
  total: number;
}