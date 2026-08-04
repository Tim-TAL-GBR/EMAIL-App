-- =============================================================================
-- Migration: Add Subscriptions and Billing History
-- =============================================================================

-- 1. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'trialing',
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_org_id_key UNIQUE (org_id)
);

-- 2. Create billing_history table
CREATE TABLE IF NOT EXISTS public.billing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT,
    amount_paid INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'eur',
    status TEXT NOT NULL,
    invoice_pdf TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Trigger for updated_at
CREATE TRIGGER set_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for subscriptions
-- Users can read subscriptions for orgs they are members of
CREATE POLICY subscriptions_select ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.team_id = subscriptions.org_id
              AND team_members.user_id = (SELECT auth.uid())
        )
    );

-- Only service role (backend) can insert/update/delete subscriptions
-- Stripe webhooks will manage these via service_role

-- 6. RLS Policies for billing_history
-- Only org owners/admins can read billing history
CREATE POLICY billing_history_select ON public.billing_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.team_id = billing_history.org_id
              AND team_members.user_id = (SELECT auth.uid())
              AND team_members.role IN ('owner', 'admin')
        )
    );
