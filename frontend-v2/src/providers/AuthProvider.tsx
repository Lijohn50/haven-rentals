import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, userApi } from '@/features/auth/api';
import { refreshOnce, tokens } from '@/api/tokens';
import type { LoginRequest, Role, UserResponse } from '@/types/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: UserResponse | null;
  status: Status;
  isAuthenticated: boolean;
  hasRole: (...roles: Role[]) => boolean;
  isHost: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  signIn: (payload: LoginRequest) => Promise<UserResponse>;
  registerAndSignIn: (payload: Parameters<typeof authApi.register>[0]) => Promise<UserResponse>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<UserResponse | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const applyUser = useCallback((next: UserResponse | null) => {
    setUser(next);
    setStatus(next ? 'authenticated' : 'anonymous');
  }, []);

  const clearSession = useCallback(() => {
    tokens.clear();
    applyUser(null);
    queryClient.clear();
  }, [applyUser, queryClient]);

  // Bootstrap: a stored refresh token means a silent sign-in attempt, so guards show a
  // skeleton instead of flashing the login page (architecture 4.4).
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!tokens.hasSession()) {
        applyUser(null);
        return;
      }
      const outcome = await refreshOnce();
      if (outcome !== 'refreshed') {
        if (!cancelled) applyUser(null);
        return;
      }
      try {
        const me = await userApi.me();
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
          queryClient.setQueryData(['me'], me);
        }
      } catch {
        if (!cancelled) applyUser(null);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [applyUser, queryClient]);

  // Other tabs sign in or out; reflect it without a reload.
  useEffect(
    () =>
      tokens.subscribe(
        (accessToken) => {
          void userApi
            .me()
            .then((me) => {
              setUser(me);
              setStatus('authenticated');
            })
            .catch(() => undefined)
            .finally(() => undefined);
          void accessToken;
        },
        () => {
          applyUser(null);
          queryClient.clear();
        }
      ),
    [applyUser, queryClient]
  );

  const signIn = useCallback(
    async (payload: LoginRequest) => {
      const response = await authApi.login(payload);
      tokens.set(response);
      setUser(response.user);
      setStatus('authenticated');
      queryClient.setQueryData(['me'], response.user);
      return response.user;
    },
    [queryClient]
  );

  const registerAndSignIn = useCallback(
    async (payload: Parameters<typeof authApi.register>[0]) => {
      await authApi.register(payload);
      // Login works before email verification, so the app signs the new user straight in.
      return signIn({ email: payload.email, password: payload.password });
    },
    [signIn]
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokens.refreshToken;
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      /* the local session is cleared regardless */
    }
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    if (!tokens.accessToken) return null;
    try {
      const me = await userApi.me();
      setUser(me);
      setStatus('authenticated');
      queryClient.setQueryData(['me'], me);
      return me;
    } catch {
      return null;
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      hasRole: (...roles: Role[]) => Boolean(user?.roles.some((role) => roles.includes(role))),
      isHost: Boolean(user?.roles.includes('HOST')),
      isAdmin: Boolean(user?.roles.includes('ADMIN')),
      isStaff: Boolean(user?.roles.includes('SUPPORT_AGENT') || user?.roles.includes('ADMIN')),
      signIn,
      registerAndSignIn,
      signOut,
      refreshUser,
    }),
    [user, status, signIn, registerAndSignIn, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}