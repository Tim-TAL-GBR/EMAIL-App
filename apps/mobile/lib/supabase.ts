/**
 * Supabase Client Configuration
 *
 * Initializes the Supabase client with AsyncStorage for persistent
 * session management in React Native / Web.
 *
 * SSR Note: AsyncStorage uses `window` internally. We guard against
 * server-side rendering by only providing it when `window` is defined.
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/** Supabase project URL – set via EXPO_PUBLIC_SUPABASE_URL env variable */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';

/** Supabase anonymous key – set via EXPO_PUBLIC_SUPABASE_ANON_KEY env variable */
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
  console.error('[Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set!');
}

/**
 * Returns the appropriate storage adapter depending on the platform.
 * On web during SSR (no `window`), we return undefined so Supabase
 * falls back to in-memory storage, avoiding the "window is not defined" crash.
 */
function getStorage() {
  if (Platform.OS !== 'web') {
    // Native (iOS / Android) – use AsyncStorage
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return AsyncStorage;
  }
  // Web – use localStorage only when running in a browser context
  if (typeof window !== 'undefined') {
    return localStorage;
  }
  // SSR / Node – no persistent storage
  return undefined;
}

/**
 * Configured Supabase client instance.
 *
 * - Uses AsyncStorage (native) or localStorage (web) for session persistence
 * - Auto-refreshes tokens before expiry
 * - detectSessionInUrl: true on web so OAuth redirects work
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey || '', {
  auth: {
    storage: getStorage() as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
