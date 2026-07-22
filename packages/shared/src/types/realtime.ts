/**
 * @module realtime
 *
 * WebSocket / real-time message types and channel utilities.
 *
 * @remarks
 * These types define the contract between the WebSocket server and connected clients.
 * Channels follow a `type:id` naming convention (e.g. `inbox:abc-123`).
 */

// ─────────────────────────────────────────────
// CLIENT → SERVER MESSAGES
// ─────────────────────────────────────────────

/**
 * Messages sent from the client to the WebSocket server.
 *
 * - `subscribe`   – Start receiving events for a channel.
 * - `unsubscribe` – Stop receiving events for a channel.
 * - `ping`        – Keep-alive heartbeat.
 */
export type ClientMessage =
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
  | { type: 'ping' };

// ─────────────────────────────────────────────
// SERVER → CLIENT MESSAGES
// ─────────────────────────────────────────────

/**
 * Messages sent from the WebSocket server to connected clients.
 *
 * - `subscribed`   – Confirms a successful channel subscription.
 * - `unsubscribed` – Confirms a successful channel unsubscription.
 * - `event`        – A database change event on a subscribed channel.
 * - `error`        – An error related to a specific channel or the connection.
 * - `pong`         – Response to a client `ping`.
 */
export type ServerMessage =
  | { type: 'subscribed'; channel: string }
  | { type: 'unsubscribed'; channel: string }
  | {
      type: 'event';
      channel: string;
      event: 'INSERT' | 'UPDATE' | 'DELETE';
      table: string;
      data: Record<string, unknown>;
    }
  | { type: 'error'; channel?: string; error: string }
  | { type: 'pong' };

// ─────────────────────────────────────────────
// CHANNEL HELPERS
// ─────────────────────────────────────────────

/** Parsed result of a channel name string. */
export interface ParsedChannel {
  /** The channel type (e.g. `'inbox'` or `'email'`). */
  type: 'inbox' | 'email';

  /** The entity UUID associated with the channel. */
  id: string;
}

/**
 * Constructs a channel name for subscribing to inbox-level events.
 *
 * @param inboxId - The UUID of the inbox.
 * @returns A channel string in the format `inbox:<inboxId>`.
 *
 * @example
 * ```ts
 * inboxChannel('abc-123'); // → 'inbox:abc-123'
 * ```
 */
export function inboxChannel(inboxId: string): string {
  return `inbox:${inboxId}`;
}

/**
 * Constructs a channel name for subscribing to email-level events.
 *
 * @param emailId - The UUID of the email.
 * @returns A channel string in the format `email:<emailId>`.
 *
 * @example
 * ```ts
 * emailChannel('def-456'); // → 'email:def-456'
 * ```
 */
export function emailChannel(emailId: string): string {
  return `email:${emailId}`;
}

/**
 * Parses a channel name string into its type and ID components.
 *
 * @param channel - The channel string to parse (e.g. `'inbox:abc-123'`).
 * @returns A {@link ParsedChannel} object, or `null` if the format is invalid.
 *
 * @example
 * ```ts
 * parseChannel('inbox:abc-123'); // → { type: 'inbox', id: 'abc-123' }
 * parseChannel('unknown:xyz');   // → null
 * ```
 */
export function parseChannel(channel: string): ParsedChannel | null {
  const [type, id] = channel.split(':');
  if ((type === 'inbox' || type === 'email') && id) {
    return { type, id };
  }
  return null;
}
