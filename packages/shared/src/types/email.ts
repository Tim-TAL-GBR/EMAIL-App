/**
 * @module email
 *
 * Composite / enriched email types used throughout the application layer.
 * These extend the raw database row types with joined data from assignments,
 * comments, and user profiles.
 */

import type {
  Email,
  EmailAssignment,
  EmailStatus,
  InternalComment,
  Profile,
} from './database.js';

/**
 * An email enriched with its assignments and comment count.
 *
 * @remarks Used in email detail views and list items where assignment badges are shown.
 */
export interface EmailWithDetails extends Email {
  /** List of active assignments for this email, with full profile data. */
  assignments: EmailAssignmentWithProfile[];

  /** Total number of internal comments on this email. */
  comment_count: number;
}

/**
 * An email assignment with resolved profile data for both the assignee and assigner.
 *
 * @remarks Used when rendering assignment chips with avatars and display names.
 */
export interface EmailAssignmentWithProfile extends EmailAssignment {
  /** Profile of the user the email is assigned to. */
  assigned_to_profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'email'>;

  /** Profile of the user who created the assignment. */
  assigned_by_profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'email'>;
}

/**
 * An internal comment with the author's profile data resolved.
 *
 * @remarks Used in the comment feed below an email detail view.
 */
export interface CommentWithAuthor extends InternalComment {
  /** The comment author's profile information. */
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'email'>;
}

/**
 * A grouped email thread (conversation) derived from emails sharing the same `thread_id`.
 *
 * @remarks
 * Threads are the primary unit of display in the inbox list view.
 * They aggregate metadata from all emails in the conversation.
 */
export interface EmailThread {
  /** The shared thread identifier grouping these emails. */
  thread_id: string;

  /** Subject line of the thread (taken from the first email). */
  subject: string;

  /** The most recent email in the thread. */
  last_email: Email;

  /** Total number of emails in this thread. */
  email_count: number;

  /** Unique email addresses of all participants in the thread. */
  participants: string[];

  /** Current lifecycle status of the thread (derived from the latest email). */
  status: EmailStatus;

  /** Whether any email in this thread has an active assignment. */
  has_assignments: boolean;
}
