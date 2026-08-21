import type { ProjectContextFreshness, ProjectContextSelectionProjection, ProjectContextSnapshot } from "./model.js";

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
