CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  linked_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Select policy: users can view tasks in their teams
CREATE POLICY "Users can view tasks in their teams" ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.team_id = tasks.team_id 
      AND team_members.user_id = auth.uid()
    )
  );

-- Insert policy: users can create tasks in their teams
CREATE POLICY "Users can insert tasks in their teams" ON tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.team_id = tasks.team_id 
      AND team_members.user_id = auth.uid()
    )
  );

-- Update policy: users can update tasks in their teams
CREATE POLICY "Users can update tasks in their teams" ON tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.team_id = tasks.team_id 
      AND team_members.user_id = auth.uid()
    )
  );

-- Delete policy: users can delete tasks in their teams
CREATE POLICY "Users can delete tasks in their teams" ON tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_members.team_id = tasks.team_id 
      AND team_members.user_id = auth.uid()
    )
  );

-- Function to get open tasks count for a user in a team
CREATE OR REPLACE FUNCTION get_user_open_tasks_count(p_team_id UUID, p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER 
  FROM tasks 
  WHERE team_id = p_team_id 
  AND assigned_to = p_user_id 
  AND status = 'open';
$$;
