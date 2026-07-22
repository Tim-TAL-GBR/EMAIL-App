import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";

export const templateRouter: Router = Router();

templateRouter.use(requireAuth);

templateRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const supabase = getSupabaseAdmin();

    const { data: templates, error } = await supabase
      .from("templates")
      .select("*")
      .or(`owner_id.eq.${userId},scope.eq.team`)
      .order("name");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ templates: templates ?? [] });
  } catch (err: any) {
    console.error("[TemplateRoutes] GET / error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

templateRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { name, subject, body, scope, team_id } = req.body;

    if (!name || !body) {
      res.status(400).json({ error: "name and body are required" });
      return;
    }

    if (!["private", "team"].includes(scope || "private")) {
      res.status(400).json({ error: "scope must be private or team" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("templates")
      .insert({
        name,
        subject: subject ?? null,
        body,
        scope: scope ?? "private",
        owner_id: scope === "private" ? userId : null,
        team_id: scope === "team" ? team_id : null,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ template: data });
  } catch (err: any) {
    console.error("[TemplateRoutes] POST / error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

templateRouter.put("/:templateId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { templateId } = req.params;
    const { name, subject, body } = req.body;

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("templates")
      .select("owner_id")
      .eq("id", templateId)
      .single();

    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    if (existing.owner_id && existing.owner_id !== userId) {
      res.status(403).json({ error: "Not authorized to edit this template" });
      return;
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;

    const { data, error } = await supabase
      .from("templates")
      .update(updates)
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ template: data });
  } catch (err: any) {
    console.error("[TemplateRoutes] PUT /:templateId error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

templateRouter.delete("/:templateId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { templateId } = req.params;

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("templates")
      .select("owner_id")
      .eq("id", templateId)
      .single();

    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    if (existing.owner_id && existing.owner_id !== userId) {
      res.status(403).json({ error: "Not authorized to delete this template" });
      return;
    }

    const { error } = await supabase
      .from("templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[TemplateRoutes] DELETE /:templateId error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
