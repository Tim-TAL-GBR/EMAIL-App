CREATE TABLE IF NOT EXISTS ai_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_context_user_id ON ai_context(user_id);

COMMENT ON TABLE ai_context IS 'User-defined context entries for AI reply suggestions';
COMMENT ON COLUMN ai_context.topic IS 'Topic label (e.g. Produkte, Versand, Preise)';
COMMENT ON COLUMN ai_context.content IS 'Plain text context that the AI should consider';

ALTER TABLE ai_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_context_select_own ON ai_context
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY ai_context_insert_own ON ai_context
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY ai_context_update_own ON ai_context
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY ai_context_delete_own ON ai_context
  FOR DELETE USING (user_id = auth.uid());

ALTER TABLE ai_context REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_context;
