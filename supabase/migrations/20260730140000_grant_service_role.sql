-- Grant missing privileges to service_role (used by getSupabaseAdmin)
-- These tables were created without proper grants; existing tables like `inboxes` have service_role=arwdDxtm
GRANT ALL PRIVILEGES ON TABLE user_preferences TO service_role;
GRANT ALL PRIVILEGES ON TABLE org_ai_settings TO service_role;
GRANT ALL PRIVILEGES ON TABLE org_ai_context TO service_role;
