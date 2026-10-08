import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { ENV } from '@/config/env';
import { normalizeError, ApiError } from './errors';
import { refreshOnce, tokens } from './tokens';

export const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 20000,
  headers: { Accept: 'application/json' },
  // Spring binds `List<Long> amenityIds` from repeated keys, not from `amenityIds[]=1`.
  paramsSerializer: {
    serialize: (params: Record<string, unknown>) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        if (Array.isArray(value)) value.forEach((entry) => search.append(key, String(entry)));
        else search.append(key, String(value));
      }
      return search.toString();
    },
  },
});

/**
 * Offsets the browser clock from the server clock using the `Date` response header, so
 * hold and payout countdowns stay honest when the two clocks disagree (document C4).
 */
let serverOffsetMs = 0;

export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

function recordServerDate(header: unknown): void {
  if (typeof header !== 'string') return;
  const serverMs = Date.parse(header);
  if (Number.isNaN(serverMs)) return;
  const offset = serverMs - Date.now();
  // ignore nonsense values from misconfigured proxies
  if (Math.abs(offset) < 5 * 60_000) serverOffsetMs = offset;
}

const AUTH_FREE_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/verify-email'];

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const path = config.url ?? '';
  if (!AUTH_FREE_PATHS.some((p) => path.includes(p)) && tokens.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    recordServerDate(response.headers?.['date']);
    return response;
  },
  async (error) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.headers?.['date']) recordServerDate(error.response.headers['date']);

    const status = error.response?.status;
    const code = (error.response?.data as { code?: string } | undefined)?.code;
    const isAuthCall = AUTH_FREE_PATHS.some((p) => (original?.url ?? '').includes(p));

    // reactive refresh: exactly once, and only for a genuine session failure
    if (status === 401 && code === 'UNAUTHENTICATED' && original && !original._retried && !isAuthCall) {
      original._retried = true;
      const outcome = await refreshOnce();
      if (outcome === 'refreshed') {
        original.headers = { ...original.headers, Authorization: `Bearer ${tokens.accessToken}` };
        return apiClient(original);
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

export interface ApiOptions {
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Thin typed wrapper so hooks never touch axios directly. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'get', params, data, headers, signal } = options;
  const response = await apiClient.request<T>({
    url: path,
    method,
    params,
    data,
    signal,
    headers,
  });
  return response.data;
}

export { ApiError };