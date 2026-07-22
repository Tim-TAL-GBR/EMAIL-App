import { supabase } from './lib/supabase';
async function test() {
  const { data, error } = await supabase.from('teams').select('*');
  console.log('Teams:', data);
  console.log('Error:', error);
}
test();
