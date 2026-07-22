import "dotenv/config";
import { ImapClient } from "./src/mail/ImapClient.js";
import { getSupabaseAdmin } from "./src/services/auth.service.js";
import { startEmailWorker } from "./src/services/queue.service.js";

async function run() {
  console.log("Starting worker...");
  startEmailWorker();
  
  const supabase = getSupabaseAdmin();
  const { data: inboxes } = await supabase.from("inboxes").select("*").not("imap_host", "is", null);
  
  if (inboxes && inboxes.length > 0) {
    for (const inbox of inboxes) {
      console.log("Connecting IMAP for:", inbox.email_address);
      const client = new ImapClient({
        inboxId: inbox.id,
        teamId: inbox.team_id,
        host: inbox.imap_host,
        port: inbox.imap_port,
        user: inbox.imap_user,
        pass: inbox.imap_pass,
        secure: inbox.imap_secure !== false
      });
      
      await client.connect();
      console.log("Wait 10 seconds for sync...");
      await new Promise(r => setTimeout(r, 10000));
      await client.disconnect();
    }
    console.log("Done");
    process.exit(0);
  } else {
    console.log("Inbox not found");
    process.exit(1);
  }
}

run();
