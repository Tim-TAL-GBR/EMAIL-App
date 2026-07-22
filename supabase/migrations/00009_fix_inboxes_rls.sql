-- =============================================================================
-- TeamMail – Migration 00009: Fix inboxes RLS
-- =============================================================================

DROP POLICY IF EXISTS inboxes_select ON inboxes;
DROP POLICY IF EXISTS inboxes_insert ON inboxes;
DROP POLICY IF EXISTS inboxes_update ON inboxes;
DROP POLICY IF EXISTS inboxes_delete ON inboxes;

-- SELECT: Private → nur owner. Shared → inbox_members ODER Team-Admins
CREATE POLICY inboxes_select ON inboxes
    FOR SELECT TO authenticated
    USING (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND (
            -- User ist Mitglied der Inbox
            EXISTS (
                SELECT 1 FROM inbox_members
                WHERE inbox_members.inbox_id = inboxes.id
                  AND inbox_members.user_id = (SELECT auth.uid())
            )
            OR
            -- Oder User ist Team-Admin/Owner
            public.get_user_team_role(team_id) IN ('owner', 'admin')
        ))
    );

-- INSERT: Private → nur für sich selbst erstellen. Shared → nur Team-Admin.
CREATE POLICY inboxes_insert ON inboxes
    FOR INSERT TO authenticated
    WITH CHECK (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND public.get_user_team_role(team_id) IN ('owner', 'admin'))
    );

-- UPDATE: Private → nur Owner. Shared → nur Inbox-Admin oder Team-Admin.
CREATE POLICY inboxes_update ON inboxes
    FOR UPDATE TO authenticated
    USING (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND (
            public.has_inbox_access(id, 'admin')
            OR
            public.get_user_team_role(team_id) IN ('owner', 'admin')
        ))
    )
    WITH CHECK (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND (
            public.has_inbox_access(id, 'admin')
            OR
            public.get_user_team_role(team_id) IN ('owner', 'admin')
        ))
    );

-- DELETE: Private → nur Owner. Shared → nur Inbox-Admin oder Team-Admin.
CREATE POLICY inboxes_delete ON inboxes
    FOR DELETE TO authenticated
    USING (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND (
            public.has_inbox_access(id, 'admin')
            OR
            public.get_user_team_role(team_id) IN ('owner', 'admin')
        ))
    );
