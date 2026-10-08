import axios from 'axios';
import { ENV } from '@/config/env';
import type { TokenResponse } from '@/types/api';

/**
 * Access token lives in memory only; the rotating refresh token lives in localStorage
 * (architecture D4). One refresh at a time in this tab, and one across all tabs via
 * Web Locks, so rotation with reuse detection never logs a healthy user out.
 */
const RT_KEY = 'haven.rt.v2';
const CHANNEL_NAME = 'haven-auth.v2';
const LOCK_NAME = 'haven-refresh.v2';

let accessTokenMemory: string | null = null;
let accessExpiresAt = 0;
let channel: BroadcastChannel | null = null;

try {
  if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(CHANNEL_NAME);
} catch {
  channel = null;
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
}

export const tokens = {
  get accessToken(): string | null {
    return accessTokenMemory;
  },
  get refreshToken(): string | null {
    return readRefreshToken();
  },
  /** true when there is no usable access token, or it dies within `ms` */
  expiresWithin(ms = 30_000): boolean {
    return !accessTokenMemory || Date.now() >= accessExpiresAt - ms;
  },
  set(response: TokenResponse): void {
    accessTokenMemory = response.accessToken;
    accessExpiresAt = Date.now() + response.expiresIn * 1000;
    try {
      localStorage.setItem(RT_KEY, response.refreshToken);
    } catch {
      /* storage unavailable: the session simply will not survive a reload */
    }
    channel?.postMessage({ type: 'tokens', accessToken: response.accessToken });
  },
  setAccess(accessToken: string, expiresInSeconds: number): void {
    accessTokenMemory = accessToken;
    accessExpiresAt = Date.now() + expiresInSeconds * 1000;
  },
  clear(broadcast = true): void {
    accessTokenMemory = null;
    accessExpiresAt = 0;
    try {
      localStorage.removeItem(RT_KEY);
    } catch {
      /* ignore */
    }
    if (broadcast) channel?.postMessage({ type: 'logout' });
  },
  hasSession(): boolean {
    return Boolean(accessTokenMemory || readRefreshToken());
  },
  subscribe(onTokens: (accessToken: string) => void, onLogout: () => void): () => void {
    if (!channel) return () => undefined;
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; accessToken?: string } | undefined;
      if (data?.type === 'tokens' && data.accessToken) {
        accessTokenMemory = data.accessToken;
        onTokens(data.accessToken);
      } else if (data?.type === 'logout') {
        accessTokenMemory = null;
        accessExpiresAt = 0;
        onLogout();
      }
    };
    channel.addEventListener('message', handler);
    return () => channel?.removeEventListener('message', handler);
  },
};

type RefreshOutcome = 'refreshed' | 'expired' | 'retry-later';

let inflight: Promise<RefreshOutcome> | null = null;

/**
 * Refresh once for the whole browser profile. Returns:
 *  - `refreshed`   tokens rotated, the original request may be retried
 *  - `expired`     the refresh token is gone or was replayed: clear the session
 *  - `retry-later` network problem or 5xx: keep the tokens and try again later
 */
export function refreshOnce(): Promise<RefreshOutcome> {
  inflight ??= run().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function run(): Promise<RefreshOutcome> {
  const exec = async (): Promise<RefreshOutcome> => {
    // read INSIDE the lock: another tab may have rotated the token while we waited
    const refreshToken = readRefreshToken();
    if (!refreshToken) return 'expired';

    try {
      const response = await axios.post<TokenResponse>(
        `${ENV.API_BASE_URL}/auth/refresh`,
        { refreshToken },
        { headers: { Accept: 'application/json' } }
      );
      tokens.set(response.data);
      return 'refreshed';
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // expired, revoked or REFRESH_TOKEN_REUSED: every session is gone server-side
        tokens.clear();
        return 'expired';
      }
      return 'retry-later';
    }
  };

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, exec) as unknown as Promise<RefreshOutcome>;
  }
  return exec();
}