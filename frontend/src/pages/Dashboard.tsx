import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { AppLayout } from '../components/layout/AppLayout';
import { BalanceCard } from '../components/BalanceCard';
import { DepositModal } from '../components/DepositModal';
import { TransactionListItem } from '../components/TransactionListItem';
import { Alert } from '../components/ui/Alert';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    balance,
    transactions,
    isLoadingBalance,
    isLoadingTransactions,
    isDepositing,
    error,
    deposit,
    clearError,
  } = useWallet();

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  const handleDeposit = async (amount: number): Promise<void> => {
    await deposit(amount);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
          <p className="mt-1 text-sm text-surface-500">
            Here&apos;s an overview of your wallet activity.
          </p>
        </div>

        {error && (
          <Alert variant="error" onDismiss={clearError}>
            {error}
          </Alert>
        )}

        <BalanceCard
          balance={balance}
          isLoading={isLoadingBalance}
          onAddFunds={() => setIsDepositModalOpen(true)}
          onSendMoney={() => navigate('/transfer')}
        />

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-surface-900">Recent Transactions</h2>
          </div>

          {isLoadingTransactions ? (
            <div className="space-y-4 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-surface-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface-100" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-surface-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-100">
                <svg className="h-6 w-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-surface-900">No transactions yet</p>
              <p className="mt-1 text-sm text-surface-500">
                Add funds or send money to see your activity here.
              </p>
            </div>
          ) : (
            <div>
              {transactions.map((entry) => (
                <TransactionListItem key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onDeposit={handleDeposit}
        isDepositing={isDepositing}
      />
    </AppLayout>
  );
};

export default Dashboard;
