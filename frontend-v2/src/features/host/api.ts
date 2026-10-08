import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { guarded, hostDashboardSchema } from '@/api/guards';
import type {
  AdminReviewResponse,
  AdminSummaryResponse,
  AdminUserResponse,
  AmenityRequest,
  AmenityResponse,
  AuditLogResponse,
  BookingResponse,
  CommissionSettingRequest,
  CommissionSettingResponse,
  HostDashboardResponse,
  ListingResponse,
  ListingMetricsResponse,
  ListingSummaryResponse,
  PageResponse,
  ReasonRequest,
  Role,
  RolesRequest,
  ReviewExchangeResponse,
  ReviewResponse,
  ReviewSort,
  ReviewStatus,
  UserStatus,
} from '@/types/api';

/* ------------------------------------------------------------------- host */

export const hostApi = {
  dashboard: (from: string, to: string) =>
    api<HostDashboardResponse>(ep.host.dashboard, { params: { from, to } }).then((response) =>
      guarded('hostDashboard', hostDashboardSchema, response)
    ),
  listingMetrics: (from: string, to: string) =>
    api<ListingMetricsResponse[]>(ep.host.dashboardListings, { params: { from, to } }),
};

export function useHostDashboard(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.hostDashboard(from, to),
    queryFn: () => hostApi.dashboard(from, to),
    enabled,
    staleTime: 60_000,
  });
}

export function useHostListingMetrics(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.hostListingMetrics(from, to),
    queryFn: () => hostApi.listingMetrics(from, to),
    enabled,
    staleTime: 60_000,
  });
}

/* ------------------------------------------------------------------ admin */

export const adminApi = {
  summary: (from: string, to: string) =>
    api<AdminSummaryResponse>(ep.admin.summary, { params: { from, to } }),
  pendingListings: (page = 0, size = 20) =>
    api<PageResponse<ListingSummaryRow>>(ep.admin.pendingListings, { params: { page, size } }),
  listing: (id: number) => api<ListingResponse>(ep.admin.listing(id)),
  approveListing: (id: number) => api<ListingResponse>(ep.admin.approveListing(id), { method: 'post' }),
  rejectListing: (id: number, reason: string) =>
    api<ListingResponse>(ep.admin.rejectListing(id), { method: 'post', data: { reason } }),
  suspendListing: (id: number, reason: string) =>
    api<ListingResponse>(ep.admin.suspendListing(id), { method: 'post', data: { reason } }),
  reinstateListing: (id: number) =>
    api<ListingResponse>(ep.admin.reinstateListing(id), { method: 'post' }),
  users: (params: { query?: string; role?: Role; status?: UserStatus; page?: number; size?: number }) =>
    api<PageResponse<AdminUserResponse>>(ep.admin.users, { params }),
  user: (id: number) => api<AdminUserResponse>(ep.admin.user(id)),
  suspendUser: (id: number, reason: string) =>
    api<AdminUserResponse>(ep.admin.suspendUser(id), { method: 'post', data: { reason } }),
  unsuspendUser: (id: number) => api<AdminUserResponse>(ep.admin.unsuspendUser(id), { method: 'post' }),
  setRoles: (id: number, roles: Role[]) =>
    api<AdminUserResponse>(ep.admin.userRoles(id), { method: 'patch', data: { roles } }),
  deleteUser: (id: number, reason: string) =>
    api<AdminUserResponse>(ep.admin.user(id), { method: 'delete', data: { reason } }),
  booking: (id: number) => api<BookingResponse>(ep.admin.booking(id)),
  bookingByReference: (reference: string) =>
    api<BookingResponse>(ep.admin.bookingByReference(reference)),
  audit: (params: {
    actor?: number;
    entityType?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  }) => api<PageResponse<AuditLogResponse>>(ep.admin.audit, { params }),
  commissionHistory: (page = 0, size = 20) =>
    api<PageResponse<CommissionSettingResponse>>(ep.admin.commissionSettings, { params: { page, size } }),
  createCommission: (payload: CommissionSettingRequest) =>
    api<CommissionSettingResponse>(ep.admin.commissionSettings, { method: 'post', data: payload }),
  amenities: () => api<AmenityResponse[]>(ep.amenities),
  createAmenity: (payload: AmenityRequest) =>
    api<AmenityResponse>(ep.admin.amenities, { method: 'post', data: payload }),
  updateAmenity: (id: number, payload: AmenityRequest) =>
    api<AmenityResponse>(ep.admin.amenity(id), { method: 'put', data: payload }),
  deleteAmenity: (id: number) => api<void>(ep.admin.amenity(id), { method: 'delete' }),
};

type ListingSummaryRow = ListingSummaryResponse;

export function useAdminSummary(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.adminSummary(from, to),
    queryFn: () => adminApi.summary(from, to),
    staleTime: 60_000,
  });
}

export function useAdminPendingListings(page = 0) {
  return useQuery({
    queryKey: queryKeys.adminPendingListings(page),
    queryFn: () => adminApi.pendingListings(page),
    placeholderData: (previous) => previous,
  });
}

export function useAdminListing(id: number | null) {
  return useQuery({
    queryKey: queryKeys.adminListing(id ?? 0),
    queryFn: () => adminApi.listing(id as number),
    enabled: Boolean(id),
  });
}

export function useAdminUsers(params: { query?: string; role?: Role; status?: UserStatus; page?: number }) {
  return useQuery({
    queryKey: queryKeys.adminUsers(params),
    queryFn: () => adminApi.users(params),
    placeholderData: (previous) => previous,
  });
}

export function useAdminUser(id: number | null) {
  return useQuery({
    queryKey: queryKeys.adminUser(id ?? 0),
    queryFn: () => adminApi.user(id as number),
    enabled: Boolean(id),
  });
}

export function useAdminBooking(id: number | null) {
  return useQuery({
    queryKey: queryKeys.adminBooking(id ?? 0),
    queryFn: () => adminApi.booking(id as number),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useAdminBookingByReference(reference: string | null) {
  return useQuery({
    queryKey: queryKeys.adminBookingByRef(reference ?? ''),
    queryFn: () => adminApi.bookingByReference(reference as string),
    enabled: Boolean(reference),
    retry: false,
  });
}

const hostReviewsApi = {
  list: (sort?: ReviewSort, page = 0, size = 20) =>
    api<PageResponse<ReviewResponse>>(ep.host.reviews, { params: { sort, page, size } }),
  exchanges: () => api<ReviewExchangeResponse[]>(ep.host.reviewExchanges),
};

export function useHostReviews(sort: ReviewSort = 'NEWEST', page = 0) {
  return useQuery({
    queryKey: queryKeys.hostReviews({ sort, page }),
    queryFn: () => hostReviewsApi.list(sort, page),
    placeholderData: (previous) => previous,
  });
}

export function useHostReviewExchanges(enabled = true) {
  return useQuery({
    queryKey: queryKeys.hostReviewExchanges,
    queryFn: hostReviewsApi.exchanges,
    enabled,
    staleTime: 60_000,
  });
}

const adminReviewsApi = {
  list: (status?: ReviewStatus, query?: string, page = 0, size = 20) =>
    api<PageResponse<AdminReviewResponse>>(ep.reviews.adminReviews, {
      params: { status, query, page, size },
    }),
};

export function useAdminReviews(status?: ReviewStatus, query?: string, page = 0) {
  return useQuery({
    queryKey: queryKeys.adminReviews({ status: status ?? 'ALL', query: query ?? '', page }),
    queryFn: () => adminReviewsApi.list(status, query, page),
    placeholderData: (previous) => previous,
  });
}

export function useAuditLog(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.auditLog(params),
    queryFn: () => adminApi.audit(params),
    placeholderData: (previous) => previous,
  });
}

export function useCommissionHistory(page = 0) {
  return useQuery({
    queryKey: queryKeys.commission(page),
    queryFn: () => adminApi.commissionHistory(page),
    placeholderData: (previous) => previous,
  });
}

export function useAdminMutations() {
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['adminPendingListings'] });
    void queryClient.invalidateQueries({ queryKey: ['adminListing'] });
    void queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    void queryClient.invalidateQueries({ queryKey: ['adminUser'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.commission(0) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.amenities });
    void queryClient.invalidateQueries({ queryKey: ['listing'] });
    void queryClient.invalidateQueries({ queryKey: ['search'] });
  };

  return {
    invalidateAll,
    approveListing: useMutation({
      mutationFn: (id: number) => adminApi.approveListing(id),
      onSuccess: invalidateAll,
    }),
    rejectListing: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason: string }) => adminApi.rejectListing(id, reason),
      onSuccess: invalidateAll,
    }),
    suspendListing: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason: string }) => adminApi.suspendListing(id, reason),
      onSuccess: invalidateAll,
    }),
    reinstateListing: useMutation({
      mutationFn: (id: number) => adminApi.reinstateListing(id),
      onSuccess: invalidateAll,
    }),
    suspendUser: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason: string }) => adminApi.suspendUser(id, reason),
      onSuccess: invalidateAll,
    }),
    unsuspendUser: useMutation({
      mutationFn: (id: number) => adminApi.unsuspendUser(id),
      onSuccess: invalidateAll,
    }),
    setRoles: useMutation({
      mutationFn: ({ id, roles }: { id: number; roles: Role[] }) => adminApi.setRoles(id, roles),
      onSuccess: invalidateAll,
    }),
    deleteUser: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason: string }) => adminApi.deleteUser(id, reason),
      onSuccess: invalidateAll,
    }),
    createCommission: useMutation({
      mutationFn: (payload: CommissionSettingRequest) => adminApi.createCommission(payload),
      onSuccess: invalidateAll,
    }),
    createAmenity: useMutation({
      mutationFn: (payload: AmenityRequest) => adminApi.createAmenity(payload),
      onSuccess: invalidateAll,
    }),
    updateAmenity: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: AmenityRequest }) =>
        adminApi.updateAmenity(id, payload),
      onSuccess: invalidateAll,
    }),
    deleteAmenity: useMutation({
      mutationFn: (id: number) => adminApi.deleteAmenity(id),
      onSuccess: invalidateAll,
    }),
  };
}

export type { ReasonRequest, RolesRequest };