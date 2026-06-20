import { apiClient } from './apiClient';
import { generateIdempotencyKey } from '../lib/idempotency';
import {
  ApiSuccessResponse,
  PaginatedLedger,
  TransferResult,
  WalletBalance,
} from '../types';

export interface TransferPayload {
  recipientEmail: string;
  amount: number;
  note?: string;
}

async function getBalance(): Promise<WalletBalance> {
  const { data } = await apiClient.get<ApiSuccessResponse<WalletBalance>>('/wallet/balance');
  return data.data;
}

async function getTransactionHistory(page = 1, limit = 20): Promise<PaginatedLedger> {
  const { data } = await apiClient.get<ApiSuccessResponse<PaginatedLedger>>(
    '/wallet/transactions',
    { params: { page, limit } }
  );
  return data.data;
}

/**
 * Generates a fresh idempotency key for this specific transfer attempt
 * and attaches it as the `Idempotency-Key` header. If the caller needs to
 * retry this EXACT same logical transfer (e.g. after a network timeout),
 * they should reuse the returned key on the retry rather than calling
 * this function again — see useWallet's retry handling for that flow.
 */
async function transfer(
  payload: TransferPayload,
  existingIdempotencyKey?: string
): Promise<{ result: TransferResult; idempotencyKey: string }> {
  const idempotencyKey = existingIdempotencyKey ?? generateIdempotencyKey();

  const { data } = await apiClient.post<ApiSuccessResponse<TransferResult>>(
    '/wallet/transfer',
    payload,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );

  return { result: data.data, idempotencyKey };
}

async function deposit(amount: number): Promise<TransferResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<TransferResult>>('/wallet/deposit', {
    amount,
  });
  return data.data;
}

export const walletApi = {
  getBalance,
  getTransactionHistory,
  transfer,
  deposit,
};
