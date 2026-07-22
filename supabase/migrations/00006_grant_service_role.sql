-- =============================================================================
-- TeamMail – Migration 00006: Service Role Grants
-- =============================================================================
-- Gewährt dem service_role alle nötigen DML-Rechte auf allen Tabellen.
-- Der service_role hat BYPASSRLS=true, braucht aber trotzdem explizite
-- GRANTs für SELECT/INSERT/UPDATE/DELETE auf der PostgreSQL-Ebene.
-- =============================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
