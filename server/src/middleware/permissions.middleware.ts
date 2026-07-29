import type { Request, Response, NextFunction } from "express";
import { getSupabaseAdmin } from "../services/auth.service.js";

/**
 * Checks if the user is a super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();

  return !!data?.is_super_admin;
}

/**
 * Checks if a user has a specific permission in a team.
 * - Super admins always have permission.
 * - Team owners/admins always have permission.
 * - Custom roles are checked for the specific permission flag.
 */
export async function hasTeamPermission(userId: string, teamId: string, permissionName: string): Promise<boolean> {
  if (await isSuperAdmin(userId)) return true;

  const supabase = getSupabaseAdmin();
  const { data: member } = await supabase
    .from("team_members")
    .select("role, custom_role_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return false;

  // Owners and Admins have all permissions
  if (["owner", "admin"].includes(member.role)) return true;

  if (member.custom_role_id) {
    const { data: customRole } = await supabase
      .from("custom_roles")
      .select("permissions")
      .eq("id", member.custom_role_id)
      .maybeSingle();

    if (customRole && customRole.permissions) {
      const perms = customRole.permissions as Record<string, boolean>;
      if (perms[permissionName] === true) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Express middleware to require a super admin
 */
export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (await isSuperAdmin(userId)) {
      next();
    } else {
      res.status(403).json({ error: "Super Admin privileges required" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Express middleware to require a specific team permission
 * Assumes the team ID is passed as `req.params.id` or `req.params.teamId`.
 */
export const requireTeamPermission = (permissionName: string, idParam = "id") => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const teamId = req.params[idParam];
      if (!teamId) {
        res.status(400).json({ error: "Missing team ID parameter" });
        return;
      }

      const hasPerm = await hasTeamPermission(userId, teamId, permissionName);
      if (hasPerm) {
        next();
      } else {
        res.status(403).json({ error: `Missing permission: ${permissionName}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
};
