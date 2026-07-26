-- RPC to get all policies for internal_comments
CREATE OR REPLACE FUNCTION get_internal_comments_policies()
RETURNS TABLE (
    policyname text,
    permissive text,
    roles text[],
    cmd text,
    qual text,
    with_check text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.policyname::text, 
        p.permissive::text, 
        p.roles::text[], 
        p.cmd::text, 
        p.qual::text, 
        p.with_check::text
    FROM pg_policies p
    WHERE p.tablename = 'internal_comments';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
