import { Router } from "express";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { requireAuth } from "../middleware/expressAuth.middleware.js";

export const userPreferencesRouter: Router = Router();

// GET /api/user-preferences — get current user's preferences
userPreferencesRouter.get("/", requireAuth, async (req, res) => {
  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", req.user!.sub)
      .maybeSingle();

    if (error) throw error;
    res.json({ preferences: data?.preferences || {} });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/user-preferences — upsert preferences (merge)
userPreferencesRouter.put("/", requireAuth, async (req, res) => {
  const { preferences } = req.body;
  if (!preferences || typeof preferences !== "object") {
    return res.status(400).json({ error: "Invalid preferences object" });
  }

  const supabase = getSupabaseAdmin();
  try {
    // Fetch existing row id + preferences
    const { data: existing } = await supabase
      .from("user_preferences")
      .select("id, preferences")
      .eq("user_id", req.user!.sub)
      .maybeSingle();

    const merged = { ...(existing?.preferences || {}), ...preferences };

    // Upsert with primary key (id is PK, guaranteed to work for onConflict)
    const record: any = {
      user_id: req.user!.sub,
      preferences: merged,
      updated_at: new Date().toISOString(),
    };
    if (existing?.id) record.id = existing.id;

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(record, { onConflict: "id" })
      .select("preferences")
      .single();

    if (error) throw error;
    res.json({ preferences: data.preferences });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
