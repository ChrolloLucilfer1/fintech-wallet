import { apiClient, setAccessToken } from './apiClient';
import { ApiSuccessResponse, AuthResponseData, User } from '../types';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<ApiSuccessResponse<AuthResponseData>>(
    '/auth/register',
    payload
  );
  setAccessToken(data.data.accessToken);
  return data.data.user;
}

async function login(payload: LoginPayload): Promise<User> {
  const { data } = await apiClient.post<ApiSuccessResponse<AuthResponseData>>(
    '/auth/login',
    payload
  );
  setAccessToken(data.data.accessToken);
  return data.data.user;
}

/**
 * Called once on app load to silently re-establish a session using the
 * HttpOnly refresh cookie (if present and valid). If the cookie is
 * missing/expired, this simply rejects and the app treats the user as
 * logged out — exactly as expected for a fresh visit.
 */
async function bootstrapSession(): Promise<User> {
  const refreshResponse = await apiClient.post<ApiSuccessResponse<{ accessToken: string }>>(
    '/auth/refresh'
  );
  setAccessToken(refreshResponse.data.data.accessToken);

  const meResponse = await apiClient.get<ApiSuccessResponse<User>>('/auth/me');
  return meResponse.data.data;
}

async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
  setAccessToken(null);
}

export const authApi = {
  register,
  login,
  bootstrapSession,
  logout,
};
