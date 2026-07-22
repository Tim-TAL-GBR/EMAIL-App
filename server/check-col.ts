import "dotenv/config";
import { getSupabaseAdmin } from "./src/services/auth.service.js";

async function run() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('emails').select('id, last_activity_at').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
run();
