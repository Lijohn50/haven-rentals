import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type {
  CreateReviewRequest,
  PendingReviewResponse,
  PayoutResponse,
  PayoutSummaryResponse,
  PageResponse,
  PayoutStatus,
  RefundResponse,
  ReviewResponse,
} from '@/types/api';

export const reviewsApi = {
  create: (bookingId: number, payload: CreateReviewRequest) =>
    api<ReviewResponse>(ep.bookings.reviews(bookingId), { method: 'post', data: payload }),
  forBooking: (bookingId: number) => api<ReviewResponse[]>(ep.bookings.reviews(bookingId)),
  pending: () => api<PendingReviewResponse[]>(ep.reviews.pending),
  removeByAdmin: (reviewId: number, reason: string) =>
    api<void>(ep.admin.review(reviewId), { method: 'delete', data: { reason } }),
};

export function usePendingReviews(enabled = true) {
  return useQuery({
    queryKey: queryKeys.pendingReviews,
    queryFn: reviewsApi.pending,
    enabled,
  });
}

export function useBookingReviews(bookingId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bookingReviews(bookingId ?? 0),
    queryFn: () => reviewsApi.forBooking(bookingId as number),
    enabled: Boolean(bookingId) && enabled,
  });
}

export function useCreateReview(bookingId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReviewRequest) => reviewsApi.create(bookingId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookingReviews(bookingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews });
      void queryClient.invalidateQueries({ queryKey: ['listingReviews'] });
      void queryClient.invalidateQueries({ queryKey: ['hostReviewExchanges'] });
    },
  });
}

export const payoutsApi = {
  list: (status?: PayoutStatus, page = 0, size = 20) =>
    api<PageResponse<PayoutResponse>>(ep.host.payouts, { params: { status, page, size } }),
  summary: () => api<PayoutSummaryResponse>(ep.host.payoutSummary),
};

export function usePayouts(status?: PayoutStatus) {
  return useQuery({
    queryKey: queryKeys.hostPayouts({ status: status ?? 'ALL' }),
    queryFn: () => payoutsApi.list(status),
    placeholderData: (previous) => previous,
  });
}

export function usePayoutSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.payoutSummary,
    queryFn: payoutsApi.summary,
    enabled,
    staleTime: 60_000,
  });
}

export type Refund = RefundResponse;