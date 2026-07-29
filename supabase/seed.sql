-- =============================================================================
-- TeamMail – Seed-Daten für Entwicklung
-- =============================================================================
-- ⚠️  WARNUNG: Diese Datei enthält TEST-ZUGANGSDATEN und darf NIEMALS in
-- ⚠️  einer Production-Umgebung ausgeführt werden! Nur für lokale Entwicklung!
-- ⚠️  CI/CD Pipelines müssen diese Datei explizit ausschließen.
-- =============================================================================
-- WICHTIG: Diese Datei muss mit service_role Rechten ausgeführt werden!
-- Supabase CLI führt `supabase db seed` automatisch als service_role aus,
-- wodurch RLS-Policies umgangen werden.
--
-- Bei manuellem Ausführen:
--   SET ROLE postgres;  -- oder service_role
--
-- Feste UUIDs werden für Reproduzierbarkeit verwendet:
--   User 1 (Anna):   a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1
--   User 2 (Ben):    b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2
--   Team:            c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3
--   Shared Inbox:    d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4
--   Private Inbox:   e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5
--   Emails:          f6f6..01 bis f6f6..04
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Auth Users (Voraussetzung für profiles FK)
-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Auth benötigt Einträge in auth.users, bevor wir Profile anlegen
-- können. Der handle_new_user()-Trigger legt profiles automatisch an.

INSERT INTO auth.users (
    id, email, aud, role,
    instance_id,
    encrypted_password,
    email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at
) VALUES
    (
        'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        'anna@acme.de',
        'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000',
        extensions.crypt('test123456', extensions.gen_salt('bf')),
        now(),
        '', '', '', '',
        jsonb_build_object('display_name', 'Anna Schmidt', 'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anna'),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        now(), now()
    ),
    (
        'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
        'ben@acme.de',
        'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000',
        extensions.crypt('test123456', extensions.gen_salt('bf')),
        now(),
        '', '', '', '',
        jsonb_build_object('display_name', 'Ben Müller', 'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ben'),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        now(), now()
    ),
    (
        '00000000-0000-0000-0000-000000000001',
        'test@teammail.dev',
        'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000',
        extensions.crypt('test123456', extensions.gen_salt('bf')),
        now(),
        '', '', '', '',
        jsonb_build_object('display_name', 'Test User'),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        now(), now()
    );

-- Profile werden automatisch via handle_new_user()-Trigger erstellt.
-- Falls der Trigger nicht feuert (service_role vs. trigger context),
-- legen wir sie manuell nach:
INSERT INTO profiles (id, email, display_name, avatar_url)
SELECT id, email,
       raw_user_meta_data->>'display_name',
       COALESCE(raw_user_meta_data->>'avatar_url', '')
FROM auth.users
WHERE id IN ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Team
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO teams (id, name, slug) VALUES
    (
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        'Acme GmbH',
        'acme-gmbh'
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Team-Mitglieder
-- ─────────────────────────────────────────────────────────────────────────────
-- Anna ist Team-Owner (hat erstellt), Ben ist normales Mitglied.

INSERT INTO team_members (team_id, user_id, role) VALUES
    ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'owner'),
    ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'member'),
    ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', '00000000-0000-0000-0000-000000000001', 'member');


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Inboxes
-- ─────────────────────────────────────────────────────────────────────────────

-- Shared Inbox: "Support" – für eingehende Kundenanfragen
INSERT INTO inboxes (id, team_id, name, email_address, type, owner_id, color) VALUES
    (
        'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        'Support',
        'support@acme.de',
        'shared',
        NULL,       -- Shared Inboxes haben keinen Owner
        '#3B82F6'   -- Blau
    );

-- Private Inbox: Annas persönliches Postfach
INSERT INTO inboxes (id, team_id, name, email_address, type, owner_id, color) VALUES
    (
        'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5',
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        'Persönlich',
        'anna@acme.de',
        'private',
        'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',  -- Anna ist Owner
        '#10B981'   -- Grün
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Inbox-Mitglieder (für Shared Inbox)
-- ─────────────────────────────────────────────────────────────────────────────
-- Anna ist Admin der Support-Inbox, Ben ist normales Mitglied.

INSERT INTO inbox_members (inbox_id, user_id, role) VALUES
    ('d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'admin'),
    ('d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'member'),
    ('d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', '00000000-0000-0000-0000-000000000001', 'member');


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Beispiel-Emails
-- ─────────────────────────────────────────────────────────────────────────────

-- 3 E-Mails in der Shared Inbox "Support"
INSERT INTO emails (id, inbox_id, team_id, message_id, thread_id, subject, from_address, to_addresses, body_text, body_html, direction, status, is_read, received_at) VALUES
    (
        'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f60001',
        'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        '<msg001@kunde.example.com>',
        'thread-001',
        'Bestellung #1234 – Lieferstatus?',
        'max.weber@example.com',
        ARRAY['support@acme.de'],
        'Hallo, ich wollte fragen, wann meine Bestellung #1234 versendet wird. Vielen Dank!',
        '<p>Hallo,</p><p>ich wollte fragen, wann meine Bestellung #1234 versendet wird.</p><p>Vielen Dank!</p>',
        'inbound',
        'open',
        false,
        now() - interval '2 hours'
    ),
    (
        'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f60002',
        'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        '<msg002@partner.example.com>',
        'thread-002',
        'Rechnung RE-2024-0815',
        'buchhaltung@partner.example.com',
        ARRAY['support@acme.de'],
        'Anbei finden Sie die Rechnung RE-2024-0815 für die vereinbarten Dienstleistungen.',
        '<p>Anbei finden Sie die Rechnung RE-2024-0815 für die vereinbarten Dienstleistungen.</p>',
        'inbound',
        'in_progress',
        true,
        now() - interval '1 day'
    ),
    (
        'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f60003',
        'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        '<msg003@kunde.example.com>',
        'thread-001',
        'Re: Bestellung #1234 – Lieferstatus?',
        'support@acme.de',
        ARRAY['max.weber@example.com'],
        'Hallo Herr Weber, Ihre Bestellung wird morgen versendet. Sie erhalten eine Trackingnummer per E-Mail.',
        '<p>Hallo Herr Weber,</p><p>Ihre Bestellung wird morgen versendet. Sie erhalten eine Trackingnummer per E-Mail.</p>',
        'outbound',
        'done',
        true,
        now() - interval '1 hour'
    );

-- 1 E-Mail in Annas privater Inbox
INSERT INTO emails (id, inbox_id, team_id, message_id, thread_id, subject, from_address, to_addresses, body_text, body_html, direction, status, is_read, received_at) VALUES
    (
        'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f60004',
        'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5',
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        '<msg004@privat.example.com>',
        'thread-003',
        'Teammeeting nächste Woche',
        'chef@example.com',
        ARRAY['anna@acme.de'],
        'Hallo Anna, können wir das Teammeeting auf Mittwoch 14:00 verschieben?',
        '<p>Hallo Anna,</p><p>können wir das Teammeeting auf Mittwoch 14:00 verschieben?</p>',
        'inbound',
        'open',
        false,
        now() - interval '30 minutes'
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Email-Zuweisung
-- ─────────────────────────────────────────────────────────────────────────────
-- Die Lieferstatus-Anfrage wird Ben zugewiesen (Anna hat zugewiesen)

INSERT INTO email_assignments (id, email_id, assigned_to, assigned_by) VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f60001',
        'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',  -- Ben
        'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'   -- Anna hat zugewiesen
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Interne Kommentare
-- ─────────────────────────────────────────────────────────────────────────────

-- Kommentar 1: Anna kommentiert die Lieferstatus-Anfrage
INSERT INTO internal_comments (id, email_id, author_id, body, created_at) VALUES
    (
        '22222222-2222-2222-2222-222222222221',
        'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f60001',
        'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        '@Ben kannst du bitte den Versandstatus im Warenwirtschaftssystem prüfen? Bestellung #1234.',
        now() - interval '90 minutes'
    );

-- Kommentar 2: Ben antwortet
INSERT INTO internal_comments (id, email_id, author_id, body, created_at) VALUES
    (
        '22222222-2222-2222-2222-222222222222',
        'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f60001',
        'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
        'Hab nachgeschaut – Paket wird morgen früh von DHL abgeholt. Trackingnummer kommt dann automatisch.',
        now() - interval '1 hour'
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Antwort-Vorlagen (Templates)
-- ─────────────────────────────────────────────────────────────────────────────

-- Private Vorlage von Anna: Persönliche Signatur
INSERT INTO templates (id, team_id, owner_id, scope, name, subject, body) VALUES
    (
        '33333333-3333-3333-3333-333333333331',
        NULL,       -- Private Vorlagen brauchen kein Team
        'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        'private',
        'Meine Signatur',
        NULL,
        E'Mit freundlichen Grüßen\nAnna Schmidt\nAcme GmbH\nTel: +49 123 456789'
    );

-- Team-Vorlage: Standard-Antwort für Support
INSERT INTO templates (id, team_id, owner_id, scope, name, subject, body) VALUES
    (
        '33333333-3333-3333-3333-333333333332',
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        NULL,       -- Team-Vorlagen brauchen keinen Owner
        'team',
        'Ticket erhalten – Automatische Bestätigung',
        'Re: {{subject}}',
        E'Hallo {{customer_name}},\n\nvielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und werden uns innerhalb von 24 Stunden bei Ihnen melden.\n\nIhre Ticketnummer: {{ticket_id}}\n\nMit freundlichen Grüßen\nDas Acme Support-Team'
    );


-- =============================================================================
-- Seed-Daten erfolgreich eingefügt!
-- =============================================================================
-- Zusammenfassung:
--   ✓ 3 User-Profile (Anna Schmidt, Ben Müller, Test User)
--   ✓ 1 Team (Acme GmbH)
--   ✓ 3 Team-Mitglieder (Anna: owner, Ben: member, Test: member)
--   ✓ 1 Shared Inbox (Support) mit 3 Inbox-Mitgliedern
--   ✓ 1 Private Inbox (Annas persönliches Postfach)
--   ✓ 3 E-Mails in Shared Inbox (inkl. Thread + Antwort)
--   ✓ 1 E-Mail in Private Inbox
--   ✓ 1 E-Mail-Zuweisung (Lieferstatus → Ben)
--   ✓ 2 Interne Kommentare (Anna ↔ Ben)
--   ✓ 1 Private Vorlage (Annas Signatur)
--   ✓ 1 Team-Vorlage (Support-Bestätigung mit Variablen)
--
--   Login für alle: test@teammail.dev / test123456
--                   anna@acme.de    / test123456
--                   ben@acme.de     / test123456
-- =============================================================================
