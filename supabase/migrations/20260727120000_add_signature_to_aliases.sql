-- Add signature_id FK to inbox_aliases so signatures can be assigned per email address
ALTER TABLE inbox_aliases ADD COLUMN signature_id UUID REFERENCES signatures(id) ON DELETE SET NULL;

-- RLS: inherit from inbox policies (users can update aliases of their inboxes)
-- The existing inbox_aliases RLS policies already cover SELECT/INSERT/UPDATE/DELETE
-- based on inbox ownership, so no new policies needed.
