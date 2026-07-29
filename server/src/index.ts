import "dotenv/config";

const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
import { userEmailSettingsRouter } from "./routes/userEmailSettings.routes.js";
import { taskRouter } from "./routes/task.routes.js";
import { taskNotificationRouter } from "./routes/taskNotification.routes.js";
import { userPreferencesRouter } from "./routes/userPreferences.routes.js";
import { aiRouter } from "./routes/ai.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { startEmailWorker } from "./services/queue.service.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3001;

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------

const app = express();

if (!process.env.FRONTEND_URL) {
  console.error("[server] FRONTEND_URL is not set");
}

const allowedOrigins = [
  process.env.FRONTEND_URL as string,
  "https://extensions.shopifycdn.com",
  "https://admin.shopify.com",
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.endsWith(o.replace('https://', ''))) || origin.includes('.myshopify.com')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow in dev; tighten in production if needed
    }
  },
  credentials: true,
}));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '2mb' }));

app.set('trust proxy', 1);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", limiter);

/** Health-check endpoint – used by load-balancers & monitoring. */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// API Routes
app.use("/api/ai", aiRouter);
app.use("/api/mail", mailRouter);
app.use("/api/inboxes", inboxRouter);
app.use("/api/emails", emailRouter);
app.use("/api/comments", commentRouter);
app.use("/api/templates", templateRouter);
app.use("/api/push", pushRouter);
app.use("/api/teams", teamRouter);
app.use("/api/shopify", shopifyRouter);
app.use("/api/user-email-settings", userEmailSettingsRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/task-notifications", taskNotificationRouter);
app.use("/api/user-preferences", userPreferencesRouter);
app.use("/api/admin", adminRouter);

// Global error handler — no stack traces in production
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] Unhandled error:", err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
  });
});

// ---------------------------------------------------------------------------
// HTTP + WebSocket Server
// ---------------------------------------------------------------------------

const server = createServer(app);
server.timeout = 30000;
server.keepAliveTimeout = 15000;
createWebSocketGateway(server);

let taskNotificationInterval: NodeJS.Timeout | undefined;
let dailyResetTimeout: NodeJS.Timeout | undefined;
let dailyResetInterval: NodeJS.Timeout | undefined;

server.listen(PORT, async () => {
  console.log(`[server] TeamMail realtime server listening on port ${PORT}`);
  
  // Start Email Worker (BullMQ)
  startEmailWorker();

  // Start IMAP Sync
  await mailManager.initialize();

  // Task due date notifications — check every 15 minutes
  taskNotificationInterval = setInterval(async () => {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/task-notifications/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.checked > 0) {
        console.log(`[TaskNotifications] Checked ${data.checked} tasks, sent ${data.sent} notifications`);
      }
    } catch (err) {
      console.error('[TaskNotifications] Cron check failed:', err);
    }
  }, 15 * 60 * 1000);

  // Daily reset of notification_sent flag at midnight
  const msUntilMidnight = (() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  })();
  dailyResetTimeout = setTimeout(() => {
    dailyResetInterval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:${PORT}/api/task-notifications/reset-daily`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        console.log('[TaskNotifications] Daily notification reset completed');
      } catch (err) {
        console.error('[TaskNotifications] Daily reset failed:', err);
      }
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
});

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string) {
  console.log(`[server] Received ${signal} – shutting down gracefully…`);
  
  if (taskNotificationInterval) clearInterval(taskNotificationInterval);
  if (dailyResetTimeout) clearTimeout(dailyResetTimeout);
  if (dailyResetInterval) clearInterval(dailyResetInterval);

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
