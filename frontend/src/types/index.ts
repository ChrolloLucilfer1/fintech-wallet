export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponseData {
  user: User;
  accessToken: string;
}

export interface WalletBalance {
  balance: number;
  currency: string;
  updatedAt: string;
}

export type TransactionDirection = 'CREDIT' | 'DEBIT';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type TransactionType = 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL';

export interface LedgerEntry {
  id: string;
  direction: TransactionDirection;
  counterpartyEmail: string | null;
  amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  note: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface PaginatedLedger {
  entries: LedgerEntry[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface TransferResult {
  transactionId: string;
  status: string;
  newBalance: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
