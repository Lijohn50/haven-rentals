import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { NotificationResponse, PageResponse, UnreadCountResponse } from '@/types/api';

export interface NotificationParams {
  unreadOnly?: boolean;
  page?: number;
  size?: number;
}

export const notificationsApi = {
  list: (params: NotificationParams) =>
    api<PageResponse<NotificationResponse>>(ep.notifications.list, { params: { ...params } }),
  unreadCount: () => api<UnreadCountResponse>(ep.notifications.unreadCount),
  markRead: (id: number) => api<void>(`${ep.notifications.markRead(id)}`, { method: 'patch' }),
  markAllRead: () => api<void>(ep.notifications.markAllRead, { method: 'patch' }),
};

export function useNotifications(params: NotificationParams) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () => notificationsApi.list(params),
    staleTime: 30_000,
  });
}

export function useUnreadNotifications(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: notificationsApi.unreadCount,
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications({}) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotifications });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications({}) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotifications });
    },
  });
}