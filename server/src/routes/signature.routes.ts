import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.middleware.js";

export const signatureRouter: Router = Router();

signatureRouter.use(requireAuth);

// GET /api/signatures?team_id=...
// Gets all team signatures for the specified team
signatureRouter.get("/", async (req, res) => {
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
      .from("signatures")
      .select("*")
      .eq("team_id", teamId)
      .eq("scope", "team");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/signatures
// Create or update a signature for a specific user in a team
const signatureSchema = z.object({
  team_id: z.string().uuid(),
  owner_id: z.string().uuid(), // The user the signature is for
  content_text: z.string()
});

signatureRouter.post("/", validateBody(signatureSchema), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { team_id, owner_id, content_text } = req.body;
    
    const supabase = getSupabaseAdmin();

    // Verify requesting user is admin/owner of the team
    const { data: myMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", team_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
      res.status(403).json({ error: "Nur Admins können Signaturen bearbeiten" });
      return;
    }

    // Verify target user is member of the team
    const { data: targetMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", team_id)
      .eq("user_id", owner_id)
      .maybeSingle();

    if (!targetMembership) {
      res.status(400).json({ error: "Zielbenutzer ist kein Mitglied der Organisation" });
      return;
    }

    // Check if signature already exists for this team + owner
    const { data: existing } = await supabase
      .from("signatures")
      .select("id")
      .eq("team_id", team_id)
      .eq("owner_id", owner_id)
      .eq("scope", "team")
      .maybeSingle();

    let result;
    if (existing) {
      // Update
      const { data, error } = await supabase
        .from("signatures")
        .update({ content_text })
        .eq("id", existing.id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      result = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from("signatures")
        .insert({
          team_id,
          owner_id,
          scope: "team",
          name: "Team Signature", // Optional fallback name
          content_text
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      result = data;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
