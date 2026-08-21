import type {
  ProjectContextBoardProjection,
  ProjectContextBoardProject,
  ProjectContextContext,
  ProjectContextFreshness,
  ProjectContextSelectionProjection,
  ProjectContextSnapshot,
  ProjectContextStatus
} from "./model.js";

const STATUS_LABEL: Record<string, string> = {
  now: "Now",
  later: "Later",
  blocked: "Blocked",
  watching: "Watching",
  done: "Done"
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
      <p>Parallel project roots, connected workstream progression, and the next useful continuation.</p>
    </div>
    <div class="board-summary" aria-label="Context summary">
      <strong>${projectCount}</strong><span>projects</span>
      ${failedCount > 0 ? `<strong class="summary-alert">${failedCount}</strong><span>partial reads</span>` : ""}
    </div>
  </section>
  <section class="project-grid" aria-label="Projects in ${escapeAttr(board.context.label)}">
    ${projects || `<section class="message"><p>No project dashboard roots were found in this Context's bounded source window.</p></section>`}
  </section>
  ${renderBoardFreshness(board)}
  <p class="lineage-note">Workstream connectors and predecessor links are presentation-only context; Todoist remains the canonical task and lifecycle source.</p>`;
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
  const title = project.root.title;
  if (!snapshot) {
    return `<article class="project-card project-card-error" data-project-id="${escapeAttr(project.root.id)}">
      <header class="project-card-header"><div><p class="project-kicker">PROJECT ROOT</p><h2>${escapeHtml(title)}</h2></div><a class="canonical-link" href="${escapeAttr(project.root.url)}" target="_blank" rel="noreferrer">Open ↗</a></header>
      <p class="project-error">This project could not be read in the bounded window. Other projects remain available.</p>
    </article>`;
  }
  const statusCounts = countStatuses(snapshot);
  const attention = primaryStatus(statusCounts);
  const map = snapshot.lanes.map(renderMapLane).join("");
  const detail = expanded && project.detail
    ? renderExpandedProject(project.detail)
    : expanded
      ? `<div class="project-detail project-detail-loading"><p>Loading bounded project history and details…</p></div>`
      : "";
  return `<article class="project-card" data-project-id="${escapeAttr(project.root.id)}">
    <header class="project-card-header">
      <div><p class="project-kicker">PROJECT ROOT</p><h2>${escapeHtml(snapshot.title)}</h2><p class="project-goal">${snapshot.goal ? escapeHtml(snapshot.goal) : "Goal not configured"}</p></div>
      <a class="canonical-link" href="${escapeAttr(snapshot.url)}" target="_blank" rel="noreferrer">Open ↗</a>
    </header>
    <div class="project-state" aria-label="Project state">
      ${attention ? `<span class="state-focus state-${escapeAttr(attention)}">${STATUS_LABEL[attention]} focus</span>` : ""}
      ${renderStatusCount(statusCounts, "now")} ${renderStatusCount(statusCounts, "blocked")} ${renderStatusCount(statusCounts, "watching")} ${renderStatusCount(statusCounts, "later")} ${renderStatusCount(statusCounts, "done")}
    </div>
    <div class="workstream-map" aria-label="Presentation-only connected workstream map">
      ${map || `<p class="empty-map">No configured workstream nodes in the compact source window.</p>`}
    </div>
    <div class="project-card-actions"><button type="button" data-project-expand="${escapeAttr(snapshot.id)}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "Hide history & details" : project.detail ? "Show history & details" : "Load history & details"}</button>${project.error ? `<span class="project-error-inline">Some reads are stale or unavailable.</span>` : ""}</div>
    ${detail}
  </article>`;
}

function renderMapLane(lane: ProjectContextSnapshot["lanes"][number]): string {
  const nodes = lane.nodes.map((node, index) => `${index > 0 ? `<span class="map-connector" aria-hidden="true"></span>` : ""}${renderMapNode(node)}`).join("");
  return `<section class="workstream-lane" data-workstream="${escapeAttr(lane.id)}"><header><h3>${escapeHtml(lane.label)}</h3><span>${lane.nodes.length}</span></header><div class="workstream-track">${nodes}</div></section>`;
}

function renderMapNode(node: ProjectContextSnapshot["lanes"][number]["nodes"][number]): string {
  const predecessorLinks = node.predecessorIds.map((id) => `<a href="https://app.todoist.com/app/task/${encodeURIComponent(id)}" target="_blank" rel="noreferrer">${escapeHtml(id)}</a>`).join("");
  return `<article class="map-node map-node-${escapeAttr(node.status)}" data-status="${escapeAttr(node.status)}"><span class="status status-${escapeAttr(node.status)}">${STATUS_LABEL[node.status]}</span><a class="map-node-title" href="${escapeAttr(node.url)}" target="_blank" rel="noreferrer">${escapeHtml(node.title)} ↗</a>${node.checkpoint ? `<span class="map-node-next">${escapeHtml(node.checkpoint)}</span>` : ""}${predecessorLinks ? `<span class="map-node-lineage">From ${predecessorLinks}</span>` : ""}</article>`;
}

function renderExpandedProject(snapshot: ProjectContextSnapshot): string {
  const lanes = snapshot.lanes.map((lane) => `<section class="detail-lane"><h3>${escapeHtml(lane.label)}</h3><div class="detail-lane-nodes">${lane.nodes.map(renderNode).join("")}</div></section>`).join("");
  return `<div class="project-detail"><div class="detail-heading"><strong>Bounded deep detail</strong><span>${snapshot.coverage.completedTasksRead} recent completed tasks read · ${snapshot.coverage.completedTruncated ? "window truncated" : "window complete"}</span></div>${lanes || `<p class="empty-map">No deeper nodes were found in the bounded history window.</p>`}</div>`;
}

function renderBoardFreshness(board: ProjectContextBoardProjection): string {
  const state = board.freshness.state;
  const projectErrors = board.projects.filter((project) => project.error).length;
  const error = board.freshness.error || projectErrors > 0 ? " · some bounded reads unavailable; cached projections remain scoped" : "";
  return `<footer class="freshness board-freshness" data-freshness="${escapeAttr(state)}"><span>Context source ${escapeHtml(state)}</span><span>${board.discoveryCoverage.sectionTasksRead} bounded source tasks read</span><span>${board.discoveryCoverage.sectionTruncated ? "Discovery window truncated" : "Discovery window complete"}</span><span>${escapeHtml(error)}</span></footer>`;
}

function countStatuses(snapshot: ProjectContextSnapshot): Record<ProjectContextStatus, number> {
  const counts: Record<ProjectContextStatus, number> = { now: 0, later: 0, blocked: 0, watching: 0, done: 0 };
  for (const node of snapshot.lanes.flatMap((lane) => lane.nodes)) counts[node.status] += 1;
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
  const lanes = snapshot.lanes.map((lane) => `
    <section class="lane" data-workstream="${escapeAttr(lane.id)}">
      <header class="lane-header"><h2>${escapeHtml(lane.label)}</h2><span>${lane.nodes.length} nodes</span></header>
      <div class="lane-nodes">${lane.nodes.map(renderNode).join("")}</div>
    </section>`).join("");
  return `<section class="project-summary">
    <div class="eyebrow">PROJECT CONTEXT V1 · READ ONLY</div>
    <h1>${escapeHtml(snapshot.title)}</h1>
    <p class="goal">${snapshot.goal ? escapeHtml(snapshot.goal) : "Goal not configured"}</p>
    ${snapshot.nextCheckpoint ? `<p class="checkpoint"><span>Next checkpoint</span> ${escapeHtml(snapshot.nextCheckpoint)}</p>` : ""}
    <a class="canonical-link" href="${escapeAttr(snapshot.url)}" target="_blank" rel="noreferrer">Open canonical root in Todoist ↗</a>
  </section>
  <div class="lanes">${lanes || `<section class="message"><p>No salient project nodes were found in the bounded source window.</p></section>`}</div>`;
}

function renderNode(node: ProjectContextSnapshot["lanes"][number]["nodes"][number]): string {
  const predecessors = node.predecessorIds.length > 0
    ? `<div class="lineage"><span>Context predecessors</span>${node.predecessorIds.map((id) => `<a href="https://app.todoist.com/app/task/${encodeURIComponent(id)}" target="_blank" rel="noreferrer">${escapeHtml(id)}</a>`).join("")}</div>`
    : "";
  const detail = node.status === "blocked" && node.blocker
    ? `<p class="detail"><strong>Blocker:</strong> ${escapeHtml(node.blocker)}</p>`
    : node.status === "watching" && node.resume
      ? `<p class="detail"><strong>Resume:</strong> ${escapeHtml(node.resume)}</p>`
      : node.checkpoint
        ? `<p class="detail"><strong>Checkpoint:</strong> ${escapeHtml(node.checkpoint)}</p>`
        : "";
  return `<article class="node" data-status="${escapeAttr(node.status)}">
    <div class="node-top"><span class="status status-${escapeAttr(node.status)}">${STATUS_LABEL[node.status]}</span><a class="node-title" href="${escapeAttr(node.url)}" target="_blank" rel="noreferrer">${escapeHtml(node.title)} ↗</a></div>
    <p class="node-summary">${escapeHtml(node.summary)}</p>
    ${detail}${predecessors}
  </article>`;
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
