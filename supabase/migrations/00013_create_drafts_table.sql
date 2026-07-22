-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ drafts – E-Mail-Entwürfe                                                 │
-- │                                                                          │
-- │ Speichert angefangene E-Mails, bevor sie gesendet werden.               │
-- │ Jeder im Team (bzw. jeder mit Inbox-Zugriff) kann Entwürfe sehen und     │
-- │ weiterbearbeiten, da TeamMail auf Kollaboration ausgelegt ist.           │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE drafts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id      UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    team_id       UUID NOT NULL REFERENCES teams(id),
    
    -- Optionale Referenzen, falls der Entwurf eine Antwort oder Weiterleitung ist
    thread_id     TEXT,
    in_reply_to   TEXT,
    
    -- E-Mail Felder (alle nullable, da es sich um einen Entwurf handelt)
    to_addresses  TEXT[],
    cc_addresses  TEXT[],
    bcc_addresses TEXT[],
    subject       TEXT,
    body_text     TEXT,
    body_html     TEXT,
    
    -- Metadaten
    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE drafts IS 'Gespeicherte E-Mail-Entwürfe. Für Inbox-Mitglieder sichtbar und bearbeitbar.';

-- Trigger für updated_at
CREATE TRIGGER set_drafts_updated_at
    BEFORE UPDATE ON drafts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ Row Level Security (RLS) für drafts                                      │
-- │ Ähnlich wie bei emails: Zugriff basiert auf Inbox/Team-Zugehörigkeit.    │
-- └──────────────────────────────────────────────────────────────────────────┘

ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Man darf Entwürfe sehen, wenn man Zugriff auf die Inbox hat
CREATE POLICY "Users can view drafts in their inboxes"
    ON drafts FOR SELECT
    USING (
        inbox_id IN (
            SELECT inbox_id FROM inbox_members WHERE user_id = auth.uid()
        )
        OR
        inbox_id IN (
            SELECT id FROM inboxes WHERE owner_id = auth.uid() AND type = 'private'
        )
    );

-- 2. INSERT: Man darf Entwürfe anlegen, wenn man in der Inbox ist
CREATE POLICY "Users can create drafts in their inboxes"
    ON drafts FOR INSERT
    WITH CHECK (
        inbox_id IN (
            SELECT inbox_id FROM inbox_members WHERE user_id = auth.uid()
        )
        OR
        inbox_id IN (
            SELECT id FROM inboxes WHERE owner_id = auth.uid() AND type = 'private'
        )
    );

-- 3. UPDATE: Man darf Entwürfe aktualisieren, wenn man Zugriff auf die Inbox hat
CREATE POLICY "Users can update drafts in their inboxes"
    ON drafts FOR UPDATE
    USING (
        inbox_id IN (
            SELECT inbox_id FROM inbox_members WHERE user_id = auth.uid()
        )
        OR
        inbox_id IN (
            SELECT id FROM inboxes WHERE owner_id = auth.uid() AND type = 'private'
        )
    )
    WITH CHECK (
        inbox_id IN (
            SELECT inbox_id FROM inbox_members WHERE user_id = auth.uid()
        )
        OR
        inbox_id IN (
            SELECT id FROM inboxes WHERE owner_id = auth.uid() AND type = 'private'
        )
    );

-- 4. DELETE: Man darf Entwürfe löschen, wenn man Zugriff auf die Inbox hat
CREATE POLICY "Users can delete drafts in their inboxes"
    ON drafts FOR DELETE
    USING (
        inbox_id IN (
            SELECT inbox_id FROM inbox_members WHERE user_id = auth.uid()
        )
        OR
        inbox_id IN (
            SELECT id FROM inboxes WHERE owner_id = auth.uid() AND type = 'private'
        )
    );

-- Echtzeit-Abonnements aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE drafts;
