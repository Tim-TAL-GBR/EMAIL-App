-- =============================================================================
-- TeamMail – Migration 00004: Realtime-Konfiguration
-- =============================================================================
-- Konfiguriert Supabase Realtime für Echtzeit-Updates.
--
-- Supabase Realtime nutzt PostgreSQL's Logical Replication, um Änderungen
-- an Tabellen als Events an verbundene Clients zu streamen.
--
-- WICHTIG:
--   • SELECT-RLS-Policies werden automatisch von Supabase Realtime erzwungen.
--     Ein Client empfängt NUR Events für Zeilen, die er auch SELECTen darf.
--   • REPLICA IDENTITY FULL ist nötig, damit UPDATE- und DELETE-Events
--     die vollständigen Zeilendaten (alte + neue Werte) enthalten.
--     Ohne FULL sehen Clients nur die Primary-Key-Spalten bei DELETE.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabellen zur Realtime-Publication hinzufügen
-- ─────────────────────────────────────────────────────────────────────────────
-- Nur die Tabellen hinzufügen, deren Änderungen in Echtzeit relevant sind.
-- Profile und Teams ändern sich selten und brauchen kein Realtime.

-- E-Mails: Neue Mails, Statusänderungen, Lese-Markierungen
ALTER PUBLICATION supabase_realtime ADD TABLE emails;

-- Interne Kommentare: Team-Chat in Echtzeit
ALTER PUBLICATION supabase_realtime ADD TABLE internal_comments;

-- Zuweisungen: Sofortige Benachrichtigung bei neuer Zuweisung
ALTER PUBLICATION supabase_realtime ADD TABLE email_assignments;

-- Inboxes: Änderungen an Inbox-Einstellungen (Name, Farbe)
ALTER PUBLICATION supabase_realtime ADD TABLE inboxes;

-- Inbox-Mitglieder: Rechte-Änderungen sofort propagieren
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_members;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. REPLICA IDENTITY auf FULL setzen
-- ─────────────────────────────────────────────────────────────────────────────
-- Standard ist REPLICA IDENTITY DEFAULT (nur PK in DELETE-Events).
-- FULL stellt sicher, dass Clients bei UPDATE die alten UND neuen Werte
-- sehen, und bei DELETE die vollständigen Zeilendaten.
--
-- Trade-off: Leicht höhere WAL-Größe, aber essentiell für sinnvolle
-- Echtzeit-Events (Client muss wissen WAS sich geändert hat).

ALTER TABLE emails            REPLICA IDENTITY FULL;
ALTER TABLE internal_comments REPLICA IDENTITY FULL;
ALTER TABLE email_assignments REPLICA IDENTITY FULL;
ALTER TABLE inboxes           REPLICA IDENTITY FULL;
ALTER TABLE inbox_members     REPLICA IDENTITY FULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Hinweise für die Client-Integration
-- ─────────────────────────────────────────────────────────────────────────────
-- 
-- Supabase JS Client Beispiel:
--
--   const channel = supabase
--     .channel('inbox-emails')
--     .on(
--       'postgres_changes',
--       {
--         event: '*',           // INSERT, UPDATE, DELETE
--         schema: 'public',
--         table: 'emails',
--         filter: `inbox_id=eq.${inboxId}`,
--       },
--       (payload) => {
--         // Nur Events für Zeilen, die der User SELECTen darf!
--         handleEmailChange(payload);
--       }
--     )
--     .subscribe();
--
-- ACHTUNG:
--   • Wenn RLS den SELECT blockiert, werden Events STILL ignoriert
--     (kein Fehler, einfach keine Daten).
--   • Filter (z.B. inbox_id=eq.xxx) reduzieren die Event-Menge
--     serverseitig und verbessern die Performance.
--   • Komplexe RLS-Policies erhöhen die Latenz beim Channel-Join.
--     Die Policies in 00002 sind auf Performance optimiert (Indexes!).
