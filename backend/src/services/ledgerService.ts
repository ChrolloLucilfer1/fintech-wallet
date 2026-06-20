import { Types } from 'mongoose';
import { Transaction, ITransaction, TransactionStatus } from '../models/Transaction';
import { BadRequestError } from '../utils/AppError';

export interface LedgerEntryView {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  counterpartyEmail: string | null;
  amount: number; // major units
  currency: string;
  type: string;
  status: TransactionStatus;
  note: string | null;
  failureReason: string | null;
  createdAt: Date;
}

interface PaginatedLedger {
  entries: LedgerEntryView[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Returns a user-centric view of the ledger: for every transaction the
 * user was involved in, whether it appears as a CREDIT or DEBIT depends
 * on whether they were the sender or recipient. This view-shaping logic
 * deliberately lives in the service layer (not the controller) so that
 * any future API surface (REST, GraphQL, admin tooling) reuses the same
 * interpretation of "what does this transaction mean for this user".
 */
async function getTransactionHistory(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedLedger> {
  if (page < 1 || limit < 1 || limit > 100) {
    throw new BadRequestError('Invalid pagination parameters', 'INVALID_PAGINATION');
  }

  const userObjectId = new Types.ObjectId(userId);
  const filter = { $or: [{ fromUser: userObjectId }, { toUser: userObjectId }] };

  const [docs, totalCount] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('fromUser', 'email')
      .populate('toUser', 'email')
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  const entries: LedgerEntryView[] = docs.map((doc) => {
    const isSender = doc.fromUser && (doc.fromUser as unknown as { _id: Types.ObjectId; email: string })._id.toString() === userId;
    const direction: 'CREDIT' | 'DEBIT' = isSender ? 'DEBIT' : 'CREDIT';

    const counterparty = isSender
      ? (doc.toUser as unknown as { email: string } | null)
      : (doc.fromUser as unknown as { email: string } | null);

    return {
      id: (doc._id as Types.ObjectId).toString(),
      direction,
      counterpartyEmail: counterparty ? counterparty.email : null,
      amount: doc.amount / 100,
      currency: doc.currency,
      type: doc.type,
      status: doc.status,
      note: (doc.metadata as Record<string, unknown>)?.note as string | undefined ?? null,
      failureReason: doc.failureReason,
      createdAt: doc.createdAt,
    };
  });

  return {
    entries,
    page,
    limit,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
  };
}

async function getTransactionById(transactionId: string): Promise<ITransaction | null> {
  return Transaction.findById(transactionId);
}

export const ledgerService = {
  getTransactionHistory,
  getTransactionById,
};
