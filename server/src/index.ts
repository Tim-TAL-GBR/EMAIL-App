import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import { createWebSocketGateway } from "./realtime/gateway.js";
import { mailManager } from "./mail/MailManager.js";
import { mailRouter } from "./routes/mail.routes.js";
import { inboxRouter } from "./routes/inbox.routes.js";
import { emailRouter } from "./routes/email.routes.js";
import { commentRouter } from "./routes/comment.routes.js";
import { templateRouter } from "./routes/template.routes.js";
import { pushRouter } from "./routes/push.routes.js";
import { teamRouter } from "./routes/team.routes.js";
import { shopifyRouter } from "./routes/shopify.routes.js";
import { startEmailWorker } from "./services/queue.service.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3001;

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());

/** Health-check endpoint – used by load-balancers & monitoring. */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// API Routes
app.use("/api/mail", mailRouter);
app.use("/api/inboxes", inboxRouter);
app.use("/api/emails", emailRouter);
app.use("/api/comments", commentRouter);
app.use("/api/templates", templateRouter);
app.use("/api/push", pushRouter);
app.use("/api/teams", teamRouter);
app.use("/api/shopify", shopifyRouter);

// ---------------------------------------------------------------------------
// HTTP + WebSocket Server
// ---------------------------------------------------------------------------

const server = createServer(app);
createWebSocketGateway(server);

server.listen(PORT, async () => {
  console.log(`[server] TeamMail realtime server listening on port ${PORT}`);
  
  // Start Email Worker (BullMQ)
  startEmailWorker();

  // Start IMAP Sync
  await mailManager.initialize();
});

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string) {
  console.log(`[server] Received ${signal} – shutting down gracefully…`);
  
  await mailManager.shutdown();
  
  server.close(() => {
    console.log("[server] HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
