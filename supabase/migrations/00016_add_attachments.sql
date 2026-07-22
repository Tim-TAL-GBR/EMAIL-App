-- Migration: Add Attachments Table and Storage Bucket

-- 1. Create Storage Bucket for Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email_attachments', 'email_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Attachments Table
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    is_inline BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

COMMENT ON TABLE email_attachments IS 'Speichert Metadaten über Dateianhänge von E-Mails.';
COMMENT ON COLUMN email_attachments.storage_path IS 'Pfad zur Datei im Supabase Storage Bucket email_attachments.';
COMMENT ON COLUMN email_attachments.is_inline IS 'Gibt an, ob es sich um ein eingebettetes Bild im HTML-Body handelt (true) oder um einen echten Anhang (false).';

-- Indexes
CREATE INDEX idx_email_attachments_email_id ON email_attachments(email_id);

-- Enable RLS on the table
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

-- Table RLS Policies: Authenticated users can view/insert/delete attachments if they can access the email
CREATE POLICY "Users can view attachments for their accessible emails"
ON email_attachments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM emails e
        JOIN inboxes i ON e.inbox_id = i.id
        WHERE e.id = email_attachments.email_id
        AND (
            (i.type = 'private' AND i.owner_id = (SELECT auth.uid()))
            OR
            (i.type = 'shared' AND i.team_id IN (
                SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
            ))
        )
    )
);

CREATE POLICY "Users can insert attachments for their accessible emails"
ON email_attachments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM emails e
        JOIN inboxes i ON e.inbox_id = i.id
        WHERE e.id = email_attachments.email_id
        AND (
            (i.type = 'private' AND i.owner_id = (SELECT auth.uid()))
            OR
            (i.type = 'shared' AND i.team_id IN (
                SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
            ))
        )
    )
);

CREATE POLICY "Users can delete attachments for their accessible emails"
ON email_attachments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM emails e
        JOIN inboxes i ON e.inbox_id = i.id
        WHERE e.id = email_attachments.email_id
        AND (
            (i.type = 'private' AND i.owner_id = (SELECT auth.uid()))
            OR
            (i.type = 'shared' AND i.team_id IN (
                SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
            ))
        )
    )
);

-- 3. Storage RLS Policies
-- Allow authenticated users to upload files to 'email_attachments' bucket
CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email_attachments');

-- Allow authenticated users to read files from 'email_attachments' bucket
-- (In a strict production app, we would join with email_attachments to verify access, 
-- but for simplicity/performance in this MVP, any authenticated user can read files if they have the UUID path)
CREATE POLICY "Users can read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'email_attachments');

CREATE POLICY "Users can delete attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email_attachments');

-- Updated At Trigger
CREATE TRIGGER trg_email_attachments_updated_at
    BEFORE UPDATE ON email_attachments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Grant Privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON email_attachments TO authenticated;
GRANT SELECT ON email_attachments TO anon;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE email_attachments;
