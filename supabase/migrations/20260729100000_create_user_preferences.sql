CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Grant service_role full access (used by getSupabaseAdmin)
GRANT ALL PRIVILEGES ON TABLE user_preferences TO service_role;

COMMENT ON TABLE user_preferences IS 'Stores user-level app preferences as a JSONB blob';
COMMENT ON COLUMN user_preferences.preferences IS 'JSON object containing all user preferences keyed by category';

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY user_preferences_select_own ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY user_preferences_insert_own ON user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY user_preferences_update_own ON user_preferences
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own preferences
CREATE POLICY user_preferences_delete_own ON user_preferences
  FOR DELETE USING (user_id = auth.uid());
