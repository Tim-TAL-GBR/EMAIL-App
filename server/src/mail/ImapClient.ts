import { ImapFlow } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { sendPushNotification } from "../services/push.service.js";
import crypto from "crypto";

interface ImapConfig {
  inboxId: string;
  teamId: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  sync_since?: string | null;
  secure?: boolean;
}

export class ImapClient {
  private client: ImapFlow;
  private config: ImapConfig;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private expungeDebounce: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  private folderMap: {
    inbox: string;
    sent: string | null;
    archive: string | null;
    trash: string | null;
  } = { inbox: "INBOX", sent: null, archive: null, trash: null };

  private allFolders: { path: string; name: string; specialUse?: string }[] = [];

  public getFolders() {
    return this.allFolders;
  }

  private createImapFlow() {
    return new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure !== false,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
      logger: false,
    });
  }

  constructor(config: ImapConfig) {
    this.config = config;
    this.client = this.createImapFlow();
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;
    try {
      if (this.client && (this.client as any).usable === false) {
        this.client = this.createImapFlow();
      }
      await this.client.connect();
      this.isConnected = true;
      console.log(`[ImapClient] Connected to ${this.config.user}`);
      
      // Discover folders
      const folders = await this.client.list();
      this.allFolders = folders.map(f => ({ path: f.path, name: f.name, specialUse: f.specialUse }));
      this.folderMap = {
        inbox: "INBOX",
        sent: folders.find(f => f.specialUse === '\\Sent' || f.name.toLowerCase() === 'sent' || f.name.toLowerCase() === 'gesendet' || f.name.toLowerCase() === 'sent items')?.path || null,
        archive: folders.find(f => f.specialUse === '\\Archive' || f.name.toLowerCase().includes('archive') || f.name.toLowerCase().includes('archiv') || f.name.toLowerCase() === 'all mail')?.path || null,
        trash: folders.find(f => f.specialUse === '\\Trash' || f.name.toLowerCase().includes('trash') || f.name.toLowerCase().includes('gelöscht') || f.name.toLowerCase().includes('papierkorb') || f.name.toLowerCase() === 'deleted items')?.path || null,
      };
      console.log(`[ImapClient] Folder mapping for ${this.config.user}:`, this.folderMap);
      console.log(`[ImapClient] All folders for ${this.config.user}:`, this.allFolders.map(f => f.path));

      // Initial fetch for all folders
      await this.syncAllFolders();

      // Select INBOX and IDLE
      const mailbox = await this.client.mailboxOpen("INBOX");
      console.log(`[ImapClient] Mailbox INBOX opened for ${this.config.user}. Total messages: ${mailbox.exists}`);

      // Listen for new messages using IDLE
      this.client.on("exists", async (data) => {
        console.log(`[ImapClient] New message exists event for ${this.config.user}:`, data);
        await this.fetchFolder("INBOX");
      });

      // Detect deleted messages in the selected mailbox (INBOX)
      this.client.on("expunge", async (data) => {
        console.log(`[ImapClient] Message expunged for ${this.config.user}:`, data);
        // Debounce: multiple expunges fire in sequence when deleting several messages
        if (this.expungeDebounce) clearTimeout(this.expungeDebounce);
        this.expungeDebounce = setTimeout(() => {
          this.expungeDebounce = null;
          this.syncDeletedEmails();
        }, 3000);
      });

      // Detect \Deleted flag additions in the selected mailbox
      this.client.on("flags", async (data) => {
        try {
          if (data.flags.has("\\Deleted") && data.uid) {
            await this.markEmailsDeletedByUid([data.uid]);
          }
        } catch (err) {
          console.error(`[ImapClient] Error handling flags event for ${this.config.user}:`, err);
        }
      });

      // Periodic full deletion scan (catches Trash/Archive/Sent changes while running)
      if (this.syncTimer) clearInterval(this.syncTimer);
      this.syncTimer = setInterval(() => {
        this.syncDeletedEmails();
      }, this.SYNC_INTERVAL_MS);

      this.client.on("error", (err) => {
        console.error(`[ImapClient] Error for ${this.config.user}:`, err);
        this.handleDisconnect();
      });

      this.client.on("close", () => {
        console.log(`[ImapClient] Connection closed for ${this.config.user}`);
        this.handleDisconnect();
      });

    } catch (error) {
      console.error(`[ImapClient] Connection failed for ${this.config.user}:`, error);
      this.handleDisconnect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.expungeDebounce) {
      clearTimeout(this.expungeDebounce);
      this.expungeDebounce = null;
    }
    if (this.isConnected) {
      await this.client.logout();
      this.isConnected = false;
    }
  }

  private handleDisconnect() {
    this.isConnected = false;
    if (!this.reconnectTimer) {
      console.log(`[ImapClient] Scheduling reconnect for ${this.config.user} in 30s...`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 30_000);
    }
  }

  private async syncAllFolders(): Promise<void> {
    for (const f of this.allFolders) {
      await this.fetchFolder(f.path);
    }
  }

  private async fetchFolder(mailboxPath: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      console.log(`[ImapClient] Starting fetch for folder: ${mailboxPath}...`);
      await this.client.mailboxOpen(mailboxPath);
      if (!this.client.mailbox) return;
      console.log(`[ImapClient] Starting fetchNewMessages...`);
      // 1. Fetch all unseen messages
      const unseenSeq = await this.client.search({ seen: false });
      console.log(`[ImapClient] unseenSeq:`, unseenSeq);
      
      // 2. Fetch history: use highest UID if available, else sync_since, else last 20
      let recentSeq: number[] = [];
      try {
        const supabase = getSupabaseAdmin();
        
        const dbMailboxName = this.mailboxNameForPath(mailboxPath);

        const { data: lastEmail } = await supabase.from('emails')
          .select('imap_uid')
          .eq('inbox_id', this.config.inboxId)
          .eq('mailbox_name', dbMailboxName)
          .order('imap_uid', { ascending: false })
          .limit(1)
          .single();
          
        const highestUid = lastEmail?.imap_uid || 0;
        
        if (highestUid > 0) {
          console.log(`[ImapClient] Searching UID > ${highestUid}`);
          recentSeq = await this.client.search({ uid: `${highestUid + 1}:*` }) || [];
          console.log(`[ImapClient] recentSeq new UIDs:`, recentSeq?.length);
        } else if (this.config.sync_since) {
          console.log(`[ImapClient] Searching since ${this.config.sync_since}`);
          const sinceDate = new Date(this.config.sync_since);
          recentSeq = await this.client.search({ since: sinceDate }) || [];
          console.log(`[ImapClient] recentSeq since date:`, recentSeq?.length);
        } else {
          const total = this.client.mailbox.exists;
          console.log(`[ImapClient] Total messages in mailbox: ${total}`);
          if (total > 0) {
            const start = Math.max(1, total - 19);
            console.log(`[ImapClient] Searching sequence ${start}:${total}`);
            recentSeq = await this.client.search({ seq: `${start}:${total}` }) || [];
            console.log(`[ImapClient] recentSeq range:`, recentSeq?.length);
          }
        }
      } catch (e) {
        console.error('[ImapClient] Error querying max UID:', e);
      }

      // Combine and deduplicate, sort descending (newest first)
      const fetchSet = new Set([...(unseenSeq || []), ...(recentSeq || [])]);
      const fetchArr = Array.from(fetchSet).sort((a, b) => b - a);

      if (fetchArr.length === 0) {
        return;
      }

      console.log(`[ImapClient] Fetching ${fetchArr.length} messages for ${this.config.user}`);

      for (const seq of fetchArr) {
        // Fetch full message source
        const message = await this.client.fetchOne(seq, { source: true, uid: true, flags: true });
        
        if (message && message.source) {
          console.log(`[ImapClient] Fetched msg ${seq} uid ${message.uid} flags:`, message.flags);
          const isUnseen = (unseenSeq || []).includes(seq);
          await this.processMessage(message.source, message.uid, !isUnseen, mailboxPath, message.flags ? [...message.flags] : undefined);
          
          if (isUnseen) {
            // Mark as seen
            await this.client.messageFlagsAdd(seq, ["\\Seen"]);
          }
        }
      }
    } catch (error) {
      console.error(`[ImapClient] Error fetching messages for ${this.config.user}:`, error);
    }
  }

  /**
   * Periodic full-folder UID scan: marks emails as deleted when their UID
   * no longer exists on the IMAP server (deleted/expunged/moved away).
   */
  private async syncDeletedEmails(): Promise<void> {
    if (!this.isConnected) return;
    console.log(`[ImapClient] Running deletion sync for ${this.config.user}...`);
    for (const f of this.allFolders) {
      await this.syncFolderDeletions(f.path);
    }
    // Re-select INBOX so the IDLE connection keeps watching the primary mailbox
    try {
      await this.client.mailboxOpen("INBOX");
    } catch (e) {
      console.error(`[ImapClient] Failed to re-open INBOX after deletion sync:`, e);
    }
  }

  private async syncFolderDeletions(mailboxPath: string): Promise<void> {
    try {
      if (!this.isConnected) return;
      await this.client.mailboxOpen(mailboxPath);
      if (!this.client.mailbox) return;

      // All UIDs currently present in this folder on the server
      const serverUids = (await this.client.search({ all: true }, { uid: true })) || [];
      const serverUidSet = new Set(serverUids);

      const supabase = getSupabaseAdmin();
      const dbMailboxName = this.mailboxNameForPath(mailboxPath);

      // Only emails currently in this folder in the DB
      const { data: dbEmails, error } = await supabase
        .from("emails")
        .select("id, imap_uid")
        .eq("inbox_id", this.config.inboxId)
        .eq("mailbox_name", dbMailboxName)
        .eq("is_deleted", false)
        .not("imap_uid", "is", null);

      if (error) {
        console.error(`[ImapClient] Error querying emails for deletion sync in ${mailboxPath}:`, error);
        return;
      }
      if (!dbEmails || dbEmails.length === 0) return;

      const missing = dbEmails.filter((e: any) => !serverUidSet.has(e.imap_uid));
      if (missing.length === 0) return;

      const missingIds = missing.map((e: any) => e.id);
      console.log(`[ImapClient] Marking ${missing.length} emails as deleted in ${mailboxPath}:`, missingIds);

      const { error: updateError } = await supabase
        .from("emails")
        .update({ is_deleted: true })
        .in("id", missingIds);

      if (updateError) {
        console.error(`[ImapClient] Error marking emails as deleted in ${mailboxPath}:`, updateError);
      }
    } catch (error) {
      console.error(`[ImapClient] Error syncing deletions for ${mailboxPath}:`, error);
    }
  }

  /** Mark emails as deleted by their IMAP UID (used for \Deleted flag / expunge events). */
  private async markEmailsDeletedByUid(uids: number[], mailboxName: string = "INBOX"): Promise<void> {
    if (uids.length === 0 || !this.isConnected) return;
    try {
      const supabase = getSupabaseAdmin();
      const { data: dbEmails, error } = await supabase
        .from("emails")
        .select("id")
        .eq("inbox_id", this.config.inboxId)
        .eq("mailbox_name", mailboxName)
        .in("imap_uid", uids)
        .eq("is_deleted", false);

      if (error) {
        console.error("[ImapClient] Error querying emails by UID:", error);
        return;
      }
      if (!dbEmails || dbEmails.length === 0) return;

      const ids = dbEmails.map((e: any) => e.id);
      console.log(`[ImapClient] Marking ${ids.length} emails as deleted by UID:`, ids);

      const { error: updateError } = await supabase
        .from("emails")
        .update({ is_deleted: true })
        .in("id", ids);

      if (updateError) {
        console.error("[ImapClient] Error marking emails deleted by UID:", updateError);
      }
    } catch (error) {
      console.error("[ImapClient] Error marking emails deleted by UID:", error);
    }
  }

  private mailboxNameForPath(path: string): string {
    if (path === this.folderMap.inbox) return "INBOX";
    if (this.folderMap.sent && path === this.folderMap.sent) return "Sent";
    if (this.folderMap.archive && path === this.folderMap.archive) return "Archive";
    if (this.folderMap.trash && path === this.folderMap.trash) return "Trash";
    // Gmail "All Mail" / "Gmail" variant handling
    if (path.toLowerCase().includes("all mail") || path.toLowerCase() === "[gmail]/all mail") return "Archive";
    return path; // Custom folders use the actual path
  }

  static imapKeyword(labelId: string): string {
    return `$TeamMail-${labelId.replace(/-/g, '').slice(0, 12)}`;
  }

  private async processMessage(source: Buffer, uid: number, isSeenOnServer: boolean, mailboxPath: string, flags?: string[]): Promise<void> {
    try {
      const supabase = getSupabaseAdmin();
      const parsed: ParsedMail = await simpleParser(source);
      
      const messageId = parsed.messageId || `uid-${uid}-${Date.now()}`;
      const subject = parsed.subject || "(Kein Betreff)";
      const fromAddress = parsed.from?.value[0]?.address || "unknown@example.com";
      const toAddresses = parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap(t => t.value.map(v => v.address || "")) : [];
      const ccAddresses = parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap(c => c.value.map(v => v.address || "")) : [];
      
      const bodyText = parsed.text || "";
      const bodyHtml = parsed.html || "";
      const receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

      const fromName = parsed.from?.value[0]?.name || "";
      const bccAddresses = parsed.bcc ? (Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc]).flatMap(b => b.value.map(v => v.address || "")) : [];

      // Process Attachments
      const processedAttachments = [];
      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const attachment of parsed.attachments) {
          try {
            const fileName = attachment.filename || `attachment-${Date.now()}`;
            const fileExt = fileName.split('.').pop() || 'bin';
            const storagePath = `${this.config.teamId}/${this.config.inboxId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
            
            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
              .from('email_attachments')
              .upload(storagePath, attachment.content, {
                contentType: attachment.contentType || 'application/octet-stream',
                upsert: true
              });

            if (uploadError) {
              console.error(`[ImapClient] Failed to upload attachment ${fileName}:`, uploadError);
            } else {
              processedAttachments.push({
                file_name: fileName,
                content_type: attachment.contentType || 'application/octet-stream',
                size_bytes: attachment.size || attachment.content.length,
                storage_path: storagePath,
                is_inline: !!attachment.related || !!attachment.cid
              });
            }
          } catch (err) {
            console.error(`[ImapClient] Error processing attachment:`, err);
          }
        }
      }

      // Determine thread_id based on In-Reply-To or References
      let threadId = messageId;
      let inReplyTo = parsed.inReplyTo;
      if (!inReplyTo && parsed.references && parsed.references.length > 0) {
        inReplyTo = parsed.references[0];
      }

      if (inReplyTo) {
        // Strip out brackets if any
        inReplyTo = inReplyTo.replace(/[<>]/g, "");
      }

      // Add to BullMQ for robust processing
      const { emailQueue } = await import("../services/queue.service.js");
      
      await emailQueue.add(`process-email-${messageId}`, {
        inboxId: this.config.inboxId,
        teamId: this.config.teamId,
        imapUid: uid,
        messageId: messageId.replace(/[<>]/g, ""),
        subject,
        fromAddress,
        fromName,
        toAddresses: toAddresses.filter(Boolean),
        ccAddresses: ccAddresses.filter(Boolean),
        bccAddresses: bccAddresses.filter(Boolean),
        date: receivedAt,
        bodyText,
        bodyHtml,
        inReplyTo: inReplyTo || null,
        threadId: null, // Worker will calculate if null
        isRead: isSeenOnServer,
        attachments: processedAttachments,
        mailboxName: this.mailboxNameForPath(mailboxPath),
        imapFlags: flags?.filter(f => f.startsWith('$TeamMail-'))
      });

      console.log(`[ImapClient] Queued email for processing: ${subject}`);

    } catch (error) {
      console.error(`[ImapClient] Error processing message source:`, error);
    }
  }

  private async notifyUsers(emailId: string, subject: string, from: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    // 1. Find users who have access to this inbox
    // For shared inboxes, this means inbox_members
    // For private inboxes, this means owner_id
    
    // First, let's get the inbox details
    const { data: inbox } = await supabase
      .from("inboxes")
      .select("type, owner_id, name")
      .eq("id", this.config.inboxId)
      .single();
      
    if (!inbox) return;

    let userIds: string[] = [];

    if (inbox.type === "private" && inbox.owner_id) {
      userIds = [inbox.owner_id];
    } else if (inbox.type === "shared") {
      const { data: members } = await supabase
        .from("inbox_members")
        .select("user_id")
        .eq("inbox_id", this.config.inboxId);
        
      if (members) {
        userIds = members.map(m => m.user_id);
      }
    }

    if (userIds.length === 0) return;

    // 2. Fetch their push tokens
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", userIds);

    if (!tokens || tokens.length === 0) return;

    const expoTokens = tokens.map(t => t.token);
    
    // 3. Send Push
    await sendPushNotification(expoTokens, {
      title: `Neue E-Mail in ${inbox.name}`,
      body: `${from}: ${subject}`,
      data: { emailId, inboxId: this.config.inboxId }
    });
  }

  public async deleteMessage(uid: number, mailbox: string = "INBOX"): Promise<void> {
    if (!this.isConnected) await this.connect();
    
    // Ensure we are in the correct mailbox
    if (!this.client.mailbox || (this.client.mailbox as any).path !== mailbox) {
      await this.client.mailboxOpen(mailbox);
    }
    
    // Add \Deleted flag
    await this.client.messageFlagsAdd({ uid }, ["\\Deleted"], { uid: true });
    
    // Most servers support moving to Trash or expunging.
    // For now, we just set the flag.
    console.log(`[ImapClient] Marked uid ${uid} as deleted in ${mailbox}`);
  }

  public async archiveMessage(uid: number, mailbox: string = "INBOX"): Promise<void> {
    if (!this.isConnected) await this.connect();
    
    if (!this.client.mailbox || (this.client.mailbox as any).path !== mailbox) {
      await this.client.mailboxOpen(mailbox);
    }
    
    // Attempt to move to an Archive folder. First list folders to find it.
    const folders = await this.client.list();
    const archiveFolder = folders.find(f => 
      f.name.toLowerCase().includes('archive') || 
      f.name.toLowerCase().includes('archiv') || 
      f.specialUse === '\\Archive' ||
      f.name.toLowerCase().includes('all mail')
    );
    
    if (archiveFolder) {
      await this.client.messageMove({ uid }, archiveFolder.path, { uid: true });
      console.log(`[ImapClient] Moved uid ${uid} to archive folder: ${archiveFolder.path}`);
    } else {
      console.warn(`[ImapClient] No archive folder found for ${this.config.user}. Setting \Archive flag manually.`);
      // Some servers might not have an archive folder but support custom flags
      await this.client.messageFlagsAdd({ uid }, ["Archive"], { uid: true });
    }
  }

  public async addLabelFlag(uid: number, keyword: string, mailbox: string = "INBOX"): Promise<void> {
    if (!this.isConnected) await this.connect();
    if (!this.client.mailbox || (this.client.mailbox as any).path !== mailbox) {
      await this.client.mailboxOpen(mailbox);
    }
    await this.client.messageFlagsAdd({ uid }, [keyword], { uid: true });
    console.log(`[ImapClient] Added flag ${keyword} to uid ${uid} in ${mailbox}`);
  }

  public async removeLabelFlag(uid: number, keyword: string, mailbox: string = "INBOX"): Promise<void> {
    if (!this.isConnected) await this.connect();
    if (!this.client.mailbox || (this.client.mailbox as any).path !== mailbox) {
      await this.client.mailboxOpen(mailbox);
    }
    await this.client.messageFlagsRemove({ uid }, [keyword], { uid: true });
    console.log(`[ImapClient] Removed flag ${keyword} from uid ${uid} in ${mailbox}`);
  }

  public async appendSentMessage(rawEml: string): Promise<void> {
    if (!this.isConnected) await this.connect();
    
    // Find Sent folder
    const folders = await this.client.list();
    const sentFolder = folders.find(f => 
      f.specialUse === '\\Sent' || 
      f.name.toLowerCase().includes('sent') || 
      f.name.toLowerCase().includes('gesendet')
    );
    
    const targetFolder = sentFolder ? sentFolder.path : "INBOX";
    await this.client.append(targetFolder, rawEml, ["\\Seen"]);
    console.log(`[ImapClient] Appended sent message to ${targetFolder}`);
  }
}
