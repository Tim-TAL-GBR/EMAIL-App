-- Add user_id to inbox_aliases for per-alias user assignment
ALTER TABLE inbox_aliases ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inbox_aliases_user_id ON inbox_aliases(user_id);
