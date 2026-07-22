/**
 * @module inbox.schema
 *
 * Zod validation schemas for inbox and template operations.
 * Used by both the API layer (request validation) and the frontend (form validation).
 */

import { z } from 'zod';

// ─────────────────────────────────────────────
// ENUM SCHEMAS
// ─────────────────────────────────────────────

/** Schema for the {@link InboxType} enum. */
export const inboxTypeSchema = z.enum(['private', 'shared']);

/** Schema for the {@link InboxRole} enum. */
export const inboxRoleSchema = z.enum(['admin', 'member', 'observer']);

// ─────────────────────────────────────────────
// INBOX OPERATION SCHEMAS
// ─────────────────────────────────────────────

/**
 * Schema for creating a new inbox.
 *
 * @remarks Color must be a valid 6-digit hex color code (e.g. `#3B82F6`).
 */
export const createInboxSchema = z.object({
  /** Inbox display name (1–100 characters). */
  name: z.string().min(1).max(100),

  /** Email address to receive mail at. */
  email_address: z.string().email(),

  /** Whether the inbox is private or shared. */
  type: inboxTypeSchema,

  /** Optional hex color for UI display (e.g. "#3B82F6"). */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g. #3B82F6)')
    .optional(),
});

/**
 * Schema for updating an existing inbox.
 *
 * @remarks All fields are optional; only provided fields are updated.
 */
export const updateInboxSchema = z.object({
  /** Updated inbox display name (1–100 characters). */
  name: z.string().min(1).max(100).optional(),

  /** Updated hex color for UI display. */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g. #3B82F6)')
    .optional(),
});

/**
 * Schema for adding a member to a shared inbox.
 */
export const addInboxMemberSchema = z.object({
  /** The inbox to add the member to. */
  inbox_id: z.string().uuid(),

  /** The user to add. */
  user_id: z.string().uuid(),

  /** The role to assign to the new member. */
  role: inboxRoleSchema,
});

// ─────────────────────────────────────────────
// TEMPLATE OPERATION SCHEMAS
// ─────────────────────────────────────────────

/**
 * Schema for creating a reusable email template.
 *
 * @remarks
 * - `subject` is capped at 998 characters per RFC 2822.
 * - `body` supports up to 50,000 characters for rich templates.
 */
export const createTemplateSchema = z.object({
  /** Template display name (1–200 characters). */
  name: z.string().min(1).max(200),

  /** Pre-filled subject line (max 998 chars per RFC 2822). */
  subject: z.string().max(998).optional(),

  /** Template body content (1–50,000 characters). */
  body: z.string().min(1).max(50000),

  /** Visibility scope: private to the user or shared with the team. */
  scope: z.enum(['private', 'team']),
});

// ─────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────

/** Inferred type for the {@link createInboxSchema}. */
export type CreateInbox = z.infer<typeof createInboxSchema>;

/** Inferred type for the {@link updateInboxSchema}. */
export type UpdateInbox = z.infer<typeof updateInboxSchema>;

/** Inferred type for the {@link addInboxMemberSchema}. */
export type AddInboxMember = z.infer<typeof addInboxMemberSchema>;

/** Inferred type for the {@link createTemplateSchema}. */
export type CreateTemplate = z.infer<typeof createTemplateSchema>;
