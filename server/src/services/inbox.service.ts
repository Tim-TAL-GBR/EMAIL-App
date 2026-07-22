import { getSupabaseAdmin } from "./auth.service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InboxRole = "admin" | "member" | "observer";

export interface Inbox {
  id: string;
  team_id: string | null;
  name: string;
  email_address: string | null;
  type: "private" | "shared";
  owner_id: string | null;
  color: string | null;
  description: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  sync_since: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Inbox Service
// ---------------------------------------------------------------------------

/**
 * Retrieve the user's role within a specific inbox via the
 * `get_user_inbox_role` RPC function defined in the database.
 *
 * Returns `null` if the user has no access to the inbox.
 */
export async function getUserInboxRole(
  userId: string,
  inboxId: string,
): Promise<InboxRole | null> {
  const supabase = getSupabaseAdmin();

  const { data: inbox, error: inboxError } = await supabase
    .from("inboxes")
    .select("type, owner_id")
    .eq("id", inboxId)
    .single();

  if (inboxError || !inbox) return null;

  if (inbox.type === "private") {
    return inbox.owner_id === userId ? "admin" : null;
  }

  if (inbox.type === "shared") {
    const { data: member, error: memberError } = await supabase
      .from("inbox_members")
      .select("role")
      .eq("inbox_id", inboxId)
      .eq("user_id", userId)
      .single();

    if (!memberError && member) {
      return member.role as InboxRole;
    }
  }

  return null;
}

/**
 * Return all inbox IDs that a user can access.
 *
 * This includes:
 * - Private inboxes owned by the user
 * - Shared inboxes where the user is a member
 */
export async function getUserAccessibleInboxIds(
  userId: string,
): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  // Private inboxes owned by the user
  const { data: ownedInboxes, error: ownedError } = await supabase
    .from("inboxes")
    .select("id")
    .eq("type", "private")
    .eq("owner_id", userId);

  if (ownedError) {
    console.error("[inbox-service] Failed to fetch owned inboxes:", ownedError.message);
  }

  // Shared inboxes where the user is a member
  const { data: memberInboxes, error: memberError } = await supabase
    .from("inbox_members")
    .select("inbox_id")
    .eq("user_id", userId);

  if (memberError) {
    console.error("[inbox-service] Failed to fetch member inboxes:", memberError.message);
  }

  const inboxIds = new Set<string>();

  for (const inbox of ownedInboxes ?? []) {
    inboxIds.add(inbox.id);
  }
  for (const member of memberInboxes ?? []) {
    inboxIds.add(member.inbox_id);
  }

  return Array.from(inboxIds);
}

/**
 * Fetch a single inbox by its ID.
 */
export async function getInboxById(inboxId: string): Promise<Inbox | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("inboxes")
    .select("*")
    .eq("id", inboxId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[inbox-service] getInboxById error:", error.message);
    return null;
  }

  return data as Inbox;
}
