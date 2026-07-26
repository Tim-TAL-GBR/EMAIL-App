-- Create RPC to test RLS
CREATE OR REPLACE FUNCTION test_user_emails(u_id UUID, e_id UUID)
RETURNS SETOF emails AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_id, 'role', 'authenticated')::text, true);
  
  RETURN QUERY SELECT * FROM emails WHERE id = e_id;
END;
$$ LANGUAGE plpgsql;
