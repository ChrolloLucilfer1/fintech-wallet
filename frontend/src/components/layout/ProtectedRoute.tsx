import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageLoader } from '../ui/PageLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Guards authenticated-only pages (Dashboard, Transfer). While the
 * AuthProvider is still silently attempting to restore a session via the
 * refresh-token cookie, this shows a loader rather than briefly
 * redirecting to /login and then bouncing back — which would otherwise
 * cause a jarring flash on every page refresh for an already-logged-in
 * user.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
