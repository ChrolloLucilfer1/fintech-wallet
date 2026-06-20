import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum TransactionType {
  TRANSFER = 'TRANSFER',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

/**
 * A Transaction document is an immutable LEDGER ENTRY, not just a status
 * flag on a wallet. Every fund movement — successful or failed — produces
 * exactly one Transaction record. This gives the system a full audit trail
 * (a core fintech requirement) independent of the current wallet balances,
 * and is what the idempotency layer keys off of.
 */
export interface ITransaction extends Document {
  fromWallet: Types.ObjectId | null;
  toWallet: Types.ObjectId | null;
  fromUser: Types.ObjectId | null;
  toUser: Types.ObjectId | null;
  amount: number; // integer minor units
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  idempotencyKey: string;
  failureReason: string | null;
  balanceAfterFrom: number | null;
  balanceAfterTo: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    fromWallet: { type: Schema.Types.ObjectId, ref: 'Wallet', default: null, index: true },
    toWallet: { type: Schema.Types.ObjectId, ref: 'Wallet', default: null, index: true },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    toUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Transaction amount must be a positive integer (minor units)'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer representing minor currency units',
      },
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      required: true,
      default: TransactionStatus.PENDING,
      index: true,
    },
    // Unique per logical operation — this is the field the idempotency
    // middleware and walletService both rely on to detect duplicate
    // submissions of the same client-generated request.
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    failureReason: { type: String, default: null },
    balanceAfterFrom: { type: Number, default: null },
    balanceAfterTo: { type: Number, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Common query pattern: "give me this user's transaction history" sorted
// by recency. Compound index keeps that fast as the ledger grows.
TransactionSchema.index({ fromUser: 1, createdAt: -1 });
TransactionSchema.index({ toUser: 1, createdAt: -1 });

export const Transaction: Model<ITransaction> = mongoose.model<ITransaction>(
  'Transaction',
  TransactionSchema
);
