import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { AppLayout } from '../components/layout/AppLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { TransferResult } from '../types';

type TransferStep = 'form' | 'confirm' | 'success';

interface FormState {
  recipientEmail: string;
  amount: string;
  note: string;
}

interface FormErrors {
  recipientEmail?: string;
  amount?: string;
}

const Transfer: React.FC = () => {
  const navigate = useNavigate();
  const { balance, isTransferring, error, transfer, clearError } = useWallet();

  const [step, setStep] = useState<TransferStep>('form');
  const [form, setForm] = useState<FormState>({ recipientEmail: '', amount: '', note: '' });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [completedResult, setCompletedResult] = useState<TransferResult | null>(null);

  const validate = (): boolean => {
    const errors: FormErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.recipientEmail || !emailPattern.test(form.recipientEmail)) {
      errors.recipientEmail = 'Please enter a valid recipient email address';
    }

    const parsedAmount = Number(form.amount);
    if (!form.amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = 'Please enter a valid amount greater than zero';
    } else if (balance && parsedAmount > balance.balance) {
      errors.amount = 'This amount exceeds your available balance';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContinue = (e: React.FormEvent): void => {
    e.preventDefault();
    if (validate()) {
      setStep('confirm');
    }
  };

  const handleConfirm = async (): Promise<void> => {
    try {
      const result = await transfer({
        recipientEmail: form.recipientEmail,
        amount: Number(form.amount),
        note: form.note || undefined,
      });
      setCompletedResult(result);
      setStep('success');
    } catch {
      // Error message is already set on the hook's `error` state and
      // rendered below; the idempotency key (if this was a transient
      // failure) is preserved internally so pressing "Try Again" reuses
      // it rather than risking a duplicate charge.
    }
  };

  const handleSendAnother = (): void => {
    setForm({ recipientEmail: '', amount: '', note: '' });
    setCompletedResult(null);
    setStep('form');
  };

  const amountNumber = Number(form.amount) || 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Send Money</h1>
          <p className="mt-1 text-sm text-surface-500">
            Transfer funds instantly and securely to another wallet.
          </p>
        </div>

        {balance && (
          <div className="rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm">
            <span className="text-surface-500">Available balance: </span>
            <span className="font-semibold text-surface-900">
              ${balance.balance.toFixed(2)} {balance.currency}
            </span>
          </div>
        )}

        {step === 'form' && (
          <div className="card">
            <form onSubmit={handleContinue} className="space-y-4">
              <Input
                label="Recipient email"
                type="email"
                placeholder="recipient@example.com"
                value={form.recipientEmail}
                onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })}
                error={formErrors.recipientEmail}
              />
              <Input
                label="Amount (USD)"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                error={formErrors.amount}
              />
              <Input
                label="Note (optional)"
                type="text"
                maxLength={280}
                placeholder="What's this for?"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          </div>
        )}

        {step === 'confirm' && (
          <div className="card">
            <h2 className="mb-4 text-base font-semibold text-surface-900">Confirm transfer</h2>

            <div className="space-y-3 rounded-xl bg-surface-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-500">Recipient</span>
                <span className="font-medium text-surface-900">{form.recipientEmail}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-500">Amount</span>
                <span className="text-lg font-bold text-surface-900">${amountNumber.toFixed(2)}</span>
              </div>
              {form.note && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-500">Note</span>
                  <span className="font-medium text-surface-900">{form.note}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4">
                <Alert variant="error" onDismiss={clearError}>
                  {error}
                </Alert>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setStep('form')}
                disabled={isTransferring}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleConfirm} isLoading={isTransferring}>
                {error ? 'Try Again' : 'Confirm & Send'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && completedResult && (
          <div className="card text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-100">
              <svg className="h-7 w-7 text-success-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-surface-900">Transfer successful</h2>
            <p className="mt-1 text-sm text-surface-500">
              ${amountNumber.toFixed(2)} was sent to {form.recipientEmail}.
            </p>
            <p className="mt-3 text-sm text-surface-500">
              New balance: <span className="font-semibold text-surface-900">${completedResult.newBalance.toFixed(2)}</span>
            </p>

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={handleSendAnother}>
                Send Another
              </Button>
              <Button className="flex-1" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Transfer;
