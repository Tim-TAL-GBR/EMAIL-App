CREATE TABLE IF NOT EXISTS org_ai_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  openai_api_key TEXT,
  openai_model   TEXT DEFAULT 'gpt-4o-mini',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_ai_settings_org_id ON org_ai_settings(org_id);

-- Grant service_role full access (used by getSupabaseAdmin)
GRANT ALL PRIVILEGES ON TABLE org_ai_settings TO service_role;
GRANT ALL PRIVILEGES ON TABLE org_ai_context TO service_role;

COMMENT ON TABLE org_ai_settings IS 'Organization-level OpenAI settings';
COMMENT ON COLUMN org_ai_settings.openai_api_key IS 'Encrypted or plaintext OpenAI API key for the org';

CREATE TABLE IF NOT EXISTS org_ai_context (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  topic      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_org_ai_context_org_id ON org_ai_context(org_id);

COMMENT ON TABLE org_ai_context IS 'Organization-level context entries for AI reply suggestions';
COMMENT ON COLUMN org_ai_context.topic IS 'Topic label (e.g. Produkte, Versand, Preise)';
COMMENT ON COLUMN org_ai_context.content IS 'Plain text context that the AI should consider';

ALTER TABLE org_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_ai_context ENABLE ROW LEVEL SECURITY;

-- Org AI settings: admins/owners can write, all org members can read
CREATE POLICY org_ai_settings_select_member ON org_ai_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = org_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY org_ai_settings_insert_admin ON org_ai_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_ai_settings_update_admin ON org_ai_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_ai_settings_delete_admin ON org_ai_settings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Org AI context: all org members can read, admins can write
CREATE POLICY org_ai_context_select_member ON org_ai_context
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = org_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY org_ai_context_insert_admin ON org_ai_context
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_ai_context_update_admin ON org_ai_context
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_ai_context_delete_admin ON org_ai_context
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

ALTER TABLE org_ai_settings REPLICA IDENTITY FULL;
ALTER TABLE org_ai_context REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE org_ai_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE org_ai_context;
