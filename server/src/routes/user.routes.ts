import { Router } from "express";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { requireAuth } from "../middleware/expressAuth.middleware.js";

export const userRouter: Router = Router();

// Alle Routen in diesem Router erfordern Authentifizierung
userRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/users - List all users in the system (System Admin functionality)
// ---------------------------------------------------------------------------
userRouter.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get all users from auth system
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Map to a frontend-friendly format
    const mappedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      role: 'system_user', // placeholder since they don't have a team context here
      joinedAt: user.created_at,
      isMe: user.id === req.user!.sub
    }));

    res.json(mappedUsers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/users/:id - Delete a user permanently (System Admin)
// ---------------------------------------------------------------------------
userRouter.delete("/:id", async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const callerId = req.user!.sub;

    // Users can only delete themselves, unless they are team owner
    if (callerId !== targetUserId) {
      // Check if caller is an owner of any team the target belongs to
      const supabase = getSupabaseAdmin();
      const { data: callerMemberships } = await supabase
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", callerId)
        .eq("role", "owner");

      if (!callerMemberships || callerMemberships.length === 0) {
        return res.status(403).json({ error: "Nur Team-Owner können andere Benutzer löschen" });
      }

      // Verify target is in one of the caller's teams
      const { data: targetMembership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", targetUserId)
        .in("team_id", callerMemberships.map(m => m.team_id))
        .maybeSingle();

      if (!targetMembership) {
        return res.status(403).json({ error: "Benutzer gehört nicht zu deinem Team" });
      }
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.deleteUser(targetUserId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: "Benutzer wurde endgültig gelöscht" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/users/me - Delete own account permanently
// ---------------------------------------------------------------------------
userRouter.delete("/me", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: "Benutzerkonto wurde endgültig gelöscht" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
