-- =============================================================================
-- TeamMail – Migration 00008: Fix inbox_members recursion
-- =============================================================================

DROP POLICY IF EXISTS inbox_members_select ON inbox_members;
DROP POLICY IF EXISTS inbox_members_insert ON inbox_members;
DROP POLICY IF EXISTS inbox_members_update ON inbox_members;
DROP POLICY IF EXISTS inbox_members_delete ON inbox_members;

-- SELECT: Nur wenn der User selbst mindestens 'observer' in der Inbox ist
CREATE POLICY inbox_members_select ON inbox_members
    FOR SELECT TO authenticated
    USING (
        public.has_inbox_access(inbox_id, 'observer')
    );

-- INSERT: Nur Inbox-Admin oder Team-Admin/Owner
CREATE POLICY inbox_members_insert ON inbox_members
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Inbox-Admin
        public.has_inbox_access(inbox_id, 'admin')
        OR
        -- Team-Admin/Owner
        (
            SELECT public.get_user_team_role(team_id) IN ('owner', 'admin')
            FROM inboxes
            WHERE inboxes.id = inbox_members.inbox_id
        )
    );

-- UPDATE: Nur Inbox-Admin kann Rollen ändern
CREATE POLICY inbox_members_update ON inbox_members
    FOR UPDATE TO authenticated
    USING (
        public.has_inbox_access(inbox_id, 'admin')
    )
    WITH CHECK (
        public.has_inbox_access(inbox_id, 'admin')
    );

-- DELETE: Inbox-Admin oder User entfernt sich selbst
CREATE POLICY inbox_members_delete ON inbox_members
    FOR DELETE TO authenticated
    USING (
        -- User entfernt sich selbst
        user_id = (SELECT auth.uid())
        OR
        -- Inbox-Admin entfernt jemand anderen
        public.has_inbox_access(inbox_id, 'admin')
    );
