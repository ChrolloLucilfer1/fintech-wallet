import { useCallback, useEffect, useRef, useState } from 'react';
import { walletApi, TransferPayload } from '../api/walletApi';
import { extractErrorMessage } from '../api/apiClient';
import { LedgerEntry, TransferResult, WalletBalance } from '../types';

interface UseWalletState {
  balance: WalletBalance | null;
  transactions: LedgerEntry[];
  isLoadingBalance: boolean;
  isLoadingTransactions: boolean;
  isTransferring: boolean;
  isDepositing: boolean;
  error: string | null;
}

interface UseWalletResult extends UseWalletState {
  refreshBalance: () => Promise<void>;
  refreshTransactions: (page?: number) => Promise<void>;
  transfer: (payload: TransferPayload) => Promise<TransferResult>;
  deposit: (amount: number) => Promise<TransferResult>;
  clearError: () => void;
}

/**
 * Centralizes all wallet-related data fetching and mutation logic so
 * pages (Dashboard, Transfer) stay focused on rendering rather than
 * managing API calls and loading/error state themselves.
 */
export function useWallet(): UseWalletResult {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks the idempotency key for the IN-FLIGHT transfer attempt so that
  // if the user's network blips and the promise rejects with a network
  // error (as opposed to a clean server-side error), a subsequent manual
  // retry from the UI can reuse the same key — guaranteeing the backend
  // treats it as the same logical operation rather than charging twice.
  const pendingTransferKeyRef = useRef<string | undefined>(undefined);

  const refreshBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    setError(null);
    try {
      const data = await walletApi.getBalance();
      setBalance(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const refreshTransactions = useCallback(async (page: number = 1) => {
    setIsLoadingTransactions(true);
    setError(null);
    try {
      const data = await walletApi.getTransactionHistory(page, 20);
      setTransactions(data.entries);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

  const transfer = useCallback(async (payload: TransferPayload): Promise<TransferResult> => {
    setIsTransferring(true);
    setError(null);
    try {
      const { result, idempotencyKey } = await walletApi.transfer(
        payload,
        pendingTransferKeyRef.current
      );
      // Success — clear the pending key so the NEXT transfer generates a
      // brand new one rather than accidentally reusing this completed key.
      pendingTransferKeyRef.current = undefined;
      void idempotencyKey;

      // Refresh local state to reflect the new balance/ledger entry
      // immediately rather than waiting for a manual reload.
      await Promise.all([refreshBalance(), refreshTransactions()]);

      return result;
    } catch (err) {
      // Preserve the idempotency key for a potential retry ONLY if this
      // looks like a transient/network failure rather than a definitive
      // business-logic rejection (e.g. insufficient funds, recipient not
      // found) — retrying those with the same key would just hit the
      // same deterministic error again, so we let the key reset in that
      // case and surface the real message to the user.
      const message = extractErrorMessage(err);
      const isDefinitiveRejection =
        message.toLowerCase().includes('insufficient') ||
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('own account') ||
        message.toLowerCase().includes('duplicate');

      if (isDefinitiveRejection) {
        pendingTransferKeyRef.current = undefined;
      }

      setError(message);
      throw err;
    } finally {
      setIsTransferring(false);
    }
  }, [refreshBalance, refreshTransactions]);

  const deposit = useCallback(async (amount: number): Promise<TransferResult> => {
    setIsDepositing(true);
    setError(null);
    try {
      const result = await walletApi.deposit(amount);
      await Promise.all([refreshBalance(), refreshTransactions()]);
      return result;
    } catch (err) {
      setError(extractErrorMessage(err));
      throw err;
    } finally {
      setIsDepositing(false);
    }
  }, [refreshBalance, refreshTransactions]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    void refreshBalance();
    void refreshTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    balance,
    transactions,
    isLoadingBalance,
    isLoadingTransactions,
    isTransferring,
    isDepositing,
    error,
    refreshBalance,
    refreshTransactions,
    transfer,
    deposit,
    clearError,
  };
}
