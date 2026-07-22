import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { getSupabaseAdmin } from "./auth.service.js";
import { sendPushNotification } from "./push.service.js";
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
        body_text: data.bodyText,
        body_html: data.bodyHtml,
        status: "open",
        is_read: data.isRead,
        direction: "inbound",
        imap_uid: data.imapUid,
      })
      .select("id")
      .single();

    if (error) {
      // If it's a unique constraint violation (duplicate message_id in the same inbox), ignore
      if (error.code === '23505') {
        console.log(`[Queue] Email ${data.messageId} already exists, skipping.`);
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

    // 4. Send push notification if it's a new open email (not archived)
    if (!data.isRead) {
      try {
        await notifyTeamMembers(data.inboxId, data.subject, data.fromName);
      } catch (pushErr) {
        console.error(`[Queue] Failed to send push notifications:`, pushErr);
      }
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
