import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.middleware.js";

export const groupRouter: Router = Router();

groupRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/groups?team_id=... – List all groups for a team
// ---------------------------------------------------------------------------
groupRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const teamId = req.query.team_id as string;
    
    if (!teamId) {
      res.status(400).json({ error: "team_id is required" });
      return;
    }
    
    const supabase = getSupabaseAdmin();

    // Verify user is member of the team
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
      .from("org_groups")
      .select(`
        id, name, created_at,
        org_group_members (
          user_id, role
        )
      `)
      .eq("team_id", teamId)
      .order("created_at");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Map to include a simple member count or similar
    const groups = data?.map(g => ({
      id: g.id,
      name: g.name,
      created_at: g.created_at,
      memberCount: g.org_group_members?.length || 0,
      myRole: g.org_group_members?.find((m: any) => m.user_id === userId)?.role || null
    })) ?? [];

    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups – Create a new group
// ---------------------------------------------------------------------------
groupRouter.post("/", validateBody(z.object({ name: z.string().min(1), team_id: z.string().uuid() })), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { name, team_id } = req.body;
    
    const supabase = getSupabaseAdmin();

    // Only owner/admin of the team can create a group
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", team_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      res.status(403).json({ error: "Nur Admins können Teams erstellen" });
      return;
    }

    const { data: group, error: groupError } = await supabase
      .from("org_groups")
      .insert({ name: name.trim(), team_id })
      .select()
      .single();

    if (groupError) {
      res.status(500).json({ error: groupError.message });
      return;
    }

    res.status(201).json({ ...group, memberCount: 0, myRole: null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:id/members – List all members of a group
// ---------------------------------------------------------------------------
groupRouter.get("/:id/members", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const groupId = req.params.id;
    const supabase = getSupabaseAdmin();

    // Must be member of the parent team
    const { data: group } = await supabase
      .from("org_groups")
      .select("team_id")
      .eq("id", groupId)
      .maybeSingle();
      
    if (!group) {
      res.status(404).json({ error: "Team nicht gefunden" });
      return;
    }

    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", group.team_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership) {
      res.status(403).json({ error: "Kein Zugriff" });
      return;
    }

    const { data, error } = await supabase
      .from("org_group_members")
      .select(`
        role,
        joined_at,
        profiles (
          id, email, display_name, avatar_url
        )
      `)
      .eq("group_id", groupId)
      .order("joined_at");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const members = data?.map((tm) => ({
      ...(tm.profiles as any),
      role: tm.role,
      joinedAt: tm.joined_at,
      isMe: (tm.profiles as any)?.id === userId,
    })) ?? [];

    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups/:id/members – Add an existing organization member to a group
// ---------------------------------------------------------------------------
groupRouter.post("/:id/members", validateBody(z.object({ user_id: z.string().uuid() })), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const groupId = req.params.id;
    const { user_id: targetUserId } = req.body;
    
    const supabase = getSupabaseAdmin();

    // Fetch the group to check the parent team
    const { data: group } = await supabase
      .from("org_groups")
      .select("team_id")
      .eq("id", groupId)
      .maybeSingle();
      
    if (!group) {
      res.status(404).json({ error: "Team nicht gefunden" });
      return;
    }

    // Only owner/admin of the parent team can add members to a group
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", group.team_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      res.status(403).json({ error: "Keine Berechtigung" });
      return;
    }
    
    // Make sure the target user is ACTUALLY in the parent team
    const { data: targetMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", group.team_id)
      .eq("user_id", targetUserId)
      .maybeSingle();
      
    if (!targetMembership) {
      res.status(400).json({ error: "Benutzer muss zuerst Teil der Organisation sein" });
      return;
    }

    // Insert into org_group_members
    const { error } = await supabase
      .from("org_group_members")
      .insert({ group_id: groupId, user_id: targetUserId, role: "member" });

    if (error) {
      // Check if already in group (unique violation)
      if (error.code === '23505') {
        res.status(409).json({ error: "Benutzer ist bereits im Team" });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ message: "Benutzer hinzugefügt" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/groups/:id/members/:userId – Remove a member from a group
// ---------------------------------------------------------------------------
groupRouter.delete("/:id/members/:memberId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const groupId = req.params.id;
    const memberId = req.params.memberId;
    const supabase = getSupabaseAdmin();

    const { data: group } = await supabase
      .from("org_groups")
      .select("team_id")
      .eq("id", groupId)
      .maybeSingle();
      
    if (!group) return res.status(404).json({ error: "Team nicht gefunden" });

    // Can remove self OR admin/owner can remove anyone
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", group.team_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership) return res.status(403).json({ error: "Kein Zugriff" });

    const isSelf = userId === memberId;
    const isAdminOrOwner = ["owner", "admin"].includes(myMembership.role);

    if (!isSelf && !isAdminOrOwner) {
      return res.status(403).json({ error: "Keine Berechtigung" });
    }

    const { error } = await supabase
      .from("org_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", memberId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Erfolgreich entfernt" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/groups/:id – Delete a group
// ---------------------------------------------------------------------------
groupRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const groupId = req.params.id;
    const supabase = getSupabaseAdmin();

    const { data: group } = await supabase
      .from("org_groups")
      .select("team_id")
      .eq("id", groupId)
      .maybeSingle();
      
    if (!group) return res.status(404).json({ error: "Team nicht gefunden" });

    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", group.team_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      return res.status(403).json({ error: "Nur Admins können Teams löschen" });
    }

    const { error } = await supabase
      .from("org_groups")
      .delete()
      .eq("id", groupId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Team erfolgreich gelöscht" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
