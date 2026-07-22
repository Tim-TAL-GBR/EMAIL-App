-- =============================================================================
-- TeamMail – Migration 00002: Row Level Security Policies
-- =============================================================================
-- Aktiviert RLS auf ALLEN Tabellen und definiert granulare Zugriffspolicies.
--
-- WICHTIG: Überall wird `(SELECT auth.uid())` statt `auth.uid()` verwendet!
-- Der Subquery-Wrapper sorgt dafür, dass PostgreSQL den Wert einmalig evaluiert
-- und als Konstante in den Query-Plan einsetzt (statt pro Zeile auszuwerten).
-- Das ist ein kritischer Performance-Unterschied bei großen Tabellen.
--
-- Alle Policies nutzen `TO authenticated` – anon-User haben keinen Zugriff.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RLS auf allen Tabellen aktivieren
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inboxes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails            ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates         ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles – Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Alle authentifizierten User können Profile sehen (für @mentions, Avatare etc.)
CREATE POLICY profiles_select ON profiles
    FOR SELECT TO authenticated
    USING (true);

-- Profile werden nur via handle_new_user() Trigger erstellt (service_role).
-- Kein direktes INSERT durch User erlaubt.
-- (Kein INSERT Policy = implizites Deny)

-- Nur das eigene Profil bearbeiten
CREATE POLICY profiles_update ON profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- Nur das eigene Profil löschen (Account-Löschung)
CREATE POLICY profiles_delete ON profiles
    FOR DELETE TO authenticated
    USING (id = (SELECT auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. teams – Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Nur Teams sehen, in denen der User Mitglied ist
CREATE POLICY teams_select ON teams
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
        )
    );

-- Jeder authentifizierte User kann ein Team erstellen
CREATE POLICY teams_insert ON teams
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Nur Team-Owner oder -Admin können Team-Daten ändern
CREATE POLICY teams_update ON teams
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        )
    );

-- Nur Team-Owner kann das Team löschen
CREATE POLICY teams_delete ON teams
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = teams.id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role = 'owner'
        )
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. team_members – Policies
-- ─────────────────────────────────────────────────────────────────────────────
-- WICHTIG: team_members-Policies dürfen NICHT rekursiv auf team_members
-- verweisen (→ "infinite recursion detected in policy").
-- Lösung:
--   SELECT: nur eigene Zeile prüfen (user_id = auth.uid()) – kein Self-Join
--   INSERT/UPDATE/DELETE: SECURITY DEFINER Funktion is_team_admin() als Brücke

-- Jeder User sieht nur seine eigene Mitgliedschaft
CREATE POLICY team_members_select ON team_members
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Hilfsfunktion: prüft ob der aktuelle User Admin/Owner eines Teams ist.
-- SECURITY DEFINER umgeht RLS für die interne team_members-Abfrage.
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = p_team_id
          AND user_id = (SELECT auth.uid())
          AND role IN ('owner', 'admin')
    );
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_admin FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_team_admin TO authenticated;

-- Team-Owner/Admin können Mitglieder hinzufügen
CREATE POLICY team_members_insert ON team_members
    FOR INSERT TO authenticated
    WITH CHECK (public.is_team_admin(team_id));

-- Team-Owner/Admin können Rollen ändern
CREATE POLICY team_members_update ON team_members
    FOR UPDATE TO authenticated
    USING  (public.is_team_admin(team_id))
    WITH CHECK (public.is_team_admin(team_id));

-- User entfernt sich selbst ODER Team-Admin entfernt jemand anderen
CREATE POLICY team_members_delete ON team_members
    FOR DELETE TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR public.is_team_admin(team_id)
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. inboxes – Policies
-- ─────────────────────────────────────────────────────────────────────────────
-- WICHTIG: Shared Inboxes nutzen inbox_members, NICHT team_members!
-- Ein Teammitglied hat nur Zugriff wenn es explizit als inbox_member eingetragen ist.

-- SELECT: Private → nur owner. Shared → nur wenn inbox_member.
CREATE POLICY inboxes_select ON inboxes
    FOR SELECT TO authenticated
    USING (
        -- Private Inbox: Nur der Owner sieht sie
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        -- Shared Inbox: Nur explizite inbox_members
        (type = 'shared' AND EXISTS (
            SELECT 1 FROM inbox_members
            WHERE inbox_members.inbox_id = inboxes.id
              AND inbox_members.user_id = (SELECT auth.uid())
        ))
    );

-- INSERT: Private → nur für sich selbst erstellen. Shared → nur Team-Admin.
CREATE POLICY inboxes_insert ON inboxes
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Private Inbox: owner_id muss der aktuelle User sein
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        -- Shared Inbox: User muss Team-Admin oder -Owner sein
        (type = 'shared' AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = inboxes.team_id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        ))
    );

-- UPDATE: Private → nur Owner. Shared → nur Inbox-Admin.
CREATE POLICY inboxes_update ON inboxes
    FOR UPDATE TO authenticated
    USING (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND EXISTS (
            SELECT 1 FROM inbox_members
            WHERE inbox_members.inbox_id = inboxes.id
              AND inbox_members.user_id = (SELECT auth.uid())
              AND inbox_members.role = 'admin'
        ))
    )
    WITH CHECK (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND EXISTS (
            SELECT 1 FROM inbox_members
            WHERE inbox_members.inbox_id = inboxes.id
              AND inbox_members.user_id = (SELECT auth.uid())
              AND inbox_members.role = 'admin'
        ))
    );

-- DELETE: Private → nur Owner. Shared → nur Inbox-Admin.
CREATE POLICY inboxes_delete ON inboxes
    FOR DELETE TO authenticated
    USING (
        (type = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (type = 'shared' AND EXISTS (
            SELECT 1 FROM inbox_members
            WHERE inbox_members.inbox_id = inboxes.id
              AND inbox_members.user_id = (SELECT auth.uid())
              AND inbox_members.role = 'admin'
        ))
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. inbox_members – Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Nur wenn der User selbst Mitglied der Inbox ist
CREATE POLICY inbox_members_select ON inbox_members
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM inbox_members AS im
            WHERE im.inbox_id = inbox_members.inbox_id
              AND im.user_id = (SELECT auth.uid())
        )
    );

-- INSERT: Nur Inbox-Admin oder Team-Admin/Owner können Mitglieder hinzufügen
CREATE POLICY inbox_members_insert ON inbox_members
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Inbox-Admin
        EXISTS (
            SELECT 1 FROM inbox_members AS im
            WHERE im.inbox_id = inbox_members.inbox_id
              AND im.user_id = (SELECT auth.uid())
              AND im.role = 'admin'
        )
        OR
        -- Team-Admin/Owner (braucht team_id über inboxes)
        EXISTS (
            SELECT 1 FROM inboxes
            JOIN team_members ON team_members.team_id = inboxes.team_id
            WHERE inboxes.id = inbox_members.inbox_id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        )
    );

-- UPDATE: Nur Inbox-Admin kann Rollen ändern
CREATE POLICY inbox_members_update ON inbox_members
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM inbox_members AS im
            WHERE im.inbox_id = inbox_members.inbox_id
              AND im.user_id = (SELECT auth.uid())
              AND im.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM inbox_members AS im
            WHERE im.inbox_id = inbox_members.inbox_id
              AND im.user_id = (SELECT auth.uid())
              AND im.role = 'admin'
        )
    );

-- DELETE: Inbox-Admin oder User entfernt sich selbst
CREATE POLICY inbox_members_delete ON inbox_members
    FOR DELETE TO authenticated
    USING (
        -- User entfernt sich selbst
        inbox_members.user_id = (SELECT auth.uid())
        OR
        -- Inbox-Admin entfernt jemand anderen
        EXISTS (
            SELECT 1 FROM inbox_members AS im
            WHERE im.inbox_id = inbox_members.inbox_id
              AND im.user_id = (SELECT auth.uid())
              AND im.role = 'admin'
        )
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. emails – Policies
-- ─────────────────────────────────────────────────────────────────────────────
-- E-Mails werden NICHT physisch gelöscht (nur Soft-Delete über UPDATE).
-- Daher gibt es keine DELETE Policy.

-- SELECT: Nur nicht-gelöschte E-Mails, und nur wenn User Inbox-Zugriff hat.
CREATE POLICY emails_select ON emails
    FOR SELECT TO authenticated
    USING (
        is_deleted = false
        AND (
            -- Private Inbox: User ist Owner
            EXISTS (
                SELECT 1 FROM inboxes
                WHERE inboxes.id = emails.inbox_id
                  AND inboxes.type = 'private'
                  AND inboxes.owner_id = (SELECT auth.uid())
            )
            OR
            -- Shared Inbox: User ist inbox_member (jede Rolle reicht für Lesen)
            EXISTS (
                SELECT 1 FROM inboxes
                JOIN inbox_members ON inbox_members.inbox_id = inboxes.id
                WHERE inboxes.id = emails.inbox_id
                  AND inboxes.type = 'shared'
                  AND inbox_members.user_id = (SELECT auth.uid())
            )
        )
    );

-- INSERT: Private → Owner. Shared → inbox_member mit admin oder member Rolle.
CREATE POLICY emails_insert ON emails
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Private Inbox: User ist Owner
        EXISTS (
            SELECT 1 FROM inboxes
            WHERE inboxes.id = emails.inbox_id
              AND inboxes.type = 'private'
              AND inboxes.owner_id = (SELECT auth.uid())
        )
        OR
        -- Shared Inbox: User ist inbox_member mit Schreibrechten
        EXISTS (
            SELECT 1 FROM inboxes
            JOIN inbox_members ON inbox_members.inbox_id = inboxes.id
            WHERE inboxes.id = emails.inbox_id
              AND inboxes.type = 'shared'
              AND inbox_members.user_id = (SELECT auth.uid())
              AND inbox_members.role IN ('admin', 'member')
        )
    );

-- UPDATE: Gleiche Logik wie INSERT (Statusänderung, Stern setzen etc.)
-- Hinweis: Soft-Delete (is_deleted = true setzen) erfolgt über UPDATE.
CREATE POLICY emails_update ON emails
    FOR UPDATE TO authenticated
    USING (
        -- Private Inbox: User ist Owner
        EXISTS (
            SELECT 1 FROM inboxes
            WHERE inboxes.id = emails.inbox_id
              AND inboxes.type = 'private'
              AND inboxes.owner_id = (SELECT auth.uid())
        )
        OR
        -- Shared Inbox: User ist inbox_member mit Schreibrechten
        EXISTS (
            SELECT 1 FROM inboxes
            JOIN inbox_members ON inbox_members.inbox_id = inboxes.id
            WHERE inboxes.id = emails.inbox_id
              AND inboxes.type = 'shared'
              AND inbox_members.user_id = (SELECT auth.uid())
              AND inbox_members.role IN ('admin', 'member')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM inboxes
            WHERE inboxes.id = emails.inbox_id
              AND inboxes.type = 'private'
              AND inboxes.owner_id = (SELECT auth.uid())
        )
        OR
        EXISTS (
            SELECT 1 FROM inboxes
            JOIN inbox_members ON inbox_members.inbox_id = inboxes.id
            WHERE inboxes.id = emails.inbox_id
              AND inboxes.type = 'shared'
              AND inbox_members.user_id = (SELECT auth.uid())
              AND inbox_members.role IN ('admin', 'member')
        )
    );

-- Kein DELETE Policy: E-Mails werden nur soft-deleted (is_deleted = true via UPDATE)


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. email_assignments – Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Nur wenn User Zugriff auf die zugehörige Inbox hat
CREATE POLICY email_assignments_select ON email_assignments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM emails
            JOIN inboxes ON inboxes.id = emails.inbox_id
            WHERE emails.id = email_assignments.email_id
              AND (
                  -- Private Inbox Owner
                  (inboxes.type = 'private' AND inboxes.owner_id = (SELECT auth.uid()))
                  OR
                  -- Shared Inbox Member
                  (inboxes.type = 'shared' AND EXISTS (
                      SELECT 1 FROM inbox_members
                      WHERE inbox_members.inbox_id = inboxes.id
                        AND inbox_members.user_id = (SELECT auth.uid())
                  ))
              )
        )
    );

-- INSERT: Inbox-Admin oder -Member können zuweisen
CREATE POLICY email_assignments_insert ON email_assignments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM emails
            JOIN inboxes ON inboxes.id = emails.inbox_id
            WHERE emails.id = email_assignments.email_id
              AND (
                  (inboxes.type = 'private' AND inboxes.owner_id = (SELECT auth.uid()))
                  OR
                  (inboxes.type = 'shared' AND EXISTS (
                      SELECT 1 FROM inbox_members
                      WHERE inbox_members.inbox_id = inboxes.id
                        AND inbox_members.user_id = (SELECT auth.uid())
                        AND inbox_members.role IN ('admin', 'member')
                  ))
              )
        )
    );

-- DELETE: Inbox-Admin oder der Zuweisende selbst
CREATE POLICY email_assignments_delete ON email_assignments
    FOR DELETE TO authenticated
    USING (
        -- Der Zuweisende kann seine eigene Zuweisung rückgängig machen
        email_assignments.assigned_by = (SELECT auth.uid())
        OR
        -- Inbox-Admin kann alle Zuweisungen entfernen
        EXISTS (
            SELECT 1 FROM emails
            JOIN inboxes ON inboxes.id = emails.inbox_id
            WHERE emails.id = email_assignments.email_id
              AND (
                  (inboxes.type = 'private' AND inboxes.owner_id = (SELECT auth.uid()))
                  OR
                  (inboxes.type = 'shared' AND EXISTS (
                      SELECT 1 FROM inbox_members
                      WHERE inbox_members.inbox_id = inboxes.id
                        AND inbox_members.user_id = (SELECT auth.uid())
                        AND inbox_members.role = 'admin'
                  ))
              )
        )
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. internal_comments – Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Nur wenn User Zugriff auf die zugehörige E-Mail hat
CREATE POLICY internal_comments_select ON internal_comments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM emails
            JOIN inboxes ON inboxes.id = emails.inbox_id
            WHERE emails.id = internal_comments.email_id
              AND (
                  (inboxes.type = 'private' AND inboxes.owner_id = (SELECT auth.uid()))
                  OR
                  (inboxes.type = 'shared' AND EXISTS (
                      SELECT 1 FROM inbox_members
                      WHERE inbox_members.inbox_id = inboxes.id
                        AND inbox_members.user_id = (SELECT auth.uid())
                  ))
              )
        )
    );

-- INSERT: Nur Inbox-Admin oder -Member können kommentieren
CREATE POLICY internal_comments_insert ON internal_comments
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Der author_id muss der aktuelle User sein
        internal_comments.author_id = (SELECT auth.uid())
        AND
        EXISTS (
            SELECT 1 FROM emails
            JOIN inboxes ON inboxes.id = emails.inbox_id
            WHERE emails.id = internal_comments.email_id
              AND (
                  (inboxes.type = 'private' AND inboxes.owner_id = (SELECT auth.uid()))
                  OR
                  (inboxes.type = 'shared' AND EXISTS (
                      SELECT 1 FROM inbox_members
                      WHERE inbox_members.inbox_id = inboxes.id
                        AND inbox_members.user_id = (SELECT auth.uid())
                        AND inbox_members.role IN ('admin', 'member')
                  ))
              )
        )
    );

-- UPDATE: Nur eigene Kommentare bearbeiten
CREATE POLICY internal_comments_update ON internal_comments
    FOR UPDATE TO authenticated
    USING (internal_comments.author_id = (SELECT auth.uid()))
    WITH CHECK (internal_comments.author_id = (SELECT auth.uid()));

-- DELETE: Eigene Kommentare oder Inbox-Admin
CREATE POLICY internal_comments_delete ON internal_comments
    FOR DELETE TO authenticated
    USING (
        -- Eigene Kommentare löschen
        internal_comments.author_id = (SELECT auth.uid())
        OR
        -- Inbox-Admin kann alle Kommentare moderieren
        EXISTS (
            SELECT 1 FROM emails
            JOIN inboxes ON inboxes.id = emails.inbox_id
            WHERE emails.id = internal_comments.email_id
              AND (
                  (inboxes.type = 'private' AND inboxes.owner_id = (SELECT auth.uid()))
                  OR
                  (inboxes.type = 'shared' AND EXISTS (
                      SELECT 1 FROM inbox_members
                      WHERE inbox_members.inbox_id = inboxes.id
                        AND inbox_members.user_id = (SELECT auth.uid())
                        AND inbox_members.role = 'admin'
                  ))
              )
        )
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. templates – Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Private → nur Owner. Team → alle Teammitglieder.
CREATE POLICY templates_select ON templates
    FOR SELECT TO authenticated
    USING (
        -- Private Vorlage: Nur der Owner sieht sie
        (scope = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        -- Team-Vorlage: Alle Teammitglieder sehen sie
        (scope = 'team' AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = templates.team_id
              AND team_members.user_id = (SELECT auth.uid())
        ))
    );

-- INSERT: Private → jeder für sich. Team → Team-Admin/Member.
CREATE POLICY templates_insert ON templates
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Private: owner_id muss der aktuelle User sein
        (scope = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        -- Team: User muss Teammitglied mit admin oder member Rolle sein
        (scope = 'team' AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = templates.team_id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin', 'member')
        ))
    );

-- UPDATE: Private → nur Owner. Team → nur Team-Admin.
CREATE POLICY templates_update ON templates
    FOR UPDATE TO authenticated
    USING (
        (scope = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (scope = 'team' AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = templates.team_id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        ))
    )
    WITH CHECK (
        (scope = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (scope = 'team' AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = templates.team_id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        ))
    );

-- DELETE: Private → nur Owner. Team → nur Team-Admin.
CREATE POLICY templates_delete ON templates
    FOR DELETE TO authenticated
    USING (
        (scope = 'private' AND owner_id = (SELECT auth.uid()))
        OR
        (scope = 'team' AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = templates.team_id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        ))
    );
