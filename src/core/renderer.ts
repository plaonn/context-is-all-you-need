import type {
  ProjectContextBand,
  ProjectContextBoardProjection,
  ProjectContextBoardProject,
  ProjectContextContext,
  ProjectContextFreshness,
  ProjectContextLineageEdge,
  ProjectContextNode,
  ProjectContextObjective,
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

const BAND_LABEL: Record<ProjectContextBand, string> = {
  before: "Recent context",
  now: "NOW",
  after: "Next / resume"
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
  const projects = board.projects.map((project) => renderBoardProject(project, expandedProjectIds.has(project.root.id))).join("");
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
      <p>Project columns share a stable NOW band; explicit objectives and contextual lineage explain the next useful continuation.</p>
    </div>
    <div class="board-summary" aria-label="Context summary">
      <strong>${projectCount}</strong><span>projects</span>
      ${failedCount > 0 ? `<strong class="summary-alert">${failedCount}</strong><span>partial reads</span>` : ""}
    </div>
  </section>
  <section class="project-matrix" aria-label="Projects in ${escapeAttr(board.context.label)}">
    <div class="matrix-scroll">
      <div class="matrix-orientation" aria-label="Board orientation"><strong>Project columns</strong><span>Recent context above · shared <b>NOW</b> band · next or resume below</span></div>
      <div class="matrix-now-axis" aria-label="Shared NOW axis"><strong>NOW</strong><span>Current, blocked, and watching context aligns across the project columns.</span></div>
      <div class="project-columns">
        ${projects || `<section class="message"><p>No project dashboard roots were found in this Context's bounded source window.</p></section>`}
      </div>
    </div>
  </section>
  ${renderBoardFreshness(board)}
  <p class="lineage-note">Objective regions and explicit Context Predecessors are presentation-only context; Todoist remains the canonical task and lifecycle source.</p>`;
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

function renderBoardProject(project: ProjectContextBoardProject, expanded: boolean): string {
  const snapshot = project.snapshot;
  if (!snapshot) {
    return `<article class="project-column project-column-error" data-project-id="${escapeAttr(project.root.id)}">
      <header class="project-column-header"><div><p class="project-kicker">PROJECT COLUMN</p><h2>${escapeHtml(project.root.title)}</h2><p class="project-goal">Project snapshot unavailable in the bounded read.</p></div><a class="canonical-link" href="${escapeAttr(project.root.url)}" target="_blank" rel="noreferrer">Open ↗</a></header>
      ${renderUnavailableBand("before", "Recent context unavailable")}
      ${renderUnavailableBand("now", "NOW · project read unavailable")}
      ${renderUnavailableBand("after", "Next / resume unavailable")}
      <footer class="project-column-footer"><p class="project-error">This project could not be read in the bounded window. Other project columns remain available.</p></footer>
    </article>`;
  }
  const statusCounts = countStatuses(snapshot);
  const focus = primaryStatus(statusCounts);
  const detail = expanded && project.detail
    ? renderExpandedProject(project.detail)
    : expanded
      ? `<div class="project-detail project-detail-loading"><p>Loading bounded project history and details…</p></div>`
      : "";
  return `<article class="project-column" data-project-id="${escapeAttr(project.root.id)}">
    <header class="project-column-header">
      <div class="project-heading-row"><div><p class="project-kicker">PROJECT COLUMN</p><h2>${escapeHtml(snapshot.title)}</h2><p class="project-goal">${snapshot.goal ? escapeHtml(snapshot.goal) : "Goal not configured"}</p></div><a class="canonical-link" href="${escapeAttr(snapshot.url)}" target="_blank" rel="noreferrer">Open ↗</a></div>
      <div class="project-state" aria-label="Project state">
        ${focus ? `<span class="state-focus state-${escapeAttr(focus)}">${STATUS_LABEL[focus]} focus</span>` : ""}
        ${renderStatusCount(statusCounts, "now")} ${renderStatusCount(statusCounts, "blocked")} ${renderStatusCount(statusCounts, "watching")} ${renderStatusCount(statusCounts, "later")} ${renderStatusCount(statusCounts, "done")}
      </div>
      ${snapshot.attention ? renderCompactAttention(snapshot.attention) : ""}
    </header>
    ${renderProjectBand(snapshot, "before")}
    ${renderProjectBand(snapshot, "now")}
    ${renderProjectBand(snapshot, "after")}
    <footer class="project-column-footer">
      ${renderLineageEdges(snapshot)}
      <div class="project-card-actions"><button type="button" data-project-expand="${escapeAttr(snapshot.id)}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "Hide history & details" : project.detail ? "Show history & details" : "Load history & details"}</button>${project.error ? `<span class="project-error-inline">Some reads are stale or unavailable.</span>` : ""}</div>
      ${detail}
    </footer>
  </article>`;
}

function renderUnavailableBand(band: ProjectContextBand, message: string): string {
  return `<section class="project-graph-band project-band-${band}" data-band="${band}"${band === "now" ? ` data-shared-axis="now"` : ""}><div class="band-caption"><strong>${BAND_LABEL[band]}</strong><small>${band === "now" ? "Shared comparison band" : "Bounded context"}</small></div><p class="band-empty">${escapeHtml(message)}</p></section>`;
}

function renderProjectBand(snapshot: ProjectContextSnapshot, band: ProjectContextBand): string {
  const nodes = snapshot.nodes.filter((node) => node.contextBand === band);
  const description = band === "before" ? "Bounded recent predecessor context" : band === "now" ? "Current, blocked, or watching state" : "Immediate next, resume, or checkpoint context";
  if (nodes.length === 0) {
    return `<section class="project-graph-band project-band-${band}" data-band="${band}"${band === "now" ? ` data-shared-axis="now"` : ""}>
      <div class="band-caption"><strong>${BAND_LABEL[band]}</strong><small>${description}</small></div>
      <p class="band-empty">No salient nodes in this bounded band.</p>
    </section>`;
  }
  const layout = buildGraphBandLayout(snapshot, nodes);
  const nodeMap = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const edgePaths = snapshot.lineageEdges
    .filter((edge) => layout.positions.has(edge.to))
    .map((edge) => renderGraphEdgePath(edge, layout, snapshot))
    .join("");
  return `<section class="project-graph-band project-band-${band}" data-band="${band}"${band === "now" ? ` data-shared-axis="now"` : ""}>
    <div class="band-caption"><strong>${BAND_LABEL[band]}</strong><small>${description}</small></div>
    <div class="graph-band-canvas" style="--graph-height: ${layout.height}px">
      <svg class="graph-edge-layer" viewBox="0 0 100 ${layout.height}" preserveAspectRatio="none" aria-hidden="true" data-lineage-source="Context Predecessors">
        ${edgePaths}
      </svg>
      <div class="graph-band-nodes">${layout.groups.map((group) => renderGraphGroup(group, layout, nodeMap)).join("")}</div>
    </div>
  </section>`;
}

type GraphGroup = {
  objective: ProjectContextObjective | null;
  nodes: ProjectContextNode[];
  startY: number;
  rows: number;
  positions: Map<string, GraphPosition>;
};

type GraphPosition = {
  column: 1 | 2 | 3;
  x: number;
  y: number;
  row: number;
};

type GraphBandLayout = {
  height: number;
  groups: GraphGroup[];
  positions: Map<string, GraphPosition>;
};

function buildGraphBandLayout(snapshot: ProjectContextSnapshot, nodes: ProjectContextNode[]): GraphBandLayout {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const groups: Array<{ objective: ProjectContextObjective | null; nodes: ProjectContextNode[] }> = snapshot.objectives
    .map((objective) => ({ objective, nodes: nodes.filter((node) => node.objectiveId === objective.id) }))
    .filter((group) => group.nodes.length > 0);
  const groupedIds = new Set(groups.flatMap((group) => group.nodes.map((node) => node.id)));
  const ungrouped = nodes.filter((node) => !groupedIds.has(node.id));
  if (ungrouped.length > 0) groups.push({ objective: null, nodes: ungrouped });

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of snapshot.lineageEdges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
  }

  const positions = new Map<string, GraphPosition>();
  const renderedGroups: GraphGroup[] = [];
  let y = 0;
  for (const group of groups) {
    const groupIds = new Set(group.nodes.map((node) => node.id));
    const remaining = new Set(group.nodes.map((node) => node.id));
    const orderedNodes: ProjectContextNode[] = [];
    while (remaining.size > 0) {
      const next = group.nodes.find((node) => remaining.has(node.id) && (incoming.get(node.id) ?? []).filter((id) => groupIds.has(id)).every((id) => !remaining.has(id)))
        ?? group.nodes.find((node) => remaining.has(node.id));
      if (!next) break;
      orderedNodes.push(next);
      remaining.delete(next.id);
    }
    const rowById = new Map<string, number>();
    let nextRow = 0;
    for (const node of orderedNodes) {
      const predecessors = (incoming.get(node.id) ?? []).filter((id) => groupIds.has(id));
      const predecessorRows = predecessors.map((id) => rowById.get(id)).filter((row): row is number => row !== undefined);
      const branchPredecessor = predecessors.find((id) => (outgoing.get(id) ?? []).length > 1);
      const row = branchPredecessor && rowById.has(branchPredecessor)
        ? rowById.get(branchPredecessor)! + 1
        : predecessorRows.length > 0
          ? Math.max(...predecessorRows) + 1
          : nextRow;
      rowById.set(node.id, row);
      nextRow = Math.max(nextRow, row + 1);
    }
    const rows = rowById.size > 0 ? Math.max(...rowById.values()) + 1 : 1;
    const groupPositions = new Map<string, GraphPosition>();
    for (const node of group.nodes) {
      const predecessors = (incoming.get(node.id) ?? []).filter((id) => groupIds.has(id));
      const branchPredecessor = predecessors.find((id) => (outgoing.get(id) ?? []).length > 1);
      const siblings = branchPredecessor ? outgoing.get(branchPredecessor)!.filter((id) => groupIds.has(id)) : [];
      const siblingIndex = branchPredecessor ? siblings.indexOf(node.id) : -1;
      const column: 1 | 2 | 3 = siblingIndex >= 0
        ? siblingIndex === 0 ? 1 : siblingIndex === siblings.length - 1 ? 3 : 2
        : 2;
      const position: GraphPosition = {
        column,
        x: column === 1 ? 18 : column === 3 ? 82 : 50,
        y: y + 40 + (rowById.get(node.id) ?? 0) * 100,
        row: rowById.get(node.id) ?? 0
      };
      groupPositions.set(node.id, position);
      positions.set(node.id, position);
    }
    renderedGroups.push({ ...group, startY: y, rows, positions: groupPositions });
    y += 42 + rows * 84 + 12;
  }

  return { height: Math.max(104, y - 12), groups: renderedGroups, positions };
}

function renderGraphGroup(
  group: GraphGroup,
  layout: GraphBandLayout,
  nodes: ReadonlyMap<string, ProjectContextNode>
): string {
  const objective = group.objective;
  const heading = objective
    ? `<div class="objective-region-heading"><span>OBJECTIVE</span><strong>${escapeHtml(objective.label)}</strong><small>${objective.nodeIds.length} node${objective.nodeIds.length === 1 ? "" : "s"}</small></div>`
    : `<div class="objective-region-heading objective-unassigned-heading"><span>LINEAGE</span><strong>Ungrouped explicit context</strong><small>${group.nodes.length} node${group.nodes.length === 1 ? "" : "s"}</small></div>`;
  const className = objective ? `objective-region objective-${escapeAttr(objective.attention)}` : "objective-unassigned";
  const id = objective?.id ?? "unassigned";
  const members = group.nodes
    .map((node) => renderGraphNode(node, nodes, layout.positions.get(node.id)!))
    .join("");
  return `<section class="${className}" data-objective-id="${escapeAttr(id)}">
    ${heading}
    <div class="objective-region-nodes">${members}</div>
    <span class="objective-note">${objective ? "Presentation grouping; task lifecycle remains canonical." : "No Objective inferred from layout or task prose."}</span>
  </section>`;
}

function renderGraphNode(node: ProjectContextNode, nodes: ReadonlyMap<string, ProjectContextNode>, position: GraphPosition): string {
  const predecessorLinks = node.predecessorIds
    .map((id) => `<a href="https://app.todoist.com/app/task/${encodeURIComponent(id)}" target="_blank" rel="noreferrer">${escapeHtml(nodes.get(id)?.title ?? id)}</a>`)
    .join("");
  const objective = node.objectiveLabel ? `<span class="node-objective">${escapeHtml(node.objectiveLabel)}</span>` : "";
  const recovery = node.attention?.salience === "high"
    ? `<span class="node-recovery">${node.attention.decisionOwner ? `Owner: ${escapeHtml(node.attention.decisionOwner)}` : node.attention.recommendation ? `Next: ${escapeHtml(node.attention.recommendation)}` : "Material attention"}</span>`
    : "";
  return `<article class="graph-node graph-node-${escapeAttr(node.status)}" data-node-id="${escapeAttr(node.id)}" data-status="${escapeAttr(node.status)}" data-context-band="${escapeAttr(node.contextBand)}" data-graph-column="${position.column}" data-graph-row="${position.row}" style="grid-column: ${position.column}; grid-row: ${position.row + 1}">
    <div class="node-top"><span class="status status-${escapeAttr(node.status)}">${STATUS_LABEL[node.status]}</span>${objective}<a class="map-node-title" href="${escapeAttr(node.url)}" target="_blank" rel="noreferrer">${escapeHtml(node.title)} ↗</a></div>
    <p class="node-summary">${escapeHtml(node.summary)}</p>
    ${recovery}${node.checkpoint ? `<span class="map-node-next">${escapeHtml(node.checkpoint)}</span>` : ""}
    ${predecessorLinks ? `<span class="map-node-lineage"><span>Explicit predecessor${node.predecessorIds.length === 1 ? "" : "s"}</span>${predecessorLinks}</span>` : ""}
  </article>`;
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
  return `<details class="explicit-lineage" aria-label="Accessible explicit contextual lineage"><summary><strong>Explicit lineage</strong><span>Context Predecessors only · presentation-only</span></summary>${edges ? `<ul class="lineage-edge-list">${edges}</ul>` : `<p class="lineage-empty">No explicit branch or merge edge in the bounded source window.</p>`}</details>`;
}

function renderGraphEdgePath(edge: ProjectContextLineageEdge, layout: GraphBandLayout, snapshot: ProjectContextSnapshot): string {
  const target = layout.positions.get(edge.to);
  if (!target) return "";
  const source = layout.positions.get(edge.from);
  const fromX = source?.x ?? 50;
  const fromY = source?.y ?? 4;
  const toX = target.x;
  const toY = target.y;
  const outgoing = snapshot.lineageEdges.filter((candidate) => candidate.from === edge.from).length;
  const incoming = snapshot.lineageEdges.filter((candidate) => candidate.to === edge.to).length;
  const branch = outgoing > 1;
  const merge = incoming > 1;
  const kind = [branch ? "branch" : "", merge ? "merge" : ""].filter(Boolean).join("-") || "link";
  const curve = Math.max(14, Math.abs(toY - fromY) * .42);
  const path = `M ${fromX} ${fromY} C ${fromX} ${fromY + curve}, ${toX} ${toY - curve}, ${toX} ${toY}`;
  return `<path class="graph-edge-path graph-edge-${kind}" data-edge-from="${escapeAttr(edge.from)}" data-edge-to="${escapeAttr(edge.to)}" d="${path}" vector-effect="non-scaling-stroke"/>`;
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
  const nodeMap = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return `<section class="project-summary">
    <div class="eyebrow">PROJECT CONTEXT V1 · READ ONLY</div>
    <h1>${escapeHtml(snapshot.title)}</h1>
    <p class="goal">${snapshot.goal ? escapeHtml(snapshot.goal) : "Goal not configured"}</p>
    ${snapshot.nextCheckpoint ? `<p class="checkpoint"><span>Next checkpoint</span> ${escapeHtml(snapshot.nextCheckpoint)}</p>` : ""}
    ${snapshot.attention ? renderCompactAttention(snapshot.attention) : ""}
    <a class="canonical-link" href="${escapeAttr(snapshot.url)}" target="_blank" rel="noreferrer">Open canonical root in Todoist ↗</a>
  </section>
  <section class="project-single-graph" aria-label="Project context graph">
    ${renderProjectBand(snapshot, "before")}${renderProjectBand(snapshot, "now")}${renderProjectBand(snapshot, "after")}
    ${renderLineageEdges(snapshot)}
    <div class="detail-nodes">${snapshot.nodes.map((node) => renderNode(node, nodeMap)).join("") || `<section class="message"><p>No salient project nodes were found in the bounded source window.</p></section>`}</div>
  </section>`;
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

function renderCompactAttention(attention: NonNullable<ProjectContextSnapshot["attention"]>): string {
  const watching = attention.salience === "low";
  const next = attention.recommendation ?? attention.resumeCondition;
  const extraCount = attention.attentionCount > 1 ? `<span class="attention-count">+${attention.attentionCount - 1} more</span>` : "";
  const label = attention.kind === "watching" ? "Watching" : attention.kind === "decision" ? "Decision" : "Blocked";
  return `<aside class="project-attention project-attention-${watching ? "low" : "high"}" data-attention="${escapeAttr(attention.kind)}">
    <div class="attention-heading"><strong>${watching ? "Passive watching" : "Material attention"}</strong><span>${label}</span>${extraCount}</div>
    <a class="attention-title" href="${escapeAttr(attention.url)}" target="_blank" rel="noreferrer">${escapeHtml(attention.title)} ↗</a>
    ${attention.blockedOn ? `<p><strong>Where:</strong> ${escapeHtml(attention.blockedOn)}</p>` : ""}
    ${attention.whyWorkerCannotDecide ? `<p><strong>Why:</strong> ${escapeHtml(attention.whyWorkerCannotDecide)}</p>` : ""}
    ${attention.decisionOwner ? `<p><strong>Decision owner:</strong> ${escapeHtml(attention.decisionOwner)}</p>` : ""}
    ${next ? `<p><strong>${watching ? "Resume" : "Next"}:</strong> ${escapeHtml(next)}</p>` : ""}
    ${watching && !next ? `<p class="attention-muted">Resume condition not stated.</p>` : ""}
    <span class="attention-note">Presentation-only context; no approval or authority inferred.</span>
  </aside>`;
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
