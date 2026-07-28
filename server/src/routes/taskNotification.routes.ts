import { safeErrorMessage } from "../utils/errors.js";
import { Router } from "express";
import { getSupabaseAdmin } from "../services/auth.service.js";

export const taskNotificationRouter: Router = Router();

/**
 * POST /api/task-notifications/check
 * 
 * Cron-like endpoint: checks for tasks due within the next hour
 * and sends push notifications to assigned users.
 * 
 * Should be called periodically (e.g. every 15 minutes) by an external cron
 * or by the server itself via setInterval.
 */
taskNotificationRouter.post("/check", async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Find open tasks due within the next hour that haven't been notified yet
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, due_date, assigned_to, team_id")
      .eq("status", "open")
      .eq("notification_sent", false)
      .not("assigned_to", "is", null)
      .not("due_date", "is", null)
      .gte("due_date", now.toISOString())
      .lte("due_date", oneHourLater.toISOString());

    if (tasksError) {
      res.status(500).json({ error: safeErrorMessage(tasksError) });
      return;
    }

    if (!tasks || tasks.length === 0) {
      res.json({ checked: 0, sent: 0 });
      return;
    }

    let sentCount = 0;

    for (const task of tasks) {
      if (!task.assigned_to || !task.due_date) continue;

      // Get push tokens for the assigned user
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token, platform")
        .eq("user_id", task.assigned_to);

      if (!tokens || tokens.length === 0) continue;

      // Get team name for context
      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("id", task.team_id)
        .single();

      const dueTime = new Date(task.due_date).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Send push notification to all tokens for this user
      for (const pushToken of tokens) {
        try {
          if (pushToken.platform === "ios" || pushToken.platform === "macos") {
            // Expo Push Notification
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: pushToken.token,
                title: "Task fällig",
                body: `"${task.title}" ist um ${dueTime} fällig${team?.name ? ` (${team.name})` : ""}`,
                data: { taskId: task.id, type: "task_due" },
              }),
            });
          }
          sentCount++;
        } catch (pushErr) {
          console.error(`[TaskNotifications] Failed to send push to ${pushToken.token}:`, pushErr);
        }
      }

      // Mark as notified
      await supabase
        .from("tasks")
        .update({ notification_sent: true })
        .eq("id", task.id);
    }

    res.json({ checked: tasks.length, sent: sentCount });
  } catch (err: any) {
    console.error("[TaskNotifications] POST /check error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/**
 * POST /api/task-notifications/reset-daily
 * 
 * Resets notification_sent for all open tasks so they can be notified again.
 * Should be called once daily (e.g. at midnight).
 */
taskNotificationRouter.post("/reset-daily", async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("tasks")
      .update({ notification_sent: false })
      .eq("status", "open")
      .not("notification_sent", "is", null);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[TaskNotifications] POST /reset-daily error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
