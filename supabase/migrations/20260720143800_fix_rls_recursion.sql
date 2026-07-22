-- Fix infinite recursion in emails_select and email_assignments_select

-- Create a security definer function to bypass RLS when checking assignments
CREATE OR REPLACE FUNCTION is_user_assigned_to_email(p_email_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM email_assignments ea
    WHERE ea.email_id = p_email_id AND ea.assigned_to = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_user_assigned_to_thread(p_thread_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM emails e
    JOIN email_assignments ea ON ea.email_id = e.id
    WHERE e.thread_id = p_thread_id AND ea.assigned_to = p_user_id
  );
$$;

-- Recreate emails policies using the security definer functions to break recursion
DROP POLICY IF EXISTS "emails_select" ON emails;
CREATE POLICY "emails_select" ON emails FOR SELECT TO authenticated USING (
  is_deleted = false AND (
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
    OR 
    EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
    OR
    is_user_assigned_to_email(emails.id, auth.uid())
    OR
    (emails.thread_id IS NOT NULL AND is_user_assigned_to_thread(emails.thread_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS "emails_update" ON emails;
CREATE POLICY "emails_update" ON emails FOR UPDATE TO authenticated USING (
  EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
  OR 
  EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() AND inbox_members.role IN ('admin', 'member') )
  OR
  is_user_assigned_to_email(emails.id, auth.uid())
  OR
  (emails.thread_id IS NOT NULL AND is_user_assigned_to_thread(emails.thread_id, auth.uid()))
);

-- And update email_assignments_select to just rely on emails_select without causing a loop!
DROP POLICY IF EXISTS "email_assignments_select" ON email_assignments;
CREATE POLICY "email_assignments_select" ON email_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM emails WHERE emails.id = email_assignments.email_id)
);
