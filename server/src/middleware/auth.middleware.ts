import type { IncomingMessage } from "node:http";
import { getSupabaseAdmin, getSupabaseForUser } from "../services/auth.service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Decoded JWT payload from Supabase Auth. */
export interface TokenPayload {
  /** Supabase user id (UUID). */
  sub: string;
  /** User email address. */
  email: string;
  /** Supabase role (e.g. "authenticated"). */
  role: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a bearer token from the `Authorization` header value.
 * Accepts both `Bearer <token>` and raw `<token>` formats.
 */
function extractBearerToken(headerValue: string): string {
  return headerValue.startsWith("Bearer ")
    ? headerValue.slice(7)
    : headerValue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a Supabase-issued JWT and return the decoded payload.
 * We use Supabase's built-in getUser method to avoid JWKS compatibility issues with EC keys.
 */
export async function verifySupabaseToken(
  token: string,
): Promise<TokenPayload> {
  // Use a fresh client for the user to avoid mutating the global admin client singleton
  const supabase = getSupabaseForUser(token);
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) {
    throw new Error(`[auth] JWT verification failed: ${error?.message || "No user"}`);
  }

  return {
    sub: data.user.id,
    email: data.user.email ?? "",
    role: data.user.role ?? "authenticated",
  };
}

/**
 * Authenticate an incoming WebSocket upgrade request.
 *
 * Looks for the token in:
 * 1. `?token=<jwt>` query parameter (preferred for browser WebSocket API)
 * 2. `Authorization: Bearer <jwt>` header
 */
export async function authenticateWs(
  request: IncomingMessage,
): Promise<TokenPayload> {
  // 1. Try query parameter
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const queryToken = url.searchParams.get("token");

  if (queryToken) {
    return verifySupabaseToken(queryToken);
  }

  // 2. Try Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader) {
    return verifySupabaseToken(extractBearerToken(authHeader));
  }

  throw new Error("[auth] No token provided (use ?token= or Authorization header)");
}
