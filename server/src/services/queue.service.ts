import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { getSupabaseAdmin } from "./auth.service.js";
import { sendPushNotification } from "./push.service.js";
import { syncEmailToShopifyOrders } from "./shopify.service.js";
import crypto from "crypto";

// Redis Connection
const redisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // Required by BullMQ
};

export const connection = new Redis(redisOptions);

// Queues
export const emailQueue = new Queue("email-processing", { connection });

// Types
export interface ProcessEmailJob {
  inboxId: string;
  teamId: string;
  mailboxName?: string;

  imapUid: number;
  messageId: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  date: string;
  bodyText: string;
  bodyHtml: string;
  inReplyTo: string | null;
  threadId: string | null; // Calculated by ImapClient or Worker
  isRead: boolean;
  imapFlags?: string[];
  attachments?: Array<{
    file_name: string;
    content_type: string;
    size_bytes: number;
    storage_path: string;
    is_inline: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Worker Setup
// ---------------------------------------------------------------------------

export function startEmailWorker() {
  const worker = new Worker("email-processing", async (job: Job<ProcessEmailJob>) => {
    console.log(`[Queue] Processing email job ${job.id} for inbox ${job.data.inboxId}`);
    const data = job.data;
    const supabase = getSupabaseAdmin();

    // 1. Calculate thread ID if missing
    let threadId = data.threadId;
    if (!threadId) {
      if (data.inReplyTo) {
        // Try to find the original email this is replying to
        const { data: parentEmail } = await supabase
          .from("emails")
          .select("thread_id")
          .eq("message_id", data.inReplyTo)
          .maybeSingle();

        if (parentEmail?.thread_id) {
          threadId = parentEmail.thread_id;
        }
      }
      
      // If still no thread ID, create a new one
      if (!threadId) {
        threadId = crypto.randomUUID();
      }
    }

    let mappedStatus = "open";
    let mappedDirection = "inbound";
    let isArchived = false;
    let isDeleted = false;
    let mailboxName = data.mailboxName || "INBOX";

    // Determine status, direction, and flags based on the folder
    const mailboxLower = mailboxName.toLowerCase();
    
    if (mailboxLower.includes("sent") || mailboxLower.includes("gesendet") || mailboxLower.includes("outbox")) {
      mappedDirection = "outbound";
      mappedStatus = "done";
    } else if (mailboxLower.includes("archive") || mailboxLower.includes("archiv") || mailboxLower.includes("all mail")) {
      mappedStatus = "done";
      isArchived = true;
    } else if (mailboxLower.includes("trash") || mailboxLower.includes("gelöscht") || mailboxLower.includes("deleted")) {
      mappedStatus = "done";
      isDeleted = true;
    }

    // 2. Insert into Supabase
    const { data: insertedEmail, error } = await supabase
      .from("emails")
      .insert({
        inbox_id: data.inboxId,
        team_id: data.teamId,
        thread_id: threadId,
        message_id: data.messageId,
        subject: data.subject,
        from_address: data.fromName ? `${data.fromName} <${data.fromAddress}>` : data.fromAddress,
        to_addresses: data.toAddresses,
        cc_addresses: data.ccAddresses,
        bcc_addresses: data.bccAddresses,
        received_at: data.date,
        last_activity_at: data.date,
        body_text: data.bodyText,
        body_html: data.bodyHtml,
        status: mappedStatus,
        is_read: data.isRead,
        direction: mappedDirection,
        imap_uid: data.imapUid,
        is_archived: isArchived,
        is_deleted: isDeleted,
        mailbox_name: mailboxName,
      })
      .select("id")
      .single();

    if (error) {
      // Unique constraint violation: email already exists (same message_id).
      // Update its mailbox metadata so folder moves (INBOX -> Trash/Archive) are reflected.
      if (error.code === '23505') {
        console.log(`[Queue] Email ${data.messageId} already exists, updating mailbox metadata.`);

        // Fetch current row so a re-sync (e.g. the periodic re-fetch of all
        // unseen messages in INBOX) can never override user decisions.
        const { data: existing } = await supabase
          .from("emails")
          .select("status, is_read")
          .eq("message_id", data.messageId)
          .eq("inbox_id", data.inboxId)
          .maybeSingle();

        // Only move the status to "done" when the email now lives in a
        // terminal folder (archive/trash/sent). Re-syncing from INBOX maps to
        // "open" and must NOT resurrect a conversation the user already closed.
        const status = mappedStatus === "done" ? "done" : existing?.status ?? mappedStatus;
        // Never downgrade back to unread: server read-state only ever wins in
        // the direction "read", otherwise the app's read flag is preserved.
        const isRead = data.isRead || existing?.is_read || false;

        const { error: updateError } = await supabase
          .from("emails")
          .update({
            mailbox_name: mailboxName,
            imap_uid: data.imapUid,
            is_deleted: isDeleted,
            is_archived: isArchived,
            status,
            direction: mappedDirection,
            is_read: isRead,
          })
          .eq("message_id", data.messageId)
          .eq("inbox_id", data.inboxId);

        if (updateError) {
          console.error(`[Queue] Failed to update existing email ${data.messageId}:`, updateError);
        }
        return { status: 'duplicate', emailId: null };
      }
      throw new Error(`DB Insert Error: ${error.message}`);
    }

    // 3. Insert attachments if any
    if (data.attachments && data.attachments.length > 0 && insertedEmail?.id) {
      const attachmentsToInsert = data.attachments.map(att => ({
        ...att,
        email_id: insertedEmail.id
      }));
      
      const { error: attError } = await supabase
        .from("email_attachments")
        .insert(attachmentsToInsert);
        
      if (attError) {
        console.error(`[Queue] Failed to insert attachments for email ${insertedEmail.id}:`, attError);
      }
    }

    // 4. Import IMAP flags → TeamMail labels
    const teamMailFlags = data.imapFlags?.filter(f => f.startsWith('$TeamMail-'));
    if (teamMailFlags?.length && insertedEmail?.id) {
      for (const flag of teamMailFlags) {
        try {
          // Derive label name from flag (e.g. "$TeamMail-abc123" → "abc123")
          const labelName = `IMAP-${flag.slice(10, 18)}`;
          // Check if label with this keyword already exists for this team
          const { data: existingLabel } = await supabase
            .from('labels')
            .select('id')
            .eq('team_id', data.teamId)
            .eq('name', labelName)
            .maybeSingle();

          let labelId = existingLabel?.id;
          if (!labelId) {
            const { data: newLabel } = await supabase
              .from('labels')
              .insert({ team_id: data.teamId, name: labelName, color: '#6366F1' })
              .select('id')
              .single();
            labelId = newLabel?.id;
          }

          if (labelId) {
            const { error: elErr } = await supabase
              .from('email_labels')
              .insert({ email_id: insertedEmail.id, label_id: labelId });
            if (elErr && elErr.code !== '23505') {
              console.error(`[Queue] Failed to insert email_label:`, elErr);
            }
          }
        } catch (e) {
          console.error(`[Queue] Failed to sync IMAP flag ${flag}:`, e);
        }
      }
    }

    // 5. Send push notification if it's a new open email in the primary INBOX (not archived/deleted)
    if (!data.isRead && mailboxName === "INBOX" && !isArchived && !isDeleted && mappedDirection === "inbound") {
      try {
        await notifyTeamMembers(data.inboxId, data.subject, data.fromName);
      } catch (pushErr) {
        console.error(`[Queue] Failed to send push notifications:`, pushErr);
      }
    }

    // 6. Sync to Shopify orders if applicable
    if (insertedEmail?.id && !isDeleted && mappedDirection === "inbound") {
      syncEmailToShopifyOrders({
        teamId: data.teamId,
        customerEmail: data.fromAddress,
        subject: data.subject,
        direction: "inbound",
        fromAddress: data.fromAddress,
        snippet: data.bodyText,
      });
    }

    return { status: 'success', emailId: insertedEmail.id };
  }, { connection });

  worker.on("completed", (job) => {
    console.log(`[Queue] Job ${job.id} completed!`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed:`, err);
  });

  return worker;
}

// Push notification helper
async function notifyTeamMembers(inboxId: string, subject: string, fromName: string) {
  const supabase = getSupabaseAdmin();

  // Find users who have access to this inbox
  const { data: inbox } = await supabase
    .from("inboxes")
    .select("type, owner_id")
    .eq("id", inboxId)
    .single();

  if (!inbox) return;

  let targetUserIds: string[] = [];

  if (inbox.type === "private" && inbox.owner_id) {
    targetUserIds.push(inbox.owner_id);
  } else if (inbox.type === "shared") {
    const { data: members } = await supabase
      .from("inbox_members")
      .select("user_id")
      .eq("inbox_id", inboxId);
    if (members) {
      targetUserIds = members.map((m) => m.user_id);
    }
  }

  for (const userId of targetUserIds) {
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);

    if (tokens && tokens.length > 0) {
      const tokenStrings = tokens.map((t) => t.token);
      await sendPushNotification(tokenStrings, {
        title: `New Email from ${fromName}`,
        body: subject,
        data: { type: "new_email", inboxId }
      });
    }
  }
}
