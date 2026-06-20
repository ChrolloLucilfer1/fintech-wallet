import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/AppError';
import { AuthenticatedUser } from '../types';

// Augment Express's Request type so `req.user` is strongly typed everywhere
// downstream (controllers, other middleware) without needing `as` casts.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the short-lived ACCESS token sent via the `Authorization:
 * Bearer <token>` header. The access token is intentionally NOT read from
 * a cookie — per the security spec, access tokens live only in client
 * memory/state and are attached manually to each request, which means
 * they are never automatically sent by the browser and therefore not
 * exposed to CSRF in the way a cookie-based token would be. The
 * long-lived refresh token, by contrast, IS stored in an HttpOnly,
 * Secure, SameSite cookie (see authController/refresh flow) so it cannot
 * be read by client-side JavaScript at all (XSS-resistant).
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authentication token missing', 'NO_TOKEN'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token', 'INVALID_ACCESS_TOKEN'));
  }
}
