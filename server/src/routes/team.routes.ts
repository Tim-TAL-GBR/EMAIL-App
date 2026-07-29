import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.middleware.js";

export const teamRouter: Router = Router();

teamRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/teams – List all teams the authenticated user belongs to
// ---------------------------------------------------------------------------
teamRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("team_members")
      .select(`
        role,
        joined_at,
        teams (
          id, name, slug, created_at, parent_id
        )
      `)
      .eq("user_id", userId)
      .order("joined_at");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Also fetch sub-teams where user is a member of the parent org
    const { data: subTeams } = await supabase
      .from("teams")
      .select("id, name, slug, created_at, parent_id")
      .not("parent_id", "is", null);

    const teamIds = new Set(data?.map((tm: any) => tm.teams?.id) ?? []);
    const orgIds = data?.filter((tm: any) => !tm.teams?.parent_id).map((tm: any) => tm.teams?.id) ?? [];

    const extraSubTeams = (subTeams ?? []).filter(
      (st) => !teamIds.has(st.id) && orgIds.includes(st.parent_id)
    );

    const teams = [
      ...(data?.map((tm: any) => ({
        ...tm.teams,
        myRole: tm.role,
      })) ?? []),
      ...extraSubTeams.map((st) => ({
        ...st,
        myRole: "member" as const,
      })),
    ];

    res.json(teams);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/teams – Create a new team, add creator as owner
// ---------------------------------------------------------------------------
teamRouter.post("/", validateBody(z.object({ name: z.string().min(1), parent_id: z.string().uuid().optional() })), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { name, parent_id } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "Name ist erforderlich" });
      return;
    }

    const supabase = getSupabaseAdmin();

    // If creating a sub-team, verify user is admin/owner of parent org
    if (parent_id) {
      const { data: parentMember } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", parent_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!parentMember || !["owner", "admin"].includes(parentMember.role)) {
        res.status(403).json({ error: "Nur Admins können Teams innerhalb einer Organisation erstellen" });
        return;
      }
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({ name: name.trim(), slug, parent_id: parent_id || null })
      .select()
      .single();

    if (teamError) {
      res.status(500).json({ error: teamError.message });
      return;
    }

    // Add creator as owner
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: userId, role: "owner" });

    if (memberError) {
      res.status(500).json({ error: memberError.message });
      return;
    }

    res.status(201).json({ ...team, myRole: "owner" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/teams/:id/members – List all members with their profile
// ---------------------------------------------------------------------------
teamRouter.get("/:id/members", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const supabase = getSupabaseAdmin();

    // Only team members can view the list
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership) {
      res.status(403).json({ error: "Kein Zugriff auf dieses Team" });
      return;
    }

    const { data, error } = await supabase
      .from("team_members")
      .select(`
        role,
        custom_role_id,
        joined_at,
        profiles (
          id, email, display_name, avatar_url
        )
      `)
      .eq("team_id", teamId)
      .order("joined_at");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const members = data?.map((tm) => ({
      ...(tm.profiles as any),
      role: tm.role,
      custom_role_id: tm.custom_role_id,
      joinedAt: tm.joined_at,
      isMe: (tm.profiles as any)?.id === userId,
    })) ?? [];

    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/teams/:id/members/invite – Invite a user by email
// ---------------------------------------------------------------------------
teamRouter.post("/:id/members/invite", validateBody(z.object({ email: z.string().email(), role: z.enum(['admin', 'member', 'owner']).optional() })), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const { email, role = "member" } = req.body;

    if (!email?.trim()) {
      res.status(400).json({ error: "E-Mail ist erforderlich" });
      return;
    }

    const supabase = getSupabaseAdmin();

    // Only owner/admin can invite
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      // Check if user is admin of parent org (for sub-team invites)
      const { data: teamInfo } = await supabase
        .from("teams")
        .select("parent_id")
        .eq("id", teamId)
        .maybeSingle();

      if (teamInfo?.parent_id) {
        const { data: parentMember } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", teamInfo.parent_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!parentMember || !["owner", "admin"].includes(parentMember.role)) {
          res.status(403).json({ error: "Nur Admins können Mitglieder einladen" });
          return;
        }
      } else {
        res.status(403).json({ error: "Nur Admins können Mitglieder einladen" });
        return;
      }
    }

    let { data: profile } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (!profile) {
      // User doesn't exist, invite them via Supabase Auth
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email.trim().toLowerCase());
      
      if (inviteError) {
        res.status(500).json({ error: `Einladung fehlgeschlagen: ${inviteError.message}` });
        return;
      }
      
      if (!inviteData?.user) {
        res.status(500).json({ error: "Fehler beim Erstellen der Einladung" });
        return;
      }

      // Trigger should have created the profile synchronously
      profile = {
        id: inviteData.user.id,
        email: inviteData.user.email,
        display_name: null,
      };
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: "Dieser Benutzer ist bereits Mitglied des Teams" });
      return;
    }

    // Add member
    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: teamId, user_id: profile.id, role });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ 
      message: `${profile.display_name || profile.email} wurde erfolgreich hinzugefügt`,
      user: profile 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/teams/:id/members/create – Create a user directly and add to team
// ---------------------------------------------------------------------------
teamRouter.post("/:id/members/create", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const { email, password, name, role = "member" } = req.body;

    if (!email?.trim() || !password?.trim()) {
      res.status(400).json({ error: "E-Mail und Passwort sind erforderlich" });
      return;
    }

    const supabase = getSupabaseAdmin();

    // Only owner/admin can create
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      res.status(403).json({ error: "Nur Admins können Benutzer anlegen" });
      return;
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      res.status(409).json({ error: "Ein Benutzer mit dieser E-Mail existiert bereits. Nutze stattdessen die Einladen-Funktion." });
      return;
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true, // Auto confirm so they can login immediately
      user_metadata: {
        display_name: name?.trim() || "",
        full_name: name?.trim() || ""
      }
    });

    if (authError) {
      res.status(500).json({ error: `Konnte Benutzer nicht anlegen: ${authError.message}` });
      return;
    }

    if (!authData?.user) {
      res.status(500).json({ error: "Fehler beim Anlegen des Benutzers (Kein User zurückgegeben)" });
      return;
    }

    // The handle_new_user trigger in the database will create the profile automatically.
    // Wait briefly for the trigger to complete to ensure the profile exists, or just insert into team_members (it cascade-links via auth.users -> profiles).
    
    // Add member
    const { error: teamError } = await supabase
      .from("team_members")
      .insert({ team_id: teamId, user_id: authData.user.id, role });

    if (teamError) {
      // Best effort to clean up auth user if team insert fails? 
      // Supabase does not easily support rollback across auth + public schema, 
      // but let's at least return the error.
      res.status(500).json({ error: `Benutzer wurde erstellt, konnte aber nicht zum Team hinzugefügt werden: ${teamError.message}` });
      return;
    }

    res.status(201).json({ 
      message: `${name || email} wurde erfolgreich angelegt und zum Team hinzugefügt.`,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        display_name: name || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/teams/:id/members/:userId – Change a member's role
// ---------------------------------------------------------------------------
teamRouter.patch("/:id/members/:memberId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const memberId = req.params.memberId;
    const { role, custom_role_id } = req.body;

    if (!role || !["owner", "admin", "member"].includes(role)) {
      res.status(400).json({ error: "Ungültige Rolle" });
      return;
    }

    const supabase = getSupabaseAdmin();

    // Only owner/admin can change roles (check direct or via parent org)
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();

    let effectiveRole = myMembership?.role;

    // If not a direct member, check parent org
    if (!effectiveRole) {
      const { data: teamInfo } = await supabase
        .from("teams")
        .select("parent_id")
        .eq("id", teamId)
        .maybeSingle();

      if (teamInfo?.parent_id) {
        const { data: parentMember } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", teamInfo.parent_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (parentMember && ["owner", "admin"].includes(parentMember.role)) {
          effectiveRole = parentMember.role;
        }
      }
    }

    if (!effectiveRole || !["owner", "admin"].includes(effectiveRole)) {
      res.status(403).json({ error: "Keine Berechtigung zum Ändern von Rollen" });
      return;
    }

    const { data: targetMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", memberId)
      .maybeSingle();

    if (!targetMembership) {
      res.status(404).json({ error: "Mitglied nicht gefunden" });
      return;
    }

    if (effectiveRole === "admin" && targetMembership.role === "owner") {
      res.status(403).json({ error: "Ein Admin kann die Rolle eines Owners nicht ändern" });
      return;
    }

    if (role === "owner" && effectiveRole !== "owner") {
      res.status(403).json({ error: "Nur ein Owner kann die Rolle 'owner' vergeben" });
      return;
    }

    if (targetMembership.role === "owner" && role !== "owner" && effectiveRole !== "owner") {
      res.status(403).json({ error: "Nur ein Owner kann einen anderen Owner herabstufen" });
      return;
    }

    const { error } = await supabase
      .from("team_members")
      .update({ role, custom_role_id: custom_role_id || null })
      .eq("team_id", teamId)
      .eq("user_id", memberId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: "Rolle erfolgreich geändert" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/teams/:id/members/:userId – Remove a member
// ---------------------------------------------------------------------------
teamRouter.delete("/:id/members/:memberId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const memberId = req.params.memberId;
    const supabase = getSupabaseAdmin();

    // Can remove self OR admin/owner can remove anyone
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership) {
      res.status(403).json({ error: "Kein Zugriff auf dieses Team" });
      return;
    }

    const isSelf = userId === memberId;
    const isAdminOrOwner = ["owner", "admin"].includes(myMembership.role);

    if (!isSelf && !isAdminOrOwner) {
      res.status(403).json({ error: "Keine Berechtigung zum Entfernen von Mitgliedern" });
      return;
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", memberId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: "Mitglied erfolgreich entfernt" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/teams/:id – Update team name
// ---------------------------------------------------------------------------
teamRouter.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const { name } = req.body;
    const supabase = getSupabaseAdmin();

    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      // Check if user is admin of parent org (for sub-team rename)
      const { data: teamInfo } = await supabase
        .from("teams")
        .select("parent_id")
        .eq("id", teamId)
        .maybeSingle();

      if (teamInfo?.parent_id) {
        const { data: parentMember } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", teamInfo.parent_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!parentMember || !["owner", "admin"].includes(parentMember.role)) {
          res.status(403).json({ error: "Keine Berechtigung" });
          return;
        }
      } else {
        res.status(403).json({ error: "Keine Berechtigung" });
        return;
      }
    }

    const { data, error } = await supabase
      .from("teams")
      .update({ name: name.trim() })
      .eq("id", teamId)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/teams/:id – Delete a team (owner only)
// ---------------------------------------------------------------------------
teamRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const supabase = getSupabaseAdmin();

    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership || myMembership.role !== "owner") {
      // Check if user is owner of parent org (for sub-team deletion)
      const { data: teamInfo } = await supabase
        .from("teams")
        .select("parent_id")
        .eq("id", teamId)
        .maybeSingle();

      if (teamInfo?.parent_id) {
        const { data: parentMember } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", teamInfo.parent_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (parentMember?.role !== "owner") {
          res.status(403).json({ error: "Nur der Eigentümer kann das Team löschen" });
          return;
        }
      } else {
        res.status(403).json({ error: "Nur der Eigentümer kann das Team löschen" });
        return;
      }
    }

    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", teamId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: "Team erfolgreich gelöscht" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/teams/unassigned-users – Users with no team membership at all
// ---------------------------------------------------------------------------
teamRouter.get("/unassigned-users", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    const { data: allProfiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url");

    if (profileErr) {
      res.status(500).json({ error: profileErr.message });
      return;
    }

    const { data: members } = await supabase
      .from("team_members")
      .select("user_id");

    const memberUserIds = new Set((members || []).map((m: any) => m.user_id));
    const unassigned = (allProfiles || []).filter((p: any) => !memberUserIds.has(p.id));

    res.json(unassigned);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/teams/:id/available-users – Users in the parent org, not yet in this team
// ---------------------------------------------------------------------------
teamRouter.get("/:id/available-users", async (req, res) => {
  try {
    const teamId = req.params.id;
    const supabase = getSupabaseAdmin();

    // Find the parent org for this team
    const { data: team } = await supabase
      .from("teams")
      .select("parent_id")
      .eq("id", teamId)
      .maybeSingle();

    if (!team?.parent_id) {
      // No parent org — return all users not in this team
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, email, display_name, avatar_url");

      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId);

      const memberIds = new Set((teamMembers || []).map((m: any) => m.user_id));
      const available = (allProfiles || []).filter((p: any) => !memberIds.has(p.id));
      res.json(available);
      return;
    }

    // Get all members of the parent org, sibling teams, and current team concurrently
    const [
      { data: orgMembers },
      { data: siblingTeams },
      { data: teamMembers }
    ] = await Promise.all([
      supabase.from("team_members").select("user_id").eq("team_id", team.parent_id),
      supabase.from("teams").select("id").eq("parent_id", team.parent_id),
      supabase.from("team_members").select("user_id").eq("team_id", teamId)
    ]);

    const siblingIds = (siblingTeams || []).map((t: any) => t.id);
    let siblingMembers: any[] = [];
    if (siblingIds.length > 0) {
      const { data } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", siblingIds);
      siblingMembers = data || [];
    }

    // Combine all org-level user IDs
    const orgUserIds = new Set([
      ...(orgMembers || []).map((m: any) => m.user_id),
      ...(siblingMembers || []).map((m: any) => m.user_id),
    ]);

    // Remove users already in this team
    const memberIds = new Set((teamMembers || []).map((m: any) => m.user_id));
    const availableUserIds = Array.from(orgUserIds).filter(id => !memberIds.has(id));

    let available: any[] = [];
    if (availableUserIds.length > 0) {
      const { data: orgProfiles } = await supabase
        .from("profiles")
        .select("id, email, display_name, avatar_url")
        .in("id", availableUserIds);
      available = orgProfiles || [];
    }

    res.json(available);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/teams/unassigned-users/:userId – Delete an unassigned user
// ---------------------------------------------------------------------------
teamRouter.delete("/unassigned-users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const supabase = getSupabaseAdmin();

    const { data: membership } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (membership) {
      res.status(400).json({ error: "Benutzer ist einem Team zugeordnet und kann nicht gelöscht werden." });
      return;
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileErr) {
      res.status(500).json({ error: profileErr.message });
      return;
    }

    const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
    if (authErr) {
      console.warn("Could not delete auth user:", authErr.message);
    }

    res.json({ message: "Benutzer erfolgreich gelöscht" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/teams/:id/roles – List all custom roles for a team
// ---------------------------------------------------------------------------
teamRouter.get("/:id/roles", async (req, res) => {
  try {
    const teamId = req.params.id;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("custom_roles").select("*").eq("team_id", teamId);
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/teams/:id/roles – Create custom role
// ---------------------------------------------------------------------------
teamRouter.post("/:id/roles", async (req, res) => {
  try {
    const teamId = req.params.id;
    const { name, permissions, description } = req.body;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("custom_roles").insert({ team_id: teamId, name, permissions, description }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/teams/:id/roles/:roleId – Update custom role
// ---------------------------------------------------------------------------
teamRouter.patch("/:id/roles/:roleId", async (req, res) => {
  try {
    const teamId = req.params.id;
    const roleId = req.params.roleId;
    const { name, permissions, description } = req.body;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("custom_roles").update({ name, permissions, description }).eq("id", roleId).eq("team_id", teamId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/teams/:id/roles/:roleId – Delete custom role
// ---------------------------------------------------------------------------
teamRouter.delete("/:id/roles/:roleId", async (req, res) => {
  try {
    const teamId = req.params.id;
    const roleId = req.params.roleId;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("custom_roles").delete().eq("id", roleId).eq("team_id", teamId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/teams/:id/members/:memberId/inboxes – Get all inboxes for a team and the member's roles
// ---------------------------------------------------------------------------
teamRouter.get("/:id/members/:memberId/inboxes", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const memberId = req.params.memberId;
    const supabase = getSupabaseAdmin();

    // Verify access
    const { data: myMembership } = await supabase.from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      if (!await import("../middleware/permissions.middleware.js").then(m => m.isSuperAdmin(userId))) {
        res.status(403).json({ error: "Keine Berechtigung" });
        return;
      }
    }

    // Fetch all inboxes for team
    const { data: inboxes } = await supabase.from("inboxes").select("*").eq("team_id", teamId).eq("type", "shared");
    
    // Fetch user's inbox memberships
    const { data: memberships } = await supabase.from("inbox_members").select("*").eq("user_id", memberId).in("inbox_id", (inboxes || []).map((i: any) => i.id));

    const result = (inboxes || []).map((inbox: any) => {
      const membership = (memberships || []).find((m: any) => m.inbox_id === inbox.id);
      return {
        ...inbox,
        userRole: membership?.role || null,
        hasAccess: !!membership
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/teams/:id/members/:memberId/inboxes – Update member's inbox access
// ---------------------------------------------------------------------------
teamRouter.patch("/:id/members/:memberId/inboxes", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.params.id;
    const memberId = req.params.memberId;
    const { inboxId, role, hasAccess } = req.body;
    const supabase = getSupabaseAdmin();

    // Verify access
    const { data: myMembership } = await supabase.from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      if (!await import("../middleware/permissions.middleware.js").then(m => m.isSuperAdmin(userId))) {
        res.status(403).json({ error: "Keine Berechtigung" });
        return;
      }
    }

    if (hasAccess) {
      // Upsert
      const { error } = await supabase.from("inbox_members").upsert({ inbox_id: inboxId, user_id: memberId, role: role || 'member' }, { onConflict: 'inbox_id,user_id' });
      if (error) throw error;
    } else {
      // Delete
      const { error } = await supabase.from("inbox_members").delete().eq("inbox_id", inboxId).eq("user_id", memberId);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

