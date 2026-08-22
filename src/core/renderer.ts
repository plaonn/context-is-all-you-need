import type {
  ProjectContextBoardProjection,
  ProjectContextBoardProject,
  ProjectContextContext,
  ProjectContextFreshness,
  ProjectContextLineageEdge,
  ProjectContextNode,
  ProjectContextObjective,
  ProjectContextRootSummary,
  ProjectContextSelectionProjection,
  ProjectContextSnapshot,
  ProjectContextStatus
} from "./model.js";

const STATUS_LABEL: Record<ProjectContextStatus, string> = {
  now: "Now",
  later: "Later",
  blocked: "Blocked",
  watching: "Watching",
  done: "Done"
};

const NODE_HEIGHT = 74;
const ROW_STEP = 96;
const TOP_PADDING = 30;
const BOTTOM_PADDING = 30;
const MAX_CONTEXT_DEPTH = 4;

type GraphPosition = {
  x: number;
  y: number;
  width: number;
  row: number;
  band: ProjectContextNode["contextBand"];
};

type GraphObjectiveFrame = {
  objective: ProjectContextObjective;
  left: number;
  top: number;
  width: number;
  height: number;
};

type ProjectGraphLayout = {
  positions: Map<string, GraphPosition>;
  objectives: GraphObjectiveFrame[];
};

type ContextGraphPlaneLayout = {
  height: number;
  nowY: number;
  projects: Map<string, ProjectGraphLayout>;
};

export function renderSelection(selection: ProjectContextSelectionProjection): string {
  return [
    renderProjectNavigation(selection),
    renderSnapshot(selection.snapshot),
    renderFreshness(selection.freshness.discovery, selection.freshness.snapshot, selection.discoveryCoverage)
  ].join("");
}

export function renderError(message: string): string {
  return `<section class="message message-error" role="alert"><strong>Context unavailable</strong><p>${escapeHtml(message)}</p></section>`;
}

export function renderBoard(
  board: ProjectContextBoardProjection,
  contexts: ProjectContextContext[],
  expandedProjectIds: ReadonlySet<string> = new Set()
): string {
  const contextOptions = contexts.map((context) => `<option value="${escapeAttr(context.localKey)}"${context.localKey === board.context.localKey ? " selected" : ""}>${escapeHtml(context.label)}</option>`).join("");
  const projectCount = board.projects.length;
  const failedCount = board.projects.filter((project) => project.error).length;
  return `<section class="context-toolbar">
    <label for="context-select">Context</label>
    <select id="context-select">${contextOptions}</select>
    <span class="context-boundary">${projectCount} project${projectCount === 1 ? "" : "s"} in selected context</span>
  </section>
  <section class="board-intro">
    <div>
      <p class="eyebrow">CONTEXT BOARD · READ ONLY</p>
      <h1>${escapeHtml(board.context.label)}</h1>
      <p>One shared graph plane keeps parallel projects readable around the present; explicit objectives and Context Predecessors remain presentation-only.</p>
    </div>
    <div class="board-summary" aria-label="Context summary">
      <strong>${projectCount}</strong><span>projects</span>
      ${failedCount > 0 ? `<strong class="summary-alert">${failedCount}</strong><span>partial reads</span>` : ""}
    </div>
  </section>
  <section class="project-matrix" aria-label="Projects in ${escapeAttr(board.context.label)}">
    <div class="matrix-scroll">
      ${projectCount > 0 ? renderContextGraphPlane(board.projects, expandedProjectIds, true) : `<section class="message"><p>No project dashboard roots were found in this Context's bounded source window.</p></section>`}
    </div>
  </section>
  ${renderBoardFreshness(board)}
  <p class="lineage-note">The plane is a read-only context projection. Objective regions and explicit Context Predecessors never become Todoist dependency, execution, approval, or completion authority.</p>`;
}

export function renderContextSettings(contexts: ProjectContextContext[], selectedContextKey: string | null): string {
  const rows = contexts.map((context) => `<li class="context-row" data-context-key="${escapeAttr(context.localKey)}">
    <div><strong>${escapeHtml(context.label)}</strong><span>Section ${escapeHtml(context.sectionId)}</span></div>
    <div class="context-row-actions">
      <button type="button" data-context-edit="${escapeAttr(context.localKey)}">Edit</button>
      <button type="button" data-context-remove="${escapeAttr(context.localKey)}" class="danger">Remove</button>
    </div>
  </li>`).join("");
  return `<div class="settings-copy">
    <p><strong>Contexts:</strong> local presentation mappings only. Adding, editing, selecting, and removing them never writes to Todoist.</p>
    <p>Selected: <strong>${escapeHtml(contexts.find((context) => context.localKey === selectedContextKey)?.label ?? "none")}</strong></p>
  </div>
  <form id="context-settings-form" class="context-form">
    <input id="context-edit-key" type="hidden" value="">
    <label for="context-label-input">Context label</label>
    <input id="context-label-input" name="context-label" autocomplete="off" maxlength="120" placeholder="Work or Personal" required>
    <label for="context-section-input">Todoist section ID</label>
    <input id="context-section-input" name="context-section" autocomplete="off" maxlength="200" placeholder="section id" required>
    <div class="context-form-actions"><button id="context-save" type="submit" class="primary">Add context</button><button id="context-cancel" type="button" hidden>Cancel edit</button></div>
  </form>
  <ul class="context-list">${rows || `<li class="context-empty">No Context mappings yet.</li>`}</ul>`;
}

function renderContextGraphPlane(
  projects: ProjectContextBoardProject[],
  expandedProjectIds: ReadonlySet<string>,
  showExpandControls: boolean
): string {
  const layout = buildContextGraphPlane(projects);
  const headers = projects.map((project) => renderGraphProjectHeader(project)).join("");
  const canvases = projects.map((project) => {
    const projectLayout = layout.projects.get(project.root.id);
    return renderGraphProjectCanvas(project, projectLayout, layout.height, layout.nowY);
  }).join("");
  const footers = projects.map((project) => renderGraphProjectFooter(
    project,
    expandedProjectIds.has(project.root.id),
    showExpandControls
  )).join("");
  return `<section class="context-graph-plane" data-layout-model="unified-context-graph-plane" data-project-count="${projects.length}" data-plane-height="${layout.height}">
    <div class="graph-plane-legend" aria-label="Graph orientation"><span class="graph-axis-past">PAST</span><span>Semantic context depth above and below one shared <strong>NOW</strong> rule · horizontal scrolling preserves the project axis</span><span class="graph-axis-next">NEXT</span></div>
    <div class="graph-plane-row graph-plane-header-row">${headers}</div>
    <div class="graph-plane-stage" style="--plane-height: ${layout.height}px; --now-y: ${layout.nowY}px">
      <div class="graph-plane-now-rule" data-shared-axis="now" aria-label="Shared NOW axis"><span>NOW</span></div>
      <div class="graph-plane-row graph-plane-canvas-row">${canvases}</div>
    </div>
    <div class="graph-plane-row graph-plane-footer-row">${footers}</div>
  </section>`;
}

function renderGraphProjectHeader(project: ProjectContextBoardProject): string {
  const snapshot = project.snapshot;
  if (!snapshot) {
    return `<header class="graph-project-header graph-project-header-error" data-project-header="${escapeAttr(project.root.id)}">
      <div class="graph-project-title"><h2>${escapeHtml(project.root.title)}</h2><span class="graph-project-error">Partial read</span></div>
      <span class="graph-project-status">Unavailable</span>
    </header>`;
  }
  const counts = countStatuses(snapshot);
  const focus = primaryStatus(counts);
  const attention = snapshot.attention;
  const attentionLabel = attention ? attention.kind === "watching" ? "Watching" : attention.kind === "decision" ? "Decision" : "Blocked" : null;
  return `<header class="graph-project-header" data-project-header="${escapeAttr(snapshot.id)}">
    <div class="graph-project-title"><h2 title="${escapeAttr(snapshot.title)}">${escapeHtml(snapshot.title)}</h2>${snapshot.goal ? `<p class="graph-project-goal" title="${escapeAttr(snapshot.goal)}">${escapeHtml(snapshot.goal)}</p>` : ""}</div>
    <div class="graph-project-meta" aria-label="${escapeAttr(snapshot.title)} summary">
      ${focus ? `<span class="lane-focus lane-focus-${escapeAttr(focus)}">${STATUS_LABEL[focus]}</span>` : `<span class="lane-focus lane-focus-idle">Idle</span>`}
      ${attentionLabel && attention ? `<span class="lane-attention lane-attention-${attention.salience}">${attentionLabel}</span>` : ""}
      ${renderStatusCount(counts, "now")}${renderStatusCount(counts, "blocked")}${renderStatusCount(counts, "watching")}${renderStatusCount(counts, "later")}${renderStatusCount(counts, "done")}
    </div>
  </header>`;
}

function renderGraphProjectCanvas(
  project: ProjectContextBoardProject,
  layout: ProjectGraphLayout | undefined,
  planeHeight: number,
  nowY: number
): string {
  const snapshot = project.snapshot;
  if (!snapshot || !layout) {
    return `<div class="graph-lane-canvas graph-lane-canvas-error" data-project-id="${escapeAttr(project.root.id)}" style="--plane-height: ${planeHeight}px; --now-y: ${nowY}px"><span class="graph-lane-marker graph-lane-marker-error">Project read unavailable</span></div>`;
  }
  if (snapshot.nodes.length === 0) {
    return `<div class="graph-lane-canvas graph-lane-canvas-idle" data-project-id="${escapeAttr(snapshot.id)}" style="--plane-height: ${planeHeight}px; --now-y: ${nowY}px"><span class="graph-lane-marker" data-idle-marker="true">— quiet near NOW</span></div>`;
  }
  const nodeMap = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const edgePaths = snapshot.lineageEdges
    .map((edge) => renderGraphEdgePath(edge, layout, snapshot))
    .join("");
  const objectiveRegions = layout.objectives.map((frame) => renderGraphObjective(frame)).join("");
  const nodes = snapshot.nodes
    .map((node) => {
      const position = layout.positions.get(node.id);
      return position ? renderGraphNode(node, nodeMap, position) : "";
    })
    .join("");
  return `<div class="graph-lane-canvas" data-project-id="${escapeAttr(snapshot.id)}" style="--plane-height: ${planeHeight}px; --now-y: ${nowY}px">
    <svg class="graph-edge-layer" viewBox="0 0 100 ${planeHeight}" preserveAspectRatio="none" aria-hidden="true" data-lineage-source="Context Predecessors">${edgePaths}</svg>
    ${objectiveRegions}
    <div class="graph-lane-nodes">${nodes}</div>
  </div>`;
}

function renderGraphProjectFooter(project: ProjectContextBoardProject, expanded: boolean, showExpandControls: boolean): string {
  const snapshot = project.snapshot;
  const detail = expanded && project.detail
    ? renderExpandedProject(project.detail)
    : expanded
      ? `<div class="project-detail project-detail-loading"><p>Loading bounded project history and details…</p></div>`
      : "";
  return `<footer class="graph-project-footer" data-project-footer="${escapeAttr(project.root.id)}">
    ${snapshot ? renderLineageEdges(snapshot) : ""}
    ${showExpandControls && snapshot ? `<div class="project-card-actions"><button type="button" data-project-expand="${escapeAttr(snapshot.id)}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "Hide history & details" : project.detail ? "Show history & details" : "Load history & details"}</button>${project.error ? `<span class="project-error-inline">Some reads are stale or unavailable.</span>` : ""}</div>` : ""}
    ${detail}
  </footer>`;
}

function buildContextGraphPlane(projects: ProjectContextBoardProject[]): ContextGraphPlaneLayout {
  const snapshots = projects.map((project) => project.snapshot).filter((snapshot): snapshot is ProjectContextSnapshot => Boolean(snapshot));
  const beforeRows = Math.max(0, ...snapshots.map((snapshot) => boundedBandRows(snapshot, "before")));
  const afterRows = Math.max(0, ...snapshots.map((snapshot) => boundedBandRows(snapshot, "after")));
  const nowTop = TOP_PADDING + beforeRows * ROW_STEP;
  const nowY = nowTop + NODE_HEIGHT / 2;
  const height = nowTop + NODE_HEIGHT + afterRows * ROW_STEP + BOTTOM_PADDING;
  const projectLayouts = new Map<string, ProjectGraphLayout>();
  for (const project of projects) {
    if (project.snapshot) projectLayouts.set(project.root.id, buildProjectGraphLayout(project.snapshot, beforeRows, afterRows));
  }
  return { height, nowY, projects: projectLayouts };
}

function buildProjectGraphLayout(snapshot: ProjectContextSnapshot, beforeRows: number, afterRows: number): ProjectGraphLayout {
  const positions = new Map<string, GraphPosition>();
  const nodesByRow = new Map<string, ProjectContextNode[]>();
  const bands: Array<ProjectContextNode["contextBand"]> = ["before", "now", "after"];
  for (const band of bands) {
    const nodes = snapshot.nodes.filter((node) => node.contextBand === band);
    const rowCount = band === "before" ? beforeRows : band === "after" ? afterRows : 1;
    const rowById = band === "now" ? new Map(nodes.map((node) => [node.id, 0])) : assignBoundedRows(nodes, snapshot.lineageEdges, Math.max(1, rowCount));
    for (const node of nodes) {
      const row = rowById.get(node.id) ?? 0;
      const y = band === "before"
        ? TOP_PADDING + (beforeRows - row - 1) * ROW_STEP
        : band === "after"
        ? TOP_PADDING + beforeRows * ROW_STEP + (row + 1) * ROW_STEP
          : TOP_PADDING + beforeRows * ROW_STEP;
      const key = `${band}:${row}`;
      nodesByRow.set(key, [...(nodesByRow.get(key) ?? []), node]);
      positions.set(node.id, { x: 50, y, width: 24, row, band });
    }
  }
  for (const nodes of nodesByRow.values()) {
    const width = Math.max(18, Math.min(58, 84 / nodes.length));
    nodes.forEach((node, index) => {
      const position = positions.get(node.id);
      if (!position) return;
      positions.set(node.id, { ...position, x: ((index + 1) / (nodes.length + 1)) * 100, width });
    });
  }
  const objectives = snapshot.objectives.flatMap((objective) => {
    const members = objective.nodeIds.map((id) => positions.get(id)).filter((position): position is GraphPosition => Boolean(position));
    if (members.length === 0) return [];
    const minX = Math.min(...members.map((position) => position.x - position.width / 2));
    const maxX = Math.max(...members.map((position) => position.x + position.width / 2));
    const center = (minX + maxX) / 2;
    const paddedWidth = Math.max(24, maxX - minX + 6);
    const left = Math.max(1, Math.min(99 - paddedWidth, center - paddedWidth / 2));
    const top = Math.max(4, Math.min(...members.map((position) => position.y)) - 8);
    const bottom = Math.max(...members.map((position) => position.y + NODE_HEIGHT)) + 8;
    return [{ objective, left, top, width: Math.min(98, paddedWidth), height: bottom - top }];
  });
  return { positions, objectives };
}

function boundedBandRows(snapshot: ProjectContextSnapshot, band: ProjectContextNode["contextBand"]): number {
  const count = snapshot.nodes.filter((node) => node.contextBand === band).length;
  return Math.min(MAX_CONTEXT_DEPTH, count);
}

function assignBoundedRows(
  nodes: ProjectContextNode[],
  edges: ProjectContextLineageEdge[],
  rowCount: number
): Map<string, number> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
  }
  const remaining = new Set(nodes.map((node) => node.id));
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const next = nodes.find((node) => remaining.has(node.id) && (incoming.get(node.id) ?? []).every((id) => !remaining.has(id)))
      ?? nodes.find((node) => remaining.has(node.id));
    if (!next) break;
    ordered.push(next.id);
    remaining.delete(next.id);
  }
  const rows = new Map<string, number>();
  for (const [index, id] of ordered.entries()) {
    const predecessorRows = (incoming.get(id) ?? []).map((predecessor) => rows.get(predecessor)).filter((row): row is number => row !== undefined);
    const naturalRow = predecessorRows.length > 0 ? Math.max(...predecessorRows) + 1 : index;
    rows.set(id, Math.min(rowCount - 1, naturalRow));
  }
  return rows;
}

function renderGraphObjective(frame: GraphObjectiveFrame): string {
  const objective = frame.objective;
  return `<section class="graph-objective-region objective-${escapeAttr(objective.attention)}" data-objective-id="${escapeAttr(objective.id)}" style="left: ${frame.left}%; top: ${frame.top}px; width: ${frame.width}%; height: ${frame.height}px" aria-label="Objective ${escapeAttr(objective.label)}; presentation grouping only">
    <span class="graph-objective-label"><span>OBJECTIVE</span><strong>${escapeHtml(objective.label)}</strong></span>
  </section>`;
}

function renderGraphNode(node: ProjectContextNode, nodes: ReadonlyMap<string, ProjectContextNode>, position: GraphPosition): string {
  const objective = node.objectiveLabel ? `<span class="node-objective">${escapeHtml(node.objectiveLabel)}</span>` : "";
  const ungrouped = node.objectiveId ? "" : " graph-node-ungrouped";
  const recovery = node.attention ? renderNodeAttention(node.attention) : "";
  const checkpoint = node.checkpoint ? `<span class="map-node-next">${escapeHtml(node.checkpoint)}</span>` : "";
  const predecessorCount = node.predecessorIds.filter((id) => nodes.has(id)).length;
  return `<article class="graph-node graph-node-${escapeAttr(node.status)}${ungrouped}" data-node-id="${escapeAttr(node.id)}" data-status="${escapeAttr(node.status)}" data-context-band="${escapeAttr(node.contextBand)}" data-objective-state="${node.objectiveId ? "registered" : "ungrouped"}" data-graph-row="${position.row}" data-graph-x="${position.x}" style="left: ${position.x}%; top: ${position.y}px; width: ${position.width}%" aria-label="${escapeAttr(`${STATUS_LABEL[node.status]}: ${node.title}`)}">
    <div class="node-top"><span class="status status-${escapeAttr(node.status)}">${STATUS_LABEL[node.status]}</span>${objective}</div>
    <a class="map-node-title" href="${escapeAttr(node.url)}" target="_blank" rel="noreferrer">${escapeHtml(node.title)} ↗</a>
    <p class="node-summary" title="${escapeAttr(node.summary)}">${escapeHtml(node.summary)}</p>
    ${recovery}${checkpoint}${predecessorCount > 0 ? `<span class="map-node-lineage">${predecessorCount} explicit predecessor${predecessorCount === 1 ? "" : "s"}</span>` : ""}
  </article>`;
}

function renderNodeAttention(attention: NonNullable<ProjectContextNode["attention"]>): string {
  const low = attention.salience === "low";
  const label = attention.kind === "watching" ? "Watching" : attention.kind === "decision" ? "Decision" : "Blocked";
  const next = attention.recommendation ?? attention.resumeCondition;
  return `<div class="node-attention node-attention-${low ? "low" : "high"}" data-attention="${escapeAttr(attention.kind)}"><strong>${low ? "Watching" : "Material attention"}</strong><span>${label}</span>${attention.blockedOn ? `<span><b>Where:</b> ${escapeHtml(attention.blockedOn)}</span>` : ""}${attention.decisionOwner ? `<span><b>Decision owner:</b> ${escapeHtml(attention.decisionOwner)}</span>` : ""}${next ? `<span><b>${low ? "Resume" : "Next"}:</b> ${escapeHtml(next)}</span>` : ""}</div>`;
}

function renderGraphEdgePath(edge: ProjectContextLineageEdge, layout: ProjectGraphLayout, snapshot: ProjectContextSnapshot): string {
  const source = layout.positions.get(edge.from);
  const target = layout.positions.get(edge.to);
  // An edge is drawable only when both explicit endpoints are in this one
  // bounded project graph. There is deliberately no arbitrary fallback point.
  if (!source || !target) return "";
  const outgoing = snapshot.lineageEdges.filter((candidate) => candidate.from === edge.from).length;
  const incoming = snapshot.lineageEdges.filter((candidate) => candidate.to === edge.to).length;
  const branch = outgoing > 1;
  const merge = incoming > 1;
  const kind = [branch ? "branch" : "", merge ? "merge" : ""].filter(Boolean).join("-") || "link";
  const sameRow = Math.abs(source.y - target.y) < 2;
  const sourceX = source.x;
  const targetX = target.x;
  let path: string;
  if (sameRow) {
    const centerY = source.y + NODE_HEIGHT / 2;
    const bendY = centerY + 26;
    path = `M ${sourceX} ${centerY} C ${sourceX} ${bendY}, ${targetX} ${bendY}, ${targetX} ${centerY}`;
  } else if (target.y > source.y) {
    const fromY = source.y + NODE_HEIGHT;
    const toY = target.y;
    const curve = Math.max(16, (toY - fromY) * .42);
    path = `M ${sourceX} ${fromY} C ${sourceX} ${fromY + curve}, ${targetX} ${toY - curve}, ${targetX} ${toY}`;
  } else {
    const fromY = source.y;
    const toY = target.y + NODE_HEIGHT;
    const curve = Math.max(16, (fromY - toY) * .42);
    path = `M ${sourceX} ${fromY} C ${sourceX} ${fromY - curve}, ${targetX} ${toY + curve}, ${targetX} ${toY}`;
  }
  return `<path class="graph-edge-path graph-edge-${kind}" data-edge-from="${escapeAttr(edge.from)}" data-edge-to="${escapeAttr(edge.to)}" d="${path}" vector-effect="non-scaling-stroke"/>`;
}

function renderLineageEdges(snapshot: ProjectContextSnapshot): string {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const edge of snapshot.lineageEdges) {
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  const edges = snapshot.lineageEdges.map((edge) => renderLineageEdge(edge, nodes, outgoing, incoming)).join("");
  if (!edges) return "";
  return `<details class="explicit-lineage" aria-label="Accessible explicit contextual lineage"><summary><strong>Explicit lineage</strong><span>Context Predecessors only · presentation-only</span></summary><ul class="lineage-edge-list">${edges}</ul></details>`;
}

function renderLineageEdge(
  edge: ProjectContextLineageEdge,
  nodes: ReadonlyMap<string, ProjectContextNode>,
  outgoing: ReadonlyMap<string, number>,
  incoming: ReadonlyMap<string, number>
): string {
  const branch = (outgoing.get(edge.from) ?? 0) > 1;
  const merge = (incoming.get(edge.to) ?? 0) > 1;
  const kind = [branch ? "branch" : "", merge ? "merge" : ""].filter(Boolean).join("-") || "link";
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  return `<li class="lineage-edge lineage-edge-${kind}" data-edge-from="${escapeAttr(edge.from)}" data-edge-to="${escapeAttr(edge.to)}"><span class="lineage-edge-kind">${branch ? "Branch" : merge ? "Merge" : "Link"}</span><a href="${escapeAttr(from?.url ?? taskUrl(edge.from))}" target="_blank" rel="noreferrer">${escapeHtml(from?.title ?? edge.from)}</a><span aria-hidden="true">→</span><a href="${escapeAttr(to?.url ?? taskUrl(edge.to))}" target="_blank" rel="noreferrer">${escapeHtml(to?.title ?? edge.to)}</a></li>`;
}

function renderExpandedProject(snapshot: ProjectContextSnapshot): string {
  const nodeMap = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return `<div class="project-detail"><div class="detail-heading"><strong>Bounded deep detail</strong><span>${snapshot.coverage.completedTasksRead} recent completed tasks read · ${snapshot.coverage.completedTruncated ? "window truncated" : "window complete"}</span></div>${renderLineageEdges(snapshot)}<div class="detail-nodes">${snapshot.nodes.map((node) => renderNode(node, nodeMap)).join("") || `<p class="empty-map">No deeper nodes were found in the bounded history window.</p>`}</div></div>`;
}

function renderBoardFreshness(board: ProjectContextBoardProjection): string {
  const state = board.freshness.state;
  const projectErrors = board.projects.filter((project) => project.error).length;
  const error = board.freshness.error || projectErrors > 0 ? " · some bounded reads unavailable; cached projections remain scoped" : "";
  return `<footer class="freshness board-freshness" data-freshness="${escapeAttr(state)}"><span>Context source ${escapeHtml(state)}</span><span>${board.discoveryCoverage.sectionTasksRead} bounded source tasks read</span><span>${board.discoveryCoverage.sectionTruncated ? "Discovery window truncated" : "Discovery window complete"}</span><span>${escapeHtml(error)}</span></footer>`;
}

function countStatuses(snapshot: ProjectContextSnapshot): Record<ProjectContextStatus, number> {
  const counts: Record<ProjectContextStatus, number> = { now: 0, later: 0, blocked: 0, watching: 0, done: 0 };
  for (const node of snapshot.nodes) counts[node.status] += 1;
  return counts;
}

function primaryStatus(counts: Record<ProjectContextStatus, number>): ProjectContextStatus | null {
  for (const status of ["blocked", "watching", "now", "later", "done"] as const) {
    if (counts[status] > 0) return status;
  }
  return null;
}

function renderStatusCount(counts: Record<ProjectContextStatus, number>, status: ProjectContextStatus): string {
  return counts[status] > 0 ? `<span class="status-count status-count-${status}">${counts[status]} ${STATUS_LABEL[status]}</span>` : "";
}

export function renderSnapshot(snapshot: ProjectContextSnapshot): string {
  const root: ProjectContextRootSummary = {
    id: snapshot.id,
    title: snapshot.title,
    url: snapshot.url,
    goal: snapshot.goal,
    goalStatus: snapshot.goalStatus
  };
  const project: ProjectContextBoardProject = {
    root,
    snapshot,
    detail: null,
    freshness: { state: "fresh", updatedAt: new Date().toISOString(), ageMs: 0, refreshing: false, error: null },
    detailFreshness: null,
    error: null
  };
  return `<section class="project-summary">
    <div class="eyebrow">PROJECT CONTEXT V1 · READ ONLY</div>
    <h1>${escapeHtml(snapshot.title)}</h1>
    <p class="goal">${snapshot.goal ? escapeHtml(snapshot.goal) : "Goal not configured"}</p>
    ${snapshot.nextCheckpoint ? `<p class="checkpoint"><span>Next checkpoint</span> ${escapeHtml(snapshot.nextCheckpoint)}</p>` : ""}
    <a class="canonical-link" href="${escapeAttr(snapshot.url)}" target="_blank" rel="noreferrer">Open canonical root in Todoist ↗</a>
  </section>
  ${renderContextGraphPlane([project], new Set(), false)}`;
}

function renderNode(node: ProjectContextNode, nodes: ReadonlyMap<string, ProjectContextNode>): string {
  const predecessors = node.predecessorIds.length > 0
    ? `<div class="lineage"><span>Context predecessors</span>${node.predecessorIds.map((id) => `<a href="${escapeAttr(nodes.get(id)?.url ?? taskUrl(id))}" target="_blank" rel="noreferrer">${escapeHtml(nodes.get(id)?.title ?? id)}</a>`).join("")}</div>`
    : "";
  const legacyDetail = node.status === "blocked" && node.blocker
    ? `<p class="detail"><strong>Blocker:</strong> ${escapeHtml(node.blocker)}</p>`
    : node.status === "watching" && node.resume
      ? `<p class="detail"><strong>Resume:</strong> ${escapeHtml(node.resume)}</p>`
      : node.checkpoint
        ? `<p class="detail"><strong>Checkpoint:</strong> ${escapeHtml(node.checkpoint)}</p>`
        : "";
  const detail = node.attention ? renderAttentionDetails(node.attention) : legacyDetail;
  return `<article class="node" data-status="${escapeAttr(node.status)}">
    <div class="node-top"><span class="status status-${escapeAttr(node.status)}">${STATUS_LABEL[node.status]}</span><a class="node-title" href="${escapeAttr(node.url)}" target="_blank" rel="noreferrer">${escapeHtml(node.title)} ↗</a></div>
    <p class="node-summary">${escapeHtml(node.summary)}</p>
    ${detail}${predecessors}
  </article>`;
}

function renderAttentionDetails(attention: NonNullable<ProjectContextNode["attention"]>): string {
  const fields = [
    ["Blocked on", attention.blockedOn],
    ["Why worker cannot decide", attention.whyWorkerCannotDecide],
    ["Decision owner", attention.decisionOwner],
    ["Recommended safe/default path", attention.recommendation],
    ["Alternatives", attention.alternatives],
    ["Safe state preserved", attention.safeState],
    ["Independent work completed", attention.independentWork],
    ["Resume condition", attention.resumeCondition],
    ["Evidence/provenance", attention.evidence]
  ] as const;
  const rendered = fields
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<p class="detail"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value!)}</p>`)
    .join("");
  return rendered ? `<div class="attention-detail" data-attention-detail="${escapeAttr(attention.kind)}">${rendered}<p class="attention-note">Presentation-only context; no approval or authority inferred.</p></div>` : "";
}

function renderProjectNavigation(selection: ProjectContextSelectionProjection): string {
  const options = selection.roots.map((root) => `<option value="${escapeAttr(root.id)}"${root.id === selection.snapshot.id ? " selected" : ""}>${escapeHtml(root.title)}</option>`).join("");
  return `<div class="project-picker"><label for="project-select">Project</label><select id="project-select">${options}</select></div>`;
}

function renderFreshness(
  discovery: ProjectContextFreshness,
  snapshot: ProjectContextFreshness,
  coverage: ProjectContextSelectionProjection["discoveryCoverage"]
): string {
  const state = snapshot.state === "fresh" && discovery.state === "fresh" ? "fresh" : snapshot.state === "expired" || discovery.state === "expired" ? "expired" : "stale";
  const error = snapshot.error || discovery.error ? " · provider read failed; showing bounded cache where available" : "";
  return `<footer class="freshness" data-freshness="${state}"><span>Source ${state}</span><span>Updated ${escapeHtml(formatAge(snapshot.ageMs))}</span><span>${coverage.sectionTasksRead} section tasks read${coverage.sectionTruncated ? " · bounded" : ""}</span><span>${escapeHtml(error)}</span></footer>`;
}

function taskUrl(id: string): string {
  return `https://app.todoist.com/app/task/${encodeURIComponent(id)}`;
}

function formatAge(ageMs: number): string {
  if (ageMs < 1_000) return "just now";
  const seconds = Math.floor(ageMs / 1_000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
