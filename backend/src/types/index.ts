import { Types } from 'mongoose';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  tokenType: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  tokenType: 'refresh';
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface SanitizedUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface TransferResult {
  transactionId: Types.ObjectId;
  status: string;
  newBalance: number;
}

/** Standard success envelope returned by every API endpoint in this service. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/** Standard error envelope returned by the centralized error handler. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
