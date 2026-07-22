import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { canAccessInbox } from "../realtime/guards.js";
import { ImapFlow } from "imapflow";

export const inboxRouter: Router = Router();

inboxRouter.use(requireAuth);

inboxRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const supabase = getSupabaseAdmin();

    const { data: inboxes, error } = await supabase
      .from("inboxes")
      .select("*, inbox_members!inner(role)")
      .eq("inbox_members.user_id", userId)
      .order("name");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const { data: ownedInboxes } = await supabase
      .from("inboxes")
      .select("*, inbox_members(role)")
      .eq("type", "private")
      .eq("owner_id", userId)
      .order("name");

    const merged = new Map<string, any>();
    for (const ib of [...(inboxes ?? []), ...(ownedInboxes ?? [])]) {
      merged.set(ib.id, ib);
    }

    res.json({ inboxes: Array.from(merged.values()) });
  } catch (err: any) {
    console.error("[InboxRoutes] GET / error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

inboxRouter.get("/:inboxId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId } = req.params;

    const hasAccess = await canAccessInbox(userId, inboxId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this inbox" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: inbox, error } = await supabase
      .from("inboxes")
      .select("*, inbox_members(*, profiles(id, email, display_name, avatar_url))")
      .eq("id", inboxId)
      .single();

    if (error || !inbox) {
      res.status(404).json({ error: "Inbox not found" });
      return;
    }

    const { count: unreadCount } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("inbox_id", inboxId)
      .eq("is_read", false)
      .eq("is_deleted", false);

    res.json({ inbox: { ...inbox, unread_count: unreadCount ?? 0 } });
  } catch (err: any) {
    console.error("[InboxRoutes] GET /:inboxId error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

inboxRouter.get("/:inboxId/emails", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId } = req.params;

    const hasAccess = await canAccessInbox(userId, inboxId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this inbox" });
      return;
    }

    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("emails")
      .select("*, email_assignments(*), internal_comments(count)")
      .eq("inbox_id", inboxId)
      .eq("is_deleted", false)
      .order("received_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ["open", "in_progress", "done"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: emails, error, count } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ emails: emails ?? [], count });
  } catch (err: any) {
    console.error("[InboxRoutes] GET /:inboxId/emails error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

inboxRouter.post("/:inboxId/reconnect", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId } = req.params;

    const hasAccess = await canAccessInbox(userId, inboxId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this inbox" });
      return;
    }

    const { mailManager } = await import("../mail/MailManager.js");
    await mailManager.restartClient(inboxId);
    
    res.json({ success: true, message: "IMAP client restarted" });
  } catch (err: any) {
    console.error("[InboxRoutes] POST /:inboxId/reconnect error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

inboxRouter.post("/:inboxId/archive-bulk", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId } = req.params;
    const { beforeDate } = req.body; // YYYY-MM-DD

    if (!beforeDate) {
      res.status(400).json({ error: "beforeDate is required" });
      return;
    }

    const hasAccess = await canAccessInbox(userId, inboxId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this inbox" });
      return;
    }

    const dateStr = new Date(beforeDate).toISOString();

    // Move to Archive logic
    // Update emails in DB where date < beforeDate and status = open
    const { getSupabaseAdmin } = await import("../services/auth.service.js");
    const supabaseAdmin = getSupabaseAdmin();
    const { data: updated, error } = await supabaseAdmin
      .from("emails")
      .update({ status: "done" })
      .eq("inbox_id", inboxId)
      .eq("status", "open")
      .lt("date", dateStr)
      .select();

    if (error) throw error;

    // TODO: Ideally we should also move them in IMAP (mailManager.moveEmails)
    
    res.json({ success: true, count: updated?.length || 0 });
  } catch (err: any) {
    console.error("[InboxRoutes] POST /:inboxId/archive-bulk error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

inboxRouter.delete("/:inboxId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId } = req.params;
    const supabase = getSupabaseAdmin();

    // Verify inbox exists and load its type/owner
    const { data: inbox, error: fetchError } = await supabase
      .from("inboxes")
      .select("id, type, owner_id, team_id")
      .eq("id", inboxId)
      .single();

    if (fetchError || !inbox) {
      res.status(404).json({ error: "Postfach nicht gefunden" });
      return;
    }

    // Permission check
    if (inbox.type === "private") {
      if (inbox.owner_id !== userId) {
        res.status(403).json({ error: "Nur der Eigentümer kann dieses Postfach löschen" });
        return;
      }
    } else {
      const { data: membership } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", inbox.team_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        res.status(403).json({ error: "Nur Team-Admins können geteilte Postfächer löschen" });
        return;
      }
    }

    // Delete in correct order (foreign keys)
    const { data: emailRows } = await supabase.from("emails").select("id").eq("inbox_id", inboxId);
    if (emailRows && emailRows.length > 0) {
      const ids = emailRows.map((e: any) => e.id);
      await supabase.from("internal_comments").delete().in("email_id", ids);
      await supabase.from("email_assignments").delete().in("email_id", ids);
    }
    await supabase.from("emails").delete().eq("inbox_id", inboxId);
    await supabase.from("inbox_members").delete().eq("inbox_id", inboxId);
    await supabase.from("inbox_aliases").delete().eq("inbox_id", inboxId);

    const { error: deleteError } = await supabase.from("inboxes").delete().eq("id", inboxId);
    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[InboxRoutes] DELETE /:inboxId error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

inboxRouter.get("/:inboxId/folders", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId } = req.params;

    const hasAccess = await canAccessInbox(userId, inboxId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this inbox" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: creds, error } = await supabase
      .from("inboxes")
      .select("imap_host, imap_port, imap_user, imap_pass, imap_secure")
      .eq("id", inboxId)
      .maybeSingle();

    if (error || !creds) {
      res.status(404).json({ error: "IMAP-Zugangsdaten nicht gefunden" });
      return;
    }

    const client = new ImapFlow({
      host: creds.imap_host,
      port: creds.imap_port,
      secure: creds.imap_secure !== false,
      auth: { user: creds.imap_user, pass: creds.imap_pass },
      logger: false,
    });

    await client.connect();
    const folders = await client.list();
    await client.logout();

    // Map folders to a simpler array
    const mappedFolders = folders.map(f => ({
      path: f.path,
      name: f.name,
      specialUse: f.specialUse // e.g. '\Sent', '\Trash', '\Drafts'
    }));

    res.json({ folders: mappedFolders });
  } catch (err: any) {
    console.error("[InboxRoutes] GET /:inboxId/folders error:", err);
    res.status(500).json({ error: err.message || "Fehler beim Abrufen der IMAP-Ordner" });
  }
});
