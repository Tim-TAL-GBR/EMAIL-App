import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { mailManager } from "./MailManager.js";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { decrypt } from "../utils/encryption.js";
import { syncEmailToShopifyOrders } from "../services/shopify.service.js";

interface SendEmailParams {
  inboxId: string;
  teamId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string | string[];
  attachments?: any[];
  fromAddress?: string;
  status?: "open" | "done" | "in_progress";
}

export class SmtpClient {
  /**
   * Send an email using the SMTP credentials configured for a specific inbox.
   */
  public async sendEmail(params: SendEmailParams): Promise<void> {
    const supabase = getSupabaseAdmin();

    // 1. Fetch inbox credentials
    const { data: inbox, error: inboxError } = await supabase
      .from("inboxes")
      .select("email_address, smtp_host, smtp_port, smtp_user, smtp_pass")
      .eq("id", params.inboxId)
      .single();

    if (inboxError || !inbox) {
      throw new Error(`Inbox not found or error fetching credentials: ${inboxError?.message}`);
    }

    // 1.5 Check subscription status
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("org_id", params.teamId)
      .single();

    if (subscription && subscription.status !== 'active' && subscription.status !== 'trialing') {
      throw new Error("Cannot send email: Subscription is inactive or expired.");
    }

    if (!inbox.smtp_host || !inbox.smtp_user || !inbox.smtp_pass) {
      throw new Error("SMTP credentials are not configured for this inbox");
    }

    // 2. Configure Nodemailer
    const transporter = nodemailer.createTransport({
      host: inbox.smtp_host,
      port: inbox.smtp_port || 465,
      secure: inbox.smtp_port === 465,
      auth: {
        user: inbox.smtp_user,
        pass: decrypt(inbox.smtp_pass),
      },
    });

    let mailAttachments: any[] = [];
    if (params.attachments && params.attachments.length > 0) {
      const paths = params.attachments.map((att: any) => att.storage_path);
      const { data: urlsData } = await supabase.storage
        .from("email_attachments")
        .createSignedUrls(paths, 3600);
        
      if (urlsData) {
        for (let i = 0; i < params.attachments.length; i++) {
          const att = params.attachments[i];
          const urlData = urlsData.find((u: any) => u.path === att.storage_path);
          if (urlData?.signedUrl) {
            mailAttachments.push({
              filename: att.file_name,
              href: urlData.signedUrl,
              contentType: att.content_type
            });
          }
        }
      }
    }

    // 3. Determine sender address (override from aliases if provided)
    const senderAddress = params.fromAddress || inbox.email_address;

    // 4. Send email
    const mailOptions: any = {
      from: senderAddress,
      to: params.to.join(", "),
      cc: params.cc?.join(", "),
      bcc: params.bcc?.join(", "),
      subject: params.subject,
      text: params.bodyText,
      html: params.bodyHtml,
    };

    if (mailAttachments.length > 0) {
      mailOptions.attachments = mailAttachments;
    }

    if (params.inReplyTo) {
      mailOptions.inReplyTo = params.inReplyTo;
    }
    if (params.references) {
      mailOptions.references = params.references;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SmtpClient] Email sent successfully: ${info.messageId}`);

    // Generate raw message to sync to IMAP
    try {
      const mail = new MailComposer(mailOptions);
      const rawMsg = await mail.compile().build();
      const imapClient = mailManager.getClient(params.inboxId);
      if (imapClient) {
        await imapClient.appendSentMessage(rawMsg.toString('utf-8'));
      }
    } catch (err) {
      console.error("[SmtpClient] Error appending to sent folder:", err);
    }

    // Determine thread_id
    const cleanMessageId = info.messageId?.replace(/[<>]/g, '') || '';
    let threadId = cleanMessageId;
    if (params.inReplyTo) {
      const cleanInReplyTo = params.inReplyTo.replace(/[<>]/g, "");
      const { data: parentEmail } = await supabase
        .from("emails")
        .select("thread_id, message_id")
        .eq("inbox_id", params.inboxId)
        .filter("message_id", "like", `%${cleanInReplyTo}%`)
        .maybeSingle();

      if (parentEmail && parentEmail.thread_id) {
        threadId = parentEmail.thread_id;
      } else if (parentEmail) {
        threadId = parentEmail.message_id;
      } else {
        threadId = cleanInReplyTo;
      }
    }

    // 4. Save to database as outbound
    const { data: newEmail, error: insertError } = await supabase.from("emails").insert({
      inbox_id: params.inboxId,
      team_id: params.teamId,
      message_id: cleanMessageId,
      thread_id: threadId,
      subject: params.subject,
      from_address: senderAddress,
      to_addresses: params.to,
      cc_addresses: params.cc || [],
      bcc_addresses: params.bcc || [],
      body_text: params.bodyText,
      body_html: params.bodyHtml,
      direction: "outbound",
      status: params.status || "done",
      is_read: true,
      is_starred: false,
      is_deleted: false,
      mailbox_name: "Sent",
    }).select("id").single();

    if (insertError) {
      console.error(`[SmtpClient] Failed to save outbound email to DB:`, insertError);
    } else if (newEmail && params.attachments && params.attachments.length > 0) {
      // 5. Insert attachments
      const attsToInsert = params.attachments.map((att: any) => ({
        email_id: newEmail.id,
        file_name: att.file_name,
        content_type: att.content_type,
        size_bytes: att.size_bytes,
        storage_path: att.storage_path,
        is_inline: att.is_inline || false
      }));
      
      const { error: attError } =       await supabase.from("email_attachments").insert(attsToInsert);
      if (attError) {
        console.error(`[SmtpClient] Failed to save attachments to DB:`, attError);
      }
    }

    if (newEmail) {
      syncEmailToShopifyOrders({
        teamId: params.teamId,
        customerEmail: params.to[0] || "",
        subject: params.subject,
        direction: "outbound",
        fromAddress: senderAddress,
        snippet: params.bodyText,
      });
    }
  }
}

export const smtpClient = new SmtpClient();
