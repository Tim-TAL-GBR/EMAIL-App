-- =============================================================================
-- TeamMail – Migration: org_groups (Teams)
-- =============================================================================

CREATE TABLE org_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE org_group_members (
    group_id UUID NOT NULL REFERENCES org_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TRIGGER set_org_groups_updated_at
BEFORE UPDATE ON org_groups
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- RLS Policies
ALTER TABLE org_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_group_members ENABLE ROW LEVEL SECURITY;

-- org_groups policies
-- A user can view org_groups if they are a member of the parent team (organization)
CREATE POLICY "Users can view org_groups of their teams"
    ON org_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = org_groups.team_id
            AND team_members.user_id = auth.uid()
        )
    );

-- A user can create org_groups if they are admin/owner of the parent team
CREATE POLICY "Admins can create org_groups"
    ON org_groups FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = org_groups.team_id
            AND team_members.user_id = auth.uid()
            AND team_members.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can update org_groups"
    ON org_groups FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = org_groups.team_id
            AND team_members.user_id = auth.uid()
            AND team_members.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can delete org_groups"
    ON org_groups FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = org_groups.team_id
            AND team_members.user_id = auth.uid()
            AND team_members.role IN ('owner', 'admin')
        )
    );

-- org_group_members policies
-- A user can view org_group_members if they are in the parent team
CREATE POLICY "Users can view org_group_members of their teams"
    ON org_group_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM org_groups
            JOIN team_members ON team_members.team_id = org_groups.team_id
            WHERE org_groups.id = org_group_members.group_id
            AND team_members.user_id = auth.uid()
        )
    );

-- Admins can insert/update/delete group members
CREATE POLICY "Admins can insert org_group_members"
    ON org_group_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM org_groups
            JOIN team_members ON team_members.team_id = org_groups.team_id
            WHERE org_groups.id = org_group_members.group_id
            AND team_members.user_id = auth.uid()
            AND team_members.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can update org_group_members"
    ON org_group_members FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM org_groups
            JOIN team_members ON team_members.team_id = org_groups.team_id
            WHERE org_groups.id = org_group_members.group_id
            AND team_members.user_id = auth.uid()
            AND team_members.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can delete org_group_members"
    ON org_group_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM org_groups
            JOIN team_members ON team_members.team_id = org_groups.team_id
            WHERE org_groups.id = org_group_members.group_id
            AND team_members.user_id = auth.uid()
            AND team_members.role IN ('owner', 'admin')
        )
    );
