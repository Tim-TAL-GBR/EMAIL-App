-- Migration: Add snippet to emails
ALTER TABLE emails ADD COLUMN snippet TEXT;

-- Update existing emails with a snippet
UPDATE emails 
SET snippet = substring(COALESCE(body_text, regexp_replace(body_html, '<[^>]*>', '', 'g')) from 1 for 200);

-- Trigger to auto-update snippet
CREATE OR REPLACE FUNCTION update_email_snippet()
RETURNS TRIGGER AS $$
BEGIN
    NEW.snippet = substring(COALESCE(NEW.body_text, regexp_replace(NEW.body_html, '<[^>]*>', '', 'g')) from 1 for 200);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_snippet
    BEFORE INSERT OR UPDATE OF body_text, body_html ON emails
    FOR EACH ROW EXECUTE FUNCTION update_email_snippet();
