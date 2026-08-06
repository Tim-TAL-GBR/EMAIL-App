import { safeErrorMessage } from "../utils/errors.js";
import { Router } from "express";
import { canWriteToInbox } from "../realtime/guards.js";
import { smtpClient } from "../mail/SmtpClient.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

import { requireAuth } from "../middleware/expressAuth.middleware.js";

export const mailRouter: Router = Router();

mailRouter.use(requireAuth);
mailRouter.post("/test-connection", async (req, res) => {
  try {
    const { imap, smtp } = req.body;
    if (!imap || !smtp) {
      res.status(400).json({ error: "Missing imap or smtp config" });
      return;
    }

    const errors: string[] = [];

    // Test IMAP
    try {
      const imapClient = new ImapFlow({
        host: imap.host,
        port: Number(imap.port),
        secure: imap.tls !== false && Number(imap.port) === 993,
        auth: {
          user: imap.user,
          pass: imap.pass
        },
        logger: false,
      });
      await imapClient.connect();
      await imapClient.logout();
    } catch (err: any) {
      console.error("[MailRoutes] IMAP test failed:", err);
      errors.push(`IMAP Connection Failed: ${err.message}`);
    }

    // Test SMTP
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port),
        secure: smtp.secure !== false && Number(smtp.port) === 465,
        auth: {
          user: smtp.user,
          pass: smtp.pass
        }
      });
      await transporter.verify();
    } catch (err: any) {
      console.error("[MailRoutes] SMTP test failed:", err);
      errors.push(`SMTP Connection Failed: ${err.message}`);
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, errors });
    } else {
      res.json({ success: true, message: "Connection successful" });
    }
  } catch (error: any) {
    console.error("[MailRoutes] Error testing connection:", error);
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

mailRouter.post("/restart-client", async (req, res) => {
  try {
    const payload = req.user!;
    const { inboxId } = req.body;
    if (!inboxId) {
      res.status(400).json({ error: "Missing inboxId" });
      return;
    }

    // Verify permission (must be admin or owner)
    const { canManageInbox } = await import("../realtime/guards.js");
    const canManage = await canManageInbox(payload.sub, inboxId);
    if (!canManage) {
      res.status(403).json({ error: "No manage access to this inbox" });
      return;
    }

    const { mailManager } = await import("../mail/MailManager.js");
    await mailManager.restartClient(inboxId);

    res.json({ success: true, message: "Client restarted" });
  } catch (error: any) {
    console.error("[MailRoutes] Error restarting client:", error);
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

mailRouter.post("/send", async (req, res) => {
  try {
    const userId = req.user!.sub;

    // 2. Extract payload
    const { inboxId, to, cc, bcc, subject, bodyText, bodyHtml, inReplyTo, references, attachments, fromAddress, status, threadId } = req.body;

    if (!inboxId || !to || to.length === 0 || !subject || !bodyText) {
      console.log("[MailRoutes] Missing fields in /send. Payload:", { inboxId, to, subject, hasBody: !!bodyText });
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // 3. Check permissions
    const canWrite = await canWriteToInbox(userId, inboxId);
    if (!canWrite) {
      res.status(403).json({ error: "No write access to this inbox" });
      return;
    }

    // 4. Get teamId for the inbox (needed for the SmtpClient)
    const supabase = getSupabaseAdmin();
    const { data: inbox } = await supabase.from("inboxes").select("team_id").eq("id", inboxId).single();
    
    if (!inbox) {
      res.status(404).json({ error: "Inbox not found" });
      return;
    }

    // 5. Send Email via SMTP
    const newEmail = await smtpClient.sendEmail({
      inboxId,
      teamId: inbox.team_id,
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      inReplyTo,
      references,
      fromAddress,
      attachments,
      status,
      threadId,
    });

    res.json({ success: true, message: "Email sent successfully", email: newEmail });
  } catch (error: any) {
    console.error("[MailRoutes] Error sending email:", error);
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});
