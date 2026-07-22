/**
 * @teammail/shared
 *
 * Shared TypeScript types and Zod validation schemas for the TeamMail platform.
 * This package is consumed by both the frontend and backend workspaces.
 *
 * @packageDocumentation
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Database row types and enum literals mirroring the PostgreSQL schema. */
export * from './types/database.js';

/** Composite inbox types with computed fields and profile data. */
export * from './types/inbox.js';

/** Composite email types with assignments, comments, and thread grouping. */
export * from './types/email.js';

/** Composite team types with member profiles. */
export * from './types/team.js';

/** WebSocket message types and channel utilities for real-time subscriptions. */
export * from './types/realtime.js';

// ─────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────

/** Zod schemas for email operations (create, status update, assign, comment). */
export * from './validation/email.schema.js';

/** Zod schemas for inbox operations (create, update, add member, templates). */
export * from './validation/inbox.schema.js';
