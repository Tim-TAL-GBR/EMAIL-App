import { getUserInboxRole, getInboxById } from "../services/inbox.service.js";
import { getEmailInboxId } from "../services/email.service.js";
import type { InboxRole } from "../services/inbox.service.js";

// ---------------------------------------------------------------------------
// Simple TTL Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

const roleCache = new Map<string, CacheEntry<InboxRole | null>>();
const ownerCache = new Map<string, CacheEntry<string | null>>();

function cacheKey(userId: string, resourceId: string): string {
  return `${userId}:${resourceId}`;
}

/**
 * Retrieve a cached value or compute & store it if missing / expired.
 */
async function withCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  compute: () => Promise<T>,
): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }

  const value = await compute();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

// Periodically purge expired cache entries to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of roleCache) {
    if (entry.expiresAt <= now) roleCache.delete(key);
  }
  for (const [key, entry] of ownerCache) {
    if (entry.expiresAt <= now) ownerCache.delete(key);
  }
}, CACHE_TTL_MS).unref();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the cached inbox role for a user, falling back to a DB lookup.
 */
async function getCachedRole(
  userId: string,
  inboxId: string,
): Promise<InboxRole | null> {
  return withCache(roleCache, cacheKey(userId, inboxId), () =>
    getUserInboxRole(userId, inboxId),
  );
}

/**
 * Returns the owner_id for an inbox (cached).
 */
async function getCachedOwnerId(inboxId: string): Promise<string | null> {
  return withCache(ownerCache, inboxId, async () => {
    const inbox = await getInboxById(inboxId);
    return inbox?.owner_id ?? null;
  });
}

// ---------------------------------------------------------------------------
// Access Guards
// ---------------------------------------------------------------------------

/**
 * Check whether a user may read from an inbox.
 *
 * Access is granted when:
 * - The user is the owner of a **private** inbox, OR
 * - The user has any role via `inbox_members` (admin / member / observer)
 */
export async function canAccessInbox(
  userId: string,
  inboxId: string,
): Promise<boolean> {
  // Fast path: check ownership
  const ownerId = await getCachedOwnerId(inboxId);
  if (ownerId === userId) return true;

  // Membership check
  const role = await getCachedRole(userId, inboxId);
  return role !== null;
}

/**
 * Check whether a user may read an email.
 *
 * Resolves the email's inbox and delegates to `canAccessInbox`.
 */
export async function canAccessEmail(
  userId: string,
  emailId: string,
): Promise<boolean> {
  const inboxId = await getEmailInboxId(emailId);
  if (!inboxId) return false;
  return canAccessInbox(userId, inboxId);
}

/**
 * Check whether a user may write to an inbox (create / update emails).
 *
 * Requires at least a **member** role (or inbox ownership).
 */
export async function canWriteToInbox(
  userId: string,
  inboxId: string,
): Promise<boolean> {
  // Owner always has write access
  const ownerId = await getCachedOwnerId(inboxId);
  if (ownerId === userId) return true;

  const role = await getCachedRole(userId, inboxId);
  return role === "admin" || role === "member";
}

/**
 * Check whether a user may manage an inbox (settings, member management).
 *
 * Requires **admin** role or ownership of a private inbox.
 */
export async function canManageInbox(
  userId: string,
  inboxId: string,
): Promise<boolean> {
  // Owner of a private inbox has full management rights
  const ownerId = await getCachedOwnerId(inboxId);
  if (ownerId === userId) return true;

  const role = await getCachedRole(userId, inboxId);
  return role === "admin";
}
