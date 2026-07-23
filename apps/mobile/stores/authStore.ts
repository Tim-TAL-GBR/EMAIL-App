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
  /** Auth state subscription to prevent memory leaks */
  authSubscription?: any;

  /** Check for existing session and set up auth state listener */
  initialize: () => Promise<void>;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Create a new account with email, password, and display name */
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null, session: any | null }>;
  /** Sign out and clear session state */
  signOut: () => Promise<void>;
  /** Update user's password */
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  /** Reset user's password by email */
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
}

/**
 * Zustand store for authentication.
 *
 * Usage:
 * ```ts
 * const { user, isAuthenticated, signIn } = useAuthStore();
 * ```
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  authSubscription: undefined,

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

    // Clean up previous subscription if it exists
    const { authSubscription } = get();
    if (authSubscription) {
      authSubscription.unsubscribe();
    }

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
      });
    });

    set({ authSubscription: data.subscription });
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

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? new Error(error.message) : null };
  },

  resetPasswordForEmail: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error ? new Error(error.message) : null };
  },
}));
