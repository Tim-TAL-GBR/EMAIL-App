// import { syncAllInboxes } from "./services/cron.service.js";
import { startEmailWorker } from "./services/queue.service.js";

async function run() {
  console.log("Starting worker...");
  startEmailWorker();
  console.log("Running sync...");
  // await syncAllInboxes();
  console.log("Sync triggered. Waiting 5s for processing...");
  await new Promise(r => setTimeout(r, 5000));
  console.log("Done.");
  process.exit(0);
}

run();
