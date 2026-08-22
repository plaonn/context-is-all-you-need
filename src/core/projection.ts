import {
  parseProjectMetadata,
  parseTaskMetadata,
  parseTaskAttentionMetadata,
  hasProjectContextMetadata,
  readDescriptionField
} from "./metadata.js";
import type { TaskAttentionMetadata } from "./metadata.js";
import type {
  ProjectContextAttention,
  ProjectContextAttentionKind,
  ProjectContextAttentionSummary,
  ProjectContextBand,
  ProjectContextLane,
  ProjectContextLineageEdge,
  ProjectContextNode,
  ProjectContextObjective,
  ProjectContextObjectiveAttention,
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

export function buildProjectContextSnapshot(
  source: TodoistProjectContextSource,
  detailLevel: "compact" | "deep" = "deep"
): ProjectContextSnapshot {
  const rootMetadata = parseProjectMetadata(source.root.description);
  const candidates = [
    ...source.activeTasks.map((task) => toCandidate(task, false)),
    ...source.completedTasks.map((task) => toCandidate(task, true))
  ];
  const referencedIds = new Set(candidates.flatMap(({ metadata }) => metadata.predecessorIds));
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.task.id, candidate])).values()];
  const visible = uniqueCandidates.filter(({ task, metadata, status }) =>
    shouldIncludeTask(task, metadata, status, referencedIds)
  );
  const objectiveRegistry = new Map(rootMetadata.objectives.map((objective) => [objective.id, objective.label]));
  const nodes = visible
    .sort(compareCandidates)
    .map(({ task, metadata, status, attentionMetadata }) => toNode(task, metadata, status, attentionMetadata, objectiveRegistry));
  const registry = new Map(rootMetadata.workstreams.map((workstream) => [workstream.id, workstream.label]));
  for (const node of nodes) {
    const id = node.workstreamId;
    if (!registry.has(id)) registry.set(id, id === "unclassified" ? "Unclassified" : id);
  }
  const lanes: ProjectContextLane[] = [...registry.keys()]
    .map((id) => ({
      id,
      label: registry.get(id)!,
      nodes: nodes.filter((node) => node.workstreamId === id)
    }))
    .filter((lane) => lane.nodes.length > 0);
  const attentionCandidates = nodes
    .map((node, index) => node.attention ? { task: { id: node.id, content: node.title, childOrder: index }, attention: node.attention } : null)
    .filter((candidate): candidate is { task: { id: string; content: string; childOrder: number }; attention: ProjectContextAttention } => Boolean(candidate));
  const attention = summarizeAttention(attentionCandidates);
  const nextCheckpoint = nodes
    .filter(({ status }) => status === "now" || status === "blocked" || status === "watching")
    .map((node) => node.checkpoint)
    .find((checkpoint): checkpoint is string => Boolean(checkpoint)) ?? null;
  return {
    schemaVersion: 1,
    detailLevel,
    id: source.root.id,
    title: source.root.content,
    url: taskUrl(source.root.id),
    goal: rootMetadata.goal,
    goalStatus: rootMetadata.goal ? "configured" : "unconfigured",
    nodes,
    lanes,
    objectives: buildObjectives(rootMetadata.objectives, nodes),
    lineageEdges: buildLineageEdges(nodes),
    nextCheckpoint,
    attention,
    coverage: {
      ...source.coverage,
      activeTasksRead: source.activeTasks.length,
      completedTasksRead: source.completedTasks.length,
      visibleTasks: nodes.length,
      suppressedTasks: candidates.length - nodes.length
    }
  };
}

function taskUrl(id: string): string {
  return `https://app.todoist.com/app/task/${encodeURIComponent(id)}`;
}

function toCandidate(task: TodoistProjectContextTask, completed: boolean) {
  return {
    task,
    metadata: parseTaskMetadata(task.description),
    attentionMetadata: parseTaskAttentionMetadata(task.description),
    status: completed ? "done" as const : taskStatus(task)
  };
}

function toNode(
  task: TodoistProjectContextTask,
  metadata: ReturnType<typeof parseTaskMetadata>,
  status: ProjectContextStatus,
  attentionMetadata: TaskAttentionMetadata,
  objectiveRegistry: ReadonlyMap<string, string>
): ProjectContextNode {
  const objectiveId = metadata.objectiveId && objectiveRegistry.has(metadata.objectiveId) ? metadata.objectiveId : null;
  return {
    id: task.id,
    title: task.content,
    url: taskUrl(task.id),
    workstreamId: metadata.workstreamId ?? "unclassified",
    summary: metadata.summary ?? task.content,
    checkpoint: metadata.checkpoint,
    predecessorIds: metadata.predecessorIds,
    objectiveId,
    objectiveLabel: objectiveId ? objectiveRegistry.get(objectiveId) ?? null : null,
    contextBand: contextBandForStatus(status),
    status,
    completedAt: task.completedAt,
    blocker: status === "blocked" ? readDescriptionField(task.description, "Blocker") : null,
    resume: status === "watching" ? readDescriptionField(task.description, "Resume condition") : null,
    attention: toAttention(task, status, attentionMetadata)
  };
}

function contextBandForStatus(status: ProjectContextStatus): ProjectContextBand {
  if (status === "done") return "before";
  if (status === "later") return "after";
  return "now";
}

function buildLineageEdges(nodes: ProjectContextNode[]): ProjectContextLineageEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: ProjectContextLineageEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    for (const predecessorId of node.predecessorIds) {
      if (!nodeIds.has(predecessorId)) continue;
      const key = `${predecessorId}->${node.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: predecessorId, to: node.id });
    }
  }
  return edges;
}

function buildObjectives(
  definitions: Array<{ id: string; label: string }>,
  nodes: ProjectContextNode[]
): ProjectContextObjective[] {
  return definitions
    .map((definition) => {
      const members = nodes.filter((node) => node.objectiveId === definition.id);
      return {
        id: definition.id,
        label: definition.label,
        nodeIds: members.map((node) => node.id),
        attention: objectiveAttention(members)
      } satisfies ProjectContextObjective;
    })
    .filter((objective) => objective.nodeIds.length > 0);
}

function objectiveAttention(nodes: ProjectContextNode[]): ProjectContextObjectiveAttention {
  if (nodes.some((node) => node.attention?.salience === "high" || node.status === "blocked")) return "high";
  if (nodes.some((node) => node.attention?.salience === "low" || node.status === "watching")) return "low";
  if (nodes.some((node) => node.status === "now")) return "active";
  return "none";
}

function toAttention(
  task: TodoistProjectContextTask,
  status: ProjectContextStatus,
  metadata: TaskAttentionMetadata
): ProjectContextAttention | null {
  if (status === "done" || isResolvedOrObsolete(task.labels, metadata.disposition)) return null;

  const hasDecisionFields = Boolean(
    metadata.blockedOn
    || metadata.whyWorkerCannotDecide
    || metadata.decisionOwner
    || metadata.recommendation
    || metadata.alternatives
    || metadata.safeState
    || metadata.independentWork
    || metadata.evidence
  );
  // Keep routine maintenance/incident/evidence residue out of the attention
  // surface unless it carries an explicit bounded packet field.
  if (noisePattern.test(`${task.content} ${task.labels.join(" ")}`) && !hasDecisionFields) return null;
  let kind: ProjectContextAttentionKind;
  if (status === "blocked") {
    kind = "blocked";
  } else if (hasDecisionFields) {
    kind = "decision";
  } else if (status === "watching") {
    kind = "watching";
  } else {
    return null;
  }

  return {
    kind,
    salience: kind === "watching" ? "low" : "high",
    blockedOn: metadata.blockedOn,
    whyWorkerCannotDecide: metadata.whyWorkerCannotDecide,
    decisionOwner: metadata.decisionOwner,
    recommendation: metadata.recommendation,
    alternatives: metadata.alternatives,
    safeState: metadata.safeState,
    independentWork: metadata.independentWork,
    resumeCondition: metadata.resumeCondition,
    evidence: metadata.evidence
  };
}

function isResolvedOrObsolete(labels: string[], disposition: string | null): boolean {
  const terminalStates = new Set(["resolved", "obsolete", "superseded", "dismissed", "closed", "cancelled", "canceled"]);
  if (disposition && terminalStates.has(disposition)) return true;
  return labels.some((label) => terminalStates.has(label.trim().toLowerCase()));
}

function summarizeAttention(
  candidates: Array<{ task: { id: string; content: string; childOrder: number }; attention: ProjectContextAttention }>
): ProjectContextAttentionSummary | null {
  if (candidates.length === 0) return null;
  const ordered = [...candidates].sort((left, right) => attentionRank(left.attention.kind) - attentionRank(right.attention.kind)
    || left.task.childOrder - right.task.childOrder
    || left.task.id.localeCompare(right.task.id));
  const primary = ordered[0]!;
  const materialCount = candidates.filter(({ attention }) => attention.salience === "high").length;
  return {
    nodeId: primary.task.id,
    title: primary.task.content,
    url: taskUrl(primary.task.id),
    kind: primary.attention.kind,
    salience: primary.attention.salience,
    attentionCount: materialCount > 0 ? materialCount : candidates.length,
    blockedOn: primary.attention.blockedOn,
    whyWorkerCannotDecide: primary.attention.whyWorkerCannotDecide,
    decisionOwner: primary.attention.decisionOwner,
    recommendation: primary.attention.recommendation,
    resumeCondition: primary.attention.resumeCondition
  };
}

function attentionRank(kind: ProjectContextAttentionKind): number {
  return kind === "blocked" ? 0 : kind === "decision" ? 1 : 2;
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
  const bands: Record<ProjectContextBand, number> = { before: 0, now: 1, after: 2 };
  const ranks: Record<ProjectContextStatus, number> = { done: 0, now: 1, blocked: 2, watching: 3, later: 4 };
  return bands[contextBandForStatus(left.status)] - bands[contextBandForStatus(right.status)]
    || ranks[left.status] - ranks[right.status]
    || left.task.childOrder - right.task.childOrder
    || left.task.id.localeCompare(right.task.id);
}
