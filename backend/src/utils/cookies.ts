import { Response } from 'express';
import { env } from '../config/env';
import { parseDurationToMs } from './jwt';

const REFRESH_COOKIE_NAME = 'refreshToken';

/**
 * Sets the refresh token as an HttpOnly, Secure (in production), SameSite
 * cookie. HttpOnly means client-side JavaScript can never read this
 * cookie's value (mitigating XSS-based theft); Secure ensures it is only
 * ever sent over HTTPS in production; SameSite=Strict/Lax mitigates CSRF
 * by restricting cross-site sending.
 */
export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: parseDurationToMs(env.REFRESH_TOKEN_EXPIRY),
    path: '/api/auth',
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/api/auth',
  });
}

export function getRefreshTokenFromCookie(cookies: Record<string, string>): string | undefined {
  return cookies[REFRESH_COOKIE_NAME];
}
