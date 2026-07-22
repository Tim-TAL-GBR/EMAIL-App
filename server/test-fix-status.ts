import "dotenv/config";
import { getSupabaseAdmin } from "./src/services/auth.service.js";
async function run() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('emails')
    .update({ status: 'open' })
    .eq('status', 'done');
  console.log("Updated emails back to open!");
}
run();
