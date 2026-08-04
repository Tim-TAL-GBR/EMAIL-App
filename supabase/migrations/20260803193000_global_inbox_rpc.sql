-- =============================================================================
-- Migration: Global Inbox Feed RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION get_global_inbox_emails()
RETURNS SETOF public.emails
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT e.*
  FROM public.emails e
  JOIN public.inboxes i ON e.inbox_id = i.id
  LEFT JOIN public.email_assignments ea ON ea.email_id = e.id AND ea.assigned_to = auth.uid()
  LEFT JOIN public.notifications n ON n.email_id = e.id AND n.user_id = auth.uid() AND n.type = 'mention'
  WHERE 
    -- 1. E-Mails aus privaten Postfächern des Users
    (i.type = 'private' AND i.owner_id = auth.uid())
    OR 
    -- 2. E-Mails, die dem User zugewiesen sind (in beliebigen Team-Spaces)
    (ea.assigned_to = auth.uid())
    OR 
    -- 3. E-Mails, bei denen der User in einem Kommentar erwähnt wurde
    (n.id IS NOT NULL);
$$;

-- Berechtigungen für den RPC setzen
GRANT EXECUTE ON FUNCTION get_global_inbox_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_inbox_emails() TO service_role;
