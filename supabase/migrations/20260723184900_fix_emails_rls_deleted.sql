-- Recreate emails_select policy without the is_deleted = false condition
-- This allows the frontend to query deleted emails for the Trash folder

DROP POLICY IF EXISTS "emails_select" ON emails;
CREATE POLICY "emails_select" ON emails FOR SELECT TO authenticated USING (
  EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
  OR 
  EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
  OR
  is_user_assigned_to_email(emails.id, auth.uid())
  OR
  (emails.thread_id IS NOT NULL AND is_user_assigned_to_thread(emails.thread_id, auth.uid()))
);
