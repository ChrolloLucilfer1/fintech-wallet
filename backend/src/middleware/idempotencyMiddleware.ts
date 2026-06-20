import { Request, Response, NextFunction } from 'express';
import { cache } from '../config/redis';
import { Transaction } from '../models/Transaction';
import { BadRequestError, ConflictError } from '../utils/AppError';
import { ApiSuccessResponse } from '../types';

const IDEMPOTENCY_LOCK_TTL_SECONDS = 60; // window during which the request is "in flight"
const IDEMPOTENCY_RESULT_TTL_SECONDS = 24 * 60 * 60; // how long a finished result is replay-able

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

/**
 * Protects mutating financial endpoints (e.g. POST /wallet/transfer) from
 * being processed twice when a client retries a request — for example, a
 * mobile app re-sending a transfer after a timeout, even though the
 * first request actually succeeded server-side.
 *
 * Flow:
 *   1. Require an `Idempotency-Key` header (client-generated UUID, one
 *      per logical operation the user intends to perform).
 *   2. Atomically try to acquire a short-lived "processing" lock for that
 *      key via `cache.setIfNotExists`. This is the critical
 *      race-condition guard: if two identical requests arrive at almost
 *      the same instant, only ONE of them wins the lock and proceeds;
 *      the other is immediately told a request is already in flight.
 *   3. If a FINAL result for that key was already cached from a previous
 *      completed request, return that cached response immediately
 *      without re-running any business logic at all (true idempotent
 *      replay).
 *   4. Otherwise let the request through to the controller. The
 *      controller/service is responsible for calling
 *      `saveIdempotentResult` once it has a final response, which both
 *      releases the lock and caches the result for future replays.
 *
 * This is deliberately layered ON TOP of the unique index on
 * `Transaction.idempotencyKey` in MongoDB (see walletService.ts) — the
 * cache is the fast, cheap first line of defense; the DB unique
 * constraint is the unconditional last line of defense, since a cache can
 * theoretically be flushed or, in the in-memory dev fallback, doesn't
 * survive a process restart.
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const idempotencyKeyHeader = req.headers['idempotency-key'];

  if (!idempotencyKeyHeader || typeof idempotencyKeyHeader !== 'string') {
    return next(
      new BadRequestError(
        'Idempotency-Key header is required for this operation',
        'MISSING_IDEMPOTENCY_KEY'
      )
    );
  }

  if (idempotencyKeyHeader.length < 8 || idempotencyKeyHeader.length > 128) {
    return next(
      new BadRequestError(
        'Idempotency-Key must be between 8 and 128 characters',
        'INVALID_IDEMPOTENCY_KEY'
      )
    );
  }

  // Namespace the key per-user so two different users can never collide
  // on the same client-generated key string.
  const userId = req.user?.userId ?? 'anonymous';
  const namespacedKey = `idempotency:${userId}:${idempotencyKeyHeader}`;

  // Step 1: has this exact operation already fully completed? If so,
  // replay the cached final response and skip business logic entirely.
  const cachedResult = await cache.get(`${namespacedKey}:result`);
  if (cachedResult) {
    res.status(200).json(JSON.parse(cachedResult) as ApiSuccessResponse<unknown>);
    return;
  }

  // Step 2: also check the durable ledger as a fallback in case the cache
  // was cleared/restarted but the transaction actually completed — this
  // keeps the in-memory dev cache from ever causing a double-charge.
  const existingTxn = await Transaction.findOne({ idempotencyKey: idempotencyKeyHeader });
  if (existingTxn) {
    return next(
      new ConflictError(
        'A transaction with this idempotency key has already been processed.',
        'DUPLICATE_REQUEST'
      )
    );
  }

  // Step 3: attempt to acquire the short-lived processing lock.
  const lockAcquired = await cache.setIfNotExists(
    `${namespacedKey}:lock`,
    '1',
    IDEMPOTENCY_LOCK_TTL_SECONDS
  );

  if (!lockAcquired) {
    return next(
      new ConflictError(
        'A request with this idempotency key is already being processed. Please wait.',
        'REQUEST_IN_PROGRESS'
      )
    );
  }

  req.idempotencyKey = idempotencyKeyHeader;

  // Ensure the lock is released if the request fails/throws, so a
  // legitimate retry (after a genuine failure) isn't blocked forever by a
  // stale lock. On success, the controller calls saveIdempotentResult,
  // which overwrites the lock key with the cached final result instead.
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      void cache.del(`${namespacedKey}:lock`);
    }
  });

  next();
}

/**
 * Called by a controller after successfully completing an idempotency-
 * protected operation. Caches the final JSON response so that if the
 * client retries with the same key (e.g. due to a network timeout on
 * their end even though the server actually succeeded), they get back
 * the exact same result instead of the operation running twice.
 */
export async function saveIdempotentResult(
  userId: string,
  idempotencyKey: string,
  response: ApiSuccessResponse<unknown>
): Promise<void> {
  const namespacedKey = `idempotency:${userId}:${idempotencyKey}`;
  await cache.set(`${namespacedKey}:result`, JSON.stringify(response), IDEMPOTENCY_RESULT_TTL_SECONDS);
  await cache.del(`${namespacedKey}:lock`);
}
