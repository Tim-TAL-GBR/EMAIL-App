-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ labels & email_labels – Ordner- und Label-Struktur                     │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE labels IS 'Definiert Ordner/Labels für ein Team.';

CREATE TABLE email_labels (
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (email_id, label_id)
);

COMMENT ON TABLE email_labels IS 'Verknüpft E-Mails mit Ordnern/Labels.';

-- Indexes
CREATE INDEX idx_labels_team_id ON labels(team_id);
CREATE INDEX idx_email_labels_label_id ON email_labels(label_id);

-- RLS für labels
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view labels"
    ON labels FOR SELECT
    TO authenticated
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can insert labels"
    ON labels FOR INSERT
    TO authenticated
    WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can update labels"
    ON labels FOR UPDATE
    TO authenticated
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can delete labels"
    ON labels FOR DELETE
    TO authenticated
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- RLS für email_labels
ALTER TABLE email_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email_labels if they can view the label"
    ON email_labels FOR SELECT
    TO authenticated
    USING (
        label_id IN (
            SELECT id FROM labels WHERE team_id IN (
                SELECT team_id FROM team_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert email_labels"
    ON email_labels FOR INSERT
    TO authenticated
    WITH CHECK (
        label_id IN (
            SELECT id FROM labels WHERE team_id IN (
                SELECT team_id FROM team_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete email_labels"
    ON email_labels FOR DELETE
    TO authenticated
    USING (
        label_id IN (
            SELECT id FROM labels WHERE team_id IN (
                SELECT team_id FROM team_members WHERE user_id = auth.uid()
            )
        )
    );

-- Echtzeit aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE labels;
ALTER PUBLICATION supabase_realtime ADD TABLE email_labels;
