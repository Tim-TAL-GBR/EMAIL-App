import { Router } from "express";
import { canWriteToInbox } from "../realtime/guards.js";
import { smtpClient } from "../mail/SmtpClient.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export const mailRouter: Router = Router();

mailRouter.post("/test-connection", async (req, res) => {
  try {
    // 1. Authenticate via token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    
    const token = authHeader.split(" ")[1];
    const { verifySupabaseToken } = await import("../middleware/auth.middleware.js");
    const payload = await verifySupabaseToken(token);
    
    if (!payload || !payload.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

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
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

mailRouter.post("/restart-client", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    
    const token = authHeader.split(" ")[1];
    const { verifySupabaseToken } = await import("../middleware/auth.middleware.js");
    const payload = await verifySupabaseToken(token);
    
    if (!payload || !payload.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

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
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

mailRouter.post("/send", async (req, res) => {
  try {
    // 1. Authenticate via token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    
    // We reuse authenticateWs slightly differently, or just verify the token.
    // For simplicity, let's verify using the existing function.
    // We pass a dummy req object just to extract the token from query if we were using WS, 
    // but here we can just extract the token string.
    const token = authHeader.split(" ")[1];
    
    // Quick inline verify:
    const { verifySupabaseToken } = await import("../middleware/auth.middleware.js");
    const payload = await verifySupabaseToken(token);
    
    if (!payload || !payload.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    
    const userId = payload.sub;

    // 2. Extract payload
    const { inboxId, to, cc, bcc, subject, bodyText, bodyHtml, inReplyTo, references, attachments } = req.body;

    if (!inboxId || !to || to.length === 0 || !subject || !bodyText) {
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
    await smtpClient.sendEmail({
      inboxId,
      teamId: inbox.team_id,
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      inReplyTo,
      references
    });

    res.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("[MailRoutes] Error sending email:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
