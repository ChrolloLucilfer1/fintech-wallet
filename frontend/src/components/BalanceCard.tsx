import React from 'react';
import { WalletBalance } from '../types';
import { Button } from './ui/Button';

interface BalanceCardProps {
  balance: WalletBalance | null;
  isLoading: boolean;
  onAddFunds: () => void;
  onSendMoney: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  isLoading,
  onAddFunds,
  onSendMoney,
}) => {
  return (
    <div className="card relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 text-white">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
      <div className="absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-white/5" aria-hidden="true" />

      <div className="relative z-10">
        <p className="text-sm font-medium text-brand-100">Available Balance</p>
        <div className="mt-2 flex items-baseline gap-2">
          {isLoading || !balance ? (
            <div className="h-10 w-48 animate-pulse rounded-lg bg-white/20" />
          ) : (
            <>
              <span className="text-4xl font-bold tracking-tight">${balance.balance.toFixed(2)}</span>
              <span className="text-sm font-medium text-brand-100">{balance.currency}</span>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={onSendMoney}
            className="bg-white text-brand-700 hover:bg-brand-50 focus:ring-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Send Money
          </Button>
          <Button
            onClick={onAddFunds}
            variant="secondary"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20 focus:ring-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Funds
          </Button>
        </div>
      </div>
    </div>
  );
};
