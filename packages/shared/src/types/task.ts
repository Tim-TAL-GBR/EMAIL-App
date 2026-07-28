/**
 * @module task
 *
 * Composite / enriched task types used throughout the application layer.
 * These extend the raw database row types with profile data and comment counts.
 */

import type { Task as DbTask, TaskComment as DbTaskComment } from './database.js';
import type { Profile } from './database.js';

/**
 * A task enriched with joined profile data, team info, and comment count.
 *
 * @remarks Used in task list views and detail screens.
 */
export interface TaskWithRelations extends DbTask {
  /** The assigned user's profile. */
  assignee?: Pick<Profile, 'id' | 'display_name' | 'email'> | null;

  /** The creator's profile. */
  creator?: Pick<Profile, 'id' | 'display_name' | 'email'> | null;

  /** The team this task belongs to. */
  team?: { id: string; name: string } | null;

  /** Number of comments on this task. */
  comment_count?: number;
}

/**
 * A task with full detail including comments.
 *
 * @remarks Used in the task detail view.
 */
export interface TaskDetail extends TaskWithRelations {
  /** All comments on this task. */
  comments: TaskCommentWithUser[];
}

/**
 * A task comment with the author's profile resolved.
 */
export interface TaskCommentWithUser extends DbTaskComment {
  /** The comment author's profile. */
  user?: Pick<Profile, 'id' | 'display_name' | 'email'> | null;
}

/**
 * Payload for creating a new task.
 */
export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  team_id: string;
  assigned_to?: string | null;
  linked_email_id?: string | null;
  due_date?: string | null;
}

/**
 * Payload for updating an existing task.
 */
export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  status?: 'open' | 'done';
  assigned_to?: string | null;
  due_date?: string | null;
  team_id?: string;
}
