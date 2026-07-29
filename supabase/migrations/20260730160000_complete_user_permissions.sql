-- =============================================================================
-- Migration: Complete User Permission Management (RBAC & Super Admin)
-- =============================================================================

-- 1. Add is_super_admin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Helper to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM public.profiles WHERE id = (SELECT auth.uid())),
        FALSE
    );
$$;

-- 2. Create custom_roles table
CREATE TABLE IF NOT EXISTS public.custom_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

COMMENT ON TABLE custom_roles IS 'Benutzerdefinierte Rollen für Organisationen mit spezifischen Berechtigungen.';
COMMENT ON COLUMN custom_roles.permissions IS 'JSON-Objekt mit Flags wie {"can_manage_users": true, "can_delete_emails": false}';

CREATE TRIGGER set_custom_roles_updated_at
    BEFORE UPDATE ON public.custom_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3. Link team_members to custom_roles
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- 4. RLS for custom_roles
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- Select: Any member of the team can see the roles of their team
CREATE POLICY custom_roles_select ON public.custom_roles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = custom_roles.team_id
              AND user_id = (SELECT auth.uid())
        )
        OR public.is_super_admin()
    );

-- Insert/Update/Delete: Only team admins or super admins can manage custom roles
CREATE POLICY custom_roles_insert ON public.custom_roles
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_team_admin(team_id)
        OR public.is_super_admin()
    );

CREATE POLICY custom_roles_update ON public.custom_roles
    FOR UPDATE TO authenticated
    USING (
        public.is_team_admin(team_id)
        OR public.is_super_admin()
    )
    WITH CHECK (
        public.is_team_admin(team_id)
        OR public.is_super_admin()
    );

CREATE POLICY custom_roles_delete ON public.custom_roles
    FOR DELETE TO authenticated
    USING (
        public.is_team_admin(team_id)
        OR public.is_super_admin()
    );

-- 5. Expand teams RLS for super admins
-- Super admins should be able to select, insert, update, delete ANY team
DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
        )
        OR (parent_id IS NOT NULL AND public.is_org_member(parent_id))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS teams_update ON public.teams;
CREATE POLICY teams_update ON public.teams
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        )
        OR public.is_team_admin_hierarchy(teams.id)
        OR public.is_super_admin()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        )
        OR public.is_team_admin_hierarchy(teams.id)
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_delete ON public.teams
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
        OR public.is_super_admin()
    );

-- 6. Update user_has_email_access to allow super admins
CREATE OR REPLACE FUNCTION user_has_email_access(e_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN;
  u_id UUID;
BEGIN
  u_id := auth.uid();
  
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

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
