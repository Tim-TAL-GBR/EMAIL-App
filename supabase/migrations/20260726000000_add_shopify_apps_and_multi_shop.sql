-- ===========================================================
-- 1. New table: shopify_apps – per-team app credentials
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.shopify_apps (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    api_key       TEXT NOT NULL,
    api_secret    TEXT NOT NULL,
    app_host_name TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id)
);

-- RLS
ALTER TABLE public.shopify_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view shopify app config"
    ON public.shopify_apps FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.team_id = shopify_apps.team_id
            AND team_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage shopify app config"
    ON public.shopify_apps FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.team_id = shopify_apps.team_id
            AND team_members.user_id = auth.uid()
            AND team_members.role IN ('owner', 'admin')
        )
    );

CREATE TRIGGER update_shopify_apps_updated_at
    BEFORE UPDATE ON public.shopify_apps
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.shopify_apps;

-- ===========================================================
-- 2. Multi-shop: replace UNIQUE(team_id) with UNIQUE(team_id, shop_domain)
-- ===========================================================
ALTER TABLE public.shopify_connections DROP CONSTRAINT IF EXISTS shopify_connections_team_id_key;
ALTER TABLE public.shopify_connections ADD CONSTRAINT shopify_connections_team_shop_key UNIQUE (team_id, shop_domain);
