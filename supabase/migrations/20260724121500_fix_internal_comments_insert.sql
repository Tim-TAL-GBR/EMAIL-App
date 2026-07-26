-- Fix internal_comments and email_assignments insert policies to rely on emails policy

DROP POLICY IF EXISTS "internal_comments_insert" ON internal_comments;
CREATE POLICY "internal_comments_insert" ON internal_comments FOR INSERT TO authenticated WITH CHECK (
  internal_comments.author_id = auth.uid() AND
  EXISTS (SELECT 1 FROM emails WHERE emails.id = internal_comments.email_id)
);

DROP POLICY IF EXISTS "email_assignments_insert" ON email_assignments;
CREATE POLICY "email_assignments_insert" ON email_assignments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM emails WHERE emails.id = email_assignments.email_id)
);
