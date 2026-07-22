CREATE TABLE IF NOT EXISTS inbox_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID REFERENCES inboxes(id) ON DELETE CASCADE NOT NULL,
  email_address TEXT NOT NULL,
  name TEXT,
  signature TEXT,
  auto_cc TEXT,
  auto_bcc TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(inbox_id, email_address)
);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON inbox_aliases
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- RLS
ALTER TABLE inbox_aliases ENABLE ROW LEVEL SECURITY;

-- Select policy: users can view aliases for inboxes they have access to
CREATE POLICY "Users can view aliases of their inboxes" ON inbox_aliases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inboxes i 
      WHERE i.id = inbox_aliases.inbox_id 
      AND (
        i.owner_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM inbox_members im WHERE im.inbox_id = i.id AND im.user_id = auth.uid())
      )
    )
  );

-- Insert policy: users can add aliases to their inboxes
CREATE POLICY "Users can insert aliases to their inboxes" ON inbox_aliases
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inboxes i 
      WHERE i.id = inbox_aliases.inbox_id 
      AND (
        i.owner_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM inbox_members im WHERE im.inbox_id = i.id AND im.user_id = auth.uid() AND im.role = 'admin')
      )
    )
  );

-- Update policy: users can update aliases of their inboxes
CREATE POLICY "Users can update aliases of their inboxes" ON inbox_aliases
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM inboxes i 
      WHERE i.id = inbox_aliases.inbox_id 
      AND (
        i.owner_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM inbox_members im WHERE im.inbox_id = i.id AND im.user_id = auth.uid() AND im.role = 'admin')
      )
    )
  );

-- Delete policy: users can delete aliases of their inboxes
CREATE POLICY "Users can delete aliases of their inboxes" ON inbox_aliases
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM inboxes i 
      WHERE i.id = inbox_aliases.inbox_id 
      AND (
        i.owner_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM inbox_members im WHERE im.inbox_id = i.id AND im.user_id = auth.uid() AND im.role = 'admin')
      )
    )
  );
