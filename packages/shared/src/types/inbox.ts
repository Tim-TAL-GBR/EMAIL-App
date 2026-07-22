/**
 * @module inbox
 *
 * Composite / enriched inbox types used throughout the application layer.
 * These extend the raw database row types with computed fields and joined data.
 */

import type { Inbox, InboxMember, InboxRole, Profile } from './database.js';

/**
 * An inbox enriched with aggregate counts and optionally its member list.
 *
 * @remarks Used in inbox detail views where unread badges and member info are needed.
 */
export interface InboxWithMeta extends Inbox {
  /** Number of unread emails in this inbox for the current user. */
  unread_count: number;

  /** Total number of emails in this inbox. */
  total_count: number;

  /** Optional list of inbox members with their profile data. */
  members?: InboxMemberWithProfile[];
}

/**
 * An inbox member with their associated user profile.
 *
 * @remarks Used when displaying member avatars and names in the inbox settings.
 */
export interface InboxMemberWithProfile extends InboxMember {
  /** The member's profile information. */
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'email'>;
}

/**
 * Lightweight inbox representation for sidebar/navigation lists.
 *
 * @remarks
 * - `user_role` is `'owner'` for private inboxes where the current user is the owner.
 * - For shared inboxes, it reflects the user's actual {@link InboxRole}.
 */
export interface InboxListItem {
  /** Unique inbox identifier. */
  id: string;

  /** Human-readable inbox name. */
  name: string;

  /** The email address associated with this inbox. */
  email_address: string;

  /** Whether the inbox is private or shared. */
  type: Inbox['type'];

  /** Optional hex color for UI badges/indicators. */
  color: string | null;

  /** Number of unread emails in this inbox. */
  unread_count: number;

  /** The current user's role in this inbox, or `'owner'` for private inboxes. */
  user_role: InboxRole | 'owner';
}
