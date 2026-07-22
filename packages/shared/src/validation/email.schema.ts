/**
 * @module email.schema
 *
 * Zod validation schemas for email-related operations.
 * Used by both the API layer (request validation) and the frontend (form validation).
 */

import { z } from 'zod';

// ─────────────────────────────────────────────
// ENUM SCHEMAS
// ─────────────────────────────────────────────

/** Schema for the {@link EmailStatus} enum. */
export const emailStatusSchema = z.enum(['open', 'in_progress', 'done']);

/** Schema for the {@link EmailDirection} enum. */
export const emailDirectionSchema = z.enum(['inbound', 'outbound']);

// ─────────────────────────────────────────────
// OPERATION SCHEMAS
// ─────────────────────────────────────────────

/**
 * Schema for composing and sending a new email.
 *
 * @remarks
 * - `subject` is capped at 998 characters per RFC 2822 line-length limits.
 * - At least one `to_addresses` entry is required.
 * - Either `body_text` or `body_html` (or both) should be provided.
 */
export const createEmailSchema = z.object({
  /** The inbox to send from. */
  inbox_id: z.string().uuid(),

  /** Email subject line (max 998 chars per RFC 2822). */
  subject: z.string().max(998).optional(),

  /** Primary recipient email addresses (at least one required). */
  to_addresses: z.array(z.string().email()).min(1),

  /** CC recipient email addresses. */
  cc_addresses: z.array(z.string().email()).optional(),

  /** BCC recipient email addresses. */
  bcc_addresses: z.array(z.string().email()).optional(),

  /** Plain-text email body. */
  body_text: z.string().optional(),

  /** HTML email body. */
  body_html: z.string().optional(),
});

/**
 * Schema for updating the lifecycle status of an email.
 */
export const updateEmailStatusSchema = z.object({
  /** The email to update. */
  email_id: z.string().uuid(),

  /** The new status to set. */
  status: emailStatusSchema,
});

/**
 * Schema for assigning an email to a team member.
 */
export const assignEmailSchema = z.object({
  /** The email to assign. */
  email_id: z.string().uuid(),

  /** The user ID to assign the email to. */
  assigned_to: z.string().uuid(),
});

/**
 * Schema for creating an internal comment on an email.
 *
 * @remarks Body is limited to 10,000 characters.
 */
export const createCommentSchema = z.object({
  /** The email to comment on. */
  email_id: z.string().uuid(),

  /** Comment body text (1–10,000 characters). */
  body: z.string().min(1).max(10000),
});

// ─────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────

/** Inferred type for the {@link createEmailSchema}. */
export type CreateEmail = z.infer<typeof createEmailSchema>;

/** Inferred type for the {@link updateEmailStatusSchema}. */
export type UpdateEmailStatus = z.infer<typeof updateEmailStatusSchema>;

/** Inferred type for the {@link assignEmailSchema}. */
export type AssignEmail = z.infer<typeof assignEmailSchema>;

/** Inferred type for the {@link createCommentSchema}. */
export type CreateComment = z.infer<typeof createCommentSchema>;
