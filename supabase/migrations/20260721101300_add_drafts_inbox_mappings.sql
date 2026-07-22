ALTER TABLE public.inboxes ADD COLUMN IF NOT EXISTS folder_drafts TEXT;
ALTER TABLE public.inboxes ADD COLUMN IF NOT EXISTS folder_inbox TEXT;
