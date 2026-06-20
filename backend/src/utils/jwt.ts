import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AccessTokenPayload, RefreshTokenPayload } from '../types';

export function signAccessToken(payload: Omit<AccessTokenPayload, 'tokenType'>): string {
  const fullPayload: AccessTokenPayload = { ...payload, tokenType: 'access' };
  return jwt.sign(fullPayload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRY,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'tokenType'>): string {
  const fullPayload: RefreshTokenPayload = { ...payload, tokenType: 'refresh' };
  return jwt.sign(fullPayload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRY,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
  if (decoded.tokenType !== 'access') {
    throw new Error('Invalid token type: expected access token');
  }
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
  if (decoded.tokenType !== 'refresh') {
    throw new Error('Invalid token type: expected refresh token');
  }
  return decoded;
}

/**
 * Converts a duration string like "7d" or "15m" into milliseconds, used
 * for setting the `maxAge` of the refresh-token HttpOnly cookie so it
 * matches the JWT's own expiry.
 */
export function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    // Sensible default: 7 days, in case of unexpected format.
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const unitToMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * unitToMs[unit];
}
