const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('http://localhost:54321', process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'); // wait I don't have the anon key easily available here.
