import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { AmenityResponse, CalendarResponse, SearchParams, SearchResultResponse, PageResponse } from '@/types/api';

export function toApiParams(params: SearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

export const searchApi = {
  search: (params: SearchParams) =>
    api<PageResponse<SearchResultResponse>>(ep.search.list, { params: toApiParams(params) }),
  citySuggestions: (prefix: string, limit = 8) =>
    api<{ city: string; country: string; listingCount: number }[]>(ep.search.citySuggestions, {
      params: { prefix, limit },
    }),
};

export const amenitiesApi = {
  list: () => api<AmenityResponse[]>(ep.amenities),
};

export function useSearch(params: SearchParams) {
  return useQuery({
    queryKey: queryKeys.search(params),
    queryFn: () => searchApi.search(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useCitySuggestions(prefix: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.citySuggestions(prefix),
    queryFn: () => searchApi.citySuggestions(prefix),
    enabled: enabled && prefix.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function useAmenities() {
  return useQuery({
    queryKey: queryKeys.amenities,
    queryFn: amenitiesApi.list,
    staleTime: 60 * 60_000,
  });
}

export const availabilityApi = {
  calendar: (listingId: number, from: string, to: string) =>
    api<CalendarResponse>(ep.listing.calendar(listingId), { params: { from, to } }),
};