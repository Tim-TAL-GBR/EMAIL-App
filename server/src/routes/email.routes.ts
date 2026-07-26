import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { canAccessEmail } from "../realtime/guards.js";

export const emailRouter: Router = Router();

emailRouter.use(requireAuth);

emailRouter.post("/bulk-action", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailIds, action } = req.body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      res.status(400).json({ error: "emailIds must be a non-empty array" });
      return;
    }
    if (!["read", "archive", "delete"].includes(action)) {
      res.status(400).json({ error: "Invalid action. Must be read, archive, or delete" });
      return;
    }

    const supabase = getSupabaseAdmin();

    const accessibleEmails: string[] = [];
    for (const emailId of emailIds) {
      if (await canAccessEmail(userId, emailId)) {
        accessibleEmails.push(emailId);
      }
    }
    
    if (accessibleEmails.length === 0) {
      res.status(403).json({ error: "No access to any of the provided emails" });
      return;
    }

    const { data: emails, error: fetchError } = await supabase
      .from("emails")
      .select("id, inbox_id, imap_uid")
      .in("id", accessibleEmails);

    if (fetchError || !emails) {
      res.status(500).json({ error: fetchError?.message || "Error fetching emails" });
      return;
    }

    let updatePayload = {};
    if (action === "read") updatePayload = { is_read: true };
    else if (action === "archive") updatePayload = { is_archived: true, updated_at: new Date().toISOString() };
    else if (action === "delete") updatePayload = { is_deleted: true, updated_at: new Date().toISOString() };

    const { error: updateError } = await supabase
      .from("emails")
      .update(updatePayload)
      .in("id", emails.map(e => e.id));

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    if (action === "archive" || action === "delete") {
      const inboxGroups: Record<string, number[]> = {};
      for (const email of emails) {
        if (email.imap_uid) {
          if (!inboxGroups[email.inbox_id]) {
            inboxGroups[email.inbox_id] = [];
          }
          inboxGroups[email.inbox_id].push(email.imap_uid);
        }
      }

      const { mailManager } = await import("../mail/MailManager.js");
      
      for (const [inboxId, uids] of Object.entries(inboxGroups)) {
        try {
          const client = mailManager.getClient(inboxId);
          if (client) {
            if (action === "archive") {
              await client.archiveMessages(uids);
            } else if (action === "delete") {
              await client.deleteMessages(uids);
            }
          }
        } catch (imapErr) {
          console.error(`[EmailRoutes] IMAP bulk error for inbox ${inboxId}:`, imapErr);
        }
      }
    }

    res.json({ success: true, processedCount: emails.length });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /bulk-action error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

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
    res.status(500).json({ error: err.message || "Internal server error" });
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
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] PATCH /:emailId/status error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
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
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/assign error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
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
    res.status(500).json({ error: err.message || "Internal server error" });
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
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, is_starred: newStarred });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/toggle-star error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
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
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/read error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
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
      res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: err.message || "Internal server error" });
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
      res.status(500).json({ error: error.message });
      return;
    }

    if (email.imap_uid) {
      try {
        const { mailManager } = await import("../mail/MailManager.js");
        const client = mailManager.getClient(email.inbox_id);
        if (client) {
          await client.deleteMessage(email.imap_uid);
        }
      } catch (imapErr) {
        console.error(`[EmailRoutes] IMAP delete failed for ${emailId}:`, imapErr);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] DELETE /:emailId error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
