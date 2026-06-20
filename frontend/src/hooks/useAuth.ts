import { useContext } from 'react';
import { AuthContext, AuthContextValue } from '../context/AuthContext';

/**
 * Provides access to the current authentication state and actions
 * (login, register, logout) anywhere in the component tree, as long as
 * it's wrapped in <AuthProvider>. Throws a clear error if used outside
 * the provider rather than silently returning undefined fields, which
 * would otherwise surface as a confusing runtime crash deep in some
 * unrelated component.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
