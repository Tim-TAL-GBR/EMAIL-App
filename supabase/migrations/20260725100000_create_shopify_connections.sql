-- Create shopify_connections table
CREATE TABLE IF NOT EXISTS public.shopify_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    shop_domain TEXT NOT NULL,
    access_token TEXT NOT NULL,
    scopes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id)
);

-- Enable RLS
ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view shopify_connections for their teams
CREATE POLICY "Users can view shopify connections for their teams"
    ON public.shopify_connections
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.team_id = shopify_connections.team_id
            AND team_members.user_id = auth.uid()
        )
    );

-- Policy: Only team admins or owners can insert/update/delete connections
CREATE POLICY "Admins can manage shopify connections"
    ON public.shopify_connections
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.team_id = shopify_connections.team_id
            AND team_members.user_id = auth.uid()
            AND team_members.role IN ('owner', 'admin')
        )
    );

-- Add updated_at trigger
CREATE TRIGGER update_shopify_connections_updated_at
    BEFORE UPDATE ON public.shopify_connections
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Add publication for realtime (if needed in the future)
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopify_connections;
