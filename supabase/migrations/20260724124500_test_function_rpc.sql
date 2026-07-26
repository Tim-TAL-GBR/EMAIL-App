CREATE OR REPLACE FUNCTION test_rls_function(u_id UUID, e_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_id, 'role', 'authenticated')::text, true);
  
  RETURN user_has_email_access(e_id);
END;
$$ LANGUAGE plpgsql;
