-- =============================================================================
-- Migration: Fix Security vulnerabilities (SEC-04, SEC-07, SEC-08, SEC-12)
-- =============================================================================

-- =============================================================================
-- Fix 1: SEC-04 – RLS-Lücke bei privaten E-Mails
-- =============================================================================
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
        OR (inboxes.type = 'shared' AND team_members.user_id = u_id)
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


-- =============================================================================
-- Fix 2: SEC-07 – Notifications-Spoofing
-- =============================================================================
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

CREATE POLICY "Users can insert notifications"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (actor_id = (SELECT auth.uid()));


-- =============================================================================
-- Fix 3: SEC-08 – email_labels unbefugtes Labeling
-- =============================================================================
DROP POLICY IF EXISTS "Users can insert email_labels" ON email_labels;

CREATE POLICY "Users can insert email_labels"
    ON email_labels FOR INSERT
    TO authenticated
    WITH CHECK (
        label_id IN (
            SELECT id FROM labels WHERE team_id IN (
                SELECT team_id FROM team_members WHERE user_id = auth.uid()
            )
        )
        AND user_has_email_access(email_id)
    );


-- =============================================================================
-- Fix 4: SEC-12 – user_email_settings fehlende Inbox-Autorisierung
-- =============================================================================
DROP POLICY IF EXISTS "Users can insert own email settings" ON user_email_settings;

CREATE POLICY "Users can insert own email settings"
  ON user_email_settings FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM inboxes
      LEFT JOIN inbox_members ON inbox_members.inbox_id = inboxes.id
      WHERE inboxes.id = inbox_id
      AND (inboxes.owner_id = auth.uid() OR inbox_members.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own email settings" ON user_email_settings;

CREATE POLICY "Users can update own email settings"
  ON user_email_settings FOR UPDATE
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM inboxes
      LEFT JOIN inbox_members ON inbox_members.inbox_id = inboxes.id
      WHERE inboxes.id = inbox_id
      AND (inboxes.owner_id = auth.uid() OR inbox_members.user_id = auth.uid())
    )
  );
