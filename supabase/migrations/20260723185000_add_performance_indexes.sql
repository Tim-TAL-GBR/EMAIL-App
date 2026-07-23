-- Fix: Primary query sorts by last_activity_at, not received_at
CREATE INDEX IF NOT EXISTS idx_emails_inbox_archived_deleted_activity
ON emails (inbox_id, is_archived, is_deleted, last_activity_at DESC);

-- Index for assigned email queries
CREATE INDEX IF NOT EXISTS idx_email_assignments_assigned_email
ON email_assignments (assigned_to, email_id);

-- Index for label queries  
CREATE INDEX IF NOT EXISTS idx_email_labels_label_email
ON email_labels (label_id, email_id);

-- Index for pinned threads
CREATE INDEX IF NOT EXISTS idx_user_pinned_threads_user_created
ON user_pinned_threads (user_id, created_at DESC);

-- Index for comments ordering
CREATE INDEX IF NOT EXISTS idx_internal_comments_email_created
ON internal_comments (email_id, created_at ASC);
