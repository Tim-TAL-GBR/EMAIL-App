-- Migration: Add IMAP sync fields to emails table

-- 1. Add imap_uid (bigint since IMAP UID is a 32-bit unsigned integer, safely stored as bigint in Postgres)
ALTER TABLE emails ADD COLUMN IF NOT EXISTS imap_uid BIGINT;

-- 2. Add mailbox_name to track where the email resides (e.g. "INBOX", "Archive", "Trash")
ALTER TABLE emails ADD COLUMN IF NOT EXISTS mailbox_name TEXT DEFAULT 'INBOX';

-- 3. Add is_archived flag for UI filtering
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- 4. Add tags array for internal custom tags
ALTER TABLE emails ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for faster querying by imap_uid (useful during IMAP sync)
CREATE INDEX IF NOT EXISTS emails_imap_uid_idx ON emails (inbox_id, mailbox_name, imap_uid);
