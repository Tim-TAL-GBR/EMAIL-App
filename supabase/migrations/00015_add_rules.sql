-- Migration: Add Rules Table

CREATE TYPE rule_trigger_type AS ENUM ('incoming', 'outgoing', 'user_action');
CREATE TYPE rule_match_type AS ENUM ('all', 'any');

CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scope template_scope NOT NULL DEFAULT 'private',
    
    name TEXT NOT NULL,
    description TEXT,
    trigger_type rule_trigger_type NOT NULL,
    conditions_match_type rule_match_type NOT NULL DEFAULT 'all',
    
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT chk_rule_scope_fields
        CHECK (
            (scope = 'private' AND owner_id IS NOT NULL)
            OR
            (scope = 'team' AND team_id IS NOT NULL)
        )
);

COMMENT ON TABLE rules IS 'Automatisierungsregeln (Wenn-Dann) für Inboxes und Emails.';
COMMENT ON COLUMN rules.conditions IS 'Array von Bedingungen: [{ field: "from", operator: "is", value: "foo" }]';
COMMENT ON COLUMN rules.actions IS 'Array von Aktionen: [{ type: "add_label", value: "label_id" }]';

-- Indexes
CREATE INDEX idx_rules_team ON rules(team_id) WHERE scope = 'team';
CREATE INDEX idx_rules_owner ON rules(owner_id) WHERE scope = 'private';

-- Enable RLS
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: 
-- Private Rules: Sichtbar für Owner
-- Team Rules: Sichtbar für Teammitglieder
CREATE POLICY "Users can view their own private rules"
ON rules FOR SELECT
USING (
    (scope = 'private' AND owner_id = (SELECT auth.uid()))
    OR
    (scope = 'team' AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
    ))
);

-- INSERT:
CREATE POLICY "Users can insert their own or team rules"
ON rules FOR INSERT
WITH CHECK (
    (scope = 'private' AND owner_id = (SELECT auth.uid()))
    OR
    (scope = 'team' AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
    ))
);

-- UPDATE:
CREATE POLICY "Users can update their own or team rules"
ON rules FOR UPDATE
USING (
    (scope = 'private' AND owner_id = (SELECT auth.uid()))
    OR
    (scope = 'team' AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
    ))
);

-- DELETE:
CREATE POLICY "Users can delete their own or team rules"
ON rules FOR DELETE
USING (
    (scope = 'private' AND owner_id = (SELECT auth.uid()))
    OR
    (scope = 'team' AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
    ))
);

-- Updated At Trigger
CREATE TRIGGER trg_rules_updated_at
    BEFORE UPDATE ON rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Grant Privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON rules TO authenticated;
GRANT SELECT ON rules TO anon;

-- Realtime aktivieren für rules
ALTER PUBLICATION supabase_realtime ADD TABLE rules;
