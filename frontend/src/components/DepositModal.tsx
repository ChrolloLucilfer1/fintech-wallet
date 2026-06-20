import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeposit: (amount: number) => Promise<void>;
  isDepositing: boolean;
}

const QUICK_AMOUNTS = [50, 100, 250, 500];

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onDeposit,
  isDepositing,
}) => {
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleClose = (): void => {
    setAmount('');
    setValidationError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const parsed = Number(amount);

    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setValidationError('Please enter a valid amount greater than zero');
      return;
    }
    if (parsed > 1_000_000) {
      setValidationError('Amount exceeds the maximum allowed deposit');
      return;
    }

    setValidationError(null);
    await onDeposit(parsed);
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Funds">
      <p className="mb-4 text-sm text-surface-500">
        This is a simulated top-up for demo purposes — no real payment method is charged.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount (USD)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={validationError ?? undefined}
          autoFocus
        />

        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((quickAmount) => (
            <button
              key={quickAmount}
              type="button"
              onClick={() => setAmount(String(quickAmount))}
              className="rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-medium text-surface-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              ${quickAmount}
            </button>
          ))}
        </div>

        {validationError && <Alert variant="error">{validationError}</Alert>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isDepositing}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isDepositing}>
            Confirm Deposit
          </Button>
        </div>
      </form>
    </Modal>
  );
};
