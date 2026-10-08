import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { guarded, quoteResponseSchema } from '@/api/guards';
import { availabilityApi } from '@/features/search/api';
import type {
  AmenityResponse,
  CalendarResponse,
  ListingResponse,
  ListingSummaryResponse,
  PageResponse,
  PhotoOrderRequest,
  PhotoResponse,
  PhotoLinkRequest,
  QuoteResponse,
  ReviewResponse,
  ReviewSort,
  HouseRulesRequest,
  UpdateAmenitiesRequest,
  BlockRequest,
  BlockResponse,
  SeasonalRateRequest,
  SeasonalRateResponse,
  PublicHostResponse,
} from '@/types/api';

export const listingsApi = {
  get: (id: number) => api<ListingResponse>(ep.listing.get(id)),
  hostListings: (status?: string, page = 0, size = 50) =>
    api<PageResponse<ListingSummaryResponse>>(ep.host.listings, {
      params: { status, page, size },
    }),
  hostListing: (id: number) => api<ListingResponse>(ep.host.listing(id)),
  createDraft: (payload: unknown) => api<ListingResponse>(ep.host.createListing, { method: 'post', data: payload }),
  update: (id: number, payload: unknown) =>
    api<ListingResponse>(ep.host.updateListing(id), { method: 'put', data: payload }),
  remove: (id: number) => api<void>(ep.host.deleteListing(id), { method: 'delete' }),
  submit: (id: number) => api<void>(ep.host.submit(id), { method: 'post' }),
  pause: (id: number) => api<void>(ep.host.pause(id), { method: 'post' }),
  resume: (id: number) => api<void>(ep.host.resume(id), { method: 'post' }),
  setAmenities: (id: number, payload: UpdateAmenitiesRequest) =>
    api<ListingResponse>(ep.host.amenities(id), { method: 'put', data: payload }),
  setHouseRules: (id: number, payload: HouseRulesRequest) =>
    api<ListingResponse>(ep.host.houseRules(id), { method: 'put', data: payload }),
  uploadPhoto: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<PhotoResponse>(ep.host.photos(id), { method: 'post', data: form });
  },
  reorderPhotos: (id: number, payload: PhotoOrderRequest) =>
    api<void>(ep.host.photoOrder(id), { method: 'put', data: payload }),
  setCover: (id: number, photoId: number) =>
    api<void>(ep.host.photoCover(id, photoId), { method: 'patch' }),
  addPhotoLink: (id: number, payload: PhotoLinkRequest) =>
    api<PhotoResponse>(ep.host.photoLink(id), { method: 'post', data: payload }),
  deletePhoto: (id: number, photoId: number) =>
    api<void>(`${ep.host.photos(id)}/${photoId}`, { method: 'delete' }),
  reviews: (id: number, sort: ReviewSort = 'NEWEST', page = 0, size = 20) =>
    api<PageResponse<ReviewResponse>>(ep.listing.reviews(id), { params: { sort, page, size } }),
  blocks: (id: number) => api<BlockResponse[]>(ep.host.blocks(id)),
  createBlock: (id: number, payload: BlockRequest) =>
    api<BlockResponse>(ep.host.blocks(id), { method: 'post', data: payload }),
  deleteBlock: (id: number, blockId: number) =>
    api<void>(ep.host.block(id, blockId), { method: 'delete' }),
  seasonalRates: (id: number) => api<SeasonalRateResponse[]>(ep.host.seasonalRates(id)),
  createSeasonalRate: (id: number, payload: SeasonalRateRequest) =>
    api<SeasonalRateResponse>(ep.host.seasonalRates(id), { method: 'post', data: payload }),
  updateSeasonalRate: (id: number, rateId: number, payload: SeasonalRateRequest) =>
    api<SeasonalRateResponse>(ep.host.seasonalRate(id, rateId), { method: 'put', data: payload }),
  deleteSeasonalRate: (id: number, rateId: number) =>
    api<void>(ep.host.seasonalRate(id, rateId), { method: 'delete' }),
  hostProfile: (userId: number) => api<PublicHostResponse>(ep.hostProfile(userId)),
};

export const pricingApi = {
  quote: (listingId: number, checkIn: string, checkOut: string, guests: number) =>
    api<QuoteResponse>(ep.listing.quote(listingId), {
      params: { checkIn, checkOut, guests },
    }).then((response) => guarded('quote', quoteResponseSchema, response)),
};

export function useListing(id: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.listing(id ?? 0),
    queryFn: () => listingsApi.get(id as number),
    enabled: Boolean(id) && enabled,
    staleTime: 60_000,
  });
}

export function useHostListing(id: number | null) {
  return useQuery({
    queryKey: queryKeys.hostListing(id ?? 0),
    queryFn: () => listingsApi.hostListing(id as number),
    enabled: Boolean(id),
  });
}

export function useHostListings(status?: string) {
  return useQuery({
    queryKey: queryKeys.hostListings(status),
    queryFn: () => listingsApi.hostListings(status),
    placeholderData: (previous) => previous,
  });
}

/** Prices and availability are never served from cache (architecture 4.6). */
export function useQuote(
  listingId: number | null,
  params: { checkIn?: string; checkOut?: string; guests: number },
  enabled: boolean
) {
  return useQuery({
    queryKey: queryKeys.quote(listingId ?? 0, params.checkIn ?? '', params.checkOut ?? '', params.guests),
    queryFn: () => pricingApi.quote(listingId as number, params.checkIn as string, params.checkOut as string, params.guests),
    enabled: Boolean(listingId) && enabled && Boolean(params.checkIn) && Boolean(params.checkOut),
    staleTime: 0,
    retry: false,
  });
}

export function useCalendar(
  listingId: number | null,
  from: string,
  to: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.calendar(listingId ?? 0, from, to),
    queryFn: () => availabilityApi.calendar(listingId as number, from, to),
    enabled: Boolean(listingId) && enabled,
    staleTime: 0,
    retry: false,
  });
}

export function useListingReviews(id: number | null, sort: ReviewSort, page: number) {
  return useQuery({
    queryKey: queryKeys.listingReviews(id ?? 0, sort, page),
    queryFn: () => listingsApi.reviews(id as number, sort, page),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useBlocks(listingId: number | null) {
  return useQuery({
    queryKey: queryKeys.blocks(listingId ?? 0),
    queryFn: () => listingsApi.blocks(listingId as number),
    enabled: Boolean(listingId),
  });
}

export function useSeasonalRates(listingId: number | null) {
  return useQuery({
    queryKey: queryKeys.seasonalRates(listingId ?? 0),
    queryFn: () => listingsApi.seasonalRates(listingId as number),
    enabled: Boolean(listingId),
  });
}

/** Every listing mutation invalidates the listing module and search (architecture 14.6). */
export function useListingMutations(listingId?: number) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['hostListings'] });
    void queryClient.invalidateQueries({ queryKey: ['hostListing'] });
    void queryClient.invalidateQueries({ queryKey: ['listing'] });
    void queryClient.invalidateQueries({ queryKey: ['search'] });
    if (listingId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.blocks(listingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasonalRates(listingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar(listingId, '', '') });
    }
  };

  return {
    invalidate,
    createDraft: useMutation({
      mutationFn: (payload: unknown) => listingsApi.createDraft(payload),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: unknown }) => listingsApi.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: number) => listingsApi.remove(id),
      onSuccess: invalidate,
    }),
    submit: useMutation({
      mutationFn: (id: number) => listingsApi.submit(id),
      onSuccess: invalidate,
    }),
    pause: useMutation({
      mutationFn: (id: number) => listingsApi.pause(id),
      onSuccess: invalidate,
    }),
    resume: useMutation({
      mutationFn: (id: number) => listingsApi.resume(id),
      onSuccess: invalidate,
    }),
    setAmenities: useMutation({
      mutationFn: ({ id, amenityIds }: { id: number; amenityIds: number[] }) =>
        listingsApi.setAmenities(id, { amenityIds }),
      onSuccess: invalidate,
    }),
    setHouseRules: useMutation({
      mutationFn: ({ id, rules }: { id: number; rules: { text: string; sortOrder: number }[] }) =>
        listingsApi.setHouseRules(id, { rules }),
      onSuccess: invalidate,
    }),
    uploadPhoto: useMutation({
      mutationFn: ({ id, file }: { id: number; file: File }) => listingsApi.uploadPhoto(id, file),
      onSuccess: invalidate,
    }),
    reorderPhotos: useMutation({
      mutationFn: ({ id, photoIds }: { id: number; photoIds: number[] }) =>
        listingsApi.reorderPhotos(id, { photoIds }),
      onSuccess: invalidate,
    }),
    setCover: useMutation({
      mutationFn: ({ id, photoId }: { id: number; photoId: number }) => listingsApi.setCover(id, photoId),
      onSuccess: invalidate,
    }),
    addPhotoLink: useMutation({
      mutationFn: ({ id, ...payload }: PhotoLinkRequest & { id: number }) =>
        listingsApi.addPhotoLink(id, payload),
      onSuccess: invalidate,
    }),
    deletePhoto: useMutation({
      mutationFn: ({ id, photoId }: { id: number; photoId: number }) => listingsApi.deletePhoto(id, photoId),
      onSuccess: invalidate,
    }),
    createBlock: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: BlockRequest }) =>
        listingsApi.createBlock(id, payload),
      onSuccess: invalidate,
    }),
    deleteBlock: useMutation({
      mutationFn: ({ id, blockId }: { id: number; blockId: number }) => listingsApi.deleteBlock(id, blockId),
      onSuccess: invalidate,
    }),
    createSeasonalRate: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: SeasonalRateRequest }) =>
        listingsApi.createSeasonalRate(id, payload),
      onSuccess: invalidate,
    }),
    updateSeasonalRate: useMutation({
      mutationFn: ({ id, rateId, payload }: { id: number; rateId: number; payload: SeasonalRateRequest }) =>
        listingsApi.updateSeasonalRate(id, rateId, payload),
      onSuccess: invalidate,
    }),
    deleteSeasonalRate: useMutation({
      mutationFn: ({ id, rateId }: { id: number; rateId: number }) => listingsApi.deleteSeasonalRate(id, rateId),
      onSuccess: invalidate,
    }),
  };
}

export type Amenity = AmenityResponse;
export type Photo = PhotoResponse;
export type Calendar = CalendarResponse;