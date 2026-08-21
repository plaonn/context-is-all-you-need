import type { TodoistProjectContextSource, TodoistProjectContextTask } from "../src/core/model.js";

export function task(
  id: string,
  content: string,
  labels: string[],
  description: string,
  parentId: string | null = "root",
  completedAt: string | null = null
): TodoistProjectContextTask {
  return {
    id,
    content,
    description,
    labels,
    priority: 2,
    projectId: "project",
    sectionId: "section",
    parentId,
    childOrder: Number.parseInt(id.replace(/\D/g, ""), 10) || 1,
    completedAt,
    isDeleted: false
  };
}

export function fixtureSource(): TodoistProjectContextSource {
  return {
    root: task("root", "* 🗂️ Project Atlas", [], "Project context v1:\nProject Goal: Recover direction\nWorkstream registry:\n- strategy | Strategy\n- delivery | Delivery", null),
    activeTasks: [
      task("now", "Validate candidate", ["codex-now"], "Project context v1:\nWorkstream: strategy\nSummary: Compare evidence\nContext Predecessors: done\nCheckpoint: Disposition recorded"),
      task("blocked", "Resolve contract", ["codex-blocked"], "Project context v1:\nWorkstream: delivery\nSummary: Keep the adapter boundary\nBlocker: Receiver authority is missing"),
      task("watch", "Observe one cycle", ["codex-watching"], "Project context v1:\nWorkstream: delivery\nSummary: Wait for a real observation\nResume condition: One safe cycle is available"),
      task("later", "Prepare bounded plan", ["codex-candidate"], "Project context v1:\nWorkstream: strategy\nSummary: Keep plan ready but non-live"),
      task("noise", "maintenance evidence cleanup", ["codex-candidate", "incident-intake"], "Project context v1:\nWorkstream: delivery\nSummary: Coordination residue"),
      task("loose", "No metadata", ["codex-candidate"], "ordinary description")
    ],
    completedTasks: [
      task("done", "Record accepted boundary", [], "Project context v1:\nWorkstream: strategy\nSummary: Boundary recorded", "root", "2026-08-20T00:00:00.000Z"),
      task("old-noise", "maintenance audit evidence", [], "Project context v1:\nWorkstream: delivery\nSummary: Noise", "root", "2026-08-19T00:00:00.000Z")
    ],
    coverage: {
      activePagesFetched: 1,
      completedPagesFetched: 1,
      activeTruncated: false,
      completedTruncated: false,
      completedSince: "2026-05-23T00:00:00.000Z",
      completedUntil: "2026-08-21T00:00:00.000Z"
    }
  };
}
