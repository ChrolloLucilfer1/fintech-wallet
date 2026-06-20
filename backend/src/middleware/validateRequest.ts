import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Returns an Express middleware that validates+parses `req.body` against
 * the given Zod schema, replacing `req.body` with the parsed (and
 * type-coerced/transformed) result. Throws (via next) a ZodError on
 * failure, which the centralized errorHandler formats into a clean 400.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}
