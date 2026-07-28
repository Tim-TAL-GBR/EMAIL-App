import { safeErrorMessage } from "../utils/errors.js";
import { Router } from "express";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { getSupabaseAdmin } from "../services/auth.service.js";

export const taskRouter: Router = Router();

taskRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// Helper: check if user is member of the task's team
// ---------------------------------------------------------------------------
async function canAccessTask(userId: string, taskId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data: task } = await supabase
    .from("tasks")
    .select("team_id, created_by")
    .eq("id", taskId)
    .single();

  if (!task) return false;

  // Private task: only creator can access
  if (!task.team_id) {
    return task.created_by === userId;
  }

  // Team task: must be team member
  const { data: member } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", task.team_id)
    .eq("user_id", userId)
    .single();

  return !!member;
}

// ---------------------------------------------------------------------------
// GET /api/tasks — List all tasks for the current user (global)
// ---------------------------------------------------------------------------
taskRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const supabase = getSupabaseAdmin();

    // Get all team IDs the user belongs to
    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId);

    const teamIds = (memberships || []).map((m) => m.team_id);

    // Fetch team tasks + private tasks (created by user)
    let query = supabase
      .from("tasks")
      .select(`
        *,
        assignee:assigned_to ( id, display_name, email ),
        creator:created_by ( id, display_name, email ),
        team:teams ( id, name ),
        task_comments ( id )
      `)
      .order("created_at", { ascending: false });

    if (teamIds.length > 0) {
      query = query.or(`team_id.in.(${teamIds.join(',')}),and(team_id.is.null,created_by.eq.${userId})`);
    } else {
      query = query.eq("created_by", userId).is("team_id", null);
    }

    const { data: tasks, error } = await query;

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    // Add comment_count to each task
    const tasksWithCount = (tasks || []).map((t: any) => ({
      ...t,
      comment_count: t.task_comments?.length || 0,
      task_comments: undefined,
    }));

    res.json({ tasks: tasksWithCount });
  } catch (err: any) {
    console.error("[TaskRoutes] GET / error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tasks/:id — Get single task with comments
// ---------------------------------------------------------------------------
taskRouter.get("/:taskId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { taskId } = req.params;

    const hasAccess = await canAccessTask(userId, taskId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this task" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:assigned_to ( id, display_name, email ),
        creator:created_by ( id, display_name, email ),
        team:teams ( id, name )
      `)
      .eq("id", taskId)
      .single();

    if (error || !task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Fetch comments
    const { data: comments } = await supabase
      .from("task_comments")
      .select("*, user:user_id ( id, display_name, email )")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    res.json({ task: { ...task, comments: comments || [] } });
  } catch (err: any) {
    console.error("[TaskRoutes] GET /:taskId error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks — Create task
// ---------------------------------------------------------------------------
taskRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { title, description, team_id, assigned_to, linked_email_id, due_date } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const supabase = getSupabaseAdmin();

    // Verify team membership if team_id is provided
    if (team_id) {
      const { data: member } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", team_id)
        .eq("user_id", userId)
        .single();

      if (!member) {
        res.status(403).json({ error: "You are not a member of this team" });
        return;
      }
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        team_id,
        created_by: userId,
        assigned_to: assigned_to || null,
        linked_email_id: linked_email_id || null,
        due_date: due_date || null,
      })
      .select(`
        *,
        assignee:assigned_to ( id, display_name, email ),
        creator:created_by ( id, display_name, email ),
        team:teams ( id, name )
      `)
      .single();

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ task });
  } catch (err: any) {
    console.error("[TaskRoutes] POST / error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id — Update task
// ---------------------------------------------------------------------------
taskRouter.patch("/:taskId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { taskId } = req.params;

    const hasAccess = await canAccessTask(userId, taskId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this task" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const updates: Record<string, any> = {};
    const allowed = ["title", "description", "status", "assigned_to", "due_date", "team_id"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key] === "" ? null : req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .select(`
        *,
        assignee:assigned_to ( id, display_name, email ),
        creator:created_by ( id, display_name, email ),
        team:teams ( id, name )
      `)
      .single();

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ task });
  } catch (err: any) {
    console.error("[TaskRoutes] PATCH /:taskId error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// ---------------------------------------------------------------------------
taskRouter.delete("/:taskId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { taskId } = req.params;

    const hasAccess = await canAccessTask(userId, taskId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this task" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[TaskRoutes] DELETE /:taskId error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/toggle-status
// ---------------------------------------------------------------------------
taskRouter.post("/:taskId/toggle-status", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { taskId } = req.params;

    const hasAccess = await canAccessTask(userId, taskId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this task" });
      return;
    }

    const supabase = getSupabaseAdmin();

    const { data: task } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .single();

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const newStatus = task.status === "open" ? "done" : "open";
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    console.error("[TaskRoutes] POST /:taskId/toggle-status error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/assign
// ---------------------------------------------------------------------------
taskRouter.post("/:taskId/assign", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { taskId } = req.params;
    const { assignedTo } = req.body;

    const hasAccess = await canAccessTask(userId, taskId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this task" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("tasks")
      .update({ assigned_to: assignedTo || null })
      .eq("id", taskId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[TaskRoutes] POST /:taskId/assign error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/comments
// ---------------------------------------------------------------------------
taskRouter.get("/:taskId/comments", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { taskId } = req.params;

    const hasAccess = await canAccessTask(userId, taskId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this task" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: comments, error } = await supabase
      .from("task_comments")
      .select("*, user:user_id ( id, display_name, email )")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ comments: comments || [] });
  } catch (err: any) {
    console.error("[TaskRoutes] GET /:taskId/comments error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/comments — Add comment
// ---------------------------------------------------------------------------
taskRouter.post("/:taskId/comments", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { taskId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    const hasAccess = await canAccessTask(userId, taskId);
    if (!hasAccess) {
      res.status(403).json({ error: "No access to this task" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: comment, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
        user_id: userId,
        content: content.trim(),
      })
      .select("*, user:user_id ( id, display_name, email )")
      .single();

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ comment });
  } catch (err: any) {
    console.error("[TaskRoutes] POST /:taskId/comments error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/comments/:commentId
// ---------------------------------------------------------------------------
taskRouter.delete("/comments/:commentId", async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { commentId } = req.params;

    const supabase = getSupabaseAdmin();

    // Fetch comment and verify ownership or admin
    const { data: comment } = await supabase
      .from("task_comments")
      .select("id, user_id, task_id")
      .eq("id", commentId)
      .single();

    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    if (comment.user_id !== userId) {
      // Check if user is team admin
      const { data: task } = await supabase
        .from("tasks")
        .select("team_id")
        .eq("id", comment.task_id)
        .single();

      if (task) {
        const { data: member } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", task.team_id)
          .eq("user_id", userId)
          .single();

        if (!member || !["owner", "admin"].includes(member.role)) {
          res.status(403).json({ error: "Can only delete your own comments" });
          return;
        }
      }
    }

    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      res.status(500).json({ error: safeErrorMessage(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[TaskRoutes] DELETE /comments/:commentId error:", err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
