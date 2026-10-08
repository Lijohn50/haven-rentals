import axios from 'axios';
import type { FieldError, ProblemDetail } from '@/types/api';

/**
 * Every non-2xx response becomes one of these. Screens switch on `code`, never on `detail`
 * (architecture 4.5 / 14.1).
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly detail: string;
  public readonly fieldErrors: FieldError[];
  public readonly traceId?: string;
  public readonly retryAfter: number;
  public readonly problem: ProblemDetail;

  constructor(
    status: number,
    code: string,
    problem: ProblemDetail,
    retryAfter = 60
  ) {
    super(problem.detail || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.problem = problem;
    this.detail = problem.detail || problem.title || 'Something went wrong.';
    this.fieldErrors = problem.fieldErrors ?? [];
    this.traceId = problem.traceId;
    this.retryAfter = retryAfter;
  }

  /** true when the failure is worth offering a "Try again" button */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data as ProblemDetail | undefined;

    // Retry-After is only readable when the backend exposes it through CORS (document C4).
    const retryHeader = error.response?.headers?.['retry-after'];
    const parsed = Number(retryHeader);
    const retryAfter = Number.isFinite(parsed) && parsed > 0 ? parsed : 60;

    if (data && typeof data === 'object') {
      return new ApiError(
        status,
        data.code || `HTTP_${status}`,
        data,
        retryAfter
      );
    }

    if (error.code === 'ERR_NETWORK') {
      return new ApiError(
        0,
        'NETWORK_ERROR',
        {
          status: 0,
          title: 'Network error',
          detail: 'You appear to be offline. Check your connection and try again.',
        },
        5
      );
    }

    return new ApiError(
      status,
      `HTTP_${status}`,
      {
        status,
        title: 'Request failed',
        detail: error.message || 'The server returned an unexpected response.',
      },
      retryAfter
    );
  }

  if (error instanceof Error) {
    return new ApiError(500, 'INTERNAL_ERROR', {
      status: 500,
      title: 'Unexpected error',
      detail: error.message,
    });
  }

  return new ApiError(500, 'INTERNAL_ERROR', {
    status: 500,
    title: 'Unexpected error',
    detail: 'An unknown error occurred.',
  });
}

/** Human sentence for anything thrown by a mutation or query. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.detail || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export function traceLine(error: unknown): string | null {
  return error instanceof ApiError && error.traceId ? `Reference: ${error.traceId}` : null;
}