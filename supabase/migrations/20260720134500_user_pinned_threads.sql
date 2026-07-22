-- Table for user-pinned threads
CREATE TABLE user_pinned_threads (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id text NOT NULL,
    subject text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, thread_id)
);

-- RLS Policies
ALTER TABLE user_pinned_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_pinned_threads_select" ON user_pinned_threads
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_pinned_threads_insert" ON user_pinned_threads
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_pinned_threads_delete" ON user_pinned_threads
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE user_pinned_threads;
