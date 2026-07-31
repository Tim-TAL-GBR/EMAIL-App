import { safeErrorMessage } from "../utils/errors.js";
import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { canAccessEmail } from "../realtime/guards.js";
import { ImapClient } from "../mail/ImapClient.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { z } from "zod";

export const emailRouter: Router = Router();

emailRouter.use(requireAuth);

emailRouter.post(
  "/bulk-action",
  validateBody(
    z.object({
      emailIds: z.array(z.string().uuid()).min(1),
      action: z.enum(["read", "archive", "delete"]),
    })
  ),
  async (req, res) => {
    try {
      const userId = req.user!.sub;
      const { emailIds, action } = req.body;

      const supabase = getSupabaseAdmin();
      const { data: emails, error } = await supabase
        .from("emails")
        .select("id, inbox_id, imap_uid")
        .in("id", emailIds);

      if (error) {
        res.status(500).json({ error: safeErrorMessage(error) });
        return;
      }

      // Filter to emails the user may access
      const allowed: any[] = [];
      for (const email of emails || []) {
        if (await canAccessEmail(userId, email.id)) allowed.push(email);
      }

      if (allowed.length === 0) {
        res.status(403).json({ error: "No access to these emails" });
        return;
      }

      const allowedIds = allowed.map((e) => e.id);

      if (action === "read") {
        const { error: updateError } = await supabase
          .from("emails")
          .update({ is_read: true })
          .in("id", allowedIds);
        if (updateError) {
          res.status(500).json({ error: safeErrorMessage(updateError) });
          return;
        }
      } else if (action === "archive") {
        const { error: updateError } = await supabase
          .from("emails")
          .update({ is_archived: true })
          .in("id", allowedIds);
        if (updateError) {
          res.status(500).json({ error: safeErrorMessage(updateError) });
          return;
        }
        const { mailManager } = await import("../mail/MailManager.js");
        for (const email of allowed) {
          if (email.imap_uid) {
            const client = mailManager.getClient(email.inbox_id);
            if (client) {
              await client.archiveMessage(email.imap_uid).catch((e: any) =>
                console.error("[EmailRoutes] bulk archive IMAP error:", e)
              );
            }
          }
        }
      } else {
        const { error: updateError } = await supabase
          .from("emails")
          .update({ is_deleted: true, is_archived: false })
          .in("id", allowedIds);
        if (updateError) {
          res.status(500).json({ error: safeErrorMessage(updateError) });
          return;
        }
        const { mailManager } = await import("../mail/MailManager.js");
        for (const email of allowed) {
          if (email.imap_uid) {
            const client = mailManager.getClient(email.inbox_id);
            if (client) {
              await client.deleteMessage(email.imap_uid).catch((e: any) =>
                console.error("[EmailRoutes] bulk delete IMAP error:", e)
              );
            }
          }
        }
      }

      res.json({ success: true, count: allowed.length });
    } catch (err: any) {
      console.error("[EmailRoutes] POST /bulk-action error:", err);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  }
);

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

emailRouter.patch("/:emailId/status", validateBody(z.object({ status: z.enum(['open', 'in_progress', 'done']) })), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const emailId = req.params.emailId as string;
    const { status } = req.body;

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

emailRouter.post("/:emailId/assign", validateBody(z.object({ assignedTo: z.string().uuid() })), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const emailId = req.params.emailId as string;
    const { assignedTo } = req.body;

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
      .update({ is_deleted: true, is_archived: false })
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

// ─── Label Sync (IMAP keywords) ────────────────────────────────────────────
emailRouter.post("/:emailId/labels", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { emailId } = req.params;
    const { labelId, action } = req.body;

    if (!labelId || !['add', 'remove'].includes(action)) {
      res.status(400).json({ error: "labelId and action ('add'|'remove') required" });
      return;
    }

    const hasAccess = await canAccessEmail(userId, emailId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this email" });
      return;
    }

    const supabase = getSupabaseAdmin();

    // 1. Update DB
    if (action === 'add') {
      const { error: insertErr } = await supabase.from('email_labels').insert({ email_id: emailId, label_id: labelId });
      if (insertErr && insertErr.code !== '23505') {
        res.status(500).json({ error: safeErrorMessage(insertErr) });
        return;
      }
    } else {
      await supabase.from('email_labels').delete().match({ email_id: emailId, label_id: labelId });
    }

    // 2. Sync to IMAP
    const { data: email } = await supabase
      .from("emails")
      .select("inbox_id, imap_uid, mailbox_name")
      .eq("id", emailId)
      .single();

    if (email?.imap_uid) {
      const { mailManager } = await import("../mail/MailManager.js");
      const client = mailManager.getClient(email.inbox_id);
      const keyword = ImapClient.imapKeyword(labelId);
      if (client) {
        const mailbox = email.mailbox_name === "INBOX" ? "INBOX" : email.mailbox_name;
        if (action === 'add') {
          await client.addLabelFlag(email.imap_uid, keyword, mailbox);
        } else {
          await client.removeLabelFlag(email.imap_uid, keyword, mailbox);
        }
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[EmailRoutes] POST /:emailId/labels error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
