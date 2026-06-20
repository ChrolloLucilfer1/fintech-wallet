import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorResponse } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:5000/api';

/**
 * IN-MEMORY ACCESS TOKEN STORE.
 *
 * Per the security spec, the access token is held ONLY in JS memory (this
 * module-level variable), never in localStorage/sessionStorage and never
 * in a cookie. This means:
 *   - It is automatically wiped on a full page reload/tab close (the user
 *     simply gets a fresh one via the refresh-token cookie flow below).
 *   - It is immune to being read by a malicious script via
 *     `localStorage.getItem(...)`, since it never lives there.
 * The trade-off — losing the token on refresh — is intentional and
 * handled gracefully by `bootstrapSession()` in AuthContext, which calls
 * /auth/refresh on app load to silently obtain a new one from the
 * HttpOnly refresh cookie.
 */
let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  // Required so the browser sends/receives the HttpOnly refresh-token
  // cookie on cross-origin requests to the API.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the current in-memory access token to every outgoing request.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
});

// --- Automatic silent-refresh-on-401 ---
//
// When an access token expires mid-session, the API returns 401
// INVALID_ACCESS_TOKEN. Rather than forcing the user to log in again,
// we transparently call /auth/refresh (which reads the HttpOnly refresh
// cookie), obtain a new access token, and retry the original request
// exactly once. If the refresh itself fails (refresh token also expired
// or revoked), we propagate the failure so the app can redirect to login.
//
// `isRefreshing` + `refreshSubscribers` coalesce concurrent 401s (e.g.
// three parallel dashboard requests all expiring at once) into a SINGLE
// refresh call, then replay all three original requests once it resolves.
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

function onRefreshed(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetryableConfig | undefined;
    const errorCode = error.response?.data?.error?.code;

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      !isAuthEndpoint &&
      originalRequest &&
      !originalRequest._retry &&
      (errorCode === 'INVALID_ACCESS_TOKEN' || errorCode === 'NO_TOKEN')
    ) {
      if (isRefreshing) {
        // A refresh is already in flight — wait for it, then retry.
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken: string) => {
            originalRequest._retry = true;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(originalRequest));
          });
          // Safety timeout in case the refresh hangs indefinitely.
          setTimeout(() => reject(error), 10_000);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post<ApiSuccessResponseLike>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newAccessToken = refreshResponse.data.data.accessToken as string;
        setAccessToken(newAccessToken);
        isRefreshing = false;
        onRefreshed(newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        setAccessToken(null);
        // Let the caller (AuthContext) handle redirecting to /login.
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Minimal local shape just for the refresh response, to avoid a circular
// import of the full ApiSuccessResponse<T> generic in this low-level file.
interface ApiSuccessResponseLike {
  data: { accessToken: string };
}

/**
 * Extracts a clean, human-readable error message from any Axios error
 * thrown by this client, falling back to a generic message if the
 * response doesn't match our expected API error envelope.
 */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiErrorResponse | undefined;
    if (apiError?.error?.message) {
      return apiError.error.message;
    }
    if (error.message === 'Network Error') {
      return 'Unable to reach the server. Please check your connection and try again.';
    }
  }
  return 'Something went wrong. Please try again.';
}
