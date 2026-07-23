import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { canAccessInbox } from "../realtime/guards.js";
import { ImapFlow } from "imapflow";
import { z } from "zod";
import { validateBody } from "../middleware/validate.middleware.js";
import { encrypt, decrypt } from "../utils/encryption.js";

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

inboxRouter.post("/:inboxId/archive-bulk", validateBody(z.object({ beforeDate: z.string().min(10) })), async (req, res) => {
  try {
    const userId = req.user!.sub;
    const inboxId = req.params.inboxId as string;
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
      .lt("received_at", dateStr)
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

inboxRouter.patch("/:inboxId/credentials", validateBody(z.object({
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive(),
  imapUser: z.string().min(1),
  imapPass: z.string().min(1),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive(),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  imapSecure: z.boolean(),
  smtpSecure: z.boolean(),
})), async (req, res) => {
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
        res.status(403).json({ error: "Nur der Eigentümer kann Zugangsdaten ändern" });
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
        res.status(403).json({ error: "Nur Team-Admins können Zugangsdaten ändern" });
        return;
      }
    }

    const { imapHost, imapPort, imapUser, imapPass, smtpHost, smtpPort, smtpUser, smtpPass, imapSecure, smtpSecure } = req.body;

    const { error: updateError } = await supabase.from("inboxes").update({
      imap_host: imapHost,
      imap_port: imapPort,
      imap_user: imapUser,
      imap_pass: encrypt(imapPass),
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_user: smtpUser,
      smtp_pass: encrypt(smtpPass),
      imap_secure: imapSecure,
      smtp_secure: smtpSecure,
    }).eq("id", inboxId);

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[InboxRoutes] PATCH /:inboxId/credentials error:", err);
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
      auth: { user: creds.imap_user, pass: decrypt(creds.imap_pass) },
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

// ---------------------------------------------------------------------------
// POST /api/inboxes/:inboxId/members/invite – Invite a user by email
// ---------------------------------------------------------------------------
inboxRouter.post("/:inboxId/members/invite", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId } = req.params;
    const { email, role = "member" } = req.body;

    if (!email?.trim()) {
      res.status(400).json({ error: "E-Mail ist erforderlich" });
      return;
    }

    const supabase = getSupabaseAdmin();

    const { data: inbox } = await supabase
      .from("inboxes")
      .select("type, owner_id, team_id")
      .eq("id", inboxId)
      .single();

    if (!inbox) {
      res.status(404).json({ error: "Inbox not found" });
      return;
    }

    // Check permissions
    let isAdminOrOwner = false;
    if (inbox.type === "private") {
      isAdminOrOwner = inbox.owner_id === userId;
    } else {
      // For shared inboxes, check inbox_members first, then team_members
      const { data: inboxMem } = await supabase
        .from("inbox_members")
        .select("role")
        .eq("inbox_id", inboxId)
        .eq("user_id", userId)
        .maybeSingle();

      if (inboxMem && ["owner", "admin"].includes(inboxMem.role)) {
        isAdminOrOwner = true;
      } else {
        const { data: teamMem } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", inbox.team_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (teamMem && ["owner", "admin"].includes(teamMem.role)) {
          isAdminOrOwner = true;
        }
      }
    }

    if (!isAdminOrOwner) {
      res.status(403).json({ error: "Nur Admins können Mitglieder einladen" });
      return;
    }

    let { data: profile } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (!profile) {
      // Invite user
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email.trim().toLowerCase());
      
      if (inviteError) {
        res.status(500).json({ error: `Einladung fehlgeschlagen: ${inviteError.message}` });
        return;
      }
      
      if (!inviteData?.user) {
        res.status(500).json({ error: "Fehler beim Erstellen der Einladung" });
        return;
      }

      profile = {
        id: inviteData.user.id,
        email: inviteData.user.email,
        display_name: null,
      };
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("inbox_members")
      .select("role")
      .eq("inbox_id", inboxId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: "Dieser Benutzer ist bereits Mitglied" });
      return;
    }

    // Add member
    const { error } = await supabase
      .from("inbox_members")
      .insert({ inbox_id: inboxId, user_id: profile.id, role });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ 
      message: `${profile.display_name || profile.email} wurde erfolgreich hinzugefügt`,
      user: profile 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/inboxes/:inboxId/members/:memberId – Change a member's role
// ---------------------------------------------------------------------------
inboxRouter.patch("/:inboxId/members/:memberId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId, memberId } = req.params;
    const { role } = req.body;

    if (!role || !["owner", "admin", "member"].includes(role)) {
      res.status(400).json({ error: "Ungültige Rolle" });
      return;
    }

    const supabase = getSupabaseAdmin();

    const { data: inbox } = await supabase
      .from("inboxes")
      .select("type, owner_id, team_id")
      .eq("id", inboxId)
      .single();

    if (!inbox) {
      res.status(404).json({ error: "Inbox not found" });
      return;
    }

    let myRole: string | null = null;
    if (inbox.type === "private") {
      if (inbox.owner_id === userId) myRole = "owner";
    } else {
      const { data: inboxMem } = await supabase
        .from("inbox_members")
        .select("role")
        .eq("inbox_id", inboxId)
        .eq("user_id", userId)
        .maybeSingle();

      myRole = inboxMem?.role || null;
      if (!myRole || myRole === "member") {
        const { data: teamMem } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", inbox.team_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (teamMem && ["owner", "admin"].includes(teamMem.role)) {
          myRole = teamMem.role;
        }
      }
    }

    if (!myRole || !["owner", "admin"].includes(myRole)) {
      res.status(403).json({ error: "Keine Berechtigung zum Ändern von Rollen" });
      return;
    }

    const { data: targetMembership } = await supabase
      .from("inbox_members")
      .select("role")
      .eq("inbox_id", inboxId)
      .eq("user_id", memberId)
      .maybeSingle();

    if (!targetMembership) {
      res.status(404).json({ error: "Mitglied nicht gefunden" });
      return;
    }

    if (myRole === "admin" && targetMembership.role === "owner") {
      res.status(403).json({ error: "Ein Admin kann die Rolle eines Owners nicht ändern" });
      return;
    }

    if (role === "owner" && myRole !== "owner") {
      res.status(403).json({ error: "Nur ein Owner kann die Rolle 'owner' vergeben" });
      return;
    }

    if (targetMembership.role === "owner" && role !== "owner" && myRole !== "owner") {
      res.status(403).json({ error: "Nur ein Owner kann einen anderen Owner herabstufen" });
      return;
    }

    const { error } = await supabase
      .from("inbox_members")
      .update({ role })
      .eq("inbox_id", inboxId)
      .eq("user_id", memberId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: "Rolle erfolgreich geändert" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/inboxes/:inboxId/members/:memberId – Remove a member
// ---------------------------------------------------------------------------
inboxRouter.delete("/:inboxId/members/:memberId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { inboxId, memberId } = req.params;
    const supabase = getSupabaseAdmin();

    const { data: inbox } = await supabase
      .from("inboxes")
      .select("type, owner_id, team_id")
      .eq("id", inboxId)
      .single();

    if (!inbox) {
      res.status(404).json({ error: "Inbox not found" });
      return;
    }

    let myRole: string | null = null;
    if (inbox.type === "private") {
      if (inbox.owner_id === userId) myRole = "owner";
    } else {
      const { data: inboxMem } = await supabase
        .from("inbox_members")
        .select("role")
        .eq("inbox_id", inboxId)
        .eq("user_id", userId)
        .maybeSingle();

      myRole = inboxMem?.role || null;
      if (!myRole || myRole === "member") {
        const { data: teamMem } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", inbox.team_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (teamMem && ["owner", "admin"].includes(teamMem.role)) {
          myRole = teamMem.role;
        }
      }
    }

    const isSelf = userId === memberId;
    const isAdminOrOwner = myRole && ["owner", "admin"].includes(myRole);

    if (!isSelf && !isAdminOrOwner) {
      res.status(403).json({ error: "Keine Berechtigung zum Entfernen von Mitgliedern" });
      return;
    }

    const { error } = await supabase
      .from("inbox_members")
      .delete()
      .eq("inbox_id", inboxId)
      .eq("user_id", memberId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: "Mitglied erfolgreich entfernt" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

