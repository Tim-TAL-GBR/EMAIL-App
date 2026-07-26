-- Create RPC to test RLS
CREATE OR REPLACE FUNCTION test_user_comments(u_id UUID, e_id UUID)
RETURNS SETOF internal_comments AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_id, 'role', 'authenticated')::text, true);
  
  RETURN QUERY SELECT * FROM internal_comments WHERE email_id = e_id;
END;
$$ LANGUAGE plpgsql;
