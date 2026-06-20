import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * Wallet balances are stored as INTEGER MINOR UNITS (e.g. cents/paise),
 * never as floating point decimals. This is a deliberate fintech-grade
 * decision: storing 19.99 as a JS float and doing repeated arithmetic on
 * it eventually produces rounding errors (0.1 + 0.2 !== 0.3 in IEEE-754).
 * Storing 1999 (minor units) and only converting to "19.99" at the
 * presentation layer eliminates that entire class of bugs.
 *
 * `version` implements optimistic concurrency control as a defense-in-depth
 * layer alongside the MongoDB transaction: every balance mutation must
 * match the version it read, and increments it. Combined with the
 * session-based transaction in walletService, this guards against lost
 * updates even under unusual replica set timing.
 */
export interface IWallet extends Document {
  user: Types.ObjectId;
  balance: number; // integer minor units, e.g. 150000 = $1,500.00
  currency: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be an integer representing minor currency units',
      },
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    version: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Wallet: Model<IWallet> = mongoose.model<IWallet>('Wallet', WalletSchema);
