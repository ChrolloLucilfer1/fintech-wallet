import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express handler so any rejected promise / thrown error is
 * automatically forwarded to `next()`, where the centralized errorHandler
 * middleware can process it. Without this, an unhandled rejection in an
 * async route handler would crash the request silently (or the process,
 * depending on Node version) instead of returning a clean JSON error.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
