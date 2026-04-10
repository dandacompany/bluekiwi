import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { query, queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await verifySession(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const [
    workflowsCount,
    activeTasksCount,
    completedTasksCount,
    usersCount,
    recentActivity,
    activeTasks,
  ] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM workflows"),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) AS count FROM tasks WHERE status IN ('in_progress','pending')",
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) AS count FROM tasks WHERE status = 'completed'",
    ),
    queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM users"),
    query<{
      id: number;
      task_id: number;
      workflow_title: string;
      status: string;
      step_title: string;
      created_at: string;
    }>(
      `SELECT tl.id, tl.task_id,
              COALESCE(c.title, 'Workflow #' || t.workflow_id) AS workflow_title,
              tl.status, tl.node_title AS step_title, tl.started_at AS created_at
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       LEFT JOIN workflows c ON c.id = t.workflow_id
       ORDER BY tl.started_at DESC
       LIMIT 10`,
    ),
    query<{
      id: number;
      workflow_title: string;
      status: string;
      current_step: number;
      total_steps: number;
      current_node_type: string;
    }>(
      `SELECT t.id,
              COALESCE(c.title, 'Workflow #' || t.workflow_id) AS workflow_title,
              t.status,
              t.current_step,
              (SELECT COALESCE(MAX(cn.step_order), 1)
               FROM workflow_nodes cn WHERE cn.workflow_id = t.workflow_id) AS total_steps,
              COALESCE(
                (SELECT cn2.node_type FROM workflow_nodes cn2
                 WHERE cn2.workflow_id = t.workflow_id AND cn2.step_order = t.current_step
                 LIMIT 1),
                'action'
              ) AS current_node_type
       FROM tasks t
       LEFT JOIN workflows c ON c.id = t.workflow_id
       WHERE t.status IN ('in_progress','pending')
       ORDER BY t.updated_at DESC
       LIMIT 5`,
    ),
  ]);

  return NextResponse.json({
    stats: {
      workflows: Number(workflowsCount?.count ?? 0),
      activeTasks: Number(activeTasksCount?.count ?? 0),
      completedTasks: Number(completedTasksCount?.count ?? 0),
      teamMembers: Number(usersCount?.count ?? 0),
    },
    activeTasks,
    recentActivity,
  });
}
