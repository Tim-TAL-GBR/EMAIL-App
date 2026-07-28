import { safeErrorMessage } from "../utils/errors.js";
import { Router } from "express";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { requireAuth } from "../middleware/expressAuth.middleware.js";

export const userEmailSettingsRouter: Router = Router();

// GET /api/user-email-settings?team_id=...&inbox_id=...
// Returns all user email settings for a team (admin) or for the current user
userEmailSettingsRouter.get("/", requireAuth, async (req, res) => {
  const teamId = req.query.team_id as string;
  const inboxId = req.query.inbox_id as string;
  const userId = req.query.user_id as string;

  const supabase = getSupabaseAdmin();

  try {
    let query = supabase
      .from("user_email_settings")
      .select(`
        id, user_id, inbox_id, signature_id, display_name, reply_to, created_at, updated_at,
        inbox:inboxes!inner(id, email_address, name, team_id),
        signature:signatures(id, name, content_text, scope),
        user:profiles!user_email_settings_user_id_fkey(id, email, display_name)
      `);

    if (teamId) {
      // Filter to inboxes belonging to this team
      query = query.eq("inbox.team_id", teamId);
    }
    if (inboxId) {
      query = query.eq("inbox_id", inboxId);
    }
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    res.json({ settings: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

// GET /api/user-email-settings/mine?inbox_id=...
// Returns the current user's own settings (used by composer)
userEmailSettingsRouter.get("/mine", requireAuth, async (req, res) => {
  const inboxId = req.query.inbox_id as string;
  const supabase = getSupabaseAdmin();

  try {
    let query = supabase
      .from("user_email_settings")
      .select("id, inbox_id, signature_id, display_name, reply_to, signature:signatures(id, name, content_text)")
      .eq("user_id", req.user!.sub);

    if (inboxId) {
      query = query.eq("inbox_id", inboxId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ settings: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

// POST /api/user-email-settings — upsert a setting (admin only)
userEmailSettingsRouter.post("/", requireAuth, async (req, res) => {
  const { userId, inboxId, signatureId, displayName, replyTo } = req.body;
  if (!userId || !inboxId) {
    return res.status(400).json({ error: "Missing userId or inboxId" });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Verify caller is admin/owner of the inbox's team
    const { data: inbox } = await supabase
      .from("inboxes")
      .select("team_id")
      .eq("id", inboxId)
      .single();

    if (!inbox) return res.status(404).json({ error: "Inbox not found" });

    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", inbox.team_id)
      .eq("user_id", req.user!.sub)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return res.status(403).json({ error: "Only team admins can manage email settings" });
    }

    const { data, error } = await supabase
      .from("user_email_settings")
      .upsert({
        user_id: userId,
        inbox_id: inboxId,
        signature_id: signatureId || null,
        display_name: displayName || null,
        reply_to: replyTo || null,
      }, { onConflict: "user_id,inbox_id" })
      .select()
      .single();

    if (error) throw error;
    res.json({ setting: data });
  } catch (e: any) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

// DELETE /api/user-email-settings/:id — remove a setting (admin only)
userEmailSettingsRouter.delete("/:id", requireAuth, async (req, res) => {
  const supabase = getSupabaseAdmin();

  try {
    const { data: setting } = await supabase
      .from("user_email_settings")
      .select("inbox_id")
      .eq("id", req.params.id)
      .single();

    if (!setting) return res.status(404).json({ error: "Setting not found" });

    const { data: inbox } = await supabase
      .from("inboxes")
      .select("team_id")
      .eq("id", setting.inbox_id)
      .single();

    if (!inbox) return res.status(404).json({ error: "Inbox not found" });

    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", inbox.team_id)
      .eq("user_id", req.user!.sub)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return res.status(403).json({ error: "Only team admins can manage email settings" });
    }

    const { error } = await supabase
      .from("user_email_settings")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});
