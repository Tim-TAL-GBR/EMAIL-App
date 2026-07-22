import "dotenv/config";
import { getSupabaseAdmin } from "./src/services/auth.service.js";
async function run() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('emails').select('id, is_archived, is_deleted, status');
  const archived = data?.filter(e => e.is_archived).length;
  const deleted = data?.filter(e => e.is_deleted).length;
  console.log(`Total: ${data?.length}, Archived: ${archived}, Deleted: ${deleted}`);
}
run();
