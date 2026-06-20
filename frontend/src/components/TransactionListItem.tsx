import React from 'react';
import { LedgerEntry } from '../types';
import { DirectionBadge, StatusBadge } from './ui/Badge';

interface TransactionListItemProps {
  entry: LedgerEntry;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const TransactionListItem: React.FC<TransactionListItemProps> = ({ entry }) => {
  const isCredit = entry.direction === 'CREDIT';
  const counterpartyLabel = entry.counterpartyEmail ?? (entry.type === 'DEPOSIT' ? 'Self deposit' : 'Unknown');

  return (
    <div className="flex items-center gap-4 border-b border-surface-100 py-4 last:border-b-0">
      <DirectionBadge direction={entry.direction} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-surface-900">
            {isCredit ? 'Received from' : 'Sent to'} {counterpartyLabel}
          </p>
          <p
            className={`flex-shrink-0 text-sm font-bold ${
              isCredit ? 'text-success-700' : 'text-surface-900'
            }`}
          >
            {isCredit ? '+' : '-'}${entry.amount.toFixed(2)}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs text-surface-500">{formatDate(entry.createdAt)}</p>
          {entry.note && (
            <>
              <span className="text-surface-300">&middot;</span>
              <p className="truncate text-xs text-surface-500">{entry.note}</p>
            </>
          )}
        </div>
        {entry.status === 'FAILED' && entry.failureReason && (
          <p className="mt-1 text-xs font-medium text-danger-600">
            Failed: {entry.failureReason.replace(/_/g, ' ').toLowerCase()}
          </p>
        )}
      </div>

      <StatusBadge status={entry.status} />
    </div>
  );
};
