-- =============================================================================
-- Migration: Add Organization ↔ Team hierarchy
-- =============================================================================
-- Organizations = teams with parent_id = NULL
-- Sub-teams = teams with parent_id = org.id
-- Org-level inboxes: visible to ALL org members (direct or via sub-team)
-- Team-level inboxes: visible to team members + org owner/admin
-- =============================================================================

-- 1. Add parent_id to teams (self-referencing FK)
ALTER TABLE teams ADD COLUMN parent_id UUID REFERENCES teams(id) ON DELETE CASCADE;
CREATE INDEX idx_teams_parent_id ON teams(parent_id);

COMMENT ON COLUMN teams.parent_id IS 'NULL = Organisation, non-NULL = Sub-Team innerhalb der Organisation.';

-- 2. Helper function: Is user a member of this org? (directly or via sub-team)
CREATE OR REPLACE FUNCTION public.is_org_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = (SELECT auth.uid())
          AND (
              -- Direct member of this org
              tm.team_id = p_team_id
              OR
              -- Member of a sub-team belonging to this org
              (t.parent_id = p_team_id)
          )
    );
$$;
REVOKE EXECUTE ON FUNCTION public.is_org_member FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_org_member TO authenticated;

-- 3. Helper function: Is user team admin? (directly or via parent org)
CREATE OR REPLACE FUNCTION public.is_team_admin_hierarchy(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.user_id = (SELECT auth.uid())
          AND (
              -- Direct admin/owner of this team
              (tm.team_id = p_team_id AND tm.role IN ('owner', 'admin'))
              OR
              -- Admin/owner of the parent org
              EXISTS (
                  SELECT 1 FROM public.teams t
                  WHERE t.id = p_team_id
                    AND t.parent_id IS NOT NULL
                    AND tm.team_id = t.parent_id
                    AND tm.role IN ('owner', 'admin')
              )
          )
    );
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_admin_hierarchy FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_team_admin_hierarchy TO authenticated;

-- 4. Replace is_team_admin to also check parent org
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT public.is_team_admin_hierarchy(p_team_id);
$$;

-- 5. Update teams_select: org members can see sub-teams
DROP POLICY IF EXISTS teams_select ON teams;
CREATE POLICY teams_select ON teams
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
        )
        OR
        -- Sub-teams visible to parent org members
        (parent_id IS NOT NULL AND public.is_org_member(parent_id))
    );

-- 6. Update teams_update: org owner/admin can update sub-teams
DROP POLICY IF EXISTS teams_update ON teams;
CREATE POLICY teams_update ON teams
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        )
        OR public.is_team_admin_hierarchy(teams.id)
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        )
        OR public.is_team_admin_hierarchy(teams.id)
    );

-- 7. Update teams_delete: org owner can delete sub-teams
DROP POLICY IF EXISTS teams_delete ON teams;
CREATE POLICY teams_delete ON teams
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role = 'owner'
        )
        OR (
            parent_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM team_members
                WHERE team_members.team_id = parent_id
                  AND team_members.user_id = (SELECT auth.uid())
                  AND team_members.role = 'owner'
            )
        )
    );

-- 8. Update inboxes_select: org members see org-level inboxes
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
            OR
            -- Org-level inbox: visible to all org members (direct or sub-team)
            public.is_org_member(inboxes.team_id)
        ))
    );

-- 9. Update emails_select: same hierarchy for emails
DROP POLICY IF EXISTS "emails_select" ON emails;
CREATE POLICY "emails_select" ON emails FOR SELECT TO authenticated USING (
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes JOIN team_members ON team_members.team_id = inboxes.team_id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND team_members.user_id = auth.uid() )
    OR
    -- Org-level inbox: all org members
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND public.is_org_member(inboxes.team_id) )
    OR
    is_user_assigned_to_email(emails.id, auth.uid())
    OR
    (emails.thread_id IS NOT NULL AND is_user_assigned_to_thread(emails.thread_id, auth.uid()))
);

-- 10. Update emails_insert
DROP POLICY IF EXISTS "emails_insert" ON emails;
CREATE POLICY "emails_insert" ON emails FOR INSERT TO authenticated WITH CHECK (
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes JOIN team_members ON team_members.team_id = inboxes.team_id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND team_members.user_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND public.is_org_member(inboxes.team_id) )
);

-- 11. Update emails_update
DROP POLICY IF EXISTS "emails_update" ON emails;
CREATE POLICY "emails_update" ON emails FOR UPDATE TO authenticated USING (
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes JOIN team_members ON team_members.team_id = inboxes.team_id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND team_members.user_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND public.is_org_member(inboxes.team_id) )
) WITH CHECK (
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes JOIN team_members ON team_members.team_id = inboxes.team_id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND team_members.user_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND public.is_org_member(inboxes.team_id) )
);

-- 12. Update user_has_email_access for comments/assignments
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
        OR public.is_org_member(inboxes.team_id)
      )
  ) INTO has_access;

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
