-- Migration to allow assigned users to view emails in private inboxes

DROP POLICY IF EXISTS "emails_select" ON emails;
CREATE POLICY "emails_select" ON emails FOR SELECT TO authenticated USING (
  is_deleted = false AND (
    EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
    OR 
    EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() )
    OR
    EXISTS ( SELECT 1 FROM email_assignments ea WHERE ea.email_id = emails.id AND ea.assigned_to = auth.uid() )
    OR
    (emails.thread_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM emails e2
      JOIN email_assignments ea ON ea.email_id = e2.id
      WHERE e2.thread_id = emails.thread_id AND ea.assigned_to = auth.uid()
    ))
  )
);

DROP POLICY IF EXISTS "emails_update" ON emails;
CREATE POLICY "emails_update" ON emails FOR UPDATE TO authenticated USING (
  EXISTS ( SELECT 1 FROM inboxes WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'private' AND inboxes.owner_id = auth.uid() )
  OR 
  EXISTS ( SELECT 1 FROM inboxes JOIN inbox_members ON inbox_members.inbox_id = inboxes.id WHERE inboxes.id = emails.inbox_id AND inboxes.type = 'shared' AND inbox_members.user_id = auth.uid() AND inbox_members.role IN ('admin', 'member') )
  OR
  EXISTS ( SELECT 1 FROM email_assignments ea WHERE ea.email_id = emails.id AND ea.assigned_to = auth.uid() )
  OR
  (emails.thread_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM emails e2
    JOIN email_assignments ea ON ea.email_id = e2.id
    WHERE e2.thread_id = emails.thread_id AND ea.assigned_to = auth.uid()
  ))
);

-- Fix child tables to rely on the updated emails_select policy
DROP POLICY IF EXISTS "email_attachments_select" ON email_attachments;
CREATE POLICY "email_attachments_select" ON email_attachments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM emails WHERE emails.id = email_attachments.email_id)
);

DROP POLICY IF EXISTS "internal_comments_select" ON internal_comments;
CREATE POLICY "internal_comments_select" ON internal_comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM emails WHERE emails.id = internal_comments.email_id)
);

DROP POLICY IF EXISTS "email_labels_select" ON email_labels;
CREATE POLICY "email_labels_select" ON email_labels FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM emails WHERE emails.id = email_labels.email_id)
);
