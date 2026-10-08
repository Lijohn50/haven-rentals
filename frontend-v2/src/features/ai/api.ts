import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/errors';
import type { AiTextResponse, PropertyType, ReviewSummaryResponse } from '@/types/api';

export const aiApi = {
  listingDescription: (payload: { propertyType: PropertyType; city: string; bullets: string[] }) =>
    api<AiTextResponse>(ep.ai.listingDescription, { method: 'post', data: payload }),
  reviewSummary: (listingId: number) => api<ReviewSummaryResponse>(ep.ai.reviewSummary(listingId)),
  tripPlan: (payload: { city: string; days: number; interests?: string[] }) =>
    api<AiTextResponse>(ep.ai.tripPlan, { method: 'post', data: payload }),
};

/** AI is a progressive enhancement: 422/503 hides the widget, never an error toast. */
export function isAiUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'AI_UNAVAILABLE' || error.code === 'SERVICE_UNAVAILABLE');
}

export function useReviewSummary(listingId: number | null, reviewCount: number) {
  return useQuery({
    queryKey: queryKeys.reviewSummary(listingId ?? 0),
    queryFn: () => aiApi.reviewSummary(listingId as number),
    enabled: Boolean(listingId) && reviewCount >= 3,
    staleTime: 60 * 60_000,
    retry: false,
  });
}

export function useListingDescriptionDraft() {
  return useMutation({
    mutationFn: (payload: { propertyType: PropertyType; city: string; bullets: string[] }) =>
      aiApi.listingDescription(payload),
  });
}

export function useTripPlan() {
  return useMutation({
    mutationFn: (payload: { city: string; days: number; interests?: string[] }) => aiApi.tripPlan(payload),
  });
}