import { Request, Response } from 'express';
import { walletService } from '../services/walletService';
import { ledgerService } from '../services/ledgerService';
import { transferSchema, depositSchema } from '../utils/validators';
import { asyncHandler } from '../utils/asyncHandler';
import { saveIdempotentResult } from '../middleware/idempotencyMiddleware';
import { ApiSuccessResponse } from '../types';

/**
 * GET /api/wallet/balance
 */
export const getBalance = asyncHandler(async (req: Request, res: Response) => {
  const balance = await walletService.getBalance(req.user!.userId);
  const response: ApiSuccessResponse<typeof balance> = { success: true, data: balance };
  res.status(200).json(response);
});

/**
 * POST /api/wallet/transfer
 * Protected by BOTH `authenticate` and `idempotencyMiddleware` upstream
 * (see walletRoutes.ts). On success, the final response is cached against
 * the idempotency key via `saveIdempotentResult` so an identical retry
 * (same header value) returns this exact response instead of re-running
 * the transfer.
 */
export const transferFunds = asyncHandler(async (req: Request, res: Response) => {
  const input = transferSchema.parse(req.body);
  const idempotencyKey = req.idempotencyKey!; // guaranteed set by idempotencyMiddleware

  const result = await walletService.transferFunds(req.user!.userId, input, idempotencyKey);

  const response: ApiSuccessResponse<typeof result> = {
    success: true,
    data: result,
    message: 'Transfer completed successfully',
  };

  await saveIdempotentResult(req.user!.userId, idempotencyKey, response);

  res.status(200).json(response);
});

/**
 * POST /api/wallet/deposit
 * Simulated "add funds" endpoint (e.g. demo top-up) so the system can be
 * exercised end-to-end without integrating a real payment processor.
 */
export const deposit = asyncHandler(async (req: Request, res: Response) => {
  const input = depositSchema.parse(req.body);
  const result = await walletService.deposit(req.user!.userId, input.amount);

  const response: ApiSuccessResponse<typeof result> = {
    success: true,
    data: result,
    message: 'Deposit completed successfully',
  };
  res.status(200).json(response);
});

/**
 * GET /api/wallet/transactions?page=1&limit=20
 */
export const getTransactionHistory = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const history = await ledgerService.getTransactionHistory(req.user!.userId, page, limit);

  const response: ApiSuccessResponse<typeof history> = { success: true, data: history };
  res.status(200).json(response);
});
