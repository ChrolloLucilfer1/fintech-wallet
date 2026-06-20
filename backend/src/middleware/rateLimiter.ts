import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Lightweight fixed-window rate limiter, keyed by IP + route. This is
 * intentionally simple (no external dependency) since the project's
 * Redis/in-memory `cache` abstraction is reserved for idempotency
 * semantics; a dedicated limiter map keeps that concern separate.
 *
 * For a real production deployment behind multiple server instances,
 * this should be backed by Redis (e.g. `rate-limit-redis`) instead of a
 * process-local Map so limits are enforced globally — noted here as the
 * natural upgrade path.
 */
export function createRateLimiter(windowMs: number, maxRequests: number) {
  const hits = new Map<string, RateLimitEntry>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs).unref();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return next(
        new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMITED')
      );
    }

    entry.count += 1;
    next();
  };
}

export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 30); // 30 requests / 15 min
export const transferRateLimiter = createRateLimiter(60 * 1000, 20); // 20 requests / 1 min
