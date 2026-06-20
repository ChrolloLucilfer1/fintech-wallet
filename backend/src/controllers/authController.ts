import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { registerSchema, loginSchema } from '../utils/validators';
import { asyncHandler } from '../utils/asyncHandler';
import { setRefreshTokenCookie, clearRefreshTokenCookie, getRefreshTokenFromCookie } from '../utils/cookies';
import { UnauthorizedError } from '../utils/AppError';
import { ApiSuccessResponse } from '../types';

/**
 * POST /api/auth/register
 * Creates a new user + wallet, returns the access token in the JSON body
 * (for the client to hold in memory) and sets the refresh token as an
 * HttpOnly cookie.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const { user, tokens } = await authService.register(input);

  setRefreshTokenCookie(res, tokens.refreshToken);

  const response: ApiSuccessResponse<{ user: typeof user; accessToken: string }> = {
    success: true,
    data: { user, accessToken: tokens.accessToken },
    message: 'Account created successfully',
  };
  res.status(201).json(response);
});

/**
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { user, tokens } = await authService.login(input);

  setRefreshTokenCookie(res, tokens.refreshToken);

  const response: ApiSuccessResponse<{ user: typeof user; accessToken: string }> = {
    success: true,
    data: { user, accessToken: tokens.accessToken },
    message: 'Logged in successfully',
  };
  res.status(200).json(response);
});

/**
 * POST /api/auth/refresh
 * Reads the refresh token from the HttpOnly cookie (never from the
 * request body — it must never be exposed to client-side JS) and issues
 * a new access/refresh token pair. The frontend calls this silently
 * whenever an access token expires.
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = getRefreshTokenFromCookie(req.cookies);
  if (!refreshToken) {
    throw new UnauthorizedError('No refresh token provided', 'NO_REFRESH_TOKEN');
  }

  const tokens = await authService.refreshTokens(refreshToken);
  setRefreshTokenCookie(res, tokens.refreshToken);

  const response: ApiSuccessResponse<{ accessToken: string }> = {
    success: true,
    data: { accessToken: tokens.accessToken },
  };
  res.status(200).json(response);
});

/**
 * POST /api/auth/logout
 * Bumps the user's refreshTokenVersion (invalidating all outstanding
 * refresh tokens) and clears the cookie client-side.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = getRefreshTokenFromCookie(req.cookies);

  if (refreshToken) {
    try {
      const { verifyRefreshToken } = await import('../utils/jwt');
      const payload = verifyRefreshToken(refreshToken);
      await authService.logout(payload.userId);
    } catch {
      // Token already invalid/expired — nothing to revoke, proceed to clear cookie.
    }
  }

  clearRefreshTokenCookie(res);

  const response: ApiSuccessResponse<null> = {
    success: true,
    data: null,
    message: 'Logged out successfully',
  };
  res.status(200).json(response);
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile. Requires a valid
 * access token (enforced by the `authenticate` middleware upstream).
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getUserById(req.user!.userId);
  const response: ApiSuccessResponse<typeof user> = { success: true, data: user };
  res.status(200).json(response);
});
