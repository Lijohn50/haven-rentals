import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type {
  BookingStatus,
  CreateDisputeRequest,
  DisputeResponse,
  DisputeStatus,
  PageResponse,
  ResolveDisputeRequest,
  RejectDisputeRequest,
  SupportDisputeDetailResponse,
} from '@/types/api';

export const disputesApi = {
  create: (bookingId: number, payload: CreateDisputeRequest) =>
    api<DisputeResponse>(ep.bookings.disputes(bookingId), { method: 'post', data: payload }),
  mine: (page = 0, size = 20) => api<PageResponse<DisputeResponse>>(ep.disputes.mine, { params: { page, size } }),
  supportQueue: (status?: DisputeStatus, page = 0, size = 20) =>
    api<PageResponse<DisputeResponse>>(ep.support.disputes, { params: { status, page, size } }),
  supportDetail: (id: number) => api<SupportDisputeDetailResponse>(ep.support.dispute(id)),
  assign: (id: number) => api<DisputeResponse>(ep.support.assign(id), { method: 'patch' }),
  resolve: (id: number, payload: ResolveDisputeRequest) =>
    api<DisputeResponse>(ep.support.resolve(id), { method: 'post', data: payload }),
  reject: (id: number, payload: RejectDisputeRequest) =>
    api<DisputeResponse>(ep.support.reject(id), { method: 'post', data: payload }),
};

export function useMyDisputes(page = 0, enabled = true) {
  return useQuery({
    queryKey: queryKeys.myDisputes(page),
    queryFn: () => disputesApi.mine(page),
    enabled,
  });
}

export function useOpenDispute(bookingId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDisputeRequest) => disputesApi.create(bookingId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['myDisputes'] });
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

export function useSupportDisputes(status?: DisputeStatus, page = 0) {
  return useQuery({
    queryKey: queryKeys.supportDisputes({ status: status ?? 'ALL', page }),
    queryFn: () => disputesApi.supportQueue(status, page),
    placeholderData: (previous) => previous,
  });
}

/**
 * Every load of a case writes an audit entry, so this query must never poll, refetch on
 * focus, or prefetch (architecture 13.1).
 */
export function useSupportDispute(id: number | null) {
  return useQuery({
    queryKey: queryKeys.supportDispute(id ?? 0),
    queryFn: () => disputesApi.supportDetail(id as number),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useSupportDisputeMutations(id: number | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.supportDispute(id) });
    void queryClient.invalidateQueries({ queryKey: ['supportDisputes'] });
    void queryClient.invalidateQueries({ queryKey: ['hostDashboard'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.payoutSummary });
  };

  return {
    assign: useMutation({
      mutationFn: (disputeId: number) => disputesApi.assign(disputeId),
      onSuccess: invalidate,
    }),
    resolve: useMutation({
      mutationFn: ({ disputeId, payload }: { disputeId: number; payload: ResolveDisputeRequest }) =>
        disputesApi.resolve(disputeId, payload),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: ({ disputeId, payload }: { disputeId: number; payload: RejectDisputeRequest }) =>
        disputesApi.reject(disputeId, payload),
      onSuccess: invalidate,
    }),
  };
}

export type { BookingStatus };