CREATE TABLE user_email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  signature_id UUID REFERENCES signatures(id) ON DELETE SET NULL,
  display_name TEXT,
  reply_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, inbox_id)
);

ALTER TABLE user_email_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view own email settings"
  ON user_email_settings FOR SELECT
  USING (user_id = auth.uid());

-- Team admins/owners can view all settings for their team's inboxes
CREATE POLICY "Team admins can view all email settings"
  ON user_email_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inboxes i
      JOIN team_members tm ON tm.team_id = i.team_id
      WHERE i.id = user_email_settings.inbox_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team admins/owners can insert settings for their team's inboxes
CREATE POLICY "Team admins can insert email settings"
  ON user_email_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inboxes i
      JOIN team_members tm ON tm.team_id = i.team_id
      WHERE i.id = inbox_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team admins/owners can update settings for their team's inboxes
CREATE POLICY "Team admins can update email settings"
  ON user_email_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM inboxes i
      JOIN team_members tm ON tm.team_id = i.team_id
      WHERE i.id = user_email_settings.inbox_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Team admins/owners can delete settings for their team's inboxes
CREATE POLICY "Team admins can delete email settings"
  ON user_email_settings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM inboxes i
      JOIN team_members tm ON tm.team_id = i.team_id
      WHERE i.id = user_email_settings.inbox_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Users can insert their own settings
CREATE POLICY "Users can insert own email settings"
  ON user_email_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own settings
CREATE POLICY "Users can update own email settings"
  ON user_email_settings FOR UPDATE
  USING (user_id = auth.uid());
