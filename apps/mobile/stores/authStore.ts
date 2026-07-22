/**
 * Authentication Store
 *
 * Manages user authentication state with Supabase Auth.
 * Handles sign-in, sign-up, sign-out, and session persistence.
 * Listens for auth state changes to keep the store in sync.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

/** Shape of the authentication state and actions */
interface AuthState {
  /** Current Supabase session (null if not authenticated) */
  session: Session | null;
  /** Current authenticated user (null if not authenticated) */
  user: User | null;
  /** Whether the initial session check is in progress */
  isLoading: boolean;
  /** Convenience flag – true when a valid session exists */
  isAuthenticated: boolean;

  /** Check for existing session and set up auth state listener */
  initialize: () => Promise<void>;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Create a new account with email, password, and display name */
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null, session: any | null }>;
  /** Sign out and clear session state */
  signOut: () => Promise<void>;
}

/**
 * Zustand store for authentication.
 *
 * Usage:
 * ```ts
 * const { user, isAuthenticated, signIn } = useAuthStore();
 * ```
 */
export const useAuthStore = create<AuthState>((set, _get) => ({
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
      });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  },

  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error: error ? new Error(error.message) : null, session: data?.session || null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, isAuthenticated: false });
  },
}));
