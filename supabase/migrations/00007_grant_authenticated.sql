-- =============================================================================
-- TeamMail – Migration 00007: Grant Public Privileges
-- =============================================================================
-- We need to ensure that the authenticated and anon roles have the correct
-- table privileges so that Row Level Security (RLS) can actually evaluate 
-- the policies. Without these grants, Postgres throws 42501 (Permission Denied).
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;

-- Ensure future tables also get these privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, anon;
