import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ep } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { guarded, tokenResponseSchema } from '@/api/guards';
import { tokens } from '@/api/tokens';
import { refreshOnce } from '@/api/tokens';
import type {
  BecomeHostRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  LoginRequest,
  PublicHostResponse,
  RegisterRequest,
  TokenResponse,
  UpdateProfileRequest,
  UserResponse,
} from '@/types/api';

/* ------------------------------------------------------------------- calls */

export const authApi = {
  register: (payload: RegisterRequest) => api<UserResponse>(ep.auth.register, { method: 'post', data: payload }),

  login: (payload: LoginRequest) =>
    api<TokenResponse>(ep.auth.login, {
      method: 'post',
      data: payload,
    }).then((response) => guarded('login', tokenResponseSchema, response)),

  refresh: (refreshToken: string) =>
    api<TokenResponse>(ep.auth.refresh, { method: 'post', data: { refreshToken } }),

  logout: (refreshToken: string) =>
    api<void>(ep.auth.logout, { method: 'post', data: { refreshToken } }),

  verifyEmail: (token: string) =>
    api<void>(ep.auth.verifyEmail, { method: 'post', data: { token } }),

  resendVerification: (email: string) =>
    api<void>(ep.auth.resendVerification, { method: 'post', data: { email } }),

  forgotPassword: (email: string) =>
    api<void>(ep.auth.forgotPassword, { method: 'post', data: { email } }),

  resetPassword: (token: string, newPassword: string) =>
    api<void>(ep.auth.resetPassword, { method: 'post', data: { token, newPassword } }),

  changePassword: (payload: ChangePasswordRequest) =>
    api<void>(ep.auth.changePassword, { method: 'post', data: payload }),
};

export const userApi = {
  me: () => api<UserResponse>(ep.me.get),
  updateProfile: (payload: UpdateProfileRequest) =>
    api<UserResponse>(ep.me.update, { method: 'patch', data: payload }),
  becomeHost: (payload: BecomeHostRequest) =>
    api<UserResponse>(ep.me.becomeHost, { method: 'post', data: payload }),
  deleteAccount: (payload: DeleteAccountRequest) =>
    api<void>(ep.me.remove, { method: 'delete', data: payload }),
  publicProfile: (userId: number) => api<PublicHostResponse>(ep.hostProfile(userId)),
};

/* ------------------------------------------------------------------- hooks */

export function useMe() {
  return useQuery<UserResponse>({
    queryKey: queryKeys.me,
    queryFn: userApi.me,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useHostProfile(userId: number, enabled = true) {
  return useQuery<PublicHostResponse>({
    queryKey: queryKeys.hostProfile(userId),
    queryFn: () => userApi.publicProfile(userId),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfileRequest) => userApi.updateProfile(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

export function useBecomeHost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BecomeHostRequest) => userApi.becomeHost(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordRequest) => authApi.changePassword(payload),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (payload: DeleteAccountRequest) => userApi.deleteAccount(payload),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: { token: string; newPassword: string }) =>
      authApi.resetPassword(payload.token, payload.newPassword),
  });
}

export { tokens, refreshOnce };