import { getSupabaseAdmin } from "../services/auth.service.js";
import { ImapClient } from "./ImapClient.js";
import { decrypt } from "../utils/encryption.js";

export class MailManager {
  private clients: Map<string, ImapClient> = new Map();
  private restarting: Set<string> = new Set();

  /**
   * Initializes IMAP connections for all inboxes with configured credentials.
   * This should be called when the server starts.
   */
  public async initialize(): Promise<void> {
    console.log("[MailManager] Initializing mail manager...");
    const supabase = getSupabaseAdmin();

    const { data: inboxes, error } = await supabase
      .from("inboxes")
      .select("id, team_id, imap_host, imap_port, imap_user, imap_pass, sync_since, imap_secure")
      .not("imap_host", "is", null);

    if (error) {
      console.error("[MailManager] Failed to fetch inboxes:", error);
      return;
    }

    if (!inboxes || inboxes.length === 0) {
      console.log("[MailManager] No inboxes with IMAP credentials found.");
      return;
    }

    for (const inbox of inboxes) {
      if (inbox.imap_host && inbox.imap_user && inbox.imap_pass) {
        this.addClient({
          inboxId: inbox.id,
          teamId: inbox.team_id,
          host: inbox.imap_host,
          port: inbox.imap_port || 993,
          user: inbox.imap_user,
          pass: decrypt(inbox.imap_pass),
          sync_since: inbox.sync_since,
          secure: inbox.imap_secure !== false,
        });
      }
    }
  }

  private addClient(config: any) {
    if (this.clients.has(config.inboxId)) {
      console.log(`[MailManager] Client for inbox ${config.inboxId} already exists.`);
      return;
    }

    const client = new ImapClient(config);
    this.clients.set(config.inboxId, client);
    client.connect();
  }

  /**
   * Restarts the IMAP client for a specific inbox.
   * Useful when credentials have been updated.
   */
  public async restartClient(inboxId: string): Promise<void> {
    if (this.restarting.has(inboxId)) {
      console.log(`[MailManager] Restart for inbox ${inboxId} is already in progress.`);
      return;
    }
    this.restarting.add(inboxId);

    try {
      console.log(`[MailManager] Restarting client for inbox ${inboxId}...`);
      
      // Disconnect existing if any
      const existingClient = this.clients.get(inboxId);
      if (existingClient) {
        await existingClient.disconnect();
        this.clients.delete(inboxId);
      }

      // Fetch new credentials from DB
      const supabase = getSupabaseAdmin();
      const { data: inbox, error } = await supabase
        .from("inboxes")
        .select("id, team_id, imap_host, imap_port, imap_user, imap_pass, sync_since, imap_secure")
        .eq("id", inboxId)
        .single();

      if (error || !inbox || !inbox.imap_host || !inbox.imap_user || !inbox.imap_pass) {
        console.log(`[MailManager] Cannot start client for ${inboxId}: missing credentials.`);
        return;
      }

      this.addClient({
        inboxId: inbox.id,
        teamId: inbox.team_id,
        host: inbox.imap_host,
        port: inbox.imap_port || 993,
        user: inbox.imap_user,
        pass: decrypt(inbox.imap_pass),
        sync_since: inbox.sync_since,
        secure: inbox.imap_secure !== false,
      });
    } finally {
      this.restarting.delete(inboxId);
    }
  }

  /**
   * Disconnects all IMAP clients. Useful for graceful shutdown.
   */
  public async shutdown(): Promise<void> {
    console.log("[MailManager] Shutting down all IMAP clients...");
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
  }

  /**
   * Retrieves an active IMAP client for the given inbox ID.
   */
  public getClient(inboxId: string): ImapClient | undefined {
    return this.clients.get(inboxId);
  }
}

export const mailManager = new MailManager();
