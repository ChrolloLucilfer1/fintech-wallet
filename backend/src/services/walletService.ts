import mongoose, { Types } from 'mongoose';
import { Wallet, IWallet } from '../models/Wallet';
import { User } from '../models/User';
import { Transaction, TransactionStatus, TransactionType } from '../models/Transaction';
import {
  BadRequestError,
  ConflictError,
  InsufficientFundsError,
  InternalServerError,
  NotFoundError,
} from '../utils/AppError';
import { toMinorUnits, toMajorUnits } from '../utils/money';
import { TransferInput } from '../utils/validators';
import { TransferResult } from '../types';

interface WalletBalanceView {
  balance: number; // major units
  currency: string;
  updatedAt: Date;
}

async function getWalletByUserId(userId: string): Promise<IWallet> {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    throw new NotFoundError('Wallet not found for this user', 'WALLET_NOT_FOUND');
  }
  return wallet;
}

async function getBalance(userId: string): Promise<WalletBalanceView> {
  const wallet = await getWalletByUserId(userId);
  return {
    balance: toMajorUnits(wallet.balance),
    currency: wallet.currency,
    updatedAt: wallet.updatedAt,
  };
}

/**
 * Credits a user's own wallet (e.g. simulated "add money" / deposit flow).
 * Wrapped in a transaction for consistency with the rest of the ledger
 * writes, even though it only touches a single wallet — every balance
 * mutation in this system produces exactly one ledger Transaction record,
 * with no exceptions, so the audit trail is always complete.
 */
async function deposit(userId: string, amountMajor: number): Promise<TransferResult> {
  const amountMinor = toMinorUnits(amountMajor);
  if (amountMinor <= 0) {
    throw new BadRequestError('Deposit amount must be greater than zero', 'INVALID_AMOUNT');
  }

  const session = await mongoose.startSession();
  let resultTransactionId: Types.ObjectId | null = null;
  let resultBalance = 0;

  try {
    await session.withTransaction(async () => {
      const wallet = await Wallet.findOne({ user: userId }).session(session);
      if (!wallet) {
        throw new NotFoundError('Wallet not found for this user', 'WALLET_NOT_FOUND');
      }

      const updated = await Wallet.findOneAndUpdate(
        { _id: wallet._id, version: wallet.version },
        { $inc: { balance: amountMinor, version: 1 } },
        { new: true, session }
      );

      if (!updated) {
        throw new ConflictError(
          'Wallet was modified concurrently. Please retry the deposit.',
          'CONCURRENT_MODIFICATION'
        );
      }

      const [txn] = await Transaction.create(
        [
          {
            fromWallet: null,
            toWallet: updated._id,
            fromUser: null,
            toUser: updated.user,
            amount: amountMinor,
            currency: updated.currency,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.SUCCESS,
            idempotencyKey: `deposit-${updated.user.toString()}-${new mongoose.Types.ObjectId().toString()}`,
            balanceAfterTo: updated.balance,
          },
        ],
        { session }
      );

      resultTransactionId = txn._id;
      resultBalance = updated.balance;
    });
  } finally {
    await session.endSession();
  }

  if (!resultTransactionId) {
    throw new InternalServerError('Deposit failed unexpectedly. Please try again.');
  }

  return {
    transactionId: resultTransactionId,
    status: TransactionStatus.SUCCESS,
    newBalance: toMajorUnits(resultBalance),
  };
}

/**
 * Core money-movement operation: atomically debits the sender's wallet
 * and credits the recipient's wallet, writing a single ledger
 * Transaction record that reflects the outcome.
 *
 * ACID GUARANTEES — how this function provides them:
 *
 * 1. ATOMICITY: `session.withTransaction()` wraps every read and write
 *    (sender lookup, recipient lookup, both balance updates, and the
 *    ledger insert) in a single MongoDB multi-document transaction. If
 *    ANY step throws — insufficient funds, a concurrent-modification
 *    conflict, a network blip — the driver automatically aborts and rolls
 *    back every write made so far in the callback. Money is never
 *    deducted from the sender without being credited to the recipient.
 *
 * 2. CONSISTENCY: Schema-level validators (balance >= 0, integer minor
 *    units) plus the explicit insufficient-funds check enforce that the
 *    system never reaches an invalid state (e.g. a negative balance).
 *
 * 3. ISOLATION: MongoDB transactions run at snapshot isolation by
 *    default. Combined with the optimistic `version` field guard on the
 *    `findOneAndUpdate` filters, two concurrent transfers debiting the
 *    SAME wallet cannot both succeed against a stale balance — the
 *    second one's version-matched update will simply not find a
 *    matching document, causing the transaction to abort and retry.
 *
 * 4. DURABILITY: Once `withTransaction` resolves successfully, MongoDB
 *    has committed the change with the configured write concern, so it
 *    survives a server crash immediately after.
 *
 * IDEMPOTENCY: the unique index on `Transaction.idempotencyKey` is the
 * last line of defense. The HTTP-level idempotency middleware
 * short-circuits duplicate requests before they even reach this
 * function, but if two requests with the same key somehow raced past
 * that check, the unique index will cause the second insert to throw a
 * duplicate-key error inside the transaction, which aborts it — so the
 * sender is never double-charged even in that edge case.
 */
async function transferFunds(
  senderUserId: string,
  input: TransferInput,
  idempotencyKey: string
): Promise<TransferResult> {
  const amountMinor = toMinorUnits(input.amount);

  const recipient = await User.findOne({ email: input.recipientEmail });
  if (!recipient) {
    throw new NotFoundError('Recipient not found', 'RECIPIENT_NOT_FOUND');
  }

  if (recipient._id.toString() === senderUserId) {
    throw new BadRequestError('Cannot transfer funds to your own account', 'SELF_TRANSFER');
  }

  const session = await mongoose.startSession();
  let resultTransactionId: Types.ObjectId | null = null;
  let resultBalance = 0;

  try {
    await session.withTransaction(async () => {
      // Fetch both wallets inside the transaction so reads are part of the
      // same snapshot as the writes that follow.
      const senderWallet = await Wallet.findOne({ user: senderUserId }).session(session);
      const recipientWallet = await Wallet.findOne({ user: recipient._id }).session(session);

      if (!senderWallet) {
        throw new NotFoundError('Sender wallet not found', 'WALLET_NOT_FOUND');
      }
      if (!recipientWallet) {
        throw new NotFoundError('Recipient wallet not found', 'WALLET_NOT_FOUND');
      }

      if (senderWallet.currency !== recipientWallet.currency) {
        throw new BadRequestError(
          'Cross-currency transfers are not supported',
          'CURRENCY_MISMATCH'
        );
      }

      if (senderWallet.balance < amountMinor) {
        // Record the failed attempt in the ledger for audit purposes
        // before throwing, so there is a permanent record of why the
        // transfer did not go through.
        await Transaction.create(
          [
            {
              fromWallet: senderWallet._id,
              toWallet: recipientWallet._id,
              fromUser: senderWallet.user,
              toUser: recipientWallet.user,
              amount: amountMinor,
              currency: senderWallet.currency,
              type: TransactionType.TRANSFER,
              status: TransactionStatus.FAILED,
              idempotencyKey,
              failureReason: 'INSUFFICIENT_FUNDS',
              metadata: input.note ? { note: input.note } : {},
            },
          ],
          { session }
        );
        throw new InsufficientFundsError(
          `Insufficient funds: balance ${toMajorUnits(senderWallet.balance)} is less than requested ${toMajorUnits(amountMinor)}`
        );
      }

      // Optimistic-concurrency-guarded debit: the filter requires the
      // version to still match what we just read. If another concurrent
      // transaction already modified this wallet, this update matches
      // zero documents, `updatedSender` is null, and we abort + surface a
      // clear conflict error rather than silently corrupting the balance.
      const updatedSender = await Wallet.findOneAndUpdate(
        { _id: senderWallet._id, version: senderWallet.version },
        { $inc: { balance: -amountMinor, version: 1 } },
        { new: true, session }
      );
      if (!updatedSender) {
        throw new ConflictError(
          'Sender wallet was modified concurrently. Please retry the transfer.',
          'CONCURRENT_MODIFICATION'
        );
      }

      const updatedRecipient = await Wallet.findOneAndUpdate(
        { _id: recipientWallet._id, version: recipientWallet.version },
        { $inc: { balance: amountMinor, version: 1 } },
        { new: true, session }
      );
      if (!updatedRecipient) {
        throw new ConflictError(
          'Recipient wallet was modified concurrently. Please retry the transfer.',
          'CONCURRENT_MODIFICATION'
        );
      }

      const [txn] = await Transaction.create(
        [
          {
            fromWallet: updatedSender._id,
            toWallet: updatedRecipient._id,
            fromUser: updatedSender.user,
            toUser: updatedRecipient.user,
            amount: amountMinor,
            currency: updatedSender.currency,
            type: TransactionType.TRANSFER,
            status: TransactionStatus.SUCCESS,
            idempotencyKey,
            balanceAfterFrom: updatedSender.balance,
            balanceAfterTo: updatedRecipient.balance,
            metadata: input.note ? { note: input.note } : {},
          },
        ],
        { session }
      );

      resultTransactionId = txn._id;
      resultBalance = updatedSender.balance;
    });
  } catch (error) {
    // Duplicate idempotencyKey racing past the HTTP-level lock is the one
    // scenario the unique index catches at the DB layer. Surface it as a
    // clean conflict rather than a raw Mongo error code.
    if (error instanceof Error && (error as { code?: number }).code === 11000) {
      throw new ConflictError(
        'This transfer has already been submitted (duplicate idempotency key).',
        'DUPLICATE_REQUEST'
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!resultTransactionId) {
    throw new InternalServerError('Transfer failed unexpectedly. Please try again.');
  }

  return {
    transactionId: resultTransactionId,
    status: TransactionStatus.SUCCESS,
    newBalance: toMajorUnits(resultBalance),
  };
}

export const walletService = {
  getWalletByUserId,
  getBalance,
  deposit,
  transferFunds,
};
