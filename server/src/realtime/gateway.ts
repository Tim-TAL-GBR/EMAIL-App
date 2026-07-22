import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { authenticateWs, type TokenPayload } from "../middleware/auth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { ChannelManager } from "./channels.js";
import type { ChannelSubscription } from "./channels.js";
import { canAccessInbox, canAccessEmail } from "./guards.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Messages received from clients. */
interface ClientMessage {
  type: "subscribe" | "unsubscribe" | "ping";
  channel?: string;
}

/** Messages sent to clients. */
interface ServerMessage {
  type: "subscribed" | "unsubscribed" | "event" | "error" | "pong";
  channel?: string;
  event?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  data?: Record<string, unknown>;
  error?: string;
}

/** Extended WebSocket with metadata attached during auth. */
interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  email?: string;
  isAlive?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

/**
 * Create the WebSocket gateway and attach it to the given HTTP server.
 *
 * This is the core realtime component. It:
 * 1. Authenticates every incoming WS connection via JWT
 * 2. Handles subscribe / unsubscribe / ping messages from clients
 * 3. Listens to Supabase Realtime postgres_changes and broadcasts
 *    events to authorised channel subscribers
 * 4. Runs a heartbeat to prune dead connections
 */
export function createWebSocketGateway(server: HttpServer): void {
  const wss = new WebSocketServer({ server });
  const channels = new ChannelManager();

  console.log("[gateway] WebSocket gateway initialised");

  // -----------------------------------------------------------------------
  // 1. Connection handling
  // -----------------------------------------------------------------------

  wss.on("connection", async (ws: AuthenticatedSocket, request: IncomingMessage) => {
    // Authenticate the connection
    let user: TokenPayload;
    try {
      user = await authenticateWs(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      console.error(`[gateway] Auth failed: ${message}`);
      sendMessage(ws, { type: "error", error: message });
      ws.close(4001, "Unauthorized");
      return;
    }

    // Attach user metadata to the socket
    ws.userId = user.sub;
    ws.email = user.email;
    ws.isAlive = true;

    console.log(`[gateway] Client connected: ${user.email} (${user.sub})`);
    sendMessage(ws, {
      type: "event",
      data: { message: "Connected to TeamMail realtime server" },
    });

    // -------------------------------------------------------------------
    // 2. Message handling
    // -------------------------------------------------------------------

    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        sendMessage(ws, { type: "error", error: "Invalid JSON" });
        return;
      }

      try {
        switch (msg.type) {
          case "ping":
            sendMessage(ws, { type: "pong" });
            break;

          case "subscribe":
            await handleSubscribe(ws, user, msg.channel, channels);
            break;

          case "unsubscribe":
            handleUnsubscribe(ws, msg.channel, channels);
            break;

          default:
            sendMessage(ws, {
              type: "error",
              error: `Unknown message type: ${(msg as { type: string }).type}`,
            });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Internal error";
        console.error(`[gateway] Error handling message:`, errorMsg);
        sendMessage(ws, { type: "error", error: errorMsg });
      }
    });

    // -------------------------------------------------------------------
    // 3. Disconnect
    // -------------------------------------------------------------------

    ws.on("close", () => {
      channels.unsubscribeAll(ws);
      console.log(`[gateway] Client disconnected: ${user.email}`);
    });

    ws.on("error", (err) => {
      console.error(`[gateway] WebSocket error for ${user.email}:`, err.message);
      channels.unsubscribeAll(ws);
    });

    // Heartbeat: mark alive on pong
    ws.on("pong", () => {
      ws.isAlive = true;
    });
  });

  // -----------------------------------------------------------------------
  // 4. Heartbeat – prune dead connections every 30 seconds
  // -----------------------------------------------------------------------

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const sock = client as AuthenticatedSocket;
      if (sock.isAlive === false) {
        console.log(`[gateway] Terminating dead connection: ${sock.userId}`);
        channels.unsubscribeAll(sock);
        sock.terminate();
        continue;
      }
      sock.isAlive = false;
      sock.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(heartbeat);
    console.log("[gateway] WebSocket server closed");
  });

  // -----------------------------------------------------------------------
  // 5. Supabase Realtime Listeners
  // -----------------------------------------------------------------------

  setupRealtimeListeners(channels);
}

// ---------------------------------------------------------------------------
// Subscribe / Unsubscribe Handlers
// ---------------------------------------------------------------------------

/**
 * Handle a `subscribe` request from a client.
 *
 * Parses the channel string (`inbox:<id>` or `email:<id>`), validates
 * access rights, and registers the subscription on success.
 */
async function handleSubscribe(
  ws: AuthenticatedSocket,
  user: TokenPayload,
  channel: string | undefined,
  channels: ChannelManager,
): Promise<void> {
  if (!channel) {
    sendMessage(ws, { type: "error", error: "Missing channel" });
    return;
  }

  const parsed = parseChannel(channel);
  if (!parsed) {
    sendMessage(ws, { type: "error", error: `Invalid channel format: ${channel}` });
    return;
  }

  const { type, id } = parsed;

  // Access control
  let hasAccess = false;
  if (type === "inbox") {
    hasAccess = await canAccessInbox(user.sub, id);
  } else if (type === "email") {
    hasAccess = await canAccessEmail(user.sub, id);
  }

  if (!hasAccess) {
    console.log(`[gateway] Access denied: ${user.email} → ${channel}`);
    sendMessage(ws, {
      type: "error",
      channel,
      error: "Access denied",
    });
    return;
  }

  const sub: ChannelSubscription = {
    userId: user.sub,
    ws,
    channelType: type,
    channelId: id,
  };

  channels.subscribe(channel, sub);
  sendMessage(ws, { type: "subscribed", channel });
}

/**
 * Handle an `unsubscribe` request from a client.
 */
function handleUnsubscribe(
  ws: WebSocket,
  channel: string | undefined,
  channels: ChannelManager,
): void {
  if (!channel) {
    sendMessage(ws, { type: "error", error: "Missing channel" });
    return;
  }

  channels.unsubscribe(channel, ws);
  sendMessage(ws, { type: "unsubscribed", channel });
}

// ---------------------------------------------------------------------------
// Supabase Realtime Listeners
// ---------------------------------------------------------------------------

/**
 * Subscribe to Supabase Realtime postgres_changes and broadcast
 * relevant events to the appropriate channels.
 */
function setupRealtimeListeners(channels: ChannelManager): void {
  const supabase = getSupabaseAdmin();

  // -- Emails table → broadcast to inbox:{inbox_id} --
  supabase
    .channel("db-emails")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "emails" },
      (payload) => {
        const record = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
        const inboxId = record?.inbox_id as string | undefined;

        if (!inboxId) {
          console.error("[gateway] Email change without inbox_id:", payload);
          return;
        }

        const channel = `inbox:${inboxId}`;
        console.log(`[gateway] Email ${payload.eventType} → ${channel}`);

        channels.broadcast(channel, {
          type: "event",
          channel,
          event: payload.eventType,
          table: "emails",
          data: payload.new ?? payload.old,
        });
      },
    )
    .subscribe((status) => {
      console.log(`[gateway] Supabase emails channel: ${status}`);
    });

  // -- Internal comments → broadcast to email:{email_id} --
  supabase
    .channel("db-internal-comments")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "internal_comments" },
      (payload) => {
        const record = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
        const emailId = record?.email_id as string | undefined;

        if (!emailId) {
          console.error("[gateway] Comment change without email_id:", payload);
          return;
        }

        const channel = `email:${emailId}`;
        console.log(`[gateway] Comment ${payload.eventType} → ${channel}`);

        channels.broadcast(channel, {
          type: "event",
          channel,
          event: payload.eventType,
          table: "internal_comments",
          data: payload.new ?? payload.old,
        });
      },
    )
    .subscribe((status) => {
      console.log(`[gateway] Supabase internal_comments channel: ${status}`);
    });

  // -- Email assignments → broadcast to email:{email_id} --
  supabase
    .channel("db-email-assignments")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "email_assignments" },
      (payload) => {
        const record = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
        const emailId = record?.email_id as string | undefined;

        if (!emailId) {
          console.error("[gateway] Assignment change without email_id:", payload);
          return;
        }

        const channel = `email:${emailId}`;
        console.log(`[gateway] Assignment ${payload.eventType} → ${channel}`);

        channels.broadcast(channel, {
          type: "event",
          channel,
          event: payload.eventType,
          table: "email_assignments",
          data: payload.new ?? payload.old,
        });
      },
    )
    .subscribe((status) => {
      console.log(`[gateway] Supabase email_assignments channel: ${status}`);
    });

  // -- Inboxes table → broadcast to inbox:{id} --
  supabase
    .channel("db-inboxes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inboxes" },
      (payload) => {
        const record = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
        const inboxId = record?.id as string | undefined;

        if (!inboxId) {
          console.error("[gateway] Inbox change without id:", payload);
          return;
        }

        const channel = `inbox:${inboxId}`;
        console.log(`[gateway] Inbox ${payload.eventType} → ${channel}`);

        channels.broadcast(channel, {
          type: "event",
          channel,
          event: payload.eventType,
          table: "inboxes",
          data: payload.new ?? payload.old,
        });
      },
    )
    .subscribe((status) => {
      console.log(`[gateway] Supabase inboxes channel: ${status}`);
    });

  console.log("[gateway] Supabase realtime listeners registered");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a channel string like `inbox:abc-123` into its components.
 */
function parseChannel(
  channel: string,
): { type: "inbox" | "email"; id: string } | null {
  const match = channel.match(/^(inbox|email):(.+)$/);
  if (!match) return null;
  return { type: match[1] as "inbox" | "email", id: match[2] };
}

/**
 * Send a JSON message to a WebSocket client.
 * Silently drops the message if the socket is not open.
 */
function sendMessage(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
