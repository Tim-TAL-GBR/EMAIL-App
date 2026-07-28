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
 * Check if a user is a team member (or org member) for a given team.
 * Returns the role as a string, or null if not a member.
 */
async function getTeamMembershipRole(
  userId: string,
  teamId: string | null,
): Promise<string | null> {
  if (!teamId) return null;
  const supabase = getSupabaseAdmin();

  const { data: member, error } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (!error && member) {
    return member.role;
  }

  return null;
}

/**
 * Check if a user is an org member (via parent org or any sub-team).
 * Mirrors the `is_org_member()` RLS function but uses explicit user_id.
 */
async function checkIsOrgMember(
  userId: string,
  teamId: string | null,
): Promise<boolean> {
  if (!teamId) return false;
  const supabase = getSupabaseAdmin();

  // First check if user is a direct team member
  const { data: directMember } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (directMember) return true;

  // Check if user is a member of a sub-team that belongs to this org
  const { data: subTeamMembers } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  if (!subTeamMembers || subTeamMembers.length === 0) return false;

  const userTeamIds = subTeamMembers.map(t => t.team_id);

  // Check if any of user's teams has parent_id = teamId (i.e., is a sub-team of the org)
  const { data: subTeams } = await supabase
    .from("teams")
    .select("id")
    .eq("parent_id", teamId)
    .in("id", userTeamIds);

  return !!subTeams && subTeams.length > 0;
}

/**
 * Retrieve the user's role within a specific inbox.
 *
 * Access is granted when:
 * - Private inbox: user is owner → returns "admin"
 * - Shared inbox: user is in inbox_members (returns that role),
 *   or user is in team_members for the inbox's team → returns "member",
 *   or user is an org member → returns "observer"
 *
 * Returns `null` if the user has no access.
 */
export async function getUserInboxRole(
  userId: string,
  inboxId: string,
): Promise<InboxRole | null> {
  const supabase = getSupabaseAdmin();

  const { data: inbox, error: inboxError } = await supabase
    .from("inboxes")
    .select("type, owner_id, team_id")
    .eq("id", inboxId)
    .single();

  if (inboxError || !inbox) return null;

  if (inbox.type === "private") {
    return inbox.owner_id === userId ? "admin" : null;
  }

  if (inbox.type === "shared") {
    // Check inbox_members first
    const { data: member, error: memberError } = await supabase
      .from("inbox_members")
      .select("role")
      .eq("inbox_id", inboxId)
      .eq("user_id", userId)
      .single();

    if (!memberError && member) {
      return member.role as InboxRole;
    }

    // Fallback: check team_members
    const teamRole = await getTeamMembershipRole(userId, inbox.team_id);
    if (teamRole) {
      return "member" as InboxRole;
    }

    // Fallback: check org membership
    const isOrgMember = await checkIsOrgMember(userId, inbox.team_id);
    if (isOrgMember) {
      return "observer" as InboxRole;
    }
  }

  return null;
}

/**
 * Return all inbox IDs that a user can access.
 *
 * This mirrors the RLS `inboxes_select` policy:
 * - Private inboxes owned by the user
 * - Shared inboxes where the user is a member of inbox_members,
 *   or a member of the inbox's team, or an org member
 */
export async function getUserAccessibleInboxIds(
  userId: string,
): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  // 1. Private inboxes owned by the user
  const { data: ownedInboxes } = await supabase
    .from("inboxes")
    .select("id")
    .eq("type", "private")
    .eq("owner_id", userId);

  // 2. Shared inboxes via inbox_members
  const { data: memberInboxes } = await supabase
    .from("inbox_members")
    .select("inbox_id")
    .eq("user_id", userId);

  // 3. Get user's team memberships (for team + org access)
  const { data: userTeams } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  const userTeamIds = (userTeams ?? []).map(t => t.team_id);

  // 4. Get parent orgs of user's teams
  const { data: teamsWithParent } = userTeamIds.length > 0
    ? await supabase.from("teams").select("id, parent_id").in("id", userTeamIds)
    : { data: [] };

  const accessibleTeamIds = new Set(userTeamIds);
  for (const t of teamsWithParent ?? []) {
    if (t.parent_id) accessibleTeamIds.add(t.parent_id);
  }

  // 5. Shared inboxes where team_id is in accessibleTeamIds
  const { data: teamInboxes } = accessibleTeamIds.size > 0
    ? await supabase
        .from("inboxes")
        .select("id")
        .eq("type", "shared")
        .in("team_id", Array.from(accessibleTeamIds))
    : { data: [] };

  const inboxIds = new Set<string>();

  for (const inbox of ownedInboxes ?? []) inboxIds.add(inbox.id);
  for (const member of memberInboxes ?? []) inboxIds.add(member.inbox_id);
  for (const inbox of teamInboxes ?? []) inboxIds.add(inbox.id);

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
