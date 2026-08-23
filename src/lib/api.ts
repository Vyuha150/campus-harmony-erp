import axios, { AxiosError } from 'axios';

/**
 * Shared API client.
 *
 * The previous version had a request interceptor and NO response interceptor.
 * When the 24-hour JWT expired, every request returned 401 and the application
 * never noticed: the user was left inside a logged-in shell where every action
 * failed silently, with no message and no redirect, until they manually
 * reloaded the page.
 *
 * A response interceptor now handles 401 centrally, and errors are normalised
 * so components get a usable message instead of "Something went wrong".
 */

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

/** Key under which the auth token is stored. Single definition. */
export const TOKEN_STORAGE_KEY = 'token';

/**
 * Notifies the app that the session ended so React state can be cleared.
 * AuthContext subscribes to this; a hard redirect alone would lose that state.
 */
export const SESSION_EXPIRED_EVENT = 'campus-harmony:session-expired';

/** Shape of the backend's error contract (see backend/src/middleware/errorHandler.ts). */
export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  requestId?: string;
}

/**
 * Error carrying the backend's structured detail.
 *
 * `message` is safe to show a user: the backend deliberately returns a
 * human-readable message and keeps internal detail in its logs.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;
  readonly retryable: boolean;
  /** Quote this in a bug report — it correlates to the server-side log line. */
  readonly requestId?: string;

  constructor(payload: ApiErrorPayload, status?: number) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.status = status;
    this.details = payload.details;
    this.retryable = payload.retryable ?? false;
    this.requestId = payload.requestId;
  }
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: ApiErrorPayload; message?: string }>) => {
    const status = error.response?.status;

    // Session ended — clear credentials and tell the app, once and centrally.
    if (status === 401) {
      const hadToken = localStorage.getItem(TOKEN_STORAGE_KEY) !== null;
      localStorage.removeItem(TOKEN_STORAGE_KEY);

      // Only announce expiry for users who were actually logged in, so a failed
      // login attempt does not fire a spurious "session expired" notice.
      if (hadToken) {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }

    // Network / timeout: no response was received at all.
    if (!error.response) {
      return Promise.reject(
        new ApiError({
          code: 'NETWORK_ERROR',
          message:
            'Could not reach the server. Check your connection and try again.',
          retryable: true
        })
      );
    }

    const payload = error.response.data?.error;
    if (payload) {
      return Promise.reject(new ApiError(payload, status));
    }

    // Fallback for any endpoint not yet migrated to the structured contract.
    return Promise.reject(
      new ApiError(
        {
          code: 'UNKNOWN_ERROR',
          message:
            error.response.data?.message ??
            `Request failed with status ${status ?? 'unknown'}.`
        },
        status
      )
    );
  }
);

/** Extract a user-safe message from any thrown value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
