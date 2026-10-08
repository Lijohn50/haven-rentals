import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type {
  ConversationResponse,
  MessagePageResponse,
  MessageResponse,
  SendMessageRequest,
  StartConversationRequest,
  UnreadCountResponse,
} from '@/types/api';

export const messagingApi = {
  inbox: () => api<ConversationResponse[]>(ep.conversations.list),
  conversation: (id: number) => api<ConversationResponse>(ep.conversations.get(id)),
  messages: (id: number, before?: string, limit = 50) =>
    api<MessagePageResponse>(ep.conversations.messages(id), { params: { before, limit } }),
  sendMessage: (id: number, payload: SendMessageRequest, idempotencyKey?: string) =>
    api<MessageResponse>(ep.conversations.sendMessage(id), {
      method: 'post',
      data: payload,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  startConversation: (payload: StartConversationRequest) =>
    api<ConversationResponse>(ep.conversations.create, { method: 'post', data: payload }),
  markRead: (id: number) => api<void>(ep.conversations.markRead(id), { method: 'post' }),
  unreadCount: () => api<UnreadCountResponse>(ep.conversations.unreadCount),
};

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: messagingApi.inbox,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useConversation(id: number | null) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? 0),
    queryFn: () => messagingApi.conversation(id as number),
    enabled: Boolean(id),
  });
}

/** Messages arrive newest-first; the thread renders them oldest-first. */
export function useMessages(id: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.messages(id ?? 0),
    queryFn: () => messagingApi.messages(id as number),
    enabled: Boolean(id) && enabled,
    refetchInterval: 8_000,
    staleTime: 0,
  });
}

export function useUnreadMessages(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.unreadMessages,
    queryFn: messagingApi.unreadCount,
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartConversationRequest) => messagingApi.startConversation(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadMessages });
    },
  });
}

export function useSendMessage(conversationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; idempotencyKey: string }) =>
      messagingApi.sendMessage(conversationId, { body: payload.body }, payload.idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => messagingApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadMessages });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}