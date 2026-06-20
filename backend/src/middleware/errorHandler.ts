import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { ApiErrorResponse } from '../types';

/**
 * Handles requests to routes that don't exist. Placed after all real
 * routes are registered in app.ts, before the error handler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

/**
 * Single centralized error-handling middleware. Every error in the app —
 * whether an intentional AppError thrown from a service, a Zod validation
 * error, a Mongoose validation/cast error, a JWT error, or a truly
 * unexpected bug — funnels through here and is normalized into the same
 * { success: false, error: { code, message } } JSON shape.
 *
 * Must be registered LAST in the middleware chain (after all routes) and
 * MUST declare all four (err, req, res, next) parameters for Express to
 * recognize it as an error-handling middleware.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Errors we threw deliberately (AppError and its subclasses).
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: err.errorCode, message: err.message },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // 2. Request body/query validation errors from Zod.
  if (err instanceof ZodError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
    res.status(400).json(response);
    return;
  }

  // 3. Mongoose schema validation errors (e.g. min/max, required, enum).
  if (err instanceof mongoose.Error.ValidationError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation',
        details: Object.values(err.errors).map((e) => e.message),
      },
    };
    res.status(400).json(response);
    return;
  }

  // 4. Mongoose CastError — typically a malformed ObjectId in a route param.
  if (err instanceof mongoose.Error.CastError) {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'INVALID_ID', message: `Invalid identifier: ${err.value}` },
    };
    res.status(400).json(response);
    return;
  }

  // 5. MongoDB duplicate key error not already handled by a service layer.
  if ((err as { code?: number }).code === 11000) {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'DUPLICATE_RESOURCE', message: 'A resource with this value already exists' },
    };
    res.status(409).json(response);
    return;
  }

  // 6. JWT errors that slipped through without being wrapped (defensive fallback).
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const response: ApiErrorResponse = {
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Authentication token is invalid or expired' },
    };
    res.status(401).json(response);
    return;
  }

  // 7. Anything else is a genuine bug. Log full details server-side, but
  // never leak internals (stack traces, raw messages) to the client in
  // production. In development, surface the real message to speed up
  // debugging.
  console.error('[Unhandled Error]', {
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    stack: err.stack,
  });

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'Something went wrong on our end. Please try again later.'
          : err.message,
    },
  };
  res.status(500).json(response);
}
