import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("[auth-service] SUPABASE_URL is not set");
  return url;
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("[auth-service] SUPABASE_SERVICE_ROLE_KEY is not set");
  return key;
}

// ---------------------------------------------------------------------------
// Admin Client (singleton)
// ---------------------------------------------------------------------------

let adminClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client authenticated with the service-role key.
 *
 * This client **bypasses RLS** and should only be used for server-side
 * operations that require elevated privileges (e.g. access checks, admin
 * queries).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), getServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("[auth-service] Supabase admin client initialised");
  }
  return adminClient;
}

// ---------------------------------------------------------------------------
// Per-User Client
// ---------------------------------------------------------------------------

/**
 * Returns a Supabase client scoped to a specific user's access token.
 *
 * All queries through this client respect RLS policies bound to the user.
 * A new client instance is created per call – callers should cache if needed.
 */
export function getSupabaseForUser(accessToken: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
