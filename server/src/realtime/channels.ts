import type { WebSocket } from "ws";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelSubscription {
  /** Supabase user id. */
  userId: string;
  /** The WebSocket connection for this subscriber. */
  ws: WebSocket;
  /** The type of channel being subscribed to. */
  channelType: "inbox" | "email";
  /** The resource id (inbox UUID or email UUID). */
  channelId: string;
}

// ---------------------------------------------------------------------------
// Channel Manager
// ---------------------------------------------------------------------------

/**
 * Manages WebSocket subscriptions to named channels.
 *
 * A channel name follows the pattern `inbox:<uuid>` or `email:<uuid>`.
 * Multiple WebSocket connections can subscribe to the same channel,
 * and a single WebSocket can subscribe to multiple channels.
 */
export class ChannelManager {
  /** Map of channel name → set of active subscriptions. */
  private subscriptions = new Map<string, Set<ChannelSubscription>>();

  // -------------------------------------------------------------------------
  // Subscribe / Unsubscribe
  // -------------------------------------------------------------------------

  /** Add a subscription to a channel. */
  subscribe(channel: string, sub: ChannelSubscription): void {
    let subs = this.subscriptions.get(channel);
    if (!subs) {
      subs = new Set();
      this.subscriptions.set(channel, subs);
    }
    subs.add(sub);
    console.log(
      `[channels] User ${sub.userId} subscribed to ${channel} (${subs.size} total)`,
    );
  }

  /** Remove a specific WebSocket from a single channel. */
  unsubscribe(channel: string, ws: WebSocket): void {
    const subs = this.subscriptions.get(channel);
    if (!subs) return;

    for (const sub of subs) {
      if (sub.ws === ws) {
        subs.delete(sub);
        console.log(`[channels] WebSocket unsubscribed from ${channel}`);
        break;
      }
    }

    // Clean up empty channels
    if (subs.size === 0) {
      this.subscriptions.delete(channel);
    }
  }

  /** Remove a WebSocket from **all** channels (e.g. on disconnect). */
  unsubscribeAll(ws: WebSocket): void {
    for (const [channel, subs] of this.subscriptions) {
      for (const sub of subs) {
        if (sub.ws === ws) {
          subs.delete(sub);
          break;
        }
      }
      if (subs.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
    console.log("[channels] WebSocket removed from all channels");
  }

  /** Return all subscribers for a channel. */
  getSubscribers(channel: string): Set<ChannelSubscription> {
    return this.subscriptions.get(channel) ?? new Set();
  }

  /**
   * Broadcast a JSON-serialisable event to every subscriber on a channel.
   *
   * Silently skips connections that are not in the OPEN state.
   */
  broadcast(channel: string, event: Record<string, unknown>): void {
    const subs = this.subscriptions.get(channel);
    if (!subs || subs.size === 0) return;

    const payload = JSON.stringify(event);
    let sent = 0;

    for (const sub of subs) {
      if (sub.ws.readyState === sub.ws.OPEN) {
        sub.ws.send(payload);
        sent++;
      }
    }

    console.log(`[channels] Broadcast to ${channel}: ${sent}/${subs.size} clients`);
  }

  /** Return a snapshot of active channel names (useful for debugging). */
  getActiveChannels(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}
