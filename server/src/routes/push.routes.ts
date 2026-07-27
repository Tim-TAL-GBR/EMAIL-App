import { safeErrorMessage } from "../utils/errors.js";
import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";

export const pushRouter: Router = Router();

pushRouter.use(requireAuth);

pushRouter.post("/register", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { token, platform } = req.body;

    if (!token) {
      res.status(400).json({ error: "Push token is required" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          platform: platform ?? "ios",
        },
        { onConflict: "user_id,token" },
      );

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[PushRoutes] POST /register error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

pushRouter.delete("/unregister", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: "Push token is required" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token", token);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[PushRoutes] DELETE /unregister error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
