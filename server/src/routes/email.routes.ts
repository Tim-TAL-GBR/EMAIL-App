import { safeErrorMessage } from "../utils/errors.js";
import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { canAccessEmail } from "../realtime/guards.js";

export const emailRouter: Router = Router();

emailRouter.use(requireAuth);

emailRouter.get("/:emailId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: email, error } = await supabase
      .from("emails")
      .select("*, email_assignments(*)")
      .eq("id", emailId)
      .single();

    if (error || !email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    res.json({ email });
  } catch (err: any) {
    console.error("[EmailRoutes] GET /:emailId error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

emailRouter.patch("/:emailId/status", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;
    const { status } = req.body;

    if (!status || !["open", "in_progress", "done"].includes(status)) {
      res.status(400).json({ error: "Invalid status. Must be open, in_progress, or done" });
      return;
    }

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("emails")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", emailId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] PATCH /:emailId/status error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

emailRouter.post("/:emailId/assign", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      res.status(400).json({ error: "assignedTo is required" });
      return;
    }

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();

    // Replace assignment: delete existing ones first
    await supabase
      .from("email_assignments")
      .delete()
      .eq("email_id", emailId);

    const { error } = await supabase
      .from("email_assignments")
      .insert({
        email_id: emailId,
        assigned_to: assignedTo,
        assigned_by: userId,
      });

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/assign error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

emailRouter.post("/:emailId/unassign", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();
    await supabase.from("email_assignments").delete().eq("email_id", emailId);

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/unassign error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

emailRouter.post("/:emailId/toggle-star", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();

    const { data: email } = await supabase
      .from("emails")
      .select("is_starred")
      .eq("id", emailId)
      .single();

    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const newStarred = !email.is_starred;
    const { error } = await supabase
      .from("emails")
      .update({ is_starred: newStarred })
      .eq("id", emailId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true, is_starred: newStarred });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/toggle-star error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

emailRouter.post("/:emailId/read", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("emails")
      .update({ is_read: true })
      .eq("id", emailId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/read error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

emailRouter.post("/:emailId/archive", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: email, error: fetchError } = await supabase
      .from("emails")
      .select("inbox_id, imap_uid")
      .eq("id", emailId)
      .single();

    if (fetchError || !email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const { error } = await supabase
      .from("emails")
      .update({ is_archived: true })
      .eq("id", emailId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    if (email.imap_uid) {
      const { mailManager } = await import("../mail/MailManager.js");
      const client = mailManager.getClient(email.inbox_id);
      if (client) {
        await client.archiveMessage(email.imap_uid);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/archive error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

emailRouter.delete("/:emailId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: email, error: fetchError } = await supabase
      .from("emails")
      .select("inbox_id, imap_uid")
      .eq("id", emailId)
      .single();

    if (fetchError || !email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const { error } = await supabase
      .from("emails")
      .update({ is_deleted: true })
      .eq("id", emailId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    if (email.imap_uid) {
      const { mailManager } = await import("../mail/MailManager.js");
      const client = mailManager.getClient(email.inbox_id);
      if (client) {
        await client.deleteMessage(email.imap_uid);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] DELETE /:emailId error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
