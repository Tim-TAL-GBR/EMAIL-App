-- =============================================================================
-- TeamMail – Migration 00001: Basis-Schema
-- =============================================================================
-- Erstellt alle ENUMs, Tabellen, Indexes und Trigger für das TeamMail-Projekt.
--
-- Design-Entscheidungen:
--   • UUIDs als Primary Keys für verteilte ID-Generierung
--   • Denormalisierte team_id auf emails für RLS-Performance
--   • Soft-Delete für E-Mails (is_deleted Flag statt physischem DELETE)
--   • CHECK-Constraints erzwingen Datenintegrität bei inbox/template Typen
--   • Partielle Indexes reduzieren Index-Größe und beschleunigen RLS-Lookups
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUM-Typen
-- ─────────────────────────────────────────────────────────────────────────────

-- Art des Postfachs: privat (nur ein User) oder geteilt (Team-Zugriff)
CREATE TYPE inbox_type AS ENUM ('private', 'shared');

-- Berechtigungsstufe innerhalb einer Shared Inbox
-- admin: Vollzugriff inkl. Mitgliederverwaltung
-- member: Lesen, Schreiben, Zuweisen
-- observer: Nur Lesen (z.B. für Manager-Überblick)
CREATE TYPE inbox_role AS ENUM ('admin', 'member', 'observer');

-- Bearbeitungsstatus einer E-Mail
CREATE TYPE email_status AS ENUM ('open', 'in_progress', 'done');

-- Richtung der E-Mail: eingehend oder ausgehend
CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');

-- Rolle eines Users innerhalb eines Teams
-- owner: Vollzugriff, kann Team löschen
-- admin: Kann Mitglieder und Inboxes verwalten
-- member: Normales Teammitglied
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');

-- Sichtbarkeitsbereich einer Antwort-Vorlage
CREATE TYPE template_scope AS ENUM ('private', 'team');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Hilfsfunktionen (Trigger)
-- ─────────────────────────────────────────────────────────────────────────────

-- Setzt updated_at automatisch auf den aktuellen Zeitpunkt bei UPDATE.
-- Wird als BEFORE UPDATE Trigger auf allen relevanten Tabellen registriert.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- Erstellt automatisch einen profiles-Eintrag wenn ein neuer User sich
-- über Supabase Auth registriert. Wird als AFTER INSERT Trigger auf
-- auth.users registriert.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabellen
-- ─────────────────────────────────────────────────────────────────────────────

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ profiles – Erweitert auth.users mit App-spezifischen Feldern            │
-- │                                                                          │
-- │ Jeder Supabase Auth User bekommt automatisch ein Profil (via Trigger).   │
-- │ Wird für Anzeigenamen, Avatare und @mentions verwendet.                  │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    display_name TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ
);

COMMENT ON TABLE profiles IS 'Erweiterte Benutzerprofile. Wird automatisch bei User-Registrierung erstellt.';
COMMENT ON COLUMN profiles.id IS 'Referenz auf auth.users – 1:1 Beziehung.';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ teams – Organisationseinheit für Gruppen von Benutzern                   │
-- │                                                                          │
-- │ Ein Team fasst mehrere User zusammen und besitzt Inboxes.                │
-- │ Der Slug wird für URL-Routing verwendet (/team/acme-gmbh/...).          │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE teams (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

COMMENT ON TABLE teams IS 'Teams als Organisationseinheit. Jedes Team hat eigene Inboxes und Mitglieder.';
COMMENT ON COLUMN teams.slug IS 'URL-sicherer Kurzname des Teams (z.B. "acme-gmbh").';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ team_members – Verknüpfungstabelle: User ↔ Team                         │
-- │                                                                          │
-- │ Definiert welche User zu welchem Team gehören und mit welcher Rolle.     │
-- │ Composite Primary Key verhindert Duplikate.                              │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE team_members (
    team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role      team_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);

COMMENT ON TABLE team_members IS 'Zuordnung von Benutzern zu Teams mit Rollenangabe.';
COMMENT ON COLUMN team_members.role IS 'owner: Vollzugriff | admin: Verwaltung | member: Standardrolle.';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ inboxes – Private oder geteilte Postfächer                               │
-- │                                                                          │
-- │ Jede Inbox gehört zu einem Team und hat eine eigene E-Mail-Adresse.      │
-- │ Private Inboxes gehören einem einzelnen User (owner_id).                 │
-- │ Shared Inboxes werden über inbox_members mit granularen Rechten geteilt. │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE inboxes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    email_address TEXT NOT NULL,
    type          inbox_type NOT NULL DEFAULT 'shared',
    -- owner_id ist NUR für private Inboxes gesetzt
    owner_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Hex-Farbcode für die UI-Darstellung (z.B. '#3B82F6')
    color         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ,

    -- Datenintegrität: owner_id MUSS bei private gesetzt sein, bei shared NICHT
    CONSTRAINT chk_inbox_private_has_owner
        CHECK (
            (type = 'private' AND owner_id IS NOT NULL)
            OR
            (type = 'shared' AND owner_id IS NULL)
        )
);

COMMENT ON TABLE inboxes IS 'E-Mail-Postfächer. Private Inboxes haben einen Owner, Shared Inboxes nutzen inbox_members.';
COMMENT ON COLUMN inboxes.email_address IS 'Die E-Mail-Adresse dieses Postfachs (z.B. support@acme.de).';
COMMENT ON COLUMN inboxes.owner_id IS 'Nur für private Inboxes – der alleinige Besitzer.';
COMMENT ON COLUMN inboxes.color IS 'Hex-Farbcode für die UI (z.B. #3B82F6 für Blau).';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ inbox_members – Granulare Berechtigungen für Shared Inboxes              │
-- │                                                                          │
-- │ Definiert welche User auf eine Shared Inbox zugreifen dürfen und mit     │
-- │ welcher Rolle (admin, member, observer).                                 │
-- │ WICHTIG: Ein Team-Mitglied hat KEINEN automatischen Zugriff auf Shared   │
-- │ Inboxes – es muss explizit als inbox_member eingetragen werden!         │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE inbox_members (
    inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role     inbox_role NOT NULL DEFAULT 'member',
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (inbox_id, user_id)
);

COMMENT ON TABLE inbox_members IS 'Zugriffskontrolle für Shared Inboxes. Kein Eintrag = kein Zugriff.';
COMMENT ON COLUMN inbox_members.role IS 'admin: Vollzugriff | member: Lesen/Schreiben | observer: Nur lesen.';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ emails – E-Mail-Nachrichten                                              │
-- │                                                                          │
-- │ Zentrale Tabelle für alle ein- und ausgehenden E-Mails.                  │
-- │ team_id ist absichtlich denormalisiert (auch in inboxes vorhanden),       │
-- │ um RLS-Policies performant zu halten (vermeidet JOINs in Policies).     │
-- │                                                                          │
-- │ Soft-Delete: E-Mails werden NICHT physisch gelöscht, sondern nur         │
-- │ is_deleted auf true gesetzt. Dadurch können sie wiederhergestellt werden. │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE emails (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id      UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
    -- Denormalisiert aus inboxes.team_id für RLS-Performance.
    -- Vermeidet teure JOINs in Row Level Security Policies.
    team_id       UUID NOT NULL REFERENCES teams(id),
    -- RFC 2822 Message-ID Header (z.B. '<abc123@mail.example.com>')
    message_id    TEXT UNIQUE,
    -- Thread-Gruppierung basierend auf In-Reply-To / References Headers
    thread_id     TEXT,
    subject       TEXT,
    from_address  TEXT NOT NULL,
    to_addresses  TEXT[] NOT NULL,
    cc_addresses  TEXT[],
    bcc_addresses TEXT[],
    body_text     TEXT,
    body_html     TEXT,
    direction     email_direction NOT NULL DEFAULT 'inbound',
    status        email_status NOT NULL DEFAULT 'open',
    is_read       BOOLEAN NOT NULL DEFAULT false,
    is_starred    BOOLEAN NOT NULL DEFAULT false,
    -- Soft-Delete Flag: true = in den Papierkorb verschoben
    is_deleted    BOOLEAN NOT NULL DEFAULT false,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ
);

COMMENT ON TABLE emails IS 'Alle E-Mail-Nachrichten mit Soft-Delete Support. team_id ist denormalisiert für RLS.';
COMMENT ON COLUMN emails.team_id IS 'Denormalisiert aus inboxes.team_id – für performante RLS-Policies.';
COMMENT ON COLUMN emails.message_id IS 'RFC 2822 Message-ID für Deduplizierung eingehender E-Mails.';
COMMENT ON COLUMN emails.thread_id IS 'Thread-Gruppierung via In-Reply-To/References Header.';
COMMENT ON COLUMN emails.is_deleted IS 'Soft-Delete: true = Papierkorb. Physisches Löschen nur via Cron-Job.';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ email_assignments – Zuweisung von E-Mails an Teammitglieder              │
-- │                                                                          │
-- │ Eine E-Mail kann mehreren Personen zugewiesen werden.                    │
-- │ Wer die Zuweisung vorgenommen hat wird für Audit-Zwecke gespeichert.    │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE email_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id    UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Eine E-Mail kann pro User nur einmal zugewiesen werden
    UNIQUE (email_id, assigned_to)
);

COMMENT ON TABLE email_assignments IS 'Zuweisungen von E-Mails an Bearbeiter mit Audit-Trail.';
COMMENT ON COLUMN email_assignments.assigned_by IS 'Wer hat diese Zuweisung vorgenommen (Audit).';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ internal_comments – Team-interner Chat pro E-Mail                        │
-- │                                                                          │
-- │ Ermöglicht interne Kommunikation zu einer E-Mail, ohne dass der         │
-- │ externe Absender davon erfährt. Ähnlich wie Slack-Threads.              │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE internal_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id   UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

COMMENT ON TABLE internal_comments IS 'Interne Team-Kommentare zu E-Mails. Nicht sichtbar für externe Sender.';


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ templates – Wiederverwendbare Antwort-Vorlagen                           │
-- │                                                                          │
-- │ Private Vorlagen gehören einem einzelnen User.                           │
-- │ Team-Vorlagen sind für alle Teammitglieder sichtbar.                     │
-- │ Unterstützen Variablen-Platzhalter wie {{customer_name}}.               │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE templates (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID REFERENCES teams(id) ON DELETE CASCADE,
    owner_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scope      template_scope NOT NULL DEFAULT 'private',
    name       TEXT NOT NULL,
    subject    TEXT,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    -- Datenintegrität: Bei 'private' muss owner_id gesetzt sein,
    -- bei 'team' muss team_id gesetzt sein
    CONSTRAINT chk_template_scope_fields
        CHECK (
            (scope = 'private' AND owner_id IS NOT NULL)
            OR
            (scope = 'team' AND team_id IS NOT NULL)
        )
);

COMMENT ON TABLE templates IS 'Antwort-Vorlagen mit Variablen-Support. Private oder Team-Scope.';
COMMENT ON COLUMN templates.scope IS 'private: Nur für den Owner | team: Für alle Teammitglieder.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Indexes
-- ─────────────────────────────────────────────────────────────────────────────
-- PERFORMANCE-KRITISCH: Diese Indexes sind essentiell für schnelle
-- RLS-Policy-Evaluation. Ohne sie würden RLS-Checks bei jedem Query
-- Full Table Scans auf team_members und inbox_members erfordern.
-- ─────────────────────────────────────────────────────────────────────────────

-- team_members: Schneller Lookup "In welchen Teams ist dieser User?"
CREATE INDEX idx_team_members_user_id
    ON team_members(user_id);

-- team_members: Schneller Lookup "Ist dieser User in diesem Team?"
-- Wird in praktisch jeder RLS-Policy referenziert.
CREATE INDEX idx_team_members_team_user
    ON team_members(team_id, user_id);

-- inboxes: Alle Inboxes eines Teams laden
CREATE INDEX idx_inboxes_team_id
    ON inboxes(team_id);

-- inboxes: Private Inboxes eines Users finden (nur wo owner_id gesetzt ist)
CREATE INDEX idx_inboxes_owner_id
    ON inboxes(owner_id) WHERE owner_id IS NOT NULL;

-- inboxes: Filterung nach Inbox-Typ
CREATE INDEX idx_inboxes_type
    ON inboxes(type);

-- inbox_members: Schneller Lookup "Auf welche Inboxes hat dieser User Zugriff?"
CREATE INDEX idx_inbox_members_user_id
    ON inbox_members(user_id);

-- inbox_members: Schneller Lookup "Hat dieser User Zugriff auf diese Inbox?"
-- Wird in praktisch jeder E-Mail-bezogenen RLS-Policy referenziert.
CREATE INDEX idx_inbox_members_inbox_user
    ON inbox_members(inbox_id, user_id);

-- emails: Alle E-Mails einer Inbox laden (Hauptansicht)
CREATE INDEX idx_emails_inbox_id
    ON emails(inbox_id);

-- emails: Alle E-Mails eines Teams laden (Team-Überblick)
CREATE INDEX idx_emails_team_id
    ON emails(team_id);

-- emails: Thread-Ansicht gruppieren (nur wo thread_id gesetzt ist)
CREATE INDEX idx_emails_thread_id
    ON emails(thread_id) WHERE thread_id IS NOT NULL;

-- emails: Nach Status filtern (nur nicht-gelöschte E-Mails)
CREATE INDEX idx_emails_status
    ON emails(status) WHERE is_deleted = false;

-- email_assignments: Alle Zuweisungen einer E-Mail
CREATE INDEX idx_email_assignments_email
    ON email_assignments(email_id);

-- email_assignments: Alle Zuweisungen an einen User
CREATE INDEX idx_email_assignments_user
    ON email_assignments(assigned_to);

-- internal_comments: Alle Kommentare zu einer E-Mail laden
CREATE INDEX idx_internal_comments_email
    ON internal_comments(email_id);

-- templates: Team-Vorlagen schnell finden
CREATE INDEX idx_templates_team
    ON templates(team_id) WHERE scope = 'team';

-- templates: Private Vorlagen eines Users finden
CREATE INDEX idx_templates_owner
    ON templates(owner_id) WHERE scope = 'private';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trigger
-- ─────────────────────────────────────────────────────────────────────────────

-- updated_at Trigger auf allen Tabellen mit updated_at-Spalte
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inboxes_updated_at
    BEFORE UPDATE ON inboxes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_emails_updated_at
    BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_internal_comments_updated_at
    BEFORE UPDATE ON internal_comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Automatische Profil-Erstellung bei User-Registrierung
-- WICHTIG: Trigger auf auth.users (Supabase Auth Schema)
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
