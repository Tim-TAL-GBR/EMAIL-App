-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ notifications – Benachrichtigungen für Erwähnungen, Zuweisungen, etc.  │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('mention', 'assignment', 'system')),
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES internal_comments(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE notifications IS 'Speichert Benachrichtigungen für Nutzer (z.B. @Mentions, Zuweisungen).';

-- Indexes für Performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (true); -- Jeder darf Benachrichtigungen für andere erstellen (z.B. beim Erwähnen)

-- Echtzeit aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
