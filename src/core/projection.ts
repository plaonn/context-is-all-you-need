import {
  parseProjectMetadata,
  parseTaskMetadata,
  hasProjectContextMetadata,
  readDescriptionField
} from "./metadata.js";
import type {
  ProjectContextLane,
  ProjectContextNode,
  ProjectContextRootSummary,
  ProjectContextSnapshot,
  ProjectContextStatus,
  TodoistProjectContextSource,
  TodoistProjectContextTask
} from "./model.js";

const lifecycleLabels = new Map<string, ProjectContextStatus>([
  ["codex-now", "now"],
  ["codex-candidate", "later"],
  ["codex-managed", "later"],
  ["codex-blocked", "blocked"],
  ["codex-watching", "watching"]
]);

const noisePattern = /(?:maintenance|incident|evidence|coordination|cleanup|review|audit|intake)/i;

export function isProjectDashboardRoot(task: TodoistProjectContextTask): boolean {
  return task.parentId === null
    && (hasProjectContextMetadata(task.description) || task.content.trimStart().startsWith("* 🗂️"));
}

export function summarizeProjectContextRoot(root: TodoistProjectContextTask): ProjectContextRootSummary {
  const metadata = parseProjectMetadata(root.description);
  return {
    id: root.id,
    title: root.content,
    url: taskUrl(root.id),
    goal: metadata.goal,
    goalStatus: metadata.goal ? "configured" : "unconfigured"
  };
}

export function buildProjectContextSnapshot(source: TodoistProjectContextSource): ProjectContextSnapshot {
  const rootMetadata = parseProjectMetadata(source.root.description);
  const candidates = [
    ...source.activeTasks.map((task) => toCandidate(task, false)),
    ...source.completedTasks.map((task) => toCandidate(task, true))
  ];
  const referencedIds = new Set(candidates.flatMap(({ metadata }) => metadata.predecessorIds));
  const visible = candidates.filter(({ task, metadata, status }) =>
    shouldIncludeTask(task, metadata, status, referencedIds)
  );
  const registry = new Map(rootMetadata.workstreams.map((workstream) => [workstream.id, workstream.label]));
  for (const candidate of visible) {
    const id = candidate.metadata.workstreamId ?? "unclassified";
    if (!registry.has(id)) registry.set(id, id === "unclassified" ? "Unclassified" : id);
  }
  const lanes: ProjectContextLane[] = [...registry.keys()]
    .map((id) => ({
      id,
      label: registry.get(id)!,
      nodes: visible
        .filter(({ metadata }) => (metadata.workstreamId ?? "unclassified") === id)
        .sort(compareCandidates)
        .map(({ task, metadata, status }) => toNode(task, metadata, status))
    }))
    .filter((lane) => lane.nodes.length > 0);
  const nextCheckpoint = visible
    .filter(({ status }) => status === "now" || status === "blocked" || status === "watching")
    .map(({ metadata }) => metadata.checkpoint)
    .find((checkpoint): checkpoint is string => Boolean(checkpoint)) ?? null;
  return {
    schemaVersion: 1,
    id: source.root.id,
    title: source.root.content,
    url: taskUrl(source.root.id),
    goal: rootMetadata.goal,
    goalStatus: rootMetadata.goal ? "configured" : "unconfigured",
    lanes,
    nextCheckpoint,
    coverage: {
      ...source.coverage,
      activeTasksRead: source.activeTasks.length,
      completedTasksRead: source.completedTasks.length,
      visibleTasks: visible.length,
      suppressedTasks: candidates.length - visible.length
    }
  };
}

function taskUrl(id: string): string {
  return `https://app.todoist.com/app/task/${encodeURIComponent(id)}`;
}

function toCandidate(task: TodoistProjectContextTask, completed: boolean) {
  return { task, metadata: parseTaskMetadata(task.description), status: completed ? "done" as const : taskStatus(task) };
}

function toNode(
  task: TodoistProjectContextTask,
  metadata: ReturnType<typeof parseTaskMetadata>,
  status: ProjectContextStatus
): ProjectContextNode {
  return {
    id: task.id,
    title: task.content,
    url: taskUrl(task.id),
    workstreamId: metadata.workstreamId ?? "unclassified",
    summary: metadata.summary ?? task.content,
    checkpoint: metadata.checkpoint,
    predecessorIds: metadata.predecessorIds,
    status,
    completedAt: task.completedAt,
    blocker: status === "blocked" ? readDescriptionField(task.description, "Blocker") : null,
    resume: status === "watching" ? readDescriptionField(task.description, "Resume condition") : null
  };
}

function taskStatus(task: TodoistProjectContextTask): ProjectContextStatus {
  for (const label of task.labels) {
    const status = lifecycleLabels.get(label);
    if (status) return status;
  }
  return "later";
}

function shouldIncludeTask(
  task: TodoistProjectContextTask,
  metadata: ReturnType<typeof parseTaskMetadata>,
  status: ProjectContextStatus,
  referencedIds: ReadonlySet<string>
): boolean {
  if (referencedIds.has(task.id)) return true;
  if (status === "now" || status === "blocked" || status === "watching") return true;
  if (!metadata.workstreamId && !metadata.summary && !metadata.checkpoint) return false;
  const noiseText = `${task.content} ${task.labels.join(" ")}`;
  if (noisePattern.test(noiseText)) return false;
  return status !== "done" || Boolean(metadata.workstreamId);
}

function compareCandidates(
  left: ReturnType<typeof toCandidate>,
  right: ReturnType<typeof toCandidate>
): number {
  const ranks: Record<ProjectContextStatus, number> = { done: 0, now: 1, blocked: 2, watching: 3, later: 4 };
  return ranks[left.status] - ranks[right.status]
    || left.task.childOrder - right.task.childOrder
    || left.task.id.localeCompare(right.task.id);
}
