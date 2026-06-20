import React from 'react';
import { TransactionDirection, TransactionStatus } from '../../types';

interface StatusBadgeProps {
  status: TransactionStatus;
}

const statusStyles: Record<TransactionStatus, string> = {
  SUCCESS: 'bg-success-100 text-success-700',
  PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-danger-100 text-danger-700',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[status]}`}
  >
    {status}
  </span>
);

interface DirectionBadgeProps {
  direction: TransactionDirection;
}

export const DirectionBadge: React.FC<DirectionBadgeProps> = ({ direction }) => {
  const isCredit = direction === 'CREDIT';
  return (
    <span
      className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
        isCredit ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
      }`}
      aria-hidden="true"
    >
      {isCredit ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-6 6m6-6l6 6" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14m0 0l6-6m-6 6l-6-6" />
        </svg>
      )}
    </span>
  );
};
