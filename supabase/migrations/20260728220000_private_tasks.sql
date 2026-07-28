-- Allow private tasks (no team) by making team_id nullable
ALTER TABLE tasks ALTER COLUMN team_id DROP NOT NULL;

-- Update RLS policies to also allow private tasks (team_id IS NULL)
-- Private tasks: only visible to creator
DROP POLICY IF EXISTS "Users can view tasks in their teams" ON tasks;
CREATE POLICY "Users can view tasks in their teams" ON tasks
  FOR SELECT
  USING (
    -- Team tasks: user is team member
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = tasks.team_id
        AND team_members.user_id = auth.uid()
      )
    )
    OR
    -- Private tasks: only creator can see
    (
      team_id IS NULL
      AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert tasks in their teams" ON tasks;
CREATE POLICY "Users can insert tasks in their teams" ON tasks
  FOR INSERT
  WITH CHECK (
    -- Team tasks: user is team member
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = tasks.team_id
        AND team_members.user_id = auth.uid()
      )
    )
    OR
    -- Private tasks: user creates for themselves
    (
      team_id IS NULL
      AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update tasks in their teams" ON tasks;
CREATE POLICY "Users can update tasks in their teams" ON tasks
  FOR UPDATE
  USING (
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = tasks.team_id
        AND team_members.user_id = auth.uid()
      )
    )
    OR
    (
      team_id IS NULL
      AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete tasks in their teams" ON tasks;
CREATE POLICY "Users can delete tasks in their teams" ON tasks
  FOR DELETE
  USING (
    (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = tasks.team_id
        AND team_members.user_id = auth.uid()
      )
    )
    OR
    (
      team_id IS NULL
      AND created_by = auth.uid()
    )
  );
