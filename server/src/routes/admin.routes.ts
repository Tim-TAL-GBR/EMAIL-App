import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { requireSuperAdmin } from "../middleware/permissions.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";

export const adminRouter: Router = Router();

// Apply authentication and super admin check to all routes in this router
adminRouter.use(requireAuth);
adminRouter.use(requireSuperAdmin);

// ---------------------------------------------------------------------------
// GET /api/admin/organizations – List all organizations
// ---------------------------------------------------------------------------
adminRouter.get("/organizations", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .is("parent_id", null)
      .order("name");

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
// GET /api/admin/users – List all users
// ---------------------------------------------------------------------------
adminRouter.get("/users", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
