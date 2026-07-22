-- Migration: Add Signatures Table & Reference

-- 1. Create Signatures Table
CREATE TABLE signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scope template_scope NOT NULL DEFAULT 'private',
    name TEXT NOT NULL,
    content_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT chk_signature_scope_fields
        CHECK (
            (scope = 'private' AND owner_id IS NOT NULL)
            OR
            (scope = 'team' AND team_id IS NOT NULL)
        )
);

COMMENT ON TABLE signatures IS 'Wiederverwendbare E-Mail-Signaturen für Inboxes.';
COMMENT ON COLUMN signatures.scope IS 'private: Gehört einem User | team: Gehört einem Team.';

-- 2. Add signature_id to inboxes
ALTER TABLE inboxes ADD COLUMN signature_id UUID REFERENCES signatures(id) ON DELETE SET NULL;

-- 3. Indexes for fast lookup
CREATE INDEX idx_signatures_team ON signatures(team_id) WHERE scope = 'team';
CREATE INDEX idx_signatures_owner ON signatures(owner_id) WHERE scope = 'private';

-- 4. Enable RLS on signatures
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies für Signatures

-- SELECT: 
-- Private Signaturen: Sichtbar für Owner
-- Team Signaturen: Sichtbar für Teammitglieder
CREATE POLICY "Users can view their own private signatures"
ON signatures FOR SELECT
USING (
    (scope = 'private' AND owner_id = (SELECT auth.uid()))
    OR
    (scope = 'team' AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
    ))
);

-- INSERT:
-- Private: Nur für sich selbst
-- Team: Nur wenn man im Team ist
CREATE POLICY "Users can insert their own or team signatures"
ON signatures FOR INSERT
WITH CHECK (
    (scope = 'private' AND owner_id = (SELECT auth.uid()))
    OR
    (scope = 'team' AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
    ))
);

-- UPDATE:
CREATE POLICY "Users can update their own or team signatures"
ON signatures FOR UPDATE
USING (
    (scope = 'private' AND owner_id = (SELECT auth.uid()))
    OR
    (scope = 'team' AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
    ))
);

-- DELETE:
CREATE POLICY "Users can delete their own or team signatures"
ON signatures FOR DELETE
USING (
    (scope = 'private' AND owner_id = (SELECT auth.uid()))
    OR
    (scope = 'team' AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
    ))
);

-- 6. Updated At Trigger
CREATE TRIGGER trg_signatures_updated_at
    BEFORE UPDATE ON signatures
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Grant Privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON signatures TO authenticated;
GRANT SELECT ON signatures TO anon;

-- Realtime aktivieren für signatures
ALTER PUBLICATION supabase_realtime ADD TABLE signatures;
