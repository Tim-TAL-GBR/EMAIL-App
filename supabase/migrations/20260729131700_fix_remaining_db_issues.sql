-- Fix SEC-11: Revoke overly permissive anon-Grants
-- Revoke specific grants from migrations 00014, 00015, 00016
REVOKE ALL PRIVILEGES ON signatures FROM anon;
REVOKE ALL PRIVILEGES ON rules FROM anon;
REVOKE ALL PRIVILEGES ON email_attachments FROM anon;

-- Revoke the broad grants from migration 00007
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon;


-- Fix DB-01: Fehlende ON DELETE CASCADE bei Drafts
-- Recreate the foreign key constraint on team_id with ON DELETE CASCADE
ALTER TABLE drafts 
    DROP CONSTRAINT IF EXISTS drafts_team_id_fkey,
    ADD CONSTRAINT drafts_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
