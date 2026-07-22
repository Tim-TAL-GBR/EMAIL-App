-- =============================================================================
-- TeamMail – Migration 00005: Push Tokens & Mail Credentials
-- =============================================================================

-- 1. Push Tokens Tabelle für Expo Notifications
CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, token)
);

-- RLS für Push Tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
    ON public.push_tokens
    FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));


-- 2. Credentials in Inboxes Tabelle hinzufügen
-- HINWEIS: In einem echten Produktionssystem würden wir Supabase Vault
-- nutzen (pgsodium), um diese Passwörter verschlüsselt zu speichern.
-- Für diesen MVP speichern wir sie als Klartext, da Vault einen komplexen 
-- Setup-Prozess erfordert.

ALTER TABLE public.inboxes ADD COLUMN imap_host TEXT;
ALTER TABLE public.inboxes ADD COLUMN imap_port INTEGER DEFAULT 993;
ALTER TABLE public.inboxes ADD COLUMN imap_user TEXT;
ALTER TABLE public.inboxes ADD COLUMN imap_pass TEXT;

ALTER TABLE public.inboxes ADD COLUMN smtp_host TEXT;
ALTER TABLE public.inboxes ADD COLUMN smtp_port INTEGER DEFAULT 465;
ALTER TABLE public.inboxes ADD COLUMN smtp_user TEXT;
ALTER TABLE public.inboxes ADD COLUMN smtp_pass TEXT;

-- Realtime-Publication aktualisieren (obwohl Inboxes schon drin sind)
-- Push Tokens brauchen kein Realtime.

-- Setze Dummy-Credentials für die Test-Inboxes (aus seed.sql)
-- Support Inbox (Shared)
UPDATE public.inboxes 
SET imap_host = 'imap.example.com', 
    imap_user = 'support@acme.de',
    imap_pass = 'dummy123',
    smtp_host = 'smtp.example.com',
    smtp_user = 'support@acme.de',
    smtp_pass = 'dummy123'
WHERE name = 'Support';

-- Anna Private Inbox
UPDATE public.inboxes 
SET imap_host = 'imap.example.com', 
    imap_user = 'anna@acme.de',
    imap_pass = 'dummy123',
    smtp_host = 'smtp.example.com',
    smtp_user = 'anna@acme.de',
    smtp_pass = 'dummy123'
WHERE type = 'private';
