import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { canAccessEmail } from "../realtime/guards.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { z } from "zod";

export const commentRouter: Router = Router();

commentRouter.use(requireAuth);

commentRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const emailId = req.query.email_id as string | undefined;

    if (!emailId) {
      res.status(400).json({ error: "email_id query parameter is required" });
      return;
    }

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: comments, error } = await supabase
      .from("internal_comments")
      .select("*, author:author_id(id, email, display_name, avatar_url)")
      .eq("email_id", emailId)
      .order("created_at", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ comments: comments ?? [] });
  } catch (err: any) {
    console.error("[CommentRoutes] GET / error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

commentRouter.post("/", validateBody(z.object({ email_id: z.string().uuid(), body: z.string().min(1) })), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { email_id, body } = req.body;

    if (body.length > 10000) {
      res.status(400).json({ error: "Comment body must be 10000 characters or less" });
      return;
    }

    const hasAccess = await canAccessEmail(userId, email_id);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("internal_comments")
      .insert({
        email_id,
        author_id: userId,
        body,
      })
      .select("*, author:author_id(id, email, display_name, avatar_url)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ comment: data });
  } catch (err: any) {
    console.error("[CommentRoutes] POST / error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
