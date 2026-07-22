-- Add indexes to improve fetchEmails query performance
CREATE INDEX IF NOT EXISTS idx_emails_inbox_id ON emails (inbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails (status);
CREATE INDEX IF NOT EXISTS idx_emails_is_archived ON emails (is_archived);
CREATE INDEX IF NOT EXISTS idx_emails_is_deleted ON emails (is_deleted);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails (received_at DESC);

-- Composite index for the main query used by the mobile app:
-- .in('inbox_id', [...]).eq('is_archived', false).eq('is_deleted', false).order('received_at', { ascending: false })
CREATE INDEX IF NOT EXISTS idx_emails_inbox_archived_deleted_received
ON emails (inbox_id, is_archived, is_deleted, received_at DESC);
