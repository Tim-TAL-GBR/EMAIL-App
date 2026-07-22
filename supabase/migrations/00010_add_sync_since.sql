-- =============================================================================
-- TeamMail – Migration 00010: Add sync_since to inboxes
-- =============================================================================

ALTER TABLE inboxes ADD COLUMN sync_since TIMESTAMPTZ;
