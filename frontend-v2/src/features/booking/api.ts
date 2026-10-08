import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { guarded, bookingResponseSchema, paymentResponseSchema } from '@/api/guards';
import { ApiError } from '@/api/errors';
import type {
  BookingResponse,
  BookingStatus,
  CancellationPreviewResponse,
  CreateBookingRequest,
  MyTripsResponse,
  PageResponse,
  PaymentResponse,
} from '@/types/api';

export const bookingsApi = {
  createHold: (payload: CreateBookingRequest, idempotencyKey?: string) =>
    api<BookingResponse>(ep.bookings.create, {
      method: 'post',
      data: payload,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }).then((response) => guarded('booking', bookingResponseSchema, response)),
  pay: (id: number, paymentToken: string) =>
    api<BookingResponse>(ep.bookings.pay(id), { method: 'post', data: { paymentToken } }),
  mine: (status?: BookingStatus, page = 0, size = 50) =>
    api<PageResponse<BookingResponse>>(ep.bookings.mine, { params: { status, page, size } }),
  get: (id: number) => api<BookingResponse>(ep.bookings.get(id)),
  byReference: (reference: string) => api<BookingResponse>(ep.bookings.byReference(reference)),
  cancellationPreview: (id: number) => api<CancellationPreviewResponse>(ep.bookings.cancellationPreview(id)),
  cancel: (id: number, reason?: string) =>
    api<BookingResponse>(ep.bookings.cancel(id), { method: 'post', data: { reason } }),
  payment: (id: number) =>
    api<PaymentResponse>(ep.bookings.payment(id)).then((response) =>
      guarded('payment', paymentResponseSchema, response)
    ),
  hostBookings: (params: { status?: BookingStatus; listingId?: number; page?: number; size?: number }) =>
    api<PageResponse<BookingResponse>>(ep.host.bookings, { params }),
  approve: (id: number) => api<BookingResponse>(ep.host.approve(id), { method: 'post' }),
  decline: (id: number, reason: string) =>
    api<BookingResponse>(ep.host.decline(id), { method: 'post', data: { reason } }),
  hostCancel: (id: number, reason: string) =>
    api<BookingResponse>(ep.host.cancel(id), { method: 'post', data: { reason } }),
};

export const tripsApi = {
  mine: () => api<MyTripsResponse>(ep.dashboard.trips),
};

export function useTrips(enabled = true) {
  return useQuery({
    queryKey: queryKeys.trips,
    queryFn: tripsApi.mine,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useMyBookings(status?: BookingStatus, enabled = true) {
  return useQuery({
    queryKey: queryKeys.myBookings(status),
    queryFn: () => bookingsApi.mine(status),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useBooking(reference: string | null) {
  return useQuery({
    queryKey: queryKeys.bookingByRef(reference ?? ''),
    queryFn: () => bookingsApi.byReference(reference as string),
    enabled: Boolean(reference),
    // While a hold or a request is live the state can change server-side at any moment.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING_PAYMENT' || status === 'PENDING_APPROVAL' ? 15_000 : false;
    },
  });
}

export function useBookingById(id: number | null) {
  return useQuery({
    queryKey: queryKeys.booking(id ?? 0),
    queryFn: () => bookingsApi.get(id as number),
    enabled: Boolean(id),
  });
}

export function useBookingPayment(bookingId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payment(bookingId ?? 0),
    queryFn: () => bookingsApi.payment(bookingId as number),
    enabled: Boolean(bookingId) && enabled,
    retry: false,
  });
}

/**
 * Same resource and query key as `useBookingPayment`, but without the zod guard: that schema
 * omits `failureCode` and `refunds`, and zod strips unknown keys, so the guest screens would
 * never see a decline reason or a refund row.
 */
export function useBookingPaymentDetail(bookingId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payment(bookingId ?? 0),
    queryFn: () => api<PaymentResponse>(ep.bookings.payment(bookingId as number)),
    enabled: Boolean(bookingId) && enabled,
    retry: false,
  });
}

export function useCancellationPreview(bookingId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['cancellationPreview', bookingId],
    queryFn: () => bookingsApi.cancellationPreview(bookingId as number),
    enabled: Boolean(bookingId) && enabled,
    staleTime: 0,
  });
}

/** All booking mutations invalidate trips, the booking itself and the calendar. */
export function useBookingMutations(reference?: string, listingId?: number) {
  const queryClient = useQueryClient();

  const invalidate = (booking?: BookingResponse) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trips });
    void queryClient.invalidateQueries({ queryKey: ['myBookings'] });
    void queryClient.invalidateQueries({ queryKey: ['hostBookings'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bookingByRef(reference ?? '') });
    if (booking) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.booking(booking.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payment(booking.id) });
      void queryClient.invalidateQueries({ queryKey: ['bookingReviews', booking.id] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews });
      void queryClient.invalidateQueries({ queryKey: ['hostDashboard'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payoutSummary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotifications });
      const listing = booking.listing?.id ?? listingId;
      if (listing) void queryClient.invalidateQueries({ queryKey: ['calendar', listing] });
    }
  };

  return {
    invalidate,
    createHold: useMutation({
      mutationFn: (payload: { body: CreateBookingRequest; idempotencyKey: string }) =>
        bookingsApi.createHold(payload.body, payload.idempotencyKey),
      onSuccess: (booking) => invalidate(booking),
    }),
    pay: useMutation({
      mutationFn: ({ id, paymentToken }: { id: number; paymentToken: string }) =>
        bookingsApi.pay(id, paymentToken),
      onSuccess: (booking) => invalidate(booking),
    }),
    cancel: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason?: string }) => bookingsApi.cancel(id, reason),
      onSuccess: (booking) => invalidate(booking),
    }),
    approve: useMutation({
      mutationFn: (id: number) => bookingsApi.approve(id),
      onSuccess: (booking) => invalidate(booking),
    }),
    decline: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason: string }) => bookingsApi.decline(id, reason),
      onSuccess: (booking) => invalidate(booking),
    }),
    hostCancel: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason: string }) => bookingsApi.hostCancel(id, reason),
      onSuccess: (booking) => invalidate(booking),
    }),
  };
}

/** `409 PRICE_CHANGED` carries the fresh quote in the problem body (architecture 11.1.1). */
export function priceChangePayload(error: unknown): { totalAmount: number } | null {
  if (!(error instanceof ApiError) || error.code !== 'PRICE_CHANGED') return null;
  const quote = (error.problem as { quote?: { priceBreakdown?: { totalAmount?: number } } }).quote;
  const total = quote?.priceBreakdown?.totalAmount;
  return typeof total === 'number' ? { totalAmount: total } : null;
}