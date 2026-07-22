-- Migration: Add last_activity_at to emails

-- 1. Add column
ALTER TABLE emails ADD COLUMN last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Populate existing rows with their received_at time
UPDATE emails SET last_activity_at = received_at;

-- 3. Create index for sorting
CREATE INDEX idx_emails_last_activity_at ON emails(last_activity_at DESC);

-- 4. Create trigger function to update last_activity_at when a comment is added
CREATE OR REPLACE FUNCTION update_email_last_activity_on_comment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE emails 
    SET last_activity_at = NEW.created_at 
    WHERE id = NEW.email_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger to internal_comments
CREATE TRIGGER trg_internal_comments_update_email_activity
    AFTER INSERT ON internal_comments
    FOR EACH ROW EXECUTE FUNCTION update_email_last_activity_on_comment();
