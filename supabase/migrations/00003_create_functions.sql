-- =============================================================================
-- TeamMail – Migration 00003: Hilfsfunktionen
-- =============================================================================
-- SECURITY DEFINER Funktionen für Rollenprüfungen und Zugriffskontrollen.
--
-- Alle Funktionen:
--   • SET search_path = '' – verhindert Schema-Injection-Angriffe
--   • SECURITY DEFINER – läuft mit den Rechten des Erstellers (service_role)
--   • STABLE – gibt bei gleichen Inputs im selben Statement gleiche Ergebnisse
--   • REVOKE FROM PUBLIC + GRANT TO authenticated – Minimalprinzip
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_user_inbox_role(p_inbox_id) → inbox_role | NULL
-- ─────────────────────────────────────────────────────────────────────────────
-- Gibt die Rolle des aktuellen Users für eine bestimmte Inbox zurück.
--
-- Logik:
--   1. Wenn die Inbox privat ist UND der User der Owner → 'admin'
--   2. Wenn die Inbox shared ist → Rolle aus inbox_members
--   3. Kein Zugriff → NULL
--
-- Verwendung:
--   SELECT get_user_inbox_role('inbox-uuid-hier');
--   -- Gibt 'admin', 'member', 'observer' oder NULL zurück
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_inbox_role(p_inbox_id UUID)
RETURNS inbox_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        CASE
            -- Private Inbox: Owner bekommt immer 'admin'-Rechte
            WHEN i.type = 'private' AND i.owner_id = (SELECT auth.uid())
                THEN 'admin'::public.inbox_role
            -- Shared Inbox: Rolle aus inbox_members Tabelle
            WHEN i.type = 'shared'
                THEN (
                    SELECT im.role
                    FROM public.inbox_members im
                    WHERE im.inbox_id = p_inbox_id
                      AND im.user_id = (SELECT auth.uid())
                )
            -- Kein Zugriff
            ELSE NULL
        END
    FROM public.inboxes i
    WHERE i.id = p_inbox_id;
$$;

-- Sicherheit: Nur authentifizierte User dürfen diese Funktion aufrufen
REVOKE EXECUTE ON FUNCTION public.get_user_inbox_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_inbox_role(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_user_inbox_role IS
    'Gibt die inbox_role des aktuellen Users für eine Inbox zurück, oder NULL wenn kein Zugriff.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. has_inbox_access(p_inbox_id, p_min_role) → BOOLEAN
-- ─────────────────────────────────────────────────────────────────────────────
-- Prüft ob der aktuelle User mindestens die angegebene Rolle in einer
-- Inbox hat. Nutzt eine Rollen-Hierarchie:
--
--   admin > member > observer
--
-- Die Hierarchie wird über eine Hilfstabelle (VALUES) als numerischer
-- Rang abgebildet: admin=3, member=2, observer=1.
--
-- Beispiele:
--   has_inbox_access('inbox-uuid', 'observer')  -- Irgendein Zugriff reicht
--   has_inbox_access('inbox-uuid', 'member')     -- Mindestens member
--   has_inbox_access('inbox-uuid', 'admin')      -- Nur admin
--   has_inbox_access('inbox-uuid')               -- Default: 'observer'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_inbox_access(
    p_inbox_id UUID,
    p_min_role TEXT DEFAULT 'observer'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT
                -- Numerischer Rang der tatsächlichen User-Rolle
                (SELECT rank FROM (VALUES
                    ('admin'::public.inbox_role, 3),
                    ('member'::public.inbox_role, 2),
                    ('observer'::public.inbox_role, 1)
                ) AS roles(role, rank) WHERE roles.role = user_role)
                >=
                -- Numerischer Rang der geforderten Mindest-Rolle
                (SELECT rank FROM (VALUES
                    ('admin', 3),
                    ('member', 2),
                    ('observer', 1)
                ) AS min_roles(role, rank) WHERE min_roles.role = p_min_role)
            FROM (
                SELECT public.get_user_inbox_role(p_inbox_id) AS user_role
            ) sub
            WHERE user_role IS NOT NULL
        ),
        false  -- NULL → kein Zugriff → false
    );
$$;

-- Sicherheit: Nur authentifizierte User dürfen diese Funktion aufrufen
REVOKE EXECUTE ON FUNCTION public.has_inbox_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_inbox_access(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.has_inbox_access IS
    'Prüft ob der aktuelle User mindestens die angegebene Rolle in einer Inbox hat. Default: observer.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. get_user_team_role(p_team_id) → team_role | NULL
-- ─────────────────────────────────────────────────────────────────────────────
-- Gibt die Rolle des aktuellen Users in einem Team zurück.
--
-- Verwendung:
--   SELECT get_user_team_role('team-uuid-hier');
--   -- Gibt 'owner', 'admin', 'member' oder NULL zurück
--
-- Kann in Clients verwendet werden um UI-Elemente basierend auf der
-- Team-Rolle ein-/auszublenden (z.B. "Team löschen" nur für Owner).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_team_role(p_team_id UUID)
RETURNS team_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT tm.role
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = (SELECT auth.uid());
$$;

-- Sicherheit: Nur authentifizierte User dürfen diese Funktion aufrufen
REVOKE EXECUTE ON FUNCTION public.get_user_team_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_team_role(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_user_team_role IS
    'Gibt die team_role des aktuellen Users in einem Team zurück, oder NULL wenn kein Mitglied.';
