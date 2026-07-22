/**
 * useAuth Hook
 *
 * Convenience hook that initializes the auth store on mount
 * and returns all auth state and actions.
 *
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, isLoading, signIn, signOut } = useAuth();
 * ```
 */

import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    store.initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
