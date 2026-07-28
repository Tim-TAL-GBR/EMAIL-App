-- ============================================================
-- Task Comments + Notification Flag
-- ============================================================

-- Add notification_sent flag to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

-- Task comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- RLS
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Select: team members can read comments on tasks in their teams
CREATE POLICY "Team members can read task comments" ON task_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN team_members ON team_members.team_id = tasks.team_id
      WHERE tasks.id = task_comments.task_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Insert: team members can comment on tasks in their teams
CREATE POLICY "Team members can insert task comments" ON task_comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN team_members ON team_members.team_id = tasks.team_id
      WHERE tasks.id = task_comments.task_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Update: only own comments
CREATE POLICY "Users can update own task comments" ON task_comments
  FOR UPDATE
  USING (user_id = auth.uid());

-- Delete: own comments or team admins
CREATE POLICY "Users can delete own task comments" ON task_comments
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks
      JOIN team_members ON team_members.team_id = tasks.team_id
      WHERE tasks.id = task_comments.task_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );
