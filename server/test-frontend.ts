import "dotenv/config";
import { getSupabaseAdmin } from "./src/services/auth.service.js";
async function run() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('inboxes')
    .select('*, team:teams(id, name), inbox_members(role)')
    .order('name');
  console.log(JSON.stringify(data, null, 2));
}
run();
