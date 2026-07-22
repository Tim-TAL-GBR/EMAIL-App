ALTER TABLE public.inboxes ADD COLUMN imap_secure BOOLEAN DEFAULT true;
ALTER TABLE public.inboxes ADD COLUMN smtp_secure BOOLEAN DEFAULT true;
