-- =============================================================================
-- Migration: Make shared inboxes visible to ALL team members automatically
-- =============================================================================

-- 1. Update inboxes_select to allow any team member
DROP POLICY IF EXISTS inboxes_select ON inboxes;
CREATE POLICY inboxes_select ON inboxes
    FOR SELECT TO authenticated
    USING (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND (
            EXISTS (
                SELECT 1 FROM inbox_members
                WHERE inbox_members.inbox_id = inboxes.id
                  AND inbox_members.user_id = (SELECT auth.uid())
            )
            OR
            EXISTS (
                SELECT 1 FROM team_members
                WHERE team_members.team_id = inboxes.team_id
                  AND team_members.user_id = (SELECT auth.uid())
            )
        ))
    );

-- 2. Update emails_select to allow any team member
DROP POLICY IF EXISTS "emails_select" ON emails;
CREATE POLICY "emails_select" ON emails FOR SELECT TO authenticated USING (
  EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
  OR 
  EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
  OR
  EXISTS ( SELECT 1 FROM inboxes JOIN team_members ON team_members.team_id = inboxes.team_id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND team_members.user_id = auth.uid() )
  OR
  is_user_assigned_to_email(emails.id, auth.uid())
  OR
  (emails.thread_id IS NOT NULL AND is_user_assigned_to_thread(emails.thread_id, auth.uid()))
);

-- 3. Update emails_insert to allow any team member
DROP POLICY IF EXISTS "emails_insert" ON emails;
CREATE POLICY "emails_insert" ON emails FOR INSERT TO authenticated WITH CHECK (
  EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
  OR 
  EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
  OR
  EXISTS ( SELECT 1 FROM inboxes JOIN team_members ON team_members.team_id = inboxes.team_id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND team_members.user_id = auth.uid() )
);

-- 4. Update emails_update to allow any team member
DROP POLICY IF EXISTS "emails_update" ON emails;
CREATE POLICY "emails_update" ON emails FOR UPDATE TO authenticated USING (
  EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
  OR 
  EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
  OR
  EXISTS ( SELECT 1 FROM inboxes JOIN team_members ON team_members.team_id = inboxes.team_id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND team_members.user_id = auth.uid() )
) WITH CHECK (
  EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
  OR 
  EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
  OR
  EXISTS ( SELECT 1 FROM inboxes JOIN team_members ON team_members.team_id = inboxes.team_id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND team_members.user_id = auth.uid() )
);

-- 5. Update user_has_email_access function for internal comments and assignments
CREATE OR REPLACE FUNCTION user_has_email_access(e_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN;
  u_id UUID;
BEGIN
  u_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM emails
    LEFT JOIN inboxes ON inboxes.id = emails.inbox_id
    LEFT JOIN inbox_members ON inbox_members.inbox_id = inboxes.id
    LEFT JOIN team_members ON team_members.team_id = inboxes.team_id
    LEFT JOIN email_assignments ea ON ea.email_id = emails.id
    WHERE emails.id = e_id
      AND (
        inboxes.owner_id = u_id
        OR inbox_members.user_id = u_id
        OR team_members.user_id = u_id
        OR ea.assigned_to = u_id
      )
  ) INTO has_access;

  -- Check thread assignments if not directly accessible
  IF NOT has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM emails e1
      JOIN emails e2 ON e1.thread_id = e2.thread_id
      JOIN email_assignments ea ON ea.email_id = e2.id
      WHERE e1.id = e_id AND ea.assigned_to = u_id
    ) INTO has_access;
  END IF;

  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
