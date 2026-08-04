-- Grant permissions for custom_roles so RLS can take effect
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;
GRANT SELECT ON public.custom_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO service_role;
