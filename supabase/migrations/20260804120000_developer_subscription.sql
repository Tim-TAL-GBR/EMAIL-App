-- =============================================================================
-- Migration: Add Developer Subscription Support
-- =============================================================================

-- 1. Add is_developer flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_developer BOOLEAN DEFAULT false;

-- 2. Create RPC to grant developer status and infinite quotas
CREATE OR REPLACE FUNCTION public.set_developer_status(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    dev_user_id UUID;
    dev_team_id UUID;
BEGIN
    -- Find user in auth.users
    SELECT id INTO dev_user_id FROM auth.users WHERE email = user_email;
    IF dev_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;

    -- Set profile to developer
    UPDATE public.profiles SET is_developer = true WHERE id = dev_user_id;

    -- Upgrade all teams where the user is a member (or owner) to lifetime 'pro' plan
    FOR dev_team_id IN 
        SELECT team_id FROM public.team_members WHERE user_id = dev_user_id
    LOOP
        INSERT INTO public.subscriptions (org_id, plan, status, current_period_end)
        VALUES (dev_team_id, 'pro', 'active', '2099-12-31 23:59:59+00')
        ON CONFLICT (org_id) DO UPDATE 
        SET plan = 'pro', status = 'active', current_period_end = '2099-12-31 23:59:59+00';
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.set_developer_status IS 'Grants a user developer status and sets all their organizations to a lifetime Pro subscription.';
