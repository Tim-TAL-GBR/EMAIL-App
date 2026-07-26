-- Bulletproof RLS for emails and internal_comments
-- Create a SECURITY DEFINER function to check if a user has access to an email
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
    LEFT JOIN email_assignments ea ON ea.email_id = emails.id
    WHERE emails.id = e_id
      AND (
        inboxes.owner_id = u_id
        OR inbox_members.user_id = u_id
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

-- Now replace the internal_comments policies to use this function
DROP POLICY IF EXISTS "internal_comments_select" ON internal_comments;
CREATE POLICY "internal_comments_select" ON internal_comments FOR SELECT TO authenticated USING (
  author_id = auth.uid() OR user_has_email_access(email_id)
);

DROP POLICY IF EXISTS "internal_comments_insert" ON internal_comments;
CREATE POLICY "internal_comments_insert" ON internal_comments FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND user_has_email_access(email_id)
);

-- And replace email_assignments policies as well!
DROP POLICY IF EXISTS "email_assignments_insert" ON email_assignments;
CREATE POLICY "email_assignments_insert" ON email_assignments FOR INSERT TO authenticated WITH CHECK (
  assigned_by = auth.uid() AND user_has_email_access(email_id)
);

DROP POLICY IF EXISTS "email_assignments_select" ON email_assignments;
CREATE POLICY "email_assignments_select" ON email_assignments FOR SELECT TO authenticated USING (
  assigned_to = auth.uid() OR user_has_email_access(email_id)
);
