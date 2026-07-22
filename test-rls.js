const { createClient } = require('@supabase/supabase-js');
const url = 'http://localhost:54321';
const key = process.env.SUPABASE_ANON_KEY;
require('dotenv').config({path: 'server/.env'});
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY); // Or we can just log in as user

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test@teammail.dev',
    password: 'test123456'
  });
  if (authErr) {
    console.error("Auth error", authErr);
    return;
  }
  
  const userClient = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } }
  });
  
  const { data: emails, error } = await userClient.from('emails').select('*');
  console.log("Emails count:", emails?.length, error);
}
run();
